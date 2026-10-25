import { useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react-native';

import { SegmentedPills } from '@/components/console-charts';
import { RoomListRow } from '@/components/room-list-row';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { agencyLabelOf, membersOf } from '@/hooks/use-actors';
import { useAdminMessageRooms } from '@/hooks/use-admin';
import { useMyActors, type MyActor, type RoomKindFilter, type StatsSelection } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { useConsoleUnread } from '@/lib/console-alerts';
import { Radius, Spacing } from '@/constants/theme';
import { IDLE_WARN_DAYS, idleDays } from '@/utils/idle-days';
import { formatReleaseAt, isUpcoming } from '@/utils/release';

type Sort = 'recent' | 'idle' | 'subscribers';
const KINDS: RoomKindFilter[] = ['ALL', 'SOLO', 'COUPLE'];

/** 팬에겐 안 보이는 운영 정보 — 공식 이름 · 소속사(CP방은 멤버 공식 이름 + 멤버 소속사) · 구독자 수 (+ 운영자만 스토어 상품 ID 없음) */
function StaffInfoLine({ actor, admin }: { actor: MyActor; admin?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const agency = agencyLabelOf(actor) ?? t('console.noAgency');
  const who = actor.kind === 'COUPLE' ? membersOf(actor).map((member) => member.legalName).join(' + ') : t('console.officialName', { name: actor.legalName });
  return (
    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
      {[who, agency, t('console.subscribers', { count: actor.subscriberCount ?? 0 })].join(' · ')}
      {/* 운영자 화면은 한국어 전용 */}
      {admin && !actor.storeProductId && !actor.retiredAt ? <ThemedText type="caption" style={{ color: theme.danger }}>{' · 스토어 상품 ID 없음'}</ThemedText> : null}
    </ThemedText>
  );
}

/** 마지막 메시지 N일 전(7일 넘으면 빨간색, 서버도 그때 소속사에 알림), 공개 예정, 활동 종료 */
function IdleLine({ actor }: { actor: MyActor }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  if (actor.retiredAt) {
    return (
      <ThemedText type="caption" themeColor="textTertiary">
        {t('dashboard.retired')}
      </ThemedText>
    );
  }
  // 공개 예정(2026-10-19) — 공개 시각과 알림 신청 수(사전 수요)
  if (isUpcoming(actor.releaseAt)) {
    return (
      <ThemedText type="caption" style={{ color: theme.tint }}>
        {t('release.consoleLine', { date: formatReleaseAt(actor.releaseAt!, i18n.language), count: actor.releaseWatchCount ?? 0 })}
      </ThemedText>
    );
  }
  const idle = idleDays(actor.lastBroadcastAt);
  return (
    <ThemedText type="caption" themeColor={(idle ?? IDLE_WARN_DAYS) >= IDLE_WARN_DAYS ? 'danger' : 'textTertiary'}>
      {idle === null ? t('console.noMessagesYet') : idle === 0 ? t('console.lastMessageToday') : t('console.lastMessageDays', { count: idle })}
    </ThemedText>
  );
}

/** 고른 기간의 이 방 건수(운영자 "그날 메시지" 보기) */
function PeriodLine({ counts }: { counts: { messages: number; fanReplies: number } }) {
  const theme = useTheme();
  return (
    <ThemedText type="caption" style={{ color: theme.tint }}>
      {`이 기간 메시지 ${counts.messages}건 · 팬 답장 ${counts.fanReplies}건`}
    </ThemedText>
  );
}

/**
 * 토피룸 모니터링 목록(2026-10-20 사용자 요청: "팬 토피룸 목록처럼 보기 쉽게 + 운영에 필요한 정보") — 소속사 "소속 아티스트" 탭과
 * 운영자 "토피룸 모니터링"이 같이 씀. 팬 목록처럼 사진·방 이름(아티스트가 정한 닉네임)·마지막 메시지·시간에 더해, 팬에겐 안 보이는
 * 공식 이름·소속사(CP방은 멤버)·구독자 수·마지막 메시지 N일 전. 검색(닉네임·공식 이름·소속사)·아티스트/CP·정렬, 운영자는 소속사 필터도.
 * 누르면 그 방의 모니터링(보낸 메시지·팬 답장·스토리·통계).
 * messagePeriod(운영자, 2026-10-25 — 운영자 홈 "오늘 메시지" 카드에서 넘어옴): 그 기간 메시지·팬 답장이 있는 방만, 아티스트 메시지 많은 순 + 방마다 건수.
 */
export function RoomMonitorList({ admin, header, messagePeriod }: { admin?: boolean; header?: ReactElement; messagePeriod?: StatsSelection | null }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: actors, isLoading } = useMyActors();
  const unread = useConsoleUnread();
  const { data: periodRooms, isLoading: loadingPeriod } = useAdminMessageRooms(admin && messagePeriod ? messagePeriod : null);
  const periodCounts = useMemo(() => (periodRooms ? new Map(periodRooms.rooms.map((room) => [room.actorId, room])) : null), [periodRooms]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<RoomKindFilter>('ALL');
  const [sort, setSort] = useState<Sort>('recent');
  const [agency, setAgency] = useState('');

  // 운영자 소속사 필터 — 목록에 나온 소속사(CP방은 멤버 소속사)
  const agencies = useMemo(() => {
    const map = new Map<string, string>();
    for (const actor of actors ?? []) {
      if (actor.agency) map.set(actor.agency.id, actor.agency.name);
      for (const member of membersOf(actor)) if (member.agency?.id) map.set(member.agency.id, member.agency.name);
    }
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [actors]);

  const rooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = (actors ?? []).filter((actor) => {
      if (periodCounts && !periodCounts.has(actor.id)) return false;
      if (kind !== 'ALL' && (actor.kind ?? 'SOLO') !== kind) return false;
      if (agency && actor.agency?.id !== agency && !membersOf(actor).some((member) => member.agency?.id === agency)) return false;
      if (!needle) return true;
      const haystack = [actor.chatDisplayName, actor.legalName, agencyLabelOf(actor), ...membersOf(actor).flatMap((m) => [m.legalName, m.chatDisplayName])];
      return haystack.some((text) => text?.toLowerCase().includes(needle));
    });
    const time = (value?: string | null) => (value ? new Date(value).getTime() : 0);
    return filtered.sort((a, b) => {
      if (periodCounts) {
        const [x, y] = [periodCounts.get(a.id)!, periodCounts.get(b.id)!];
        return y.messages - x.messages || y.fanReplies - x.fanReplies;
      }
      if (sort === 'subscribers') return (b.subscriberCount ?? 0) - (a.subscriberCount ?? 0);
      // 오래 안 보낸 순 — 활동 종료한 방은 맨 아래, 한 번도 안 보낸 방이 맨 위
      if (sort === 'idle') return Number(!!a.retiredAt) - Number(!!b.retiredAt) || time(a.lastBroadcastAt) - time(b.lastBroadcastAt);
      return time(b.lastMessage?.createdAt) - time(a.lastMessage?.createdAt);
    });
  }, [actors, query, kind, agency, sort, periodCounts]);

  const filters = (
    <View style={styles.filters}>
      {header}
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <Icon as={Search} size={16} color={theme.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('console.monitorSearch')}
          placeholderTextColor={theme.textTertiary}
          style={[styles.searchInput, { color: theme.text }]}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.pillRow}>
        <SegmentedPills options={KINDS.map((value) => ({ value, label: t(`dashboard.kind.${value}`) }))} value={kind} onChange={setKind} />
        {periodCounts ? null : (
        <SegmentedPills
          options={[
            { value: 'recent' as Sort, label: t('console.sortRecent') },
            { value: 'idle' as Sort, label: t('dashboard.sort.idle') },
            { value: 'subscribers' as Sort, label: t('dashboard.sort.subscribers') },
          ]}
          value={sort}
          onChange={setSort}
        />
        )}
      </View>
      {admin && agencies.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <SegmentedPills options={[{ value: '', label: '모든 소속사' }, ...agencies.map((item) => ({ value: item.id, label: item.name }))]} value={agency} onChange={setAgency} />
        </ScrollView>
      ) : null}
      {actors ? (
        <ThemedText type="caption" themeColor="textTertiary">
          {t('dashboard.countItems', { count: rooms.length })}
          {/* 운영자 화면은 한국어 전용 */}
          {periodRooms ? ` · 아티스트 메시지 ${periodRooms.totals.messages}건 · 팬 답장 ${periodRooms.totals.fanReplies}건(지운 것 포함)` : ''}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isLoading || loadingPeriod ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={filters}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              {actors?.length ? t('console.searchEmpty') : t('console.empty')}
            </ThemedText>
          }
          renderItem={({ item }) => (
            <RoomListRow
              actor={item}
              unread={unread.get(item.id) ?? 0}
              extra={
                <>
                  <StaffInfoLine actor={item} admin={admin} />
                  {periodCounts ? <PeriodLine counts={periodCounts.get(item.id)!} /> : <IdleLine actor={item} />}
                </>
              }
              onPress={() => router.push(`/console/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingVertical: Spacing.two, width: '100%', maxWidth: 820, alignSelf: 'center' },
  filters: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, gap: Spacing.two },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.md, paddingHorizontal: Spacing.three },
  searchInput: { flex: 1, paddingVertical: Spacing.two, fontSize: 15 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.four },
  loading: { marginTop: Spacing.four },
});
