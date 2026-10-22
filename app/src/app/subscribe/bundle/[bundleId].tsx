import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Bell, BellRing, ChevronLeft, SearchX, Sparkle } from 'lucide-react-native';

import { BundleAvatars } from '@/components/bundle-card';
import { MembershipBenefits } from '@/components/membership-benefits';
import { PurchaseDisclosure } from '@/components/purchase-disclosure';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { ApiError } from '@/lib/api-client';
import { bundleDiscountPercent, useBundle, useBundleSwitchInfo, useSubscribeBundle, useSwitchBundle } from '@/hooks/use-bundles';
import { useMySubscriptions } from '@/hooks/use-subscriptions';
import { STORE_REPLACE_NOT_FOUND, useStorePurchase } from '@/hooks/use-store-purchase';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/utils/price';
import { formatReleaseAt } from '@/utils/release';
import { useReleaseWatch, useUpcoming } from '@/hooks/use-release';

/**
 * 묶음 구독 확인 → 완료(2026-09-29) — 개인 구독 화면(P-2)과 같은 흐름. 사진 대신 배우들 사진을 겹쳐 보여주고, 개인
 * 구독 합계 대비 할인·포함된 배우·이미 개인 구독 중인 배우는 묶음으로 옮겨진다는 안내를 구독 버튼 전에 분명히.
 * 결제: 앱이고 묶음에 스토어 상품 ID가 있으면 스토어 결제, 아니면 결제 없는 테스트 구독(서버가 켜 둔 경우만). 스토어 결제면 이미 개인
 * 구독 중인 배우의 스토어 구독은 앱이 끊을 수 없어서 "스토어에서 해지" 안내를 따로 보여 줌.
 * 같은 CP 묶음 갈아타기(2026-10-22): 같은 CP의 다른 묶음을 이미 가진 팬에겐 [구독하기] 대신 [이 묶음으로 바꾸기] + 바뀌는 시점. 스토어가 같은 구독
 * 그룹으로 처리해서 결제는 하나로 유지. 다른 스토어(아이폰에서 산 걸 안드로이드에서 등)로 산 묶음은 그 스토어에서 바꾸라고만 안내.
 */
export default function SubscribeBundleScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bundleId } = useLocalSearchParams<{ bundleId: string }>();
  const { data: bundle, isLoading, isError } = useBundle(bundleId);
  const { data: subscriptions } = useMySubscriptions();
  const subscribe = useSubscribeBundle(bundleId);
  const { data: switchFrom } = useBundleSwitchInfo(bundleId);
  const switchSandbox = useSwitchBundle(bundleId);
  const [done, setDone] = useState(false);
  const store = useStorePurchase({ kind: 'bundle', id: bundleId, sku: bundle?.storeProductId });
  const storeBuy = useMutation({ mutationFn: store.buy, onSuccess: (result) => result && setDone(true) });
  const failure = storeBuy.error ?? subscribe.error ?? switchSandbox.error;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // 공개 예정 묶음(2026-10-19) — 묶음·든 방 중 가장 늦은 공개 시각까지는 구독 대신 알림 받기
  const upcoming = useUpcoming(bundle?.opensAt);
  const release = useReleaseWatch({ kind: 'bundles', id: bundleId }, upcoming);
  const [notice, setNotice] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      </SafeAreaView>
    );
  }
  if (isError || !bundle) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
        <IconButton icon={ChevronLeft} label={t('actorProfile.back')} onPress={back} style={styles.backPlain} />
        <EmptyState icon={SearchX} title={t('bundle.notFound')} />
      </SafeAreaView>
    );
  }

  const price = store.displayPrice ?? formatPrice(bundle.priceCents);
  const discount = bundleDiscountPercent(bundle);
  // 이미 개인 구독으로 열려 있는 배우 — 묶음으로 옮겨지고 대화는 이어짐
  const alreadySingle = bundle.actors.filter((actor) =>
    subscriptions?.some((sub) => sub.actorId === actor.id && sub.coveredBy.some((cover) => !cover.bundle)),
  );

  // 갈아타기 — 지금 묶음을 산 스토어가 이 기기 스토어와 다르면 여기선 못 바꿈(그 스토어 구독 관리에서)
  const thisStore = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : null;
  const switching = !!switchFrom;
  const otherStore = !!switchFrom?.platform && switchFrom.platform !== thisStore;
  const switchTimingText = switchFrom
    ? switchFrom.timing === 'next-renewal'
      ? t('bundle.switchNextRenewal', { date: switchFrom.renewsAt ? new Date(switchFrom.renewsAt).toLocaleDateString(i18n.language) : '-' })
      : switchFrom.platform === 'IOS'
        ? t('bundle.switchNowApple')
        : switchFrom.platform === 'ANDROID'
          ? t('bundle.switchNowGoogle')
          : t('bundle.switchNow')
    : null;
  const startSwitch = () => {
    if (!switchFrom) return;
    if (switchFrom.platform) storeBuy.mutate({ replaceSku: switchFrom.bundle.storeProductId });
    else switchSandbox.mutate(undefined, { onSuccess: () => setDone(true) });
  };

  if (done) {
    return (
      <View style={[styles.flex, styles.doneWrap]}>
        <LinearGradient colors={['#7C8CFF', '#0F1115']} style={StyleSheet.absoluteFill} />
        <View style={[styles.doneBody, { paddingBottom: insets.bottom + Spacing.five }]}>
          <BundleAvatars actors={bundle.actors} size={72} />
          <Icon as={Sparkle} size={28} color="#ffffff" fill="#ffffff" />
          <ThemedText type="display" style={styles.onDark}>
            {t('subscribeFlow.doneTitle')}
          </ThemedText>
          <ThemedText style={styles.onDarkSoft}>
            {switching
              ? switchFrom!.timing === 'next-renewal'
                ? t('bundle.switchDoneLater', { name: bundle.name })
                : t('bundle.switchDone', { name: bundle.name })
              : t('bundle.doneBody', { name: bundle.name })}
          </ThemedText>
          <Button title={t('bundle.goInbox')} variant="accent" iconRight={ArrowRight} style={styles.doneCta} onPress={() => router.replace('/chats')} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.head}>
          <BundleAvatars actors={bundle.actors} size={88} />
          <ThemedText type="small" themeColor="textSecondary">
            {switching ? t('bundle.switchTitle') : t('bundle.subscribeTo')}
          </ThemedText>
          <ThemedText type="display" style={styles.center}>
            {bundle.name}
          </ThemedText>
          <View style={styles.price}>
            <ThemedText type="title">{price}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {' '}
              {t('actorProfile.perMonth')}
            </ThemedText>
          </View>
          {discount > 0 ? (
            <View style={[styles.save, { backgroundColor: theme.tintSoft }]}>
              <ThemedText type="captionBold" style={{ color: theme.tint }}>
                {t('bundle.saveDetail', { regular: formatPrice(bundle.regularPriceCents), percent: discount })}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="headline">{t('bundle.includes', { count: bundle.actors.length })}</ThemedText>
          {bundle.actors.map((actor) => (
            <View key={actor.id} style={styles.actorRow}>
              <Avatar uri={actor.chatProfileImageUrl} size={40} />
              <View style={styles.flex}>
                <ThemedText type="defaultSemiBold">{actor.legalName}</ThemedText>
                <ThemedText type="caption" themeColor="textTertiary">
                  {t('bundle.singlePrice', { price: formatPrice(actor.monthlyPriceCents) })}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        {/* "OO님과 1:1 메시지"의 이름 자리엔 묶음 이름 대신 배우 이름들("A · B님과") */}
        <MembershipBenefits name={bundle.actors.map((actor) => actor.legalName).join(' · ')} detailed />

        {switchFrom ? (
          <View style={[styles.card, { backgroundColor: theme.tintSoft }]}>
            <ThemedText type="defaultSemiBold">{t('bundle.switchFrom', { name: switchFrom.bundle.name })}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {otherStore ? t('bundle.switchOtherStore', { store: switchFrom.platform === 'IOS' ? 'App Store' : 'Google Play' }) : switchTimingText}
            </ThemedText>
          </View>
        ) : null}

        {!switching && alreadySingle.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {store.available
              ? t('bundle.replacesSingleStore', { names: alreadySingle.map((actor) => actor.chatDisplayName).join(', ') })
              : t('bundle.replacesSingle', { names: alreadySingle.map((actor) => actor.chatDisplayName).join(', ') })}
          </ThemedText>
        ) : null}
        {failure && (
          <ThemedText type="small" themeColor="danger" style={styles.center}>
            {failure instanceof ApiError ? failure.message : failure instanceof Error && failure.message === STORE_REPLACE_NOT_FOUND ? t('bundle.switchNoPurchase') : t('subscribeFlow.failed')}
          </ThemedText>
        )}
        {upcoming ? (
          <>
            <View style={[styles.save, styles.releaseBox, { backgroundColor: theme.tintSoft }]}>
              <ThemedText type="captionBold" style={{ color: theme.tint }}>
                {t('release.comingSoon')}
              </ThemedText>
              <ThemedText type="headline">{t('release.opensAt', { date: formatReleaseAt(bundle.opensAt!, i18n.language) })}</ThemedText>
            </View>
            <Button
              title={release.watching ? t('release.notifying') : t('release.notifyMe')}
              icon={release.watching ? BellRing : Bell}
              variant={release.watching ? 'secondary' : 'accent'}
              disabled={!release.canWatch || release.toggle.isPending}
              onPress={() =>
                release.toggle.mutate(!release.watching, {
                  onSuccess: (result) => setNotice(result.watching ? t('release.notifyOn') : t('release.notifyOff')),
                  onError: (error) => setNotice(error instanceof ApiError ? error.message : t('release.notifyFailed')),
                })
              }
            />
            <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
              {notice ?? t('release.notifyHint')}
            </ThemedText>
          </>
        ) : switching ? (
          otherStore ? null : (
            <Button title={t('bundle.switchCta')} variant="accent" loading={switchSandbox.isPending || storeBuy.isPending} onPress={startSwitch} />
          )
        ) : (
          <Button
            title={t('subscribeFlow.cta', { price })}
            variant="accent"
            loading={subscribe.isPending || storeBuy.isPending}
            onPress={() => (store.available ? storeBuy.mutate() : subscribe.mutate(undefined, { onSuccess: () => setDone(true) }))}
          />
        )}
        <PurchaseDisclosure bundle />
        {store.available ? null : (
          <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
            {t('subscribeFlow.sandboxNote')}
          </ThemedText>
        )}
      </ScrollView>
      <IconButton icon={ChevronLeft} label={t('actorProfile.back')} onPress={back} style={[styles.back, { top: insets.top + Spacing.two }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  head: { alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  price: { flexDirection: 'row', alignItems: 'baseline', marginTop: Spacing.one },
  save: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4, marginTop: Spacing.one },
  card: { borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.three },
  releaseBox: { alignSelf: 'center', alignItems: 'center', borderRadius: Radius.lg, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  actorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  center: { textAlign: 'center' },
  back: { position: 'absolute', left: Spacing.three },
  backPlain: { margin: Spacing.three },
  loading: { marginTop: Spacing.six },
  doneWrap: { justifyContent: 'flex-end' },
  doneBody: { paddingHorizontal: Spacing.four, gap: Spacing.two, alignItems: 'center', width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  onDark: { color: '#ffffff', textAlign: 'center' },
  onDarkSoft: { color: 'rgba(255,255,255,0.82)', textAlign: 'center' },
  doneCta: { alignSelf: 'stretch', marginTop: Spacing.four, marginBottom: Spacing.two },
});
