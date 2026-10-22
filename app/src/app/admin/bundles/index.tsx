import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AdminButton, AdminButtonRow, AdminSection, formatBaht } from '@/components/admin-ui';
import { storeGroupText, useAdminBundles } from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

/** 묶음 상품 관리(2026-09-29) — 여러 배우 개인방을 할인가로 한 번에 파는 상품. 판매 중지해도 이미 산 팬은 유지 */
export default function AdminBundlesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: bundles, isLoading } = useAdminBundles();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 묶음 = 패키지 상품(방들을 할인가로 파는 것) — 방(아티스트·CP) 등록과 따로(2026-10-20 사용자 결정). 보통은 CP로 3개 한 번에 */}
        <AdminButtonRow>
          <AdminButton label="CP로 패키지 3개 한 번에(A + CP · B + CP · 전체)" onPress={() => router.push('/admin/bundles/cp-set')} />
          <AdminButton secondary label="직접 고르기(아무 조합)" onPress={() => router.push('/admin/bundles/new')} />
        </AdminButtonRow>
        {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
        {bundles?.length === 0 ? (
          <AdminSection title="아직 묶음이 없어요" hint="보통은 CP마다 '아티스트 + CP방' 2개와 '전체' 1개를 만들어요(위 첫 번째 버튼). 개인방·CP방 어느 조합이든 직접 고를 수도 있어요." />
        ) : null}
        {bundles?.map((bundle) => (
          <Pressable
            key={bundle.id}
            onPress={() => router.push({ pathname: '/admin/bundles/[id]', params: { id: bundle.id } })}
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.rowHead}>
              <ThemedText type="smallBold" style={styles.flex}>
                {bundle.name}
              </ThemedText>
              <ThemedText type="small" themeColor={bundle.active ? 'textSecondary' : 'danger'}>
                {bundle.active ? '판매 중' : '판매 중지'}
              </ThemedText>
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary">
              {bundle.actors.map((actor) => actor.legalName).join(' + ')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatBaht(bundle.priceCents)}/월 (개인 합계 {formatBaht(bundle.regularPriceCents)}) · 구독 {bundle.activePurchaseCount}명 ·{' '}
              {bundle.storeProductId ?? '스토어 상품 미등록'}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              {storeGroupText(bundle.storeGroup)}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  row: { padding: Spacing.three, borderRadius: 12, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' },
  flex: { flex: 1 },
});
