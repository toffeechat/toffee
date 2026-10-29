import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AdminAvatar,
  AdminButton,
  AdminButtonRow,
  AdminChip,
  AdminField,
  AdminLoadError,
  AdminMessage,
  AdminSection,
  formatBaht,
  GENDER_OPTIONS,
  parseBahtToCents,
  pickSquarePhoto,
} from '@/components/admin-ui';
import {
  useActorAgencyHistory,
  useAdminActor,
  useAdminBundles,
  useAdminAgencies,
  useAdminUsers,
  useAssignActorAgency,
  useClearActorStatusMessage,
  useIssueActorLinks,
  useLinkActorUser,
  useRevokeActorLink,
  useSetActorContractEnd,
  useSetActorRetired,
  useSetActorRetireAt,
  useUpdateActor,
  useUpdateActorImages,
  type AdminActor,
} from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { actorLinkUrl } from '@/lib/actor-link';
import { copyText } from '@/lib/copy-text';
import { ReleaseSection } from '@/components/admin-release';
import { uploadProfileImage } from '@/lib/upload-media';
import { Spacing } from '@/constants/theme';
import { STORE_PRODUCT_ID_PATTERN } from '@/utils/store-product';
import { formatBangkokDateTime, parseBangkokDateTime } from '@/utils/release';
import { thaiToday } from '@/utils/stat-range';
import { AdminDateField } from '@/components/admin-date-field';

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR');
}

type ImageField = 'officialProfileImageKey' | 'chatProfileImageKey';

function PhotoSlot({ actor, field, label }: { actor: AdminActor; field: ImageField; label: string }) {
  const updateImages = useUpdateActorImages(actor.id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const uri = field === 'officialProfileImageKey' ? actor.officialProfileImageUrl : actor.chatProfileImageUrl;

  const change = async () => {
    const picked = await pickSquarePhoto();
    if (!picked) return;
    setBusy(true);
    setMessage(null);
    try {
      const key = await uploadProfileImage('ACTOR', actor.id, picked.uri, picked.contentType);
      await updateImages.mutateAsync({ [field]: key });
    } catch (e) {
      setMessage(errorText(e, '사진을 올리지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm(`${label} 삭제`, '사진을 지우면 사람 모양 기본 이미지로 표시돼요.', '삭제', '취소'))) return;
    updateImages.mutate({ [field]: null }, { onError: (e) => setMessage(errorText(e, '삭제하지 못했어요.')) });
  };

  return (
    <ThemedView style={styles.photoSlot}>
      <AdminAvatar uri={uri} name={actor.legalName} size={88} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedView style={styles.chips}>
        <AdminChip label={busy ? '올리는 중…' : uri ? '바꾸기' : '올리기'} disabled={busy} onPress={change} />
        {uri ? <AdminChip label="삭제" danger disabled={busy} onPress={remove} /> : null}
      </ThemedView>
      <AdminMessage text={message} error />
    </ThemedView>
  );
}

function BasicInfo({ actor }: { actor: AdminActor }) {
  const updateActor = useUpdateActor(actor.id);
  const [legalName, setLegalName] = useState(actor.legalName);
  const [chatDisplayName, setChatDisplayName] = useState(actor.chatDisplayName);
  const [price, setPrice] = useState(String(actor.monthlyPriceCents / 100));
  const [productId, setProductId] = useState(actor.storeProductId ?? '');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const save = () => {
    const monthlyPriceCents = parseBahtToCents(price);
    const storeProductId = productId.trim() || null;
    if (!legalName.trim() || !chatDisplayName.trim()) return setMessage({ text: '이름을 비울 수 없어요.', error: true });
    if (monthlyPriceCents === null) return setMessage({ text: '월 구독료를 숫자로 입력해 주세요.', error: true });
    if (storeProductId && !STORE_PRODUCT_ID_PATTERN.test(storeProductId)) {
      return setMessage({ text: '스토어 상품 ID는 소문자·숫자·_·. 만 쓸 수 있어요(예: toffee.actor.nawin).', error: true });
    }
    updateActor.mutate(
      { legalName: legalName.trim(), chatDisplayName: chatDisplayName.trim(), monthlyPriceCents, storeProductId },
      {
        onSuccess: () => setMessage({ text: '저장했어요.' }),
        onError: (e) => setMessage({ text: errorText(e, '저장하지 못했어요.'), error: true }),
      },
    );
  };

  return (
    <AdminSection
      title="기본 정보"
      hint="구독료는 앱에 보이는 금액이에요 — 실제 결제 금액은 스토어에 등록한 상품 가격이 기준이라 같이 바꿔야 해요.">
      <AdminField label="공식 이름(실명·활동명)" value={legalName} onChangeText={setLegalName} maxLength={100} />
      <AdminField label="닉네임(아티스트가 직접 바꿀 수 있음)" value={chatDisplayName} onChangeText={setChatDisplayName} maxLength={20} />
      <AdminField label="월 구독료(바트)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <AdminField
        label="스토어 상품 ID(앱스토어·플레이스토어에 등록한 구독 상품, 등록 전엔 비워 두기)"
        value={productId}
        onChangeText={setProductId}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="예: toffee.actor.nawin"
        maxLength={100}
      />
      {actor.kind === 'SOLO' && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            성별(둘러보기 여성·남성 아티스트 줄, 누르면 바로 저장)
          </ThemedText>
          <ThemedView style={styles.chips}>
            {GENDER_OPTIONS.map((option) => (
              <AdminChip
                key={option.label}
                label={option.label}
                selected={actor.gender === option.value}
                disabled={updateActor.isPending}
                onPress={() => updateActor.mutate({ gender: option.value })}
              />
            ))}
          </ThemedView>
        </>
      )}
      <ThemedView style={styles.chips}>
        <AdminChip
          label={actor.verified ? '✓ 공식 인증됨' : '공식 인증 안 됨'}
          selected={actor.verified}
          disabled={updateActor.isPending}
          onPress={() => updateActor.mutate({ verified: !actor.verified })}
        />
      </ThemedView>
      <AdminMessage text={message?.text ?? null} error={message?.error} />
      <AdminButton label={updateActor.isPending ? '저장 중…' : '저장'} disabled={updateActor.isPending} onPress={save} />
    </AdminSection>
  );
}

function AgencySection({ actor }: { actor: AdminActor }) {
  const { data: agencies } = useAdminAgencies();
  const { data: history } = useActorAgencyHistory(actor.id);
  const assign = useAssignActorAgency(actor.id);
  const [message, setMessage] = useState<string | null>(null);
  const currentId = actor.agency?.id ?? null;

  const move = async (agencyId: string | null, name: string) => {
    if (agencyId === currentId) return;
    const ok = await confirm(
      '소속사 변경',
      `${actor.legalName} 아티스트를 "${name}"(으)로 옮길까요?\n이전 소속사는 이 아티스트의 메시지를 더 이상 볼 수 없고, 이적 기록이 남아요.`,
      '변경',
      '취소',
    );
    if (ok) assign.mutate(agencyId, { onError: (e) => setMessage(errorText(e, '변경하지 못했어요.')) });
  };

  return (
    <AdminSection title="소속사" hint="이적 기록은 정산·계약 확인용으로 남아요.">
      <ThemedView style={styles.chips}>
        <AdminChip label="무소속" selected={currentId === null} disabled={assign.isPending} onPress={() => move(null, '무소속')} />
        {agencies?.map((agency) => (
          <AdminChip
            key={agency.id}
            label={agency.name}
            selected={currentId === agency.id}
            disabled={assign.isPending}
            onPress={() => move(agency.id, agency.name)}
          />
        ))}
      </ThemedView>
      <AdminMessage text={message} error />
      {history && history.length > 0 ? (
        <ThemedView style={styles.history}>
          {history.map((entry) => (
            <ThemedText key={entry.id} type="small" themeColor="textSecondary">
              {entry.agency.name} · {formatDate(entry.startedAt)} ~ {entry.endedAt ? formatDate(entry.endedAt) : '현재'}
            </ThemedText>
          ))}
        </ThemedView>
      ) : null}
    </AdminSection>
  );
}

// 1회용 연결 링크(2026-10-19) — 아이디·비밀번호 대신. 아티스트가 링크를 열고 평소 쓰는 소셜 계정으로 로그인해 [연결하기]를 누르면 끝.
// 원문 링크는 만들 때 한 번만 보임(서버엔 해시만) — 잃어버리면 새로 만들면 되고, 새로 만들면 예전 링크는 바로 무효
function LinkInvite({ actor }: { actor: AdminActor }) {
  const issue = useIssueActorLinks();
  const revoke = useRevokeActorLink(actor.id);
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const make = async () => {
    if (actor.linkPendingUntil && !(await confirm('연결 링크 새로 만들기', '아직 안 쓴 링크가 있어요. 새로 만들면 예전 링크는 바로 쓸 수 없게 돼요.', '새로 만들기', '취소'))) return;
    issue.mutate([actor.id], {
      onSuccess: (result) => {
        const link = result.links[0];
        if (!link) return setMessage({ text: '이미 본인 계정이 연결된 아티스트예요.', error: true });
        setUrl(actorLinkUrl(link.token));
        setMessage({ text: `${formatDate(link.expiresAt)}까지 쓸 수 있어요. 소속사 담당자를 통해 아티스트에게 보내 주세요.` });
      },
      onError: (e) => setMessage({ text: errorText(e, '만들지 못했어요.'), error: true }),
    });
  };

  return (
    <ThemedView style={styles.linkBox}>
      <ThemedText type="small" themeColor="textSecondary">
        {actor.linkPendingUntil ? `보낸 링크가 아직 안 쓰였어요(${formatDate(actor.linkPendingUntil)}까지).` : '아티스트에게 1회용 연결 링크를 보내면 본인이 직접 계정을 붙여요.'}
      </ThemedText>
      {url ? (
        <ThemedView style={styles.linkedRow}>
          <ThemedText type="small" style={styles.flex} selectable>
            {url}
          </ThemedText>
          <AdminChip label="복사" onPress={() => copyText(`${actor.legalName}: ${url}`)} />
        </ThemedView>
      ) : null}
      <AdminMessage text={message?.text ?? null} error={message?.error} />
      <ThemedView style={styles.chips}>
        <AdminChip label={issue.isPending ? '만드는 중…' : actor.linkPendingUntil ? '연결 링크 새로 만들기' : '연결 링크 만들기'} disabled={issue.isPending} onPress={() => void make()} />
        {actor.linkPendingUntil ? (
          <AdminChip
            label="링크 취소"
            danger
            disabled={revoke.isPending}
            // 실패도 보여 줌(2026-10-29 — 예전엔 실패해도 아무 표시 없었음)
            onPress={() =>
              revoke.mutate(undefined, {
                onSuccess: () => (setUrl(null), setMessage({ text: '링크를 취소했어요.' })),
                onError: (e) => setMessage({ text: errorText(e, '취소하지 못했어요.'), error: true }),
              })
            }
          />
        ) : null}
      </ThemedView>
    </ThemedView>
  );
}

function SelfAccountSection({ actor }: { actor: AdminActor }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const { data: candidatePage } = useAdminUsers(query.trim(), 'ACTOR');
  const candidates = candidatePage?.items;
  const link = useLinkActorUser(actor.id);
  const [message, setMessage] = useState<string | null>(null);
  const onError = (e: unknown) => setMessage(errorText(e, '연결하지 못했어요.'));

  const unlink = async () => {
    if (await confirm('본인 계정 연결 해제', '해제하면 그 계정으로 메시지를 보낼 수 없어요.', '해제', '취소')) {
      link.mutate(null, { onError });
    }
  };

  return (
    <AdminSection
      title="본인 계정"
      hint="연결된 계정으로 로그인하면 스튜디오에서 이 아티스트로 메시지를 보내요. 보통은 연결 링크를 보내고, 아래 검색은 회원 관리에서 역할을 '아티스트'로 바꾼 계정을 직접 붙일 때만.">
      {actor.selfUser ? (
        <ThemedView style={styles.linkedRow}>
          <ThemedText type="small" style={styles.flex}>
            {actor.selfUser.displayName} · {actor.selfUser.email ?? '이메일 없음'}
          </ThemedText>
          <AdminChip label="연결 해제" danger disabled={link.isPending} onPress={unlink} />
        </ThemedView>
      ) : (
        <>
          <LinkInvite actor={actor} />
          <AdminField label="직접 연결 — 아티스트 계정 검색" value={query} onChangeText={setQuery} placeholder="이름 또는 이메일" />
          {candidates?.length ? (
            candidates.map((user) => (
              <ThemedView key={user.id} style={[styles.linkedRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small" style={styles.flex}>
                  {user.displayName} · {user.email ?? '이메일 없음'}
                  {user.actorSelf ? ` (${user.actorSelf.legalName}에 연결됨)` : ''}
                </ThemedText>
                <AdminChip
                  label="연결"
                  disabled={link.isPending || !!user.actorSelf}
                  onPress={() => link.mutate(user.id, { onError })}
                />
              </ThemedView>
            ))
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              아티스트 역할 계정이 없어요.
            </ThemedText>
          )}
        </>
      )}
      <AdminMessage text={message} error />
    </AdminSection>
  );
}

// 활동 종료(계약 종료·입대 등) — 둘러보기·검색에서 숨기고 신규 구독을 막음. 기존 구독 팬은 대화 유지 + 알림, 결제 후 14일 안이면 환불 요청 가능(잠정 정책). 작업 기록에 남음
/**
 * 활동 상태(2026-10-20: 종료 예정 추가) — ① 예정일을 정하면 그 순간 새 구독·묶음 판매가 막히고 팬 화면에 "N월 N일 활동 종료 예정", 구독 팬에게 미리 알림,
 * 그 시각에 자동 종료(사용자 결정) ② [지금 바로 종료] ③ 종료된 뒤 [활동 재개].
 * 종료되면: 둘러보기·검색에서 숨김, 새 구독 막힘, 기존 팬은 지난 대화를 계속 봄, 구독 팬에게 종료 알림, 결제 14일 안이면 환불 요청 가능, 든 CP방도 종료 취급.
 * 2026-10-21 B안: 예정 알림 뒤 종료 전에 된 결제는 14일 환불 대상 아님(서버 retireNoticedAt).
 */
function RetireSection({ actor }: { actor: AdminActor }) {
  const setRetired = useSetActorRetired(actor.id);
  const setRetireAt = useSetActorRetireAt(actor.id);
  const [when, setWhen] = useState(actor.retireAt ? formatBangkokDateTime(actor.retireAt) : '');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const busy = setRetired.isPending || setRetireAt.isPending;
  const onError = (e: unknown) => setMessage({ text: errorText(e, '바꾸지 못했어요.'), error: true });
  const effects = `지금 구독 중인 팬(${actor.activeSubscriberCount}명)은 지난 대화를 계속 볼 수 있고, 구독 팬에게 활동 종료 알림이 가요. 결제한 지 14일 안인 팬은 그 달 환불을 요청할 수 있어요(종료 예정 알림 뒤에 된 결제는 제외 — 14일 넘게 앞서 예정을 잡으면 이 환불은 거의 없어요). 구글 구독은 서버가 갱신을 자동으로 끊고, 애플 구독은 운영자 홈 "애플 판매 중지 할 일"에서 상품 판매 중지가 필요해요(종료 31일 전까지 권장).`;

  const retireNow = async () => {
    const ok = await confirm('지금 바로 활동 종료', `${actor.legalName} 아티스트를 지금 둘러보기·검색에서 숨기고 새 구독을 막을까요?\n\n${effects}`, '활동 종료', '취소');
    if (ok) setRetired.mutate(true, { onSuccess: () => setMessage({ text: '활동을 종료했어요.' }), onError });
  };
  const restore = async () => {
    if (await confirm('활동 재개', `${actor.legalName} 아티스트를 다시 둘러보기에 보이고 구독을 받을까요?`, '활동 재개', '취소')) {
      setRetired.mutate(false, { onSuccess: () => setMessage({ text: '활동을 재개했어요.' }), onError });
    }
  };
  const schedule = async () => {
    const iso = parseBangkokDateTime(when);
    if (!iso) return setMessage({ text: '종료 예정 날짜와 시각을 골라 주세요(태국 시간).', error: true });
    const ok = await confirm(
      '활동 종료 예정',
      `${actor.legalName} 아티스트를 ${when}(태국)에 활동 종료할까요?\n\n지금부터 새 구독·묶음 판매가 막히고, 팬 화면에 종료 예정일이 보이고, 구독 팬에게 미리 알림이 가요. 그 시각이 되면 자동으로 종료돼요.\n\n${effects}`,
      '예정 저장',
      '취소',
    );
    if (ok) setRetireAt.mutate(iso, { onSuccess: () => setMessage({ text: `${when}(태국)에 종료돼요. 지금부터 새 구독은 막혀 있어요.` }), onError });
  };
  const cancelSchedule = async () => {
    if (await confirm('종료 예정 취소', '종료 예정을 지우고 다시 새 구독을 받을까요?', '예정 취소', '취소')) {
      setRetireAt.mutate(null, { onSuccess: () => { setWhen(''); setMessage({ text: '종료 예정을 취소했어요. 다시 구독을 받아요.' }); }, onError });
    }
  };

  return (
    <AdminSection title="활동 상태" hint="계약이 끝나거나 활동을 멈출 때(입대도 종료 → 전역하면 재개). 미리 날짜를 정해 두면 그날 자동으로 종료돼요.">
      <ThemedText type="smallBold" themeColor={actor.retiredAt || actor.retireAt ? 'danger' : 'textSecondary'}>
        {actor.retiredAt
          ? `활동 종료됨 (${formatDate(actor.retiredAt)})`
          : actor.retireAt
            ? `${formatBangkokDateTime(actor.retireAt)}(태국) 활동 종료 예정 — 새 구독 막힘`
            : '활동 중'}
      </ThemedText>
      {actor.retiredAt ? (
        <AdminButtonRow>
          <AdminButton label={busy ? '바꾸는 중…' : '활동 재개'} disabled={busy} onPress={() => void restore()} />
        </AdminButtonRow>
      ) : (
        <>
          <AdminDateField label="종료 예정(태국 시간)" value={when} onChange={setWhen} withTime min={thaiToday()} />
          <AdminButtonRow>
            <AdminButton label={busy ? '저장 중…' : actor.retireAt ? '예정 바꾸기' : '종료 예정 저장'} disabled={busy || !when} onPress={() => void schedule()} />
            {actor.retireAt ? <AdminButton secondary label="예정 취소" disabled={busy} onPress={() => void cancelSchedule()} /> : null}
            <AdminButton secondary label="지금 바로 종료" disabled={busy} onPress={() => void retireNow()} />
          </AdminButtonRow>
        </>
      )}
      <AdminMessage text={message?.text ?? null} error={message?.error} />
    </AdminSection>
  );
}

const bangkokDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

/**
 * 계약 끝나는 날(2026-10-20) — 저장만 하고 자동 종료는 하지 않음(연장 협의 중일 수 있어서). 31일 전부터 운영자 홈 할 일 + 알림(메일·푸시).
 * [이 날짜로 종료 예정 잡기]는 그날 23:59(태국)로 활동 종료 예정을 잡음.
 */
function ContractSection({ actor }: { actor: AdminActor }) {
  const setContract = useSetActorContractEnd(actor.id);
  const setRetireAt = useSetActorRetireAt(actor.id);
  const [day, setDay] = useState(actor.contractEndAt ? bangkokDay(actor.contractEndAt) : '');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const busy = setContract.isPending || setRetireAt.isPending;
  const onError = (e: unknown) => setMessage({ text: errorText(e, '저장하지 못했어요.'), error: true });
  const saved = actor.contractEndAt ? bangkokDay(actor.contractEndAt) : '';
  // 화면을 연 시각 기준(렌더마다 시계를 읽지 않게)
  const [openedAt] = useState(() => Date.now());
  const daysLeft = actor.contractEndAt ? Math.ceil((new Date(actor.contractEndAt).getTime() - openedAt) / 86_400_000) : null;

  const save = (value: string) => {
    setDay(value);
    setContract.mutate(value ? `${value}T00:00:00+07:00` : null, {
      onSuccess: () => setMessage({ text: value ? `계약 끝나는 날을 ${value}로 저장했어요.` : '계약 끝나는 날을 지웠어요.' }),
      onError,
    });
  };
  const scheduleRetire = async () => {
    const ok = await confirm(
      '계약 끝나는 날로 종료 예정',
      `${actor.legalName} 아티스트를 ${saved} 23:59(태국)에 활동 종료할까요? 지금부터 새 구독·묶음 판매가 막히고 구독 팬에게 미리 알림이 가요.`,
      '예정 저장',
      '취소',
    );
    if (ok) setRetireAt.mutate(`${saved}T23:59:00+07:00`, { onSuccess: () => setMessage({ text: '활동 종료 예정을 잡았어요.' }), onError });
  };

  return (
    <AdminSection title="계약" hint="계약 끝나는 날을 적어 두면 31일 전부터 운영자 홈 할 일과 알림으로 알려 줘요. 날짜가 지나도 자동으로 종료하지는 않아요.">
      {daysLeft !== null && !actor.retiredAt ? (
        <ThemedText type="smallBold" themeColor={daysLeft <= 31 ? 'danger' : 'textSecondary'}>
          {daysLeft < 0 ? `계약이 ${-daysLeft}일 전에 끝났어요` : daysLeft === 0 ? '오늘 계약이 끝나요' : `계약 종료까지 ${daysLeft}일`}
        </ThemedText>
      ) : null}
      <AdminDateField label="계약 끝나는 날(태국)" value={day} onChange={save} clearable />
      {saved && !actor.retiredAt && !actor.retireAt && saved >= thaiToday() ? (
        <AdminButtonRow>
          <AdminButton secondary label="이 날짜로 종료 예정 잡기" disabled={busy} onPress={() => void scheduleRetire()} />
        </AdminButtonRow>
      ) : null}
      <AdminMessage text={message?.text ?? null} error={message?.error} />
    </AdminSection>
  );
}

/** 상태메시지(2026-10-25) — 아티스트 본인이 토피룸 설정에서 씀. 운영자는 신고·민원 대응으로 지우기만(작업 기록에 지운 문구가 남음) */
function StatusMessageSection({ actor }: { actor: AdminActor }) {
  const clear = useClearActorStatusMessage(actor.id);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const onClear = async () => {
    if (!(await confirm('상태메시지 지우기', `"${actor.statusMessage}"\n\n이 상태메시지를 지울까요? 아티스트는 다시 쓸 수 있어요(쓸 때 금칙어 검사).`, '지우기', '취소'))) return;
    clear.mutate(undefined, {
      onSuccess: () => setMessage({ text: '상태메시지를 지웠어요. 작업 기록에 남았어요.' }),
      onError: (e) => setMessage({ text: errorText(e, '지우지 못했어요.'), error: true }),
    });
  };
  return (
    <AdminSection title="상태메시지" hint="팬이 보는 토피룸 프로필 카드의 한 줄이에요. 아티스트가 직접 쓰고, 운영자는 지우기만 할 수 있어요(CP방 카드에도 같은 값이 보여요).">
      <ThemedText type="small" themeColor={actor.statusMessage ? 'text' : 'textTertiary'}>
        {actor.statusMessage ?? '비어 있음 — 카드에 줄이 안 보여요'}
      </ThemedText>
      {actor.statusMessage ? (
        <AdminButtonRow>
          <AdminButton secondary label={clear.isPending ? '지우는 중…' : '지우기'} disabled={clear.isPending} onPress={() => void onClear()} />
        </AdminButtonRow>
      ) : null}
      <AdminMessage text={message?.text ?? null} error={message?.error} />
    </AdminSection>
  );
}

function ActorRelease({ actor }: { actor: AdminActor }) {
  const update = useUpdateActor(actor.id);
  return (
    <ReleaseSection
      key={actor.releaseAt ?? 'none'}
      releaseAt={actor.releaseAt}
      watchCount={actor.releaseWatchCount}
      saving={update.isPending}
      onSave={(releaseAt) => update.mutateAsync({ releaseAt })}
      note={actor.kind === 'SOLO' ? '이 아티스트가 든 CP방·묶음은 각자 공개 시각을 따로 정해요(묶음은 든 방 중 가장 늦게 열리는 방에 맞춰 열려요).' : undefined}
    />
  );
}

export default function AdminActorDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: actor, isLoading, error } = useAdminActor(id);
  const { data: bundles } = useAdminBundles();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: actor?.legalName ?? '아티스트' }} />
      {/* 없는 아티스트·권한 없음이면 오류 문구 + 뒤로(2026-10-29 — 예전엔 스피너만 계속) */}
      {!actor && !isLoading && error ? (
        <AdminLoadError error={error} fallback="/admin/actors" />
      ) : isLoading || !actor ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            {formatBaht(actor.monthlyPriceCents)}/월 · 구독자 {actor.activeSubscriberCount}명 · 등록 {formatDate(actor.createdAt)}
          </ThemedText>
          {/* 소속사와 같은 모니터링 화면(보낸 메시지·팬 답장·스토리·통계, 2026-10-20) */}
          <AdminButtonRow>
            <AdminButton label="토피룸 모니터링" onPress={() => router.push(`/console/${actor.id}`)} />
            {/* 이 CP가 든 묶음(패키지)이 아직 없을 때만(2026-10-20) */}
            {actor.kind === 'COUPLE' && bundles && !bundles.some((bundle) => bundle.actors.some((item) => item.id === actor.id)) ? (
              <AdminButton secondary label="이 CP로 패키지(묶음 3개) 만들기" onPress={() => router.push({ pathname: '/admin/bundles/cp-set', params: { roomId: actor.id } })} />
            ) : null}
          </AdminButtonRow>
          <AdminSection title="프로필 사진" hint="공식 사진은 아티스트 찾기·아티스트 소개에, 대화방 사진은 채팅방에서 보여요. 공식 사진을 처음 올리면 비어 있는 대화방 사진에도 같이 들어가요(아티스트가 나중에 바꾸거나 기본 이미지로 돌릴 수 있음). 정사각으로 잘라서 올려요.">
            <ThemedView style={styles.photos}>
              <PhotoSlot actor={actor} field="officialProfileImageKey" label="공식 사진" />
              <PhotoSlot actor={actor} field="chatProfileImageKey" label="대화방 사진" />
            </ThemedView>
          </AdminSection>
          <BasicInfo key={`${actor.id}-info`} actor={actor} />
          {actor.kind === 'COUPLE' ? (
            // 커플방: 소속사·본인 계정은 멤버 배우 쪽에서 정해짐(각 소속사가 자기 배우가 든 커플방을 모니터링, 두 배우 본인 계정이 보냄)
            <AdminSection title="멤버 아티스트" hint="방 이름과 대화방 사진은 두 아티스트가 각자 스튜디오에서 바꿀 수 있어요. 멤버 중 한 명이라도 활동을 종료하면 새 구독이 멈춰요.">
              {actor.coupleMembers.map(({ member }) => (
                <ThemedText key={member.id} type="small">
                  {member.legalName} ({member.chatDisplayName}){member.retiredAt ? ' — 활동 종료' : ''}
                  {/* 상태메시지는 멤버별(2026-10-25) — 지우기는 그 아티스트 화면에서 */}
                  {member.statusMessage ? ` · 상태메시지 "${member.statusMessage}"` : ''}
                </ThemedText>
              ))}
            </AdminSection>
          ) : (
            <>
              <AgencySection actor={actor} />
              <SelfAccountSection actor={actor} />
              <StatusMessageSection actor={actor} />
            </>
          )}
          <ActorRelease actor={actor} />
          <ContractSection actor={actor} />
          <RetireSection actor={actor} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  loading: { marginTop: Spacing.six },
  photos: { flexDirection: 'row', gap: Spacing.four, backgroundColor: 'transparent' },
  photoSlot: { alignItems: 'center', gap: Spacing.one, backgroundColor: 'transparent', flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, backgroundColor: 'transparent' },
  history: { gap: 2, backgroundColor: 'transparent' },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  linkBox: { gap: Spacing.two, backgroundColor: 'transparent', paddingBottom: Spacing.two },
});
