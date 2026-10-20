import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminSection } from '@/components/admin-ui';
import { useAppleStoreTodo, useMarkSaleStopped } from '@/hooks/use-admin';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { formatBangkokDateTime } from '@/utils/release';

/**
 * 애플 판매 중지 할 일(2026-10-20) — 활동 종료(예정) 방이 든 애플 상품. 구글 구독은 서버가 자동으로 갱신을 끊지만, 애플은 개발자가 팬 구독을
 * 끊는 API가 없어서 운영자가 App Store Connect에서 그 상품을 판매 중지해야 기존 구독이 갱신되지 않음. 판매 중지한 뒤 여기서 [판매 중지함].
 */
export default function AdminStoreTodoScreen() {
  const theme = useTheme();
  const { data, isLoading } = useAppleStoreTodo();
  const mark = useMarkSaleStopped();
  const done = async (kind: 'actors' | 'bundles', id: string, name: string) => {
    if (await confirm('판매 중지함', `App Store Connect에서 "${name}" 상품을 판매 중지했나요? 표시하면 할 일에서 빠져요.`, '판매 중지함', '취소', false)) mark.mutate({ kind, id });
  };
  const empty = data && data.actors.length === 0 && data.bundles.length === 0;
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdminSection
          title="이렇게 하면 돼요"
          hint="① App Store Connect → 앱 → 구독 → 아래 상품 ID → 사용 가능 여부에서 모든 국가 빼기(판매 중지) ② 여기서 [판매 중지함]. 월 구독이라 종료일 31일 전까지 해 두면 다음 갱신이 안 생겨요. 그래도 종료 뒤 갱신된 결제는 팬이 환불을 요청할 수 있어요(애플 환불 안내). 구글 구독은 서버가 자동으로 갱신을 끊어요."
        />
        {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
        {empty ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            판매 중지할 애플 상품이 없어요.
          </ThemedText>
        ) : null}
        {data?.actors.map((actor) => (
          <View key={actor.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{actor.legalName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" selectable>
              상품 ID {actor.storeProductId} ·{' '}
              {actor.retiredAt ? '활동 종료됨' : actor.retireAt ? `${formatBangkokDateTime(actor.retireAt)}(태국) 종료 예정` : ''}
            </ThemedText>
            <AdminButtonRow>
              <AdminButton label="판매 중지함" disabled={mark.isPending} onPress={() => void done('actors', actor.id, actor.storeProductId)} />
            </AdminButtonRow>
          </View>
        ))}
        {data?.bundles.map((bundle) => (
          <View key={bundle.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">묶음 {bundle.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" selectable>
              상품 ID {bundle.storeProductId}
            </ThemedText>
            <AdminButtonRow>
              <AdminButton label="판매 중지함" disabled={mark.isPending} onPress={() => void done('bundles', bundle.id, bundle.storeProductId)} />
            </AdminButtonRow>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  row: { borderRadius: 14, padding: Spacing.three, gap: 4 },
  empty: { textAlign: 'center', marginTop: Spacing.four },
});
