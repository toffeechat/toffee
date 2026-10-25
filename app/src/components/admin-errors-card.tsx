import { Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Bug, ExternalLink } from 'lucide-react-native';

import { Panel } from '@/components/console-charts';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useAdminErrors } from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';

const SHOW = 5;

function ago(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

const open = (url: string) => {
  if (url) void Linking.openURL(url).catch(() => {});
};

/**
 * 운영자 홈 "최근 오류"(2026-10-25 사용자 결정, 1차) — Sentry 미해결 오류(제목·횟수·마지막 발생·영향 받은 사용자),
 * 누르면 Sentry 상세. 서버에 Sentry API 토큰이 없으면 "Sentry 연결 전" 안내만.
 */
export function AdminErrorsCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const { data } = useAdminErrors();
  if (!data) return null;

  if (data.status === 'NOT_CONNECTED') {
    return (
      <Panel title="최근 오류" icon={Bug} style={style}>
        <ThemedText type="small" themeColor="textSecondary">
          Sentry 연결 전이에요. 서버에 Sentry API 토큰(SENTRY_API_TOKEN)을 넣으면 앱·서버 오류가 여기 보이고, 새 오류는 운영자 알림으로 와요.
        </ThemedText>
      </Panel>
    );
  }

  const issues = data.issues.slice(0, SHOW);
  const right = data.listUrl ? (
    <Pressable onPress={() => open(data.listUrl)} accessibilityRole="link" hitSlop={8} style={styles.more}>
      <ThemedText type="caption" themeColor="tint">
        Sentry에서 전체 보기
      </ThemedText>
      <Icon as={ExternalLink} size={12} color={theme.tint} />
    </Pressable>
  ) : undefined;
  const caption =
    data.status === 'FAILED'
      ? `Sentry에서 가져오지 못했어요(${data.error ?? '알 수 없는 오류'})${data.fetchedAt ? ` — ${ago(data.fetchedAt)} 목록` : ''}`
      : `미해결 오류 · 최근 24시간 ${data.total24h.toLocaleString()}번 · 5분마다 새로 가져와요`;

  return (
    <Panel title="최근 오류" icon={Bug} right={right} caption={caption} style={style}>
      {issues.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {data.status === 'OK' ? '해결 안 된 오류가 없어요.' : '보여 줄 목록이 없어요.'}
        </ThemedText>
      ) : (
        issues.map((issue) => (
          <Pressable
            key={issue.id}
            onPress={() => open(issue.url)}
            accessibilityRole="link"
            style={({ hovered }) => [styles.row, { borderColor: theme.border }, hovered && { backgroundColor: theme.backgroundSelected }]}>
            <View style={styles.flex}>
              <ThemedText type="smallMedium" numberOfLines={2} themeColor={issue.level === 'fatal' || issue.level === 'error' ? 'danger' : 'text'}>
                {issue.title}
              </ThemedText>
              <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
                {issue.culprit ? `${issue.culprit} · ` : ''}
                {issue.project}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                전체 {issue.count.toLocaleString()}번 · 24시간 {issue.count24h.toLocaleString()}번 · 사용자 {issue.userCount.toLocaleString()}명 · 마지막 {ago(issue.lastSeen)}
              </ThemedText>
            </View>
            <Icon as={ExternalLink} size={14} color={theme.textTertiary} />
          </Pressable>
        ))
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
  },
});
