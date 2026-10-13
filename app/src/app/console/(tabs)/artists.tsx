import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';

import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { ScreenIntro } from '@/components/console-stats';
import { ThemedText } from '@/components/themed-text';
import { useMyActors } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { useConsoleUnread } from '@/lib/console-alerts';
import { Radius, Spacing } from '@/constants/theme';
import type { Actor } from '@/hooks/use-actors';
import { IDLE_WARN_DAYS, idleDays } from '@/utils/idle-days';

function ActorRow({ actor, unread, onPress }: { actor: Actor & { lastBroadcastAt?: string | null }; unread: number; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const idle = idleDays(actor.lastBroadcastAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ hovered, pressed }) => [
        styles.row,
        { backgroundColor: theme.background, borderColor: hovered || pressed ? theme.tint : theme.border },
      ]}>
      <View>
        <Avatar uri={actor.chatProfileImageUrl} size={48} />
        {/* PC 웹 새 메시지(2026-10-13) — 그 아티스트 화면을 열면 사라짐 */}
        {unread > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.tint, borderColor: theme.background }]} accessibilityLabel={t('consoleAlerts.unread', { count: unread })}>
            <ThemedText type="captionBold" style={styles.badgeText}>
              {unread > 99 ? '99+' : unread}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.rowBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {actor.chatDisplayName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {actor.kind === 'COUPLE' ? `${t('couple.roomLabel')} · ${actor.legalName}` : actor.legalName}
        </ThemedText>
        {/* 장기 미발송(2026-09-29) — 7일 넘으면 빨간색(서버도 그때 소속사에 알림) */}
        {actor.retiredAt ? (
          <ThemedText type="caption" themeColor="textTertiary">
            {t('dashboard.retired')}
          </ThemedText>
        ) : (
          <ThemedText type="caption" themeColor={(idle ?? IDLE_WARN_DAYS) >= IDLE_WARN_DAYS ? 'danger' : 'textTertiary'}>
            {idle === null ? t('console.noMessagesYet') : idle === 0 ? t('console.lastMessageToday') : t('console.lastMessageDays', { count: idle })}
          </ThemedText>
        )}
      </View>
      {unread > 0 ? (
        <ThemedText type="captionBold" style={{ color: theme.tint }}>
          {t('consoleAlerts.newLabel')}
        </ThemedText>
      ) : null}
      <Icon as={ChevronRight} size={18} color={theme.textTertiary} />
    </Pressable>
  );
}

/** 소속 아티스트(2026-10-13: "내가 관리하는 아티스트" → "소속 아티스트", 하단 탭/왼쪽 메뉴 두 번째) — 누르면 모니터링·답장·통계 */
export default function ConsoleArtistsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: actors, isLoading } = useMyActors();
  const unread = useConsoleUnread();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <FlatList
          data={actors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<ScreenIntro text={t('console.description')} />}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              {t('console.empty')}
            </ThemedText>
          }
          renderItem={({ item }) => <ActorRow actor={item} unread={unread.get(item.id) ?? 0} onPress={() => router.push(`/console/${item.id}`)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: 820, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.three },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12 },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.four },
  loading: { marginTop: Spacing.four },
});
