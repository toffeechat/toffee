import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BellOff } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { useMySubscriptions, useSetNotificationsMuted, type Subscription } from '@/hooks/use-subscriptions';
import { useMe, useSetBirthdayGreetings, useUpdateNotificationSettings } from '@/hooks/use-onboarding';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** 알림 — 배우별 새 메시지 알림 켜기/끄기(채팅방 🔔과 같은 설정). 끄면 푸시만 빠지고 메시지는 그대로 */
export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { role } = useAuth();
  const { data: subscriptions } = useMySubscriptions();
  // 아티스트·소속사는 따로(2026-10-12 역할별 알림 설정)
  if (role === 'ACTOR' || role === 'AGENCY_STAFF') return <StaffAlerts staff={role === 'AGENCY_STAFF'} />;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <BirthdayToggle />
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {t('profile.notificationsHint')}
      </ThemedText>
      {subscriptions && subscriptions.length === 0 ? <EmptyState icon={BellOff} title={t('profile.noSubscriptions')} /> : null}
      {subscriptions?.map((sub) => <ActorToggle key={sub.id} sub={sub} />)}
    </ScrollView>
  );
}

/** 생일 축하 메시지 받기(2026-10-12) — 켜면 생일(월·일) 아침에 구독 중인 아티스트가 써 둔 축하 메시지가 옴. 아티스트에겐 날짜가 안 보임 */
function BirthdayToggle() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const setEnabled = useSetBirthdayGreetings();
  if (!me || me.hasBirthDate === false) return null;
  return (
    <View style={[styles.birthday, { borderBottomColor: theme.border }]}>
      <View style={styles.row}>
        <ThemedText type="defaultMedium" style={styles.name}>
          {t('birthday.toggle')}
        </ThemedText>
        <Switch
          value={setEnabled.isPending ? setEnabled.variables : !!me.birthdayGreetingsEnabled}
          onValueChange={(on) => setEnabled.mutate(on)}
          trackColor={{ true: theme.tint, false: theme.border }}
          thumbColor="#ffffff"
          accessibilityLabel={t('birthday.toggle')}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {t('birthday.hint')}
      </ThemedText>
    </View>
  );
}

/**
 * 아티스트·소속사 알림 설정(2026-10-12) — 소속사: 소속 아티스트 새 메시지·스토리 알림, 둘 다: 장기 미발송 알림.
 * 환불 기준 경고(30일 미발송 직전)는 놓치면 안 돼서 끌 수 없음(안내 문구로 알림)
 */
function StaffAlerts({ staff }: { staff: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: me } = useMe();
  const update = useUpdateNotificationSettings();
  if (!me) return null;
  const pending = update.isPending ? update.variables : {};
  const rows: { key: 'notifyArtistMessages' | 'notifyIdleAlerts'; title: string; hint: string }[] = [
    ...(staff ? [{ key: 'notifyArtistMessages' as const, title: t('alerts.artistMessages'), hint: t('alerts.artistMessagesHint') }] : []),
    { key: 'notifyIdleAlerts', title: t('alerts.idle'), hint: t(staff ? 'alerts.idleHintStaff' : 'alerts.idleHintArtist') },
  ];
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      {rows.map((row) => (
        <View key={row.key} style={[styles.birthday, { borderBottomColor: theme.border }]}>
          <View style={styles.row}>
            <ThemedText type="defaultMedium" style={styles.name}>
              {row.title}
            </ThemedText>
            <Switch
              value={pending?.[row.key] ?? me[row.key] !== false}
              onValueChange={(on) => update.mutate({ [row.key]: on })}
              trackColor={{ true: theme.tint, false: theme.border }}
              thumbColor="#ffffff"
              accessibilityLabel={row.title}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {row.hint}
          </ThemedText>
        </View>
      ))}
      <ThemedText type="small" themeColor="textTertiary" style={styles.hint}>
        {t('alerts.refundNote')}
      </ThemedText>
    </ScrollView>
  );
}

function ActorToggle({ sub }: { sub: Subscription }) {
  const theme = useTheme();
  const setMuted = useSetNotificationsMuted(sub.actorId);
  return (
    <View style={styles.row}>
      <Avatar uri={sub.actor.chatProfileImageUrl} size={40} />
      <ThemedText type="defaultMedium" style={styles.name} numberOfLines={1}>
        {sub.actor.chatDisplayName}
      </ThemedText>
      <Switch
        value={!sub.notificationsMuted}
        onValueChange={(on) => setMuted.mutate(!on)}
        trackColor={{ true: theme.tint, false: theme.border }}
        thumbColor="#ffffff"
        accessibilityLabel={sub.actor.chatDisplayName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  hint: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: 10 },
  name: { flex: 1 },
  birthday: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: Spacing.two, marginBottom: Spacing.two },
});
