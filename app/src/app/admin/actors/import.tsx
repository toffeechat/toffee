import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AdminButton, AdminChip, AdminField, AdminMessage, AdminSection, parseBahtToCents } from '@/components/admin-ui';
import {
  useAdminActors,
  useAdminAgencies,
  useImportActors,
  useIssueActorLinks,
  type AdminActor,
  type ImportPlan,
  type ImportResult,
  type IssuedLinks,
} from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiClient } from '@/lib/api-client';
import { actorLinkUrl } from '@/lib/actor-link';
import { copyText } from '@/lib/copy-text';
import { uploadProfileImage } from '@/lib/upload-media';
import { canUseWebFiles, downloadText, pickWebFiles, shrinkPhoto } from '@/lib/web-files';
import { Spacing } from '@/constants/theme';
import { parseBangkokDateTime } from '@/utils/release';
import { parseCsv, photoNameKey, rowsFromTable, TEMPLATE_CSV, type SheetRow } from '@/utils/sheet-import';
import { readXlsx } from '@/utils/xlsx';

const GENDER_LABEL = { FEMALE: '여성', MALE: '남성' } as const;
const STATUS_LABEL = { new: '새로 등록', exists: '이미 있음(건너뜀)', error: '고쳐야 함' } as const;

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * 아티스트 일괄 등록(2026-10-19 사용자 결정, 1차) — 계약 후 소속사에서 받은 표(엑셀·CSV: 영문 이름·닉네임·성별·CP 짝)로 한 번에.
 * ① 양식 받기 → ② 소속사·구독료·공개 시각 고르고 파일 올리기 → ③ 미리보기(서버가 검사만) → ④ 등록(CP 짝이면 CP방도) →
 * ⑤ 연결 링크 한꺼번에 만들어 복사(소속사 담당자에게 전달). 사진은 아래 "사진 묶어 올리기"에서 파일 이름을 영문 이름에 맞춰서.
 * 파일을 다루는 일이라 PC 웹 전용.
 */
export default function AdminImportActorsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: agencies } = useAdminAgencies();
  const importActors = useImportActors();
  const issueLinks = useIssueActorLinks();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [couplePrice, setCouplePrice] = useState('');
  const [release, setRelease] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [created, setCreated] = useState<ImportResult['created']>(null);
  const [links, setLinks] = useState<IssuedLinks | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  if (!canUseWebFiles) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ThemedView style={styles.content}>
          <AdminMessage text="파일을 고르고 올리는 화면이라 PC 웹(브라우저)에서 열어 주세요." />
        </ThemedView>
      </SafeAreaView>
    );
  }

  /** 입력값 → 서버 요청(미리보기·등록 공통). 고칠 게 있으면 문구 */
  const buildInput = (dryRun: boolean, sheetRows: SheetRow[] | null = rows) => {
    const monthlyPriceCents = parseBahtToCents(price);
    const couplePriceCents = parseBahtToCents(couplePrice);
    if (monthlyPriceCents === null || couplePriceCents === null) return '개인방·CP방 월 구독료를 숫자로 넣어 주세요(예: 149).';
    const releaseAt = release.trim() ? parseBangkokDateTime(release) : null;
    if (release.trim() && !releaseAt) return '공개 시각은 "2026-11-01 20:00"처럼 넣어 주세요(태국 시간).';
    if (!sheetRows?.length) return '먼저 파일을 올려 주세요.';
    return {
      agencyId: agencyId ?? undefined,
      monthlyPriceCents,
      couplePriceCents,
      releaseAt,
      dryRun,
      rows: sheetRows.map(({ legalName, chatDisplayName, gender, partners }) => ({ legalName, chatDisplayName, gender, partners })),
    };
  };

  const preview = (nextRows: SheetRow[] | null = rows) => {
    if (!nextRows?.length) return;
    const input = buildInput(true, nextRows);
    if (typeof input === 'string') return setMessage({ text: input, error: true });
    importActors.mutate(input, {
      onSuccess: (result) => {
        setPlan(result.plan);
        setMessage(null);
      },
      onError: (e) => setMessage({ text: errorText(e, '미리보기를 만들지 못했어요.'), error: true }),
    });
  };

  const pickSheet = async () => {
    const [file] = await pickWebFiles('.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', false);
    if (!file) return;
    setCreated(null);
    setLinks(null);
    setPlan(null);
    try {
      const table = file.name.toLowerCase().endsWith('.csv') ? parseCsv(await file.text()) : await readXlsx(await file.arrayBuffer());
      const parsed = rowsFromTable(table);
      if (!parsed) return setMessage({ text: '"영문 이름"(English name) 칸을 찾지 못했어요. 양식의 첫 줄 칸 이름을 확인해 주세요.', error: true });
      if (parsed.rows.length === 0) return setMessage({ text: '등록할 줄이 없어요.', error: true });
      setFileName(file.name);
      setRows(parsed.rows);
      setIgnored(parsed.ignoredColumns);
      preview(parsed.rows);
    } catch (e) {
      setMessage({ text: `파일을 읽지 못했어요(${e instanceof Error ? e.message : '알 수 없는 오류'}). 엑셀(.xlsx)이나 CSV로 저장해 올려 주세요.`, error: true });
    }
  };

  const submit = () => {
    const input = buildInput(false);
    if (typeof input === 'string') return setMessage({ text: input, error: true });
    importActors.mutate(input, {
      onSuccess: (result) => {
        setPlan(result.plan);
        setCreated(result.created);
        setMessage({ text: `아티스트 ${result.created?.actors.length ?? 0}명, CP방 ${result.created?.couples.length ?? 0}개를 등록했어요.` });
      },
      onError: (e) => setMessage({ text: errorText(e, '등록하지 못했어요.'), error: true }),
    });
  };

  const makeLinks = () => {
    if (!created?.actors.length) return;
    issueLinks.mutate(
      created.actors.map((actor) => actor.id),
      { onSuccess: setLinks, onError: (e) => setMessage({ text: errorText(e, '연결 링크를 만들지 못했어요.'), error: true }) },
    );
  };
  const linksText = links?.links.map((link) => `${link.legalName}: ${actorLinkUrl(link.token)}`).join('\n') ?? '';
  const newCount = plan?.rows.filter((row) => row.status === 'new').length ?? 0;
  const newCouples = plan?.couples.filter((couple) => couple.status === 'new').length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdminSection
          title="① 양식"
          hint="칸: 영문 이름(필수) · 닉네임(비우면 영문 이름) · 성별(F/M, 여/남, หญิง/ชาย) · CP 짝(상대 영문 이름, 여럿이면 ;로). 소속사 표에 다른 칸(태국어 이름·생년월일·SNS 등)이 있어도 그 칸은 읽지 않아요. 사진은 표에 넣지 말고 아래에서 따로.">
          <AdminButton label="양식 받기(CSV)" onPress={() => downloadText('toffee-artists-template.csv', TEMPLATE_CSV)} />
        </AdminSection>

        <AdminSection title="② 소속사·구독료·공개 시각" hint="이번 파일 전체에 적용돼요. 구독료·공개 시각은 나중에 아티스트마다 상세 화면에서 바꿀 수 있어요.">
          <ThemedView style={styles.chips}>
            <AdminChip label="무소속" selected={agencyId === null} onPress={() => setAgencyId(null)} />
            {agencies?.map((agency) => (
              <AdminChip key={agency.id} label={agency.name} selected={agencyId === agency.id} onPress={() => setAgencyId(agency.id)} />
            ))}
          </ThemedView>
          <AdminField label="개인방 월 구독료(바트)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="예: 149" />
          <AdminField label="CP방 월 구독료(바트)" value={couplePrice} onChangeText={setCouplePrice} keyboardType="decimal-pad" placeholder="예: 199" />
          <AdminField
            label="공개 시각(태국 시간, 비우면 바로 공개)"
            value={release}
            onChangeText={setRelease}
            placeholder="2026-11-01 20:00"
            autoCapitalize="none"
          />
        </AdminSection>

        <AdminSection title="③ 파일 올리기 → 미리보기" hint="저장하기 전에 서버가 줄마다 검사해요. 같은 소속사에 같은 영문 이름이 있으면 건너뛰고(CP 짝으로는 써요), 빨간 줄이 하나라도 있으면 등록되지 않아요.">
          <AdminButton label={fileName ? `다른 파일 고르기(지금: ${fileName})` : '엑셀·CSV 파일 고르기'} onPress={() => void pickSheet()} />
          {rows ? <AdminChip label="설정을 바꿨으면 미리보기 다시" disabled={importActors.isPending} onPress={() => preview()} /> : null}
          {ignored.length > 0 ? <AdminMessage text={`읽지 않은 칸: ${ignored.join(', ')}`} /> : null}
          {plan ? (
            <ThemedView style={styles.table}>
              {plan.rows.map((row) => (
                <ThemedView key={row.index} style={[styles.planRow, { borderColor: row.status === 'error' ? theme.danger : theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={row.status === 'error' ? { color: theme.danger } : row.status === 'exists' ? { color: theme.textSecondary } : undefined}>
                    {row.index + 1}. {row.legalName || '(이름 없음)'} — {STATUS_LABEL[row.status]}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    닉네임 {row.chatDisplayName || '-'} · {row.gender ? GENDER_LABEL[row.gender] : '성별 지정 안 함'}
                    {row.partners.length ? ` · CP ${row.partners.join(', ')}` : ''}
                  </ThemedText>
                  {[...row.errors, ...(rows?.[row.index]?.warnings ?? [])].map((text) => (
                    <ThemedText key={text} type="small" style={{ color: row.errors.includes(text) ? theme.danger : theme.textSecondary }}>
                      · {text}
                    </ThemedText>
                  ))}
                </ThemedView>
              ))}
              {plan.couples.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  CP방: {plan.couples.map((couple) => `${couple.legalName}${couple.status === 'exists' ? '(이미 있음)' : ''}`).join(', ')}
                </ThemedText>
              ) : null}
            </ThemedView>
          ) : null}
        </AdminSection>

        <AdminMessage text={message?.text ?? null} error={message?.error} />

        {plan && !created ? (
          <AdminButton
            label={importActors.isPending ? '처리 중…' : `④ 등록 — 아티스트 ${newCount}명, CP방 ${newCouples}개`}
            disabled={importActors.isPending || plan.errorCount > 0 || newCount + newCouples === 0}
            onPress={submit}
          />
        ) : null}

        {created ? (
          <AdminSection
            title="⑤ 계정 연결 링크"
            hint="아이디·비밀번호는 만들지 않아요. 링크를 소속사 담당자에게 보내면 아티스트가 각자 열어 평소 쓰는 계정(Google·Apple·LINE 등)으로 로그인해 연결해요. 1회용이고 14일 뒤 만료돼요(새로 만들면 예전 링크는 무효).">
            {links ? (
              <>
                <ThemedText type="small" selectable>
                  {linksText}
                </ThemedText>
                <AdminButton label="링크 전체 복사" onPress={() => copyText(linksText)} />
              </>
            ) : (
              <AdminButton label={issueLinks.isPending ? '만드는 중…' : `연결 링크 ${created.actors.length}개 만들기`} disabled={issueLinks.isPending || created.actors.length === 0} onPress={makeLinks} />
            )}
            <AdminChip label="아티스트 목록으로" onPress={() => router.replace('/admin/actors')} />
          </AdminSection>
        ) : null}

        <PhotoBatch agencyId={agencyId} />
      </ScrollView>
    </SafeAreaView>
  );
}

type PhotoMatch = { file: File; actor: AdminActor | null; reason?: string };

/**
 * 사진 묶어 올리기 — 사진 파일 이름을 아티스트 영문 이름(CP방은 방 공식 이름, 예: "Bright & Win")에 맞춰 공식 사진으로. 대소문자·밑줄·하이픈
 * 무시("Bright_Vachirawit.jpg" = "Bright Vachirawit"). 같은 이름이 여러 소속사에 있으면 위에서 고른 소속사 쪽. 큰 사진은 줄여서 올림.
 * 대화방 사진이 비어 있으면 공식 사진이 같이 들어감(기존 규칙). 소속사 직원이 앱에서 아티스트별로 바꾸는 것도 그대로 됨.
 */
function PhotoBatch({ agencyId }: { agencyId: string | null }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data: actors } = useAdminActors('');
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);

  const byName = useMemo(() => {
    const map = new Map<string, AdminActor[]>();
    for (const actor of actors ?? []) {
      const key = photoNameKey(actor.legalName);
      map.set(key, [...(map.get(key) ?? []), actor]);
    }
    return map;
  }, [actors]);

  const pick = async () => {
    const files = await pickWebFiles('image/*', true);
    if (files.length === 0) return;
    setFailed([]);
    setProgress(null);
    setMatches(
      files.map((file) => {
        const found = byName.get(photoNameKey(file.name)) ?? [];
        const preferred = found.length > 1 ? found.filter((actor) => actor.agency?.id === agencyId) : found;
        if (preferred.length === 1) return { file, actor: preferred[0] };
        return { file, actor: null, reason: found.length > 1 ? '같은 이름이 여러 명(위에서 소속사를 고르세요)' : '맞는 아티스트 없음' };
      }),
    );
  };

  const upload = async () => {
    const targets = matches.filter((match) => match.actor);
    const errors: string[] = [];
    for (const [index, match] of targets.entries()) {
      setProgress(`${index + 1} / ${targets.length} 올리는 중…`);
      try {
        const photo = await shrinkPhoto(match.file);
        const key = await uploadProfileImage('ACTOR', match.actor!.id, photo.uri, photo.contentType);
        await apiClient.patch(`/admin/actors/${match.actor!.id}/images`, { officialProfileImageKey: key });
      } catch (e) {
        errors.push(`${match.file.name}: ${errorText(e, '올리지 못했어요')}`);
      }
    }
    setFailed(errors);
    setProgress(`${targets.length - errors.length}장 올렸어요.`);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'actors'] });
    void queryClient.invalidateQueries({ queryKey: ['actors'] });
  };

  const ready = matches.filter((match) => match.actor).length;
  return (
    <AdminSection
      title="사진 묶어 올리기(공식 사진)"
      hint='사진 파일 이름을 영문 이름과 같게 해서 여러 장을 한 번에 고르세요(예: "Bright.jpg", CP방은 "Bright & Win.jpg"). 이미 공식 사진이 있으면 바뀌어요. 정사각이 아니어도 돼요(화면에서 가운데를 맞춰 보여 줘요).'>
      <AdminButton label="사진 여러 장 고르기" onPress={() => void pick()} />
      {matches.map((match) => (
        <ThemedText key={match.file.name} type="small" style={{ color: match.actor ? theme.text : theme.danger }}>
          {match.file.name} → {match.actor ? `${match.actor.kind === 'COUPLE' ? '[CP] ' : ''}${match.actor.legalName}${match.actor.officialProfileImageUrl ? '(바꿈)' : ''}` : match.reason}
        </ThemedText>
      ))}
      {ready > 0 ? <AdminButton label={`맞는 사진 ${ready}장 올리기`} disabled={!!progress?.includes('중')} onPress={() => void upload()} /> : null}
      <AdminMessage text={progress} />
      {failed.map((text) => (
        <AdminMessage key={text} text={text} error />
      ))}
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, backgroundColor: 'transparent' },
  table: { gap: Spacing.two, backgroundColor: 'transparent' },
  planRow: { borderWidth: 1, borderRadius: 10, padding: Spacing.two, gap: 2, backgroundColor: 'transparent' },
});
