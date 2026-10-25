import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWideLayout } from '@/components/wide-shell';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

// 운영자 화면 표·배지(2026-10-22 — 회원 상세가 줄글이라 뭐가 뭔지 안 보인다는 사용자 피드백). 색은 브랜드 팔레트만:
// 빨강 danger(막힘·대기), 주황 chart2(운영자·소속사가 지움·곧 바뀜), 라벤더 tint(정상·완료), 회색(지난 일)

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

/** 목록 맨 위 숫자 카드(2026-10-25 아티스트·회원 목록) — 누르면 그 조건으로 거르고, 다시 누르면 풂. 숫자가 0이면 회색 */
export interface AdminStatTile {
  key: string;
  label: string;
  count: number | undefined;
  tone: BadgeTone;
}

export function AdminStatTiles({ tiles, selected, onSelect }: { tiles: AdminStatTile[]; selected: string | null; onSelect: (key: string | null) => void }) {
  const theme = useTheme();
  const wide = useWideLayout();
  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => {
        const on = selected === tile.key;
        const color = tile.count ? toneColor(theme, tile.tone) : theme.textSecondary;
        return (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(on ? null : tile.key)}
            style={({ hovered }) => [
              styles.tile,
              wide ? styles.tileWide : styles.tileNarrow,
              { borderColor: on ? color : theme.border, backgroundColor: on ? `${color}1A` : hovered ? theme.backgroundElement : theme.background },
            ]}>
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={wide ? undefined : styles.flex}>
              {tile.label}
            </ThemedText>
            <ThemedText type={wide ? 'subtitle' : 'defaultSemiBold'} style={{ color }}>
              {tile.count === undefined ? '–' : tile.count.toLocaleString()}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export type SortDir = 'asc' | 'desc';
export interface AdminSort<K extends string> {
  key: K;
  dir: SortDir;
}

/** 정렬되는 표의 열 제목 줄 — sortKey가 있는 열만 누를 수 있음(같은 열을 다시 누르면 방향이 바뀜) */
export function AdminSortHeader<K extends string>({
  columns,
  sort,
  onSort,
}: {
  columns: (AdminColumn & { sortKey?: K; firstDir?: SortDir })[];
  sort: AdminSort<K> | null;
  onSort: (sort: AdminSort<K>) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.head, styles.listHead, { borderBottomColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      {columns.map((column) => {
        const active = !!column.sortKey && sort?.key === column.sortKey;
        const label = `${column.title}${active ? (sort!.dir === 'asc' ? ' ▲' : ' ▼') : ''}`;
        return column.sortKey ? (
          <Pressable
            key={column.title}
            accessibilityRole="button"
            onPress={() => onSort({ key: column.sortKey!, dir: active ? (sort!.dir === 'asc' ? 'desc' : 'asc') : (column.firstDir ?? 'asc') })}
            style={{ flex: column.flex }}>
            <ThemedText type="captionBold" style={{ color: active ? theme.tint : theme.textSecondary }} numberOfLines={1}>
              {label}
            </ThemedText>
          </Pressable>
        ) : (
          <ThemedText key={column.title} type="captionBold" themeColor="textSecondary" style={{ flex: column.flex }} numberOfLines={1}>
            {label}
          </ThemedText>
        );
      })}
    </View>
  );
}

/** 정렬되는 표의 한 줄(누르면 상세) — 열 너비는 AdminSortHeader와 같은 columns */
export function AdminListRow({ columns, cells, faded, onPress }: { columns: AdminColumn[]; cells: ReactNode[]; faded?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }) => [styles.row, { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, opacity: faded ? 0.6 : 1 }, hovered && { backgroundColor: theme.backgroundElement }]}>
      {cells.map((cell, i) => (
        <View key={columns[i].title} style={{ flex: columns[i].flex }}>
          {typeof cell === 'string' ? (
            <ThemedText type="small" numberOfLines={1}>
              {cell}
            </ThemedText>
          ) : (
            cell
          )}
        </View>
      ))}
    </Pressable>
  );
}

/** 폰 폭 목록의 한 줄 카드 — 왼쪽(사진·이름), 오른쪽 핵심 배지 2~3개 */
export function AdminCompactRow({ left, right, faded, onPress }: { left: ReactNode; right: ReactNode; faded?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.compact, { backgroundColor: theme.backgroundElement, opacity: faded ? 0.6 : 1 }]}>
      <View style={styles.compactLeft}>{left}</View>
      <View style={styles.compactRight}>{right}</View>
      <ThemedText type="small" themeColor="textTertiary">
        ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { borderWidth: 1.5, borderRadius: Radius.md, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, gap: 2 },
  tileWide: { flexGrow: 1, flexBasis: 140 },
  // 폰은 두 칸씩, 이름과 숫자를 한 줄에(세로 자리 아끼기)
  tileNarrow: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  listHead: { borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md },
  compact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.md, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  compactLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minWidth: 0 },
  compactRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2, flexShrink: 0 },
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
