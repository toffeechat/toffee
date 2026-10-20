import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ScreenIntro } from '@/components/console-stats';
import { RoomListRow } from '@/components/room-list-row';
import { ThemedText } from '@/components/themed-text';
import { useMyActors, type MyActor } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { useConsoleUnread } from '@/lib/console-alerts';
import { Spacing } from '@/constants/theme';
import { IDLE_WARN_DAYS, idleDays } from '@/utils/idle-days';
import { formatReleaseAt, isUpcoming } from '@/utils/release';

/** 소속사에게만 보이는 줄 — 마지막 메시지 N일 전(7일 넘으면 빨간색, 서버도 그때 소속사에 알림), 활동 종료 */
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

/**
 * 소속 아티스트(2026-10-13 하단 탭/왼쪽 메뉴 두 번째, 2026-10-14 사용자 요청으로 팬 토피룸 목록처럼) — 사진·이름·마지막 메시지·시간 +
 * 소속사만 보는 "마지막 메시지 N일 전". PC 웹 새 메시지 수는 숫자 배지. 최근에 보낸 방이 위. 누르면 모니터링·답장·통계
 */
export default function ConsoleArtistsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: actors, isLoading } = useMyActors();
  const unread = useConsoleUnread();
  const rooms = [...(actors ?? [])].sort(
    (a, b) => new Date(b.lastMessage?.createdAt ?? 0).getTime() - new Date(a.lastMessage?.createdAt ?? 0).getTime(),
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<ScreenIntro text={t('console.description')} style={styles.intro} />}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              {t('console.empty')}
            </ThemedText>
          }
          renderItem={({ item }) => (
            <RoomListRow actor={item} unread={unread.get(item.id) ?? 0} extra={<IdleLine actor={item} />} onPress={() => router.push(`/console/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingVertical: Spacing.two, width: '100%', maxWidth: 820, alignSelf: 'center' },
  intro: { marginHorizontal: Spacing.four, marginBottom: Spacing.two },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.four },
  loading: { marginTop: Spacing.four },
});
