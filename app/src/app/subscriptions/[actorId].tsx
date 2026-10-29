import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react-native';

import { MembershipBenefits } from '@/components/membership-benefits';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ExpandableItem } from '@/components/expandable-item';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { openStoreSubscriptions, storeName } from '@/lib/store-subscriptions';
import { useCancelPurchase } from '@/hooks/use-bundles';
import { useMySubscriptions, useUnsubscribe } from '@/hooks/use-subscriptions';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/utils/price';

/**
 * 구독 상세 — DESIGN_GUIDE §11: 상태·월 요금·다음 결제일·자동 갱신 안내·혜택·해지.
 * 다음 결제일은 스토어 구독의 만료일을 "참고용"으로(2026-10-28 버블 비교 — 테스트 구독은 "스토어에서 확인"), 자동 결제 실패(유예 중)면
 * 맨 위에 결제 수단 확인 안내, 맨 아래 이용권 안내(결제일·환불·결제 실패·구매 복원).
 */
export default function SubscriptionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { actorId } = useLocalSearchParams<{ actorId: string }>();
  const { data: subscriptions } = useMySubscriptions();
  const sub = subscriptions?.find((s) => s.actorId === actorId);
  const unsubscribe = useUnsubscribe(actorId);
  const cancelPurchase = useCancelPurchase();
  const [error, setError] = useState<string | null>(null);

  if (!sub) {
    return <EmptyState icon={SearchX} title={t('manage.notFound')} />;
  }

  // 묶음으로만 열린 방이면 해지는 묶음 단위(묶음에 든 다른 배우 방도 같이 닫힘) — 개인 구독이 있으면 개인 구독 해지
  const single = sub.coveredBy.find((cover) => !cover.bundle);
  const bundleCover = single ? null : sub.coveredBy.find((cover) => cover.bundle);
  const cancelling = unsubscribe.isPending || cancelPurchase.isPending;
  // 스토어 결제 구독이면 해지는 스토어에서(앱이 끊으면 결제는 계속되고 방만 닫힘 — 서버도 409로 막음)
  const storePlatform = (single ?? bundleCover)?.iapPlatform;

  // 해지하면 목록으로 — 주소로 바로 열었거나 새로고침한 웹이면 돌아갈 곳이 없어 "구독 정보를 찾을 수 없어요"만 남았음(2026-10-20)
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/subscriptions'));
  // 해지 실패(2026-10-28) — 예전엔 버튼 로딩만 끝나고 아무 안내가 없었음(구독 관리 목록과 같은 문구)
  const onError = (e: unknown) => setError(e instanceof ApiError ? e.message : t('bundle.cancelFailed'));
  const cancel = async () => {
    setError(null);
    if (storePlatform) {
      const ok = await confirm(
        t('manage.cancelInStore'),
        t('manage.cancelInStoreBody', { store: storeName(storePlatform) }),
        t('manage.openStore', { store: storeName(storePlatform) }),
        t('common.cancel'),
      );
      if (ok) void openStoreSubscriptions().catch(() => {});
      return;
    }
    if (bundleCover?.bundle) {
      const ok = await confirm(
        t('bundle.cancelTitle'),
        t('bundle.cancelFromActor', { name: bundleCover.bundle.name }),
        t('bundle.cancel'),
        t('common.cancel'),
      );
      if (ok) cancelPurchase.mutate(bundleCover.purchaseId, { onSuccess: leave, onError });
      return;
    }
    const ok = await confirm(
      t('mypage.unsubscribeTitle'),
      t('mypage.unsubscribeConfirm', { name: sub.actor.chatDisplayName }),
      t('mypage.unsubscribe'),
      t('common.cancel'),
    );
    if (ok) unsubscribe.mutate(undefined, { onSuccess: leave, onError });
  };

  // 스토어에서 자동 갱신을 끈 방(2026-10-02) — "해지 예정" + 이용 종료일
  const endsOn = sub.endsAt ? new Date(sub.endsAt).toLocaleDateString(i18n.language) : null;
  const streakStart = sub.streakStartedAt ?? sub.startedAt;
  const rows: [string, string][] = [
    [t('manage.status'), endsOn ? t('manage.ending') : t('manage.active')],
    bundleCover?.bundle
      ? [t('manage.price'), t('bundle.via', { name: bundleCover.bundle.name })]
      : [t('manage.price'), `${formatPrice(sub.actor.monthlyPriceCents)} ${t('actorProfile.perMonth')}`],
    // 끊기지 않고 이어진 이번 구독의 시작일 + 며칠째(시작한 날이 1일째) — 장기 구독 혜택의 기준(2026-10-15 사용자 결정: 여러 번 나눠 구독한 걸
    // 합치지 않고 한 번 이어서 구독한 기간만). 2026-10-29부터 streakStartedAt — 만료 후 24시간 안에 다시 구독하면 이어짐, 개인 → 묶음 전환도 그대로
    [t('manage.started'), t('manage.startedDays', { date: new Date(streakStart).toLocaleDateString(i18n.language), days: daysSince(streakStart) })],
    // 장기 구독 혜택(2026-10-29) — 지금 답장 글자 수, 1년 이상이면 "1년+"
    ...(sub.replyMaxLength ? [[t('manage.replyLength'), t('manage.replyLengthValue', { max: sub.replyMaxLength })] as [string, string]] : []),
    ...(sub.yearBadge ? [[t('manage.badge'), t('streak.yearBadgeLabel')] as [string, string]] : []),
    endsOn
      ? [t('manage.endsOn'), endsOn]
      : [t('manage.nextBilling'), sub.renewsAt ? t('manage.nextBillingDate', { date: new Date(sub.renewsAt).toLocaleDateString(i18n.language) }) : t('manage.nextBillingStore')],
  ];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.head}>
        <Avatar uri={sub.actor.chatProfileImageUrl} size={72} />
        <ThemedText type="title">{sub.actor.chatDisplayName}</ThemedText>
      </View>

      {/* 자동 결제 실패 — 스토어 유예 기간 동안은 그대로 이용, 끝나면 방이 닫힘(2026-10-28, 버블의 "구독 갱신 보류 중") */}
      {sub.billingIssue ? (
        <View style={[styles.card, { backgroundColor: `${theme.danger}1A` }]}>
          <ThemedText type="smallBold" themeColor="danger">
            {t('manage.billingIssueTitle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('manage.billingIssueBody')}
          </ThemedText>
          {storePlatform ? (
            <Button title={t('manage.openStore', { store: storeName(storePlatform) })} variant="secondary" onPress={() => void openStoreSubscriptions().catch(() => {})} />
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
            <ThemedText type="smallMedium">{value}</ThemedText>
          </View>
        ))}
        <ThemedText type="caption" themeColor="textTertiary">
          {endsOn ? t('manage.endingNote') : t('manage.autoRenew')}
        </ThemedText>
      </View>

      <ThemedText type="headline" style={styles.sectionTitle}>
        {t('manage.benefits')}
      </ThemedText>
      <MembershipBenefits name={sub.actor.chatDisplayName} detailed />

      <View style={styles.actions}>
        <Button title={t('manage.openChat')} onPress={() => router.push(`/chat/${actorId}`)} />
        <Button
          title={storePlatform ? t('manage.cancelInStore') : bundleCover ? t('bundle.cancel') : t('manage.cancel')}
          variant="danger"
          loading={cancelling}
          onPress={cancel}
        />
        {error ? (
          <ThemedText type="small" themeColor="danger" style={styles.center}>
            {error}
          </ThemedText>
        ) : null}
      </View>

      <ExpandableItem title={t('manage.guideTitle')} body={t('manage.guideBody')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  head: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  card: { borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  sectionTitle: { marginTop: Spacing.three },
  actions: { gap: Spacing.two, marginTop: Spacing.four },
  center: { textAlign: 'center' },
});

const DAY_MS = 24 * 60 * 60 * 1000;
const daysSince = (iso: string) => Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS) + 1);
