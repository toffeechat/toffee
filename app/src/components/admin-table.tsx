import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWideLayout } from '@/components/wide-shell';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

// 운영자 화면 표·배지(2026-10-22 — 회원 상세가 줄글이라 뭐가 뭔지 안 보인다는 사용자 피드백). 색은 브랜드 팔레트만:
// 빨강 danger(막힘·대기), 주황 chart2(운영자·소속사가 지움), 라벤더 tint(정상·완료), 회색(지난 일)

export type BadgeTone = 'danger' | 'warn' | 'ok' | 'muted';

function toneColor(theme: ReturnType<typeof useTheme>, tone: BadgeTone) {
  return tone === 'danger' ? theme.danger : tone === 'warn' ? theme.chart2 : tone === 'ok' ? theme.chart1 : theme.textSecondary;
}

export function AdminBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const theme = useTheme();
  const color = toneColor(theme, tone);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1F` }]}>
      <ThemedText type="captionBold" style={{ color }} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

export interface AdminColumn {
  title: string;
  flex: number;
}

/** 표 — PC 넓은 화면은 열 제목 + 줄, 폰·좁은 창은 한 줄을 작은 카드(열 제목: 값)로 */
export function AdminTable({ columns, rows }: { columns: AdminColumn[]; rows: { key: string; cells: ReactNode[]; faded?: boolean }[] }) {
  const theme = useTheme();
  const wide = useWideLayout();
  if (!wide) {
    return (
      <View style={styles.cards}>
        {rows.map((row) => (
          <View key={row.key} style={[styles.card, { backgroundColor: theme.background, opacity: row.faded ? 0.6 : 1 }]}>
            {row.cells.map((cell, i) =>
              cell === null || cell === '' ? null : (
                <View key={columns[i].title} style={styles.cardLine}>
                  <ThemedText type="caption" themeColor="textTertiary" style={styles.cardLabel}>
                    {columns[i].title}
                  </ThemedText>
                  <View style={styles.flex}>{typeof cell === 'string' ? <ThemedText type="small">{cell}</ThemedText> : cell}</View>
                </View>
              ),
            )}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.table, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={[styles.row, styles.head, { borderBottomColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        {columns.map((column) => (
          <ThemedText key={column.title} type="captionBold" themeColor="textSecondary" style={{ flex: column.flex }}>
            {column.title}
          </ThemedText>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={row.key} style={[styles.row, { borderBottomColor: theme.border, borderBottomWidth: r === rows.length - 1 ? 0 : StyleSheet.hairlineWidth, opacity: row.faded ? 0.6 : 1 }]}>
          {row.cells.map((cell, i) => (
            <View key={columns[i].title} style={{ flex: columns[i].flex }}>
              {typeof cell === 'string' ? <ThemedText type="small">{cell}</ThemedText> : cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** 표 한 묶음 — 제목 + 건수 배지, 0건이면 "없음" 한 줄로 접음 */
export function AdminTableBlock({ title, count, tone = 'muted', note, children }: { title: string; count: number; tone?: BadgeTone; note?: string; children?: ReactNode }) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
        <AdminBadge label={`${count}`} tone={count ? tone : 'muted'} />
        {note ? (
          <ThemedText type="caption" themeColor="textTertiary">
            {note}
          </ThemedText>
        ) : null}
      </View>
      {count ? (
        children
      ) : (
        <ThemedText type="small" themeColor="textTertiary">
          없음
        </ThemedText>
      )}
    </View>
  );
}

/** 상태 요약 카드 — 문제가 있으면 빨간 테두리·옅은 빨간 바탕, 없으면 라벤더 */
export function AdminSummaryCard({ alert, title, children }: { alert: boolean; title: string; children: ReactNode }) {
  const theme = useTheme();
  const color = alert ? theme.danger : theme.chart1;
  return (
    <View style={[styles.summary, { borderColor: color, backgroundColor: `${color}12` }]}>
      <ThemedText type="defaultSemiBold" style={{ color }}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

export function AdminBadgeRow({ children }: { children: ReactNode }) {
  return <View style={styles.badgeRow}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.pill },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2, alignItems: 'center' },
  table: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  head: { borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  cards: { gap: Spacing.two },
  card: { borderRadius: Radius.md, padding: Spacing.three, gap: 4 },
  cardLine: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  cardLabel: { width: 64, paddingTop: 1 },
  block: { gap: Spacing.two, marginTop: Spacing.two },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  summary: { borderWidth: 1.5, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two },
});
