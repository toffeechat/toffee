import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Flag, ShieldBan, Trash2 } from 'lucide-react-native';

import { SegmentedPills } from '@/components/console-charts';
import { ScreenIntro } from '@/components/console-stats';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useAgencyRecords, useMyActors, type AgencyRecords, type RecordFan, type RecordRoom } from '@/hooks/use-console';
import { useUnblockFan } from '@/hooks/use-safety';
import { useTheme } from '@/hooks/use-theme';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { showNameToken } from '@/utils/name-token';
import { Radius, Spacing } from '@/constants/theme';

type Tab = 'blocks' | 'reports' | 'deleted';

/**
 * 소속사 "기록"(2026-10-13 사용자 요청, 1차) — 소속 아티스트 방에서 일어난 차단·신고·메시지 삭제를 한곳에서(예전엔 아티스트마다
 * 차단 관리에 들어가야 했고, 신고는 처리됐는지 볼 수 없었음). 범위는 우리 아티스트 방만(사용자 결정). 위에서 아티스트로 좁혀 보기.
 */
export default function ConsoleRecordsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('blocks');
  const [actorId, setActorId] = useState<string | null>(null);
  const { data: actors } = useMyActors();
  const { data, isLoading, refetch } = useAgencyRecords(actorId);
  const { refreshing, onRefresh } = useManualRefresh(refetch);

  const counts = { blocks: data?.blocks.length ?? 0, reports: data?.reports.length ?? 0, deleted: data?.deleted.length ?? 0 };
  const list = data ? data[tab] : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <FlatList<AgencyRecords[Tab][number]>
        data={list as AgencyRecords[Tab][number][]}
        keyExtractor={(item, index) => `${tab}-${'id' in item ? item.id : `${item.room?.id}-${item.fanUser?.id ?? index}`}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenIntro text={t('records.description')} />
            <SegmentedPills
              options={(['blocks', 'reports', 'deleted'] as Tab[]).map((value) => ({ value, label: `${t(`records.tabs.${value}`)} ${counts[value]}` }))}
              value={tab}
              onChange={setTab}
            />
            {/* 아티스트로 좁혀 보기 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {[{ id: null as string | null, chatDisplayName: t('records.allArtists') }, ...(actors ?? [])].map((actor) => {
                const selected = actorId === actor.id;
                return (
                  <Pressable
                    key={actor.id ?? 'all'}
                    onPress={() => setActorId(actor.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.background, borderColor: selected ? theme.primary : theme.border }]}>
                    <ThemedText type="smallMedium" style={{ color: selected ? theme.onPrimary : theme.text }}>
                      {actor.chatDisplayName}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <ThemedText type="small" themeColor="textTertiary" style={styles.empty}>
              {t(`records.empty.${tab}`)}
            </ThemedText>
          )
        }
        ListFooterComponent={
          data && list.length >= data.limit ? (
            <ThemedText type="caption" themeColor="textTertiary" style={styles.empty}>
              {t('records.limitNote', { count: data.limit })}
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) =>
          tab === 'blocks' ? (
            <BlockCard item={item as AgencyRecords['blocks'][number]} />
          ) : tab === 'reports' ? (
            <ReportCard item={item as AgencyRecords['reports'][number]} />
          ) : (
            <DeletedCard item={item as AgencyRecords['deleted'][number]} />
          )
        }
      />
    </View>
  );
}

function useWho() {
  const { t } = useTranslation();
  return (role: string, byMe: boolean) => (byMe ? t('records.byMe') : t(`records.by.${role}`, { defaultValue: role }));
}

function useDate() {
  const { i18n } = useTranslation();
  return (at: string) => new Date(at).toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fanName(fan: RecordFan | null, fallback: string) {
  return fan ? `${fan.nickname ?? '-'} ${fan.tag}` : fallback;
}

function RecordCard({
  icon,
  tone,
  room,
  title,
  meta,
  children,
  right,
}: {
  icon: typeof Flag;
  tone: 'danger' | 'tint' | 'muted';
  room: RecordRoom | null;
  title: string;
  meta: string;
  children?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  const color = tone === 'danger' ? theme.danger : tone === 'tint' ? theme.tint : theme.textSecondary;
  return (
    <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: tone === 'danger' ? `${theme.danger}1A` : theme.backgroundElement }]}>
          <Icon as={icon} size={16} color={color} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary" numberOfLines={2}>
            {meta}
          </ThemedText>
        </View>
        {right}
      </View>
      {children}
      {room ? (
        <Pressable onPress={() => router.push(`/console/${room.id}`)} hitSlop={6} accessibilityRole="link" style={styles.roomLink}>
          <ThemedText type="captionBold" style={{ color: theme.tint }}>
            {`${room.chatDisplayName} ›`}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function Quote({ text, faded }: { text: string; faded?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.quote, { borderLeftColor: theme.border, backgroundColor: theme.backgroundElement }, faded && styles.faded]}>
      <ThemedText type="small">{text}</ThemedText>
    </View>
  );
}

function BlockCard({ item }: { item: AgencyRecords['blocks'][number] }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const who = useWho();
  const date = useDate();
  const unblock = useUnblockFan(item.room?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    if (!item.fanUser || !item.room) return;
    if (!(await confirm(t('records.unblockTitle', { nickname: item.fanUser.nickname ?? '' }), t('records.unblockBody'), t('block.unblock'), t('common.cancel')))) return;
    setError(null);
    unblock.mutate(item.fanUser.id, { onError: (e) => setError(e instanceof ApiError ? e.message : t('common.requestFailed')) });
  };
  return (
    <RecordCard
      icon={ShieldBan}
      tone="danger"
      room={item.room}
      title={fanName(item.fanUser, t('console.deletedFan'))}
      meta={t('records.blockedMeta', { who: who(item.by, item.byMe), date: date(item.createdAt) })}
      right={
        item.fanUser && item.room ? (
          <Pressable onPress={() => void start()} disabled={unblock.isPending} hitSlop={6} accessibilityRole="button" style={[styles.smallButton, { borderColor: theme.border }]}>
            <ThemedText type="captionBold">{t('block.unblock')}</ThemedText>
          </Pressable>
        ) : null
      }>
      {item.message?.body ? (
        <>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('records.trigger')}
          </ThemedText>
          <Quote text={item.message.body} />
        </>
      ) : (
        <ThemedText type="caption" themeColor="textTertiary">
          {t('records.noTrigger')}
        </ThemedText>
      )}
      {item.reason ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {item.reason}
        </ThemedText>
      ) : null}
      {error ? (
        <ThemedText type="caption" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </RecordCard>
  );
}

function ReportCard({ item }: { item: AgencyRecords['reports'][number] }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const who = useWho();
  const date = useDate();
  const statusColor = item.status === 'PENDING' ? theme.textSecondary : item.status === 'RESOLVED' ? theme.tint : theme.textTertiary;
  return (
    <RecordCard
      icon={Flag}
      tone={item.status === 'PENDING' ? 'muted' : 'tint'}
      room={item.room}
      title={`${t(`report.category.${item.category}`)} · ${fanName(item.message.fanUser, t('console.deletedFan'))}`}
      meta={t('records.reportedMeta', { who: who(item.by, item.byMe), date: date(item.createdAt) })}
      right={
        <View style={[styles.status, { backgroundColor: item.status === 'RESOLVED' ? theme.tintSoft : theme.backgroundElement }]}>
          <ThemedText type="captionBold" style={{ color: statusColor }}>
            {t(`records.status.${item.status}`)}
          </ThemedText>
        </View>
      }>
      <Quote text={item.message.body ?? t(`console.media.${item.message.mediaType}`, { defaultValue: '-' })} />
      {item.reason ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {item.reason}
        </ThemedText>
      ) : null}
    </RecordCard>
  );
}

function DeletedCard({ item }: { item: AgencyRecords['deleted'][number] }) {
  const { t } = useTranslation();
  const who = useWho();
  const date = useDate();
  const body = item.body ? showNameToken(item.body, t('studio.fanNickname')) : null;
  return (
    <RecordCard
      icon={Trash2}
      tone="muted"
      room={item.room}
      title={t(item.by === 'ADMIN' ? 'records.hiddenByAdmin' : 'records.deletedBy', { who: who(item.by, item.byMe) })}
      meta={t('records.deletedMeta', { sent: date(item.createdAt), deleted: date(item.deletedAt) })}>
      <Quote text={[item.mediaType !== 'TEXT' ? `[${t(`console.media.${item.mediaType}`)}]` : null, body].filter(Boolean).join(' ') || '-'} faded />
    </RecordCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  container: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: 820, alignSelf: 'center' },
  header: { gap: Spacing.three, marginBottom: Spacing.one },
  chips: { gap: Spacing.two },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: 6 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardIcon: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  quote: { borderLeftWidth: 3, borderRadius: Radius.sm, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  faded: { opacity: 0.7 },
  roomLink: { alignSelf: 'flex-start' },
  smallButton: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: 4 },
  status: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  empty: { textAlign: 'center', marginTop: Spacing.four },
});
