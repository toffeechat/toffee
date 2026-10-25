import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminChip } from '@/components/admin-ui';
import { ROLE_LABELS } from '@/components/admin-user-panels';
import { useAdminInquiries, type AdminInquiryStatus } from '@/hooks/use-admin';
import { INQUIRY_CATEGORIES, type InquiryCategory } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export const INQUIRY_CATEGORY_LABEL: Record<string, string> = { ACCOUNT: '계정', PAYMENT: '결제', REFUND: '환불', ARTIST: '아티스트·대화', BUG: '오류', OTHER: '기타' };
export const INQUIRY_STATUS_LABEL: Record<AdminInquiryStatus, string> = { OPEN: '답변 대기', ANSWERED: '답변함', CLOSED: '종료' };
const TABS: (AdminInquiryStatus | null)[] = ['OPEN', 'ANSWERED', 'CLOSED', null];

/**
 * 1:1 문의함(2026-10-20) — 답변 대기는 오래된 것부터. 새 문의·추가 질문은 운영자 알림(푸시·메일)으로도 옴.
 * 2026-10-25: 종류 칩(개수) — 상태 칩 숫자는 고른 종류 안에서, 종류 칩 숫자는 고른 상태 안에서
 */
export default function AdminInquiriesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<AdminInquiryStatus | null>('OPEN');
  const [category, setCategory] = useState<InquiryCategory | null>(null);
  const { data, isLoading } = useAdminInquiries(status ?? undefined, category ?? undefined);
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.chips}>
              {TABS.map((tab) => (
                <AdminChip key={tab ?? 'ALL'} label={tab ? INQUIRY_STATUS_LABEL[tab] : '전체'} count={data?.counts[tab ?? 'ALL']} selected={status === tab} onPress={() => setStatus(tab)} />
              ))}
              {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
            </View>
            <View style={styles.chips}>
              {[null, ...INQUIRY_CATEGORIES].map((key) => (
                <AdminChip
                  key={key ?? 'ALL'}
                  label={key ? INQUIRY_CATEGORY_LABEL[key] : '모든 종류'}
                  count={data?.categoryCounts?.[key ?? 'ALL']}
                  selected={category === key}
                  onPress={() => setCategory(key)}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {category ? `${INQUIRY_CATEGORY_LABEL[category]} 문의가 없어요.` : status === 'OPEN' ? '답을 기다리는 문의가 없어요.' : '문의가 없어요.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/admin/inquiries/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.rowTop}>
              <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                [{INQUIRY_CATEGORY_LABEL[item.category] ?? item.category}] {item.title}
              </ThemedText>
              <ThemedText type="small" themeColor={item.status === 'OPEN' ? 'danger' : 'textSecondary'}>
                {INQUIRY_STATUS_LABEL[item.status]}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {item.user.nickname ?? item.user.displayName} · {ROLE_LABELS[item.user.role]} · 글 {item._count?.messages ?? 0}개 · {new Date(item.updatedAt).toLocaleString('ko-KR')}
            </ThemedText>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.two },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  row: { borderRadius: 12, padding: Spacing.three, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.four },
});
