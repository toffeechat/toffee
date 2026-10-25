import { IDLE_WARN_DAYS, idleDays } from '@/utils/idle-days';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminAvatar, AdminButton, AdminChip, formatBaht } from '@/components/admin-ui';
import { AdminBadge, AdminBadgeRow, AdminCompactRow, AdminListRow, AdminSortHeader, AdminStatTiles, type AdminSort, type BadgeTone } from '@/components/admin-table';
import { useWideLayout } from '@/components/wide-shell';
import { useAdminActors, type AdminActor } from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { formatBangkokDateTime, isUpcoming } from '@/utils/release';

type KindTab = 'ALL' | 'FEMALE' | 'MALE' | 'NONE' | 'COUPLE';
const KIND_TABS: { key: KindTab; label: string; match: (actor: AdminActor) => boolean }[] = [
  { key: 'ALL', label: '전체', match: () => true },
  { key: 'FEMALE', label: '여성', match: (actor) => actor.kind === 'SOLO' && actor.gender === 'FEMALE' },
  { key: 'MALE', label: '남성', match: (actor) => actor.kind === 'SOLO' && actor.gender === 'MALE' },
  { key: 'NONE', label: '성별 지정 안 함', match: (actor) => actor.kind === 'SOLO' && !actor.gender },
  { key: 'COUPLE', label: 'CP방', match: (actor) => actor.kind === 'COUPLE' },
];

type Status = 'ACTIVE' | 'UPCOMING' | 'RETIRING' | 'RETIRED';
const statusOf = (actor: AdminActor): Status =>
  actor.retiredAt ? 'RETIRED' : actor.retireAt ? 'RETIRING' : isUpcoming(actor.releaseAt) ? 'UPCOMING' : 'ACTIVE';
const STATUS_BADGE: Record<Status, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: '활동 중', tone: 'ok' },
  UPCOMING: { label: '공개 예정', tone: 'warn' },
  RETIRING: { label: '종료 예정', tone: 'danger' },
  RETIRED: { label: '활동 종료', tone: 'muted' },
};
// 활동 종료한 방은 스토어 상품이 없어도 상관없음
const missingStore = (actor: AdminActor) => !actor.storeProductId && !actor.retiredAt;

/** 맨 위 요약 카드(2026-10-25) — 누르면 그 조건으로 거름. 활동 종료는 카드 없이 "전체"·상태 정렬로 봄 */
type Tile = 'ACTIVE' | 'UPCOMING' | 'RETIRING' | 'NO_STORE';
const TILES: { key: Tile; label: string; tone: BadgeTone; match: (actor: AdminActor) => boolean }[] = [
  { key: 'ACTIVE', label: '활동 중', tone: 'ok', match: (actor) => statusOf(actor) === 'ACTIVE' },
  { key: 'UPCOMING', label: '공개 예정', tone: 'warn', match: (actor) => statusOf(actor) === 'UPCOMING' },
  { key: 'RETIRING', label: '활동 종료 예정', tone: 'danger', match: (actor) => statusOf(actor) === 'RETIRING' },
  { key: 'NO_STORE', label: '스토어 ID 없음', tone: 'danger', match: missingStore },
];

const NO_AGENCY = 'none';
/** 소속사 — 개인방은 자기 소속사, CP방은 멤버 소속사들 */
const agencyIdsOf = (actor: AdminActor): string[] =>
  actor.kind === 'COUPLE' ? [...new Set(actor.coupleMembers.map(({ member }) => member.agency?.id ?? NO_AGENCY))] : [actor.agency?.id ?? NO_AGENCY];
const agencyText = (actor: AdminActor) =>
  actor.kind === 'COUPLE' ? [...new Set(actor.coupleMembers.map(({ member }) => member.agency?.name ?? '무소속'))].join(' · ') : (actor.agency?.name ?? '무소속');

type SortKey = 'name' | 'agency' | 'status' | 'subscribers' | 'price' | 'broadcast';
const STATUS_ORDER: Record<Status, number> = { RETIRING: 0, UPCOMING: 1, ACTIVE: 2, RETIRED: 3 };
// 최근 메시지는 오래된 순이 위(안 보낸 방을 먼저 찾으려고), 한 번도 안 보낸 방이 맨 위
const SORT_VALUE: Record<SortKey, (actor: AdminActor) => string | number> = {
  name: (actor) => actor.legalName,
  agency: agencyText,
  status: (actor) => STATUS_ORDER[statusOf(actor)],
  subscribers: (actor) => actor.activeSubscriberCount,
  price: (actor) => actor.monthlyPriceCents,
  broadcast: (actor) => (actor.lastBroadcastAt ? new Date(actor.lastBroadcastAt).getTime() : 0),
};
const COLUMNS: { title: string; flex: number; sortKey?: SortKey; firstDir?: 'asc' | 'desc' }[] = [
  { title: '이름', flex: 2.2, sortKey: 'name' },
  { title: '소속사', flex: 1.4, sortKey: 'agency' },
  { title: '상태', flex: 2, sortKey: 'status' },
  { title: '구독자', flex: 0.8, sortKey: 'subscribers', firstDir: 'desc' },
  { title: '최근 메시지', flex: 1.1, sortKey: 'broadcast' },
  { title: '월 가격', flex: 0.8, sortKey: 'price', firstDir: 'desc' },
];

/** 최근 메시지 — 구독자가 있는데 IDLE_WARN_DAYS일 넘게 안 보냈으면 빨간 배지(2026-09-29 장기 미발송) */
function BroadcastCell({ actor }: { actor: AdminActor }) {
  const days = idleDays(actor.lastBroadcastAt);
  const late = actor.activeSubscriberCount > 0 && !actor.retiredAt && (days ?? IDLE_WARN_DAYS) >= IDLE_WARN_DAYS;
  const label = days === null ? '없음' : days === 0 ? '오늘' : `${days}일 전`;
  return late ? <AdminBadge label={label} tone="danger" /> : <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>;
}

function StatusBadges({ actor }: { actor: AdminActor }) {
  const status = statusOf(actor);
  // 공개·종료 예정은 날짜까지(태국 날짜)
  const at = status === 'UPCOMING' ? actor.releaseAt : status === 'RETIRING' ? actor.retireAt : null;
  return (
    <AdminBadgeRow>
      <AdminBadge label={`${STATUS_BADGE[status].label}${at ? ` ${formatBangkokDateTime(at).slice(5, 10).replace('-', '/')}` : ''}`} tone={STATUS_BADGE[status].tone} />
      {/* 공개 전 알림 신청 수(2026-10-19 사전 수요) — 공개 예정일 때만 목록에, 공개 후엔 상세에서 */}
      {status === 'UPCOMING' ? <AdminBadge label={`알림 신청 ${actor.releaseWatchCount}`} tone="muted" /> : null}
      {missingStore(actor) ? <AdminBadge label="스토어 ID 없음" tone="danger" /> : null}
    </AdminBadgeRow>
  );
}

/** 폰 폭은 배지 하나 — 가장 급한 것(종료 예정 > 공개 예정 > 스토어 ID 없음 > 활동 종료·활동 중) */
function TopBadge({ actor }: { actor: AdminActor }) {
  const status = statusOf(actor);
  if (status === 'ACTIVE' && missingStore(actor)) return <AdminBadge label="스토어 ID 없음" tone="danger" />;
  return <AdminBadge label={STATUS_BADGE[status].label} tone={STATUS_BADGE[status].tone} />;
}

function NameCell({ actor, size }: { actor: AdminActor; size: number }) {
  return (
    <View style={styles.name}>
      <AdminAvatar uri={actor.officialProfileImageUrl ?? actor.chatProfileImageUrl} name={actor.legalName} size={size} />
      <View style={styles.flex}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {actor.kind === 'COUPLE' ? '[CP] ' : ''}
          {actor.legalName}
          {actor.verified ? ' ✓' : ''}
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
          {actor.kind === 'COUPLE' ? actor.coupleMembers.map(({ member }) => member.legalName).join(' + ') : actor.chatDisplayName}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * 아티스트 관리(2026-10-20 소속사·종류별 개수, 2026-10-25 개편: "정보가 많아 정신없다" — 회원 상세처럼 요약 카드 + 표 + 색 배지).
 * 맨 위 요약 카드(활동 중·공개 예정·종료 예정·스토어 ID 없음)를 누르면 그 조건으로 거름. PC는 열 제목을 눌러 정렬하는 표, 폰 폭은 한 줄 카드(이름·상태·구독자).
 * 본인 계정 연결·알림 신청 수·계약 종료일 같은 부가 정보는 상세 화면. 칩 개수는 다른 조건을 건 결과(예: 소속사 A를 고르면 종류 칩은 A의 인원).
 */
export default function AdminActorsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const wide = useWideLayout();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindTab>('ALL');
  const [agency, setAgency] = useState<string | null>(null);
  const [tile, setTile] = useState<Tile | null>(null);
  const [sort, setSort] = useState<AdminSort<SortKey> | null>(null);
  const { data: actors, isLoading } = useAdminActors(query.trim());
  const all = actors ?? [];
  const kindOk = (actor: AdminActor, key = kind) => KIND_TABS.find((tab) => tab.key === key)!.match(actor);
  const tileOk = (actor: AdminActor, key = tile) => !key || TILES.find((t) => t.key === key)!.match(actor);
  const agencyOk = (actor: AdminActor, key = agency) => !key || agencyIdsOf(actor).includes(key);
  const filtered = all.filter((actor) => kindOk(actor) && tileOk(actor) && agencyOk(actor));
  const shown = sort
    ? [...filtered].sort((a, b) => {
        const [x, y] = [SORT_VALUE[sort.key](a), SORT_VALUE[sort.key](b)];
        const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return sort.dir === 'asc' ? order : -order;
      })
    : filtered;
  const agencies = new Map<string, string>();
  for (const actor of all) {
    if (actor.kind === 'COUPLE') for (const { member } of actor.coupleMembers) agencies.set(member.agency?.id ?? NO_AGENCY, member.agency?.name ?? '무소속');
    else agencies.set(actor.agency?.id ?? NO_AGENCY, actor.agency?.name ?? '무소속');
  }
  const open = (actor: AdminActor) => router.push({ pathname: '/admin/actors/[id]', params: { id: actor.id } });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={isLoading ? [] : shown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, !wide && styles.listNarrow]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            {/* 아티스트·CP방(= 방) 등록은 화면 하나(2026-10-20 사용자 결정) — 한 명이든 엑셀 수백 줄이든. 패키지(묶음)는 묶음 상품 메뉴 */}
            <View style={styles.searchLine}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="아티스트 이름·닉네임·소속사로 검색"
                placeholderTextColor={theme.textSecondary}
                style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              />
              <AdminButton label={wide ? '+ 아티스트·CP 등록' : '+ 등록'} onPress={() => router.push('/admin/actors/import')} />
            </View>
            <AdminStatTiles
              tiles={TILES.map((t) => ({ key: t.key, label: t.label, tone: t.tone, count: actors ? all.filter((actor) => kindOk(actor) && agencyOk(actor) && t.match(actor)).length : undefined }))}
              selected={tile}
              onSelect={(key) => setTile(key as Tile | null)}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>
              {KIND_TABS.map((tab) => (
                <AdminChip key={tab.key} label={tab.label} count={all.filter((actor) => kindOk(actor, tab.key) && tileOk(actor) && agencyOk(actor)).length} selected={kind === tab.key} onPress={() => setKind(tab.key)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>
              <AdminChip label="모든 소속사" count={all.filter((actor) => kindOk(actor) && tileOk(actor)).length} selected={!agency} onPress={() => setAgency(null)} />
              {[...agencies].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                <AdminChip key={id} label={name} count={all.filter((actor) => kindOk(actor) && tileOk(actor) && agencyOk(actor, id)).length} selected={agency === id} onPress={() => setAgency(id)} />
              ))}
            </ScrollView>
            {wide ? <AdminSortHeader columns={COLUMNS} sort={sort} onSort={setSort} /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.loading} color={theme.tint} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {query || kind !== 'ALL' || agency || tile ? '조건에 맞는 아티스트가 없어요.' : '등록된 아티스트가 없어요.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) =>
          wide ? (
            <AdminListRow
              columns={COLUMNS}
              faded={!!item.retiredAt}
              onPress={() => open(item)}
              cells={[
                <NameCell key="name" actor={item} size={36} />,
                agencyText(item),
                <StatusBadges key="status" actor={item} />,
                `${item.activeSubscriberCount.toLocaleString()}명`,
                <BroadcastCell key="broadcast" actor={item} />,
                formatBaht(item.monthlyPriceCents),
              ]}
            />
          ) : (
            <AdminCompactRow
              faded={!!item.retiredAt}
              onPress={() => open(item)}
              left={<NameCell actor={item} size={32} />}
              right={
                <>
                  <TopBadge actor={item} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.activeSubscriberCount.toLocaleString()}명
                  </ThemedText>
                </>
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  list: { padding: Spacing.four },
  listNarrow: { gap: Spacing.two },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  searchLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  search: { flex: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  chipLine: { flexDirection: 'row', gap: Spacing.two },
  name: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1, minWidth: 0 },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  loading: { marginTop: Spacing.six },
});
