import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AdminButton, AdminButtonRow, AdminChip, AdminField, AdminMessage, AdminSection, parseBahtToCents } from '@/components/admin-ui';
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
import { parseCsv, photoNameKey, rowsFromTable, TEMPLATE_CSV, type ImportGender, type SheetRow } from '@/utils/sheet-import';
import { readXlsx } from '@/utils/xlsx';
import { AdminDateField } from '@/components/admin-date-field';
import { thaiToday } from '@/utils/stat-range';

const GENDER_LABEL = { FEMALE: '여성', MALE: '남성' } as const;
const STATUS_LABEL = { new: '새로 등록', exists: '이미 등록돼 있음(새로 안 만듦)', error: '고쳐야 함' } as const;
const GENDERS: { value: ImportGender; label: string }[] = [
  { value: 'FEMALE', label: '여' },
  { value: 'MALE', label: '남' },
  { value: null, label: '지정 안 함' },
];

let nextKey = 0;
const newKey = () => `k${nextKey++}`;

/** 새로 등록할 아티스트 한 줄. partners = 엑셀 "CP 짝" 중 화면에서 못 찾은 이름(서버가 다시 찾거나 오류로 알려 줌) */
type EditRow = { key: string; legalName: string; chatDisplayName: string; gender: ImportGender; partners: string[]; warnings: string[] };
/** CP방 멤버 — 이번에 넣는 줄 또는 이미 등록된 아티스트 */
type Member = { kind: 'row'; key: string } | { kind: 'actor'; id: string; name: string };
type CpEntry = { key: string; members: [Member | null, Member | null] };

const emptyRow = (): EditRow => ({ key: newKey(), legalName: '', chatDisplayName: '', gender: null, partners: [], warnings: [] });

/** 자주 하는 등록 — 누르면 아래 칸이 그 모양으로(2026-10-20 사용자 피드백 "어떻게 해야 하는지 이해가 안 감") */
const SCENARIOS: { label: string; hint: string; build: () => { rows: EditRow[]; cps: CpEntry[] } }[] = [
  { label: '아티스트만', hint: '개인방만 — 한 명이든 여러 명이든', build: () => ({ rows: [emptyRow()], cps: [] }) },
  {
    label: '새 CP 한 쌍',
    hint: 'A·B 개인방 + A&B CP방',
    build: () => {
      const rows = [emptyRow(), emptyRow()];
      return { rows, cps: [{ key: newKey(), members: [{ kind: 'row', key: rows[0].key }, { kind: 'row', key: rows[1].key }] }] };
    },
  },
  {
    label: '새 아티스트 + 기존 아티스트로 CP',
    hint: '새 사람 개인방 + 이미 있는 사람과 CP방',
    build: () => {
      const rows = [emptyRow()];
      return { rows, cps: [{ key: newKey(), members: [{ kind: 'row', key: rows[0].key }, null] }] };
    },
  },
  { label: '기존 두 아티스트로 CP만', hint: '이미 있는 두 사람의 CP방만', build: () => ({ rows: [], cps: [{ key: newKey(), members: [null, null] }] }) },
];

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * 아티스트·CP 등록 — "방"을 만드는 화면 하나(2026-10-20 사용자 결정). 예전 한 명 등록·CP방 만들기·일괄 등록을 합침. 묶음(패키지 상품)은
 * 성격이 달라서(방을 할인가로 파는 상품) 묶음 상품 화면에 따로 — 등록이 끝나면 새 CP마다 [패키지 만들기]로 이어 줌.
 * ① 무엇을 등록하나요(자주 하는 모양 버튼) ② 소속사·구독료·공개 시각 ③ 새 아티스트 줄(직접 입력 — 폰에서도, PC 웹은 엑셀로 채우기도)
 * ④ CP방(멤버를 골라서 — 이번에 넣는 사람 또는 이미 등록된 사람) ⑤ "등록하면 만들어지는 것" 요약 → 미리보기(서버가 검사) → 한 번에 등록
 * (하나라도 틀리면 아무것도 안 만듦) ⑥ 계정 연결 링크·패키지 만들기. 사진 묶어 올리기는 PC 웹(아래).
 */
export default function AdminImportActorsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: agencies } = useAdminAgencies();
  const { data: allActors } = useAdminActors('');
  const importActors = useImportActors();
  const issueLinks = useIssueActorLinks();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [couplePrice, setCouplePrice] = useState('');
  const [release, setRelease] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<EditRow[]>(() => SCENARIOS[0].build().rows);
  const [cps, setCps] = useState<CpEntry[]>([]);
  const [scenario, setScenario] = useState(0);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [created, setCreated] = useState<ImportResult['created']>(null);
  const [links, setLinks] = useState<IssuedLinks | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // 무엇이든 바꾸면 미리보기를 지움 — 미리보기와 다른 내용이 등록되지 않게
  const touch = () => {
    setPlan(null);
    setCreated(null);
    setLinks(null);
    setMessage(null);
  };
  const editRow = (key: string, patch: Partial<EditRow>) => {
    touch();
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const removeRow = (key: string) => {
    touch();
    setRows((list) => list.filter((row) => row.key !== key));
    // 그 줄을 멤버로 고른 CP방은 칸을 비움
    setCps((list) => list.map((cp) => ({ ...cp, members: cp.members.map((m) => (m?.kind === 'row' && m.key === key ? null : m)) as CpEntry['members'] })));
  };
  const setMember = (cpKey: string, slot: 0 | 1, member: Member | null) => {
    touch();
    setCps((list) => list.map((cp) => (cp.key === cpKey ? { ...cp, members: (slot === 0 ? [member, cp.members[1]] : [cp.members[0], member]) as CpEntry['members'] } : cp)));
  };
  const setting =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      touch();
      setter(value);
    };
  const applyScenario = (index: number) => {
    touch();
    const next = SCENARIOS[index].build();
    setScenario(index);
    setRows(next.rows);
    setCps(next.cps);
    setFileName(null);
    setIgnored([]);
  };

  const filledRows = rows.filter((row) => row.legalName.trim());
  const rowName = (key: string) => rows.find((row) => row.key === key)?.legalName.trim() || '';
  const memberName = (member: Member | null) => (!member ? '' : member.kind === 'row' ? rowName(member.key) : member.name);
  const hasCouple = cps.length > 0 || filledRows.some((row) => row.partners.length > 0);

  /** 입력값 → 서버 요청(미리보기·등록 공통). 고칠 게 있으면 문구 */
  const buildInput = (dryRun: boolean) => {
    const index = new Map(filledRows.map((row, i) => [row.key, i]));
    if (filledRows.length === 0 && cps.length === 0) return '등록할 아티스트나 CP방을 넣어 주세요.';
    if (rows.some((row) => !row.legalName.trim() && (row.chatDisplayName.trim() || cps.some((cp) => cp.members.some((m) => m?.kind === 'row' && m.key === row.key))))) {
      return '영문 이름이 빈 줄이 있어요.';
    }
    const couples = [];
    for (const [n, cp] of cps.entries()) {
      if (!cp.members[0] || !cp.members[1]) return `${n + 1}번째 CP방의 멤버 두 명을 골라 주세요.`;
      couples.push({ members: cp.members.map((m) => (m!.kind === 'row' ? { row: index.get(m!.key)! } : { actorId: m!.id })) });
    }
    const monthlyPriceCents = filledRows.length > 0 ? parseBahtToCents(price) : (parseBahtToCents(price) ?? 0);
    if (monthlyPriceCents === null) return '개인방 월 구독료를 숫자로 넣어 주세요(예: 149).';
    const couplePriceCents = hasCouple ? parseBahtToCents(couplePrice) : (parseBahtToCents(couplePrice) ?? 0);
    if (couplePriceCents === null) return 'CP방 월 구독료를 숫자로 넣어 주세요(예: 199).';
    const releaseAt = release.trim() ? parseBangkokDateTime(release) : null;
    if (release.trim() && !releaseAt) return '공개 시각을 다시 골라 주세요(태국 시간).';
    return {
      agencyId: agencyId ?? undefined,
      monthlyPriceCents,
      couplePriceCents,
      releaseAt,
      dryRun,
      rows: filledRows.map((row) => ({ legalName: row.legalName, chatDisplayName: row.chatDisplayName.trim() || undefined, gender: row.gender, partners: row.partners })),
      couples,
    };
  };

  const preview = () => {
    const input = buildInput(true);
    if (typeof input === 'string') return setMessage({ text: input, error: true });
    importActors.mutate(input, {
      onSuccess: (result) => {
        setPlan(result.plan);
        setMessage(null);
      },
      onError: (e) => setMessage({ text: errorText(e, '미리보기를 만들지 못했어요.'), error: true }),
    });
  };

  // 엑셀·CSV — 줄을 채우고, "CP 짝"은 파일 안 사람이면 CP방 칸으로 옮김(이미 등록된 사람 이름은 서버가 찾음)
  const pickSheet = async () => {
    const [file] = await pickWebFiles('.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', false);
    if (!file) return;
    touch();
    try {
      const table = file.name.toLowerCase().endsWith('.csv') ? parseCsv(await file.text()) : await readXlsx(await file.arrayBuffer());
      const parsed = rowsFromTable(table);
      if (!parsed) return setMessage({ text: '"영문 이름"(English name) 칸을 찾지 못했어요. 양식의 첫 줄 칸 이름을 확인해 주세요.', error: true });
      if (parsed.rows.length === 0) return setMessage({ text: '등록할 줄이 없어요.', error: true });
      const nextRows = parsed.rows.map((row: SheetRow) => ({ ...emptyRow(), legalName: row.legalName, chatDisplayName: row.chatDisplayName ?? '', gender: row.gender, warnings: row.warnings }));
      const byName = new Map(nextRows.map((row) => [row.legalName.trim().toLowerCase(), row.key]));
      const pairs = new Set<string>();
      const nextCps: CpEntry[] = [];
      parsed.rows.forEach((sheetRow, i) => {
        for (const partner of sheetRow.partners) {
          const other = byName.get(partner.trim().toLowerCase());
          if (!other) {
            nextRows[i].partners.push(partner);
            continue;
          }
          const pairKey = [nextRows[i].key, other].sort().join('|');
          if (other === nextRows[i].key || pairs.has(pairKey)) continue;
          pairs.add(pairKey);
          nextCps.push({ key: newKey(), members: [{ kind: 'row', key: nextRows[i].key }, { kind: 'row', key: other }] });
        }
      });
      setFileName(file.name);
      setRows(nextRows);
      setCps(nextCps);
      setScenario(-1);
      setIgnored(parsed.ignoredColumns);
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
        const made = result.created;
        setMessage({ text: `아티스트 ${made?.actors.length ?? 0}명, CP방 ${made?.couples.length ?? 0}개를 등록했어요.` });
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

  // 등록하면 만들어지는 것(미리보기 전, 화면 입력만으로) — 이름이 비었으면 "(이름)"
  const cpNames = cps.map((cp) => cp.members.map((m) => memberName(m) || '(고르기)') as [string, string]);
  const summary = [
    filledRows.length ? `개인방 ${filledRows.length}개: ${filledRows.map((row) => row.legalName.trim()).join(', ')}` : null,
    cps.length ? `CP방 ${cps.length}개: ${cpNames.map(([x, y]) => `${x} & ${y}`).join(', ')}` : null,
  ].filter((line): line is string => !!line);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AdminSection title="① 무엇을 등록하나요?" hint="누르면 아래 칸이 그 모양으로 바뀌어요. 섞어서도 돼요 — 줄과 CP방은 아래에서 더하고 뺄 수 있어요.">
          <ThemedView style={styles.scenarios}>
            {SCENARIOS.map((item, index) => (
              <Pressable
                key={item.label}
                onPress={() => applyScenario(index)}
                accessibilityRole="button"
                style={[styles.scenario, { borderColor: scenario === index ? theme.tint : theme.backgroundSelected, backgroundColor: scenario === index ? theme.tintSoft : theme.background }]}>
                <ThemedText type="smallBold">{item.label}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {item.hint}
                </ThemedText>
              </Pressable>
            ))}
            {canUseWebFiles ? (
              <Pressable
                onPress={() => void pickSheet()}
                accessibilityRole="button"
                style={[styles.scenario, { borderColor: scenario === -1 ? theme.tint : theme.backgroundSelected, backgroundColor: scenario === -1 ? theme.tintSoft : theme.background }]}>
                <ThemedText type="smallBold">엑셀·CSV로 여러 명</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {fileName ? `지금: ${fileName}(다시 누르면 다른 파일)` : '소속사 표를 올리면 아래가 채워져요(CP 짝 칸 → CP방)'}
                </ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>
          {canUseWebFiles ? <AdminChip label="엑셀 양식 받기(CSV)" onPress={() => downloadText('toffee-artists-template.csv', TEMPLATE_CSV)} /> : null}
          {ignored.length > 0 ? <AdminMessage text={`파일에서 읽지 않은 칸: ${ignored.join(', ')}(태국어 이름·생년월일 등은 저장하지 않아요)`} /> : null}
        </AdminSection>

        <AdminSection title="② 소속사·구독료·공개 시각" hint="이번에 새로 만드는 개인방·CP방 전체에 적용돼요. 나중에 하나씩 상세 화면에서 바꿀 수 있어요.">
          <ThemedView style={styles.chips}>
            <AdminChip label="무소속" selected={agencyId === null} onPress={() => setting(setAgencyId)(null)} />
            {agencies?.map((agency) => (
              <AdminChip key={agency.id} label={agency.name} selected={agencyId === agency.id} onPress={() => setting(setAgencyId)(agency.id)} />
            ))}
          </ThemedView>
          <ThemedView style={styles.fieldRow}>
            {filledRows.length > 0 || rows.length > 0 ? (
              <ThemedView style={styles.fieldCell}>
                <AdminField label="개인방 월 구독료(바트)" value={price} onChangeText={setting(setPrice)} keyboardType="decimal-pad" placeholder="예: 149" />
              </ThemedView>
            ) : null}
            {hasCouple ? (
              <ThemedView style={styles.fieldCell}>
                <AdminField label="CP방 월 구독료(바트)" value={couplePrice} onChangeText={setting(setCouplePrice)} keyboardType="decimal-pad" placeholder="예: 199" />
              </ThemedView>
            ) : null}
            <ThemedView style={styles.fieldCell}>
              <AdminDateField label="공개 시각(태국 시간, 비우면 바로 공개)" value={release} onChange={setting(setRelease)} withTime min={thaiToday()} clearable />
            </ThemedView>
          </ThemedView>
        </AdminSection>

        <AdminSection title={`③ 새로 등록할 아티스트 (${filledRows.length}명)`} hint="한 줄 = 한 명(개인방 하나). 이미 등록된 사람은 여기 적지 말고 ④에서 골라요.">
          {rows.length === 0 ? <AdminMessage text="새로 등록할 아티스트가 없어요(이미 있는 사람끼리 CP방만 만들 때)." /> : null}
          {rows.map((row, index) => (
            <ThemedView key={row.key} style={[styles.editRow, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rowNumber}>
                {String.fromCharCode(65 + (index % 26))}
              </ThemedText>
              <TextInput
                value={row.legalName}
                onChangeText={(legalName) => editRow(row.key, { legalName })}
                placeholder="영문 이름(필수)"
                placeholderTextColor={theme.textTertiary}
                style={[styles.cellInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
              <TextInput
                value={row.chatDisplayName}
                onChangeText={(chatDisplayName) => editRow(row.key, { chatDisplayName })}
                placeholder="닉네임(비우면 영문 이름)"
                placeholderTextColor={theme.textTertiary}
                style={[styles.cellInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
              <ThemedView style={styles.chips}>
                {GENDERS.map((option) => (
                  <AdminChip key={option.label} label={option.label} selected={row.gender === option.value} onPress={() => editRow(row.key, { gender: option.value })} />
                ))}
                <AdminChip label="빼기" danger onPress={() => removeRow(row.key)} />
              </ThemedView>
              {row.partners.length ? (
                <ThemedText type="caption" themeColor="textSecondary" style={styles.fullWidth}>
                  엑셀 CP 짝(이미 등록된 사람으로 찾음): {row.partners.join(', ')}
                </ThemedText>
              ) : null}
            </ThemedView>
          ))}
          <AdminButtonRow>
            <AdminButton
              secondary
              label="+ 아티스트 한 명 더"
              onPress={() => {
                touch();
                setRows((list) => [...list, emptyRow()]);
              }}
            />
          </AdminButtonRow>
        </AdminSection>

        <AdminSection title={`④ CP방 (${cps.length}개)`} hint="CP방마다 멤버 두 명을 골라요 — ③에 적은 사람이나 이미 등록된 사람. 개인방만 등록하면 비워 두세요.">
          {cps.map((cp, n) => (
            <ThemedView key={cp.key} style={[styles.editRow, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" style={styles.fullWidth}>
                CP방 {n + 1}: {cpNames[n][0]} & {cpNames[n][1]}
              </ThemedText>
              {([0, 1] as const).map((slot) => (
                <MemberPicker
                  key={slot}
                  label={`멤버 ${slot + 1}`}
                  value={cp.members[slot]}
                  nameOf={memberName}
                  rows={rows}
                  actors={allActors ?? []}
                  onChange={(member) => setMember(cp.key, slot, member)}
                />
              ))}
              <AdminChip
                label="이 CP방 빼기"
                danger
                onPress={() => {
                  touch();
                  setCps((list) => list.filter((item) => item.key !== cp.key));
                }}
              />
            </ThemedView>
          ))}
          <AdminButtonRow>
            <AdminButton
              secondary
              label="+ CP방 추가"
              onPress={() => {
                touch();
                setCps((list) => [...list, { key: newKey(), members: [null, null] }]);
              }}
            />
          </AdminButtonRow>
        </AdminSection>

        <AdminSection title="⑤ 확인하고 등록" hint="미리보기를 누르면 서버가 검사해요. 빨간 줄이 하나라도 있으면 아무것도 등록되지 않아요.">
          <ThemedView style={[styles.summary, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">등록하면 만들어지는 것</ThemedText>
            {summary.length ? (
              summary.map((line) => (
                <ThemedText key={line} type="small">
                  · {line}
                </ThemedText>
              ))
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                아직 없어요 — 위에서 이름을 넣거나 CP방 멤버를 골라 주세요.
              </ThemedText>
            )}
          </ThemedView>
          <AdminButtonRow>
            <AdminButton secondary label={importActors.isPending && !plan ? '검사하는 중…' : '미리보기(검사)'} disabled={importActors.isPending} onPress={preview} />
          </AdminButtonRow>
          {plan ? (
            <ThemedView style={styles.table}>
              {plan.rows.map((row) => (
                <ThemedView key={row.index} style={[styles.planRow, { borderColor: row.status === 'error' ? theme.danger : theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={row.status === 'error' ? { color: theme.danger } : row.status === 'exists' ? { color: theme.textSecondary } : undefined}>
                    {row.legalName || '(이름 없음)'} — {STATUS_LABEL[row.status]}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    닉네임 {row.chatDisplayName || '-'} · {row.gender ? GENDER_LABEL[row.gender] : '성별 지정 안 함'}
                  </ThemedText>
                  {[...row.errors, ...(filledRows[row.index]?.warnings ?? [])].map((text) => (
                    <ThemedText key={text} type="small" style={{ color: row.errors.includes(text) ? theme.danger : theme.textSecondary }}>
                      · {text}
                    </ThemedText>
                  ))}
                </ThemedView>
              ))}
              {plan.coupleErrors.map((text) => (
                <AdminMessage key={text} text={text} error />
              ))}
              {plan.couples.map((couple) => (
                <ThemedView key={couple.legalName} style={[styles.planRow, { borderColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold">
                    CP방 {couple.legalName} — {couple.status === 'exists' ? '이미 있음(건너뜀)' : '새로 만듦'}
                  </ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          ) : null}
          <AdminMessage text={message?.text ?? null} error={message?.error} />
          {plan && !created ? (
            <AdminButton
              label={importActors.isPending ? '처리 중…' : `등록 — 아티스트 ${newCount}명 · CP방 ${newCouples}개`}
              disabled={importActors.isPending || plan.errorCount > 0 || newCount + newCouples === 0}
              onPress={submit}
            />
          ) : null}
        </AdminSection>

        {created ? (
          <AdminSection
            title="⑥ 다음 할 일 — 계정 연결 링크·패키지"
            hint="아이디·비밀번호는 만들지 않아요. 링크를 소속사 담당자에게 보내면 아티스트가 각자 열어 평소 쓰는 계정(Google·Apple·LINE 등)으로 로그인해 연결해요. 1회용이고 14일 뒤 만료돼요(새로 만들면 예전 링크는 무효).">
            {links ? (
              <>
                <ThemedText type="small" selectable>
                  {linksText}
                </ThemedText>
                <AdminButton label="링크 전체 복사" onPress={() => copyText(linksText)} />
              </>
            ) : created.actors.length ? (
              <AdminButton label={issueLinks.isPending ? '만드는 중…' : `연결 링크 ${created.actors.length}개 만들기`} disabled={issueLinks.isPending} onPress={makeLinks} />
            ) : null}
            {/* 묶음(패키지)은 묶음 상품 화면에서 — 새 CP마다 바로 이어 줌(그 CP가 골라진 채로) */}
            {created.couples.length ? (
              <AdminButtonRow>
                {created.couples.map((room) => (
                  <AdminButton key={room.id} label={`${room.legalName} 패키지(묶음 3개) 만들기`} onPress={() => router.push({ pathname: '/admin/bundles/cp-set', params: { roomId: room.id } })} />
                ))}
              </AdminButtonRow>
            ) : null}
            <AdminButtonRow>
              <AdminButton secondary label="아티스트 목록으로" onPress={() => router.replace('/admin/actors')} />
            </AdminButtonRow>
          </AdminSection>
        ) : null}

        {canUseWebFiles ? <PhotoBatch agencyId={agencyId} /> : <AdminMessage text="사진 묶어 올리기는 PC 웹에서 돼요. 앱에선 아티스트 상세 화면에서 한 명씩 올려요." />}
      </ScrollView>
    </SafeAreaView>
  );
}

/** CP방 멤버 한 칸 — 고른 사람 또는 [고르기]: ③에 적은 사람 + 이미 등록된 사람 검색 */
function MemberPicker({
  label,
  value,
  nameOf,
  rows,
  actors,
  onChange,
}: {
  label: string;
  value: Member | null;
  nameOf: (member: Member | null) => string;
  rows: EditRow[];
  actors: AdminActor[];
  onChange: (member: Member | null) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  if (value) {
    return (
      <ThemedView style={[styles.member, { borderColor: theme.tint }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold">
          {nameOf(value) || '(③에서 이름 입력)'} {value.kind === 'row' ? '· 새로 등록' : '· 이미 등록됨'}
        </ThemedText>
        <AdminChip label="바꾸기" onPress={() => onChange(null)} />
      </ThemedView>
    );
  }
  const needle = query.trim().toLowerCase();
  const found = needle
    ? actors
        .filter((actor) => actor.kind === 'SOLO' && !actor.retiredAt && [actor.legalName, actor.chatDisplayName, actor.agency?.name].some((text) => text?.toLowerCase().includes(needle)))
        .slice(0, 8)
    : [];
  return (
    <ThemedView style={[styles.member, { borderColor: theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label} 고르기
      </ThemedText>
      <ThemedView style={styles.chips}>
        {rows
          .filter((row) => row.legalName.trim())
          .map((row) => (
            <AdminChip key={row.key} label={`${row.legalName.trim()} (새로)`} onPress={() => onChange({ kind: 'row', key: row.key })} />
          ))}
      </ThemedView>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="이미 등록된 아티스트 검색(이름·소속사)"
        placeholderTextColor={theme.textTertiary}
        autoCapitalize="none"
        style={[styles.cellInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      <ThemedView style={styles.chips}>
        {found.map((actor) => (
          <AdminChip key={actor.id} label={`${actor.legalName} · ${actor.agency?.name ?? '무소속'}`} onPress={() => onChange({ kind: 'actor', id: actor.id, name: actor.legalName })} />
        ))}
        {needle && found.length === 0 ? (
          <ThemedText type="caption" themeColor="textSecondary">
            찾는 아티스트가 없어요.
          </ThemedText>
        ) : null}
      </ThemedView>
    </ThemedView>
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
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, backgroundColor: 'transparent' },
  fieldCell: { flexGrow: 1, flexBasis: 200, backgroundColor: 'transparent' },
  editRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 10, padding: Spacing.two, backgroundColor: 'transparent' },
  rowNumber: { width: 20, textAlign: 'center' },
  fullWidth: { width: '100%' },
  scenarios: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, backgroundColor: 'transparent' },
  scenario: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: 2 },
  member: { flexGrow: 1, flexBasis: 260, borderWidth: 1, borderRadius: 10, padding: Spacing.two, gap: Spacing.one, backgroundColor: 'transparent' },
  summary: { borderWidth: 1, borderRadius: 10, padding: Spacing.three, gap: 2 },
  cellInput: { flexGrow: 1, flexBasis: 160, borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.two, paddingVertical: 6, fontSize: 15 },
  planRow: { borderWidth: 1, borderRadius: 10, padding: Spacing.two, gap: 2, backgroundColor: 'transparent' },
});
