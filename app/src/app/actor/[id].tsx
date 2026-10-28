import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Bell, BellRing, ChevronLeft, SearchX } from 'lucide-react-native';

import { BundleCard } from '@/components/bundle-card';
import { CoupleCard } from '@/components/couple-card';
import { Avatar } from '@/components/ui/avatar';
import { MembershipBenefits } from '@/components/membership-benefits';
import { useActorBundles } from '@/hooks/use-bundles';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { membersOf, useActor, useActorCouples } from '@/hooks/use-actors';
import { useMySubscriptions } from '@/hooks/use-subscriptions';
import { useScreenshotWarning } from '@/hooks/use-screenshot-warning';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/utils/price';
import { formatReleaseAt } from '@/utils/release';
import { useReleaseWatch, useUpcoming } from '@/hooks/use-release';
import { ApiError } from '@/lib/api-client';

/**
 * 배우 프로필 — Hybrid 시안(docs/product/brand/exploration/hybrid-recommendation-profile.png)의 분위기 + DESIGN_GUIDE §5의
 * 최종 결정: 배우 정보(큰 사진·이름·소속사) + 구독 정보(월 요금·혜택 아이콘 목록·"구독하고 메시지 받기")만.
 * 게시물·최근 콘텐츠 같은 피드 섹션은 넣지 않음. 무료 이용이 없다는 것도 숨기지 않고 적음.
 */
export default function ActorProfileScreen() {
  const theme = useTheme();
  // 프로필에서 캡처해도 경고(2026-10-28, 버블처럼) — 아티스트 사진·정보 무단 사용 안내
  useScreenshotWarning(true, 'profile');
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: actor, isLoading, isError } = useActor(id);
  const { data: subscriptions } = useMySubscriptions();
  const isSubscribed = subscriptions?.some((sub) => sub.actorId === id) ?? false;
  const { data: bundles } = useActorBundles(id);
  // 1인 배우면 이 배우가 든 커플방, 커플방이면 멤버 배우(2026-09-29)
  const isCouple = actor?.kind === 'COUPLE';
  const { data: couples } = useActorCouples(id, !!actor && !isCouple);
  const ownedBundleIds = new Set(subscriptions?.flatMap((sub) => sub.coveredBy.map((cover) => cover.bundle?.id)).filter(Boolean));
  const offers = (bundles ?? []).filter((bundle) => !ownedBundleIds.has(bundle.id));
  // 1인 아티스트의 묶음 중 CP방이 들어 있는 게 있으면 "CP와 함께 구독하면 더 저렴해요"
  const coupleIds = new Set((couples ?? []).map((room) => room.id));
  const withCouple = offers.some((bundle) => bundle.actors.some((member) => coupleIds.has(member.id)));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // 공개 예정(2026-10-19) — 시각 전엔 구독 대신 "알림 받기", 화면을 켜 둔 채 시각이 지나면 저절로 구독 버튼으로
  const upcoming = useUpcoming(actor?.releaseAt);
  // 활동 종료 예정(2026-10-20) — 방 자체 또는 CP 멤버 중 가장 이른 예정
  const retireAt = actor ? ([actor.retireAt, ...membersOf(actor).map((member) => member.retireAt)].filter((value): value is string => !!value).sort()[0] ?? null) : null;
  const release = useReleaseWatch({ kind: 'actors', id }, upcoming);
  const [notice, setNotice] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      </SafeAreaView>
    );
  }
  if (isError || !actor) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <IconButton icon={ChevronLeft} label={t('actorProfile.back')} onPress={back} style={styles.backPlain} />
        <EmptyState icon={SearchX} title={t('actorProfile.notFound')} />
      </SafeAreaView>
    );
  }

  const photo = actor.officialProfileImageUrl ?? actor.chatProfileImageUrl;
  const heroHeight = Math.min(Math.max(height * 0.5, 320), 520);
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.five }]} bounces={false}>
        <View style={[styles.hero, { height: heroHeight, maxWidth: MaxContentWidth, width: Math.min(width, MaxContentWidth) }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.tintSoft }]} />
          )}
          {/* 사진 아래쪽을 배경색으로 자연스럽게 이어줌 */}
          <LinearGradient colors={['transparent', theme.background]} style={styles.heroFade} />
        </View>

        <View style={styles.body}>
          <ThemedText type="display">{actor.legalName}</ThemedText>
          {isCouple ? (
            // 커플방: 멤버 배우 — 누르면 각자 프로필
            <View style={styles.members}>
              {membersOf(actor).map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => router.push({ pathname: '/actor/[id]', params: { id: member.id } })}
                  style={styles.member}
                  accessibilityRole="link">
                  <Avatar uri={member.chatProfileImageUrl ?? member.officialProfileImageUrl} size={28} />
                  <ThemedText type="smallMedium">{member.legalName}</ThemedText>
                </Pressable>
              ))}
            </View>
          ) : actor.agency ? (
            <ThemedText type="small" themeColor="textSecondary">
              {actor.agency.name}
            </ThemedText>
          ) : null}

          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardHead}>
              <ThemedText type="headline">{t('actorProfile.membership')}</ThemedText>
              <View style={styles.price}>
                <ThemedText type="title" style={{ color: theme.tint }}>
                  {formatPrice(actor.monthlyPriceCents)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {' '}
                  {t('actorProfile.perMonth')}
                </ThemedText>
              </View>
            </View>
            <MembershipBenefits name={actor.legalName} />
            {upcoming ? (
              <View style={[styles.release, { backgroundColor: theme.tintSoft }]}>
                <ThemedText type="captionBold" style={{ color: theme.tint }}>
                  {t('release.comingSoon')}
                </ThemedText>
                <ThemedText type="headline">{t('release.opensAt', { date: formatReleaseAt(actor.releaseAt!, i18n.language) })}</ThemedText>
              </View>
            ) : null}
            {/* 활동 종료 예정(2026-10-20) — 예정이 잡히면 새 구독을 막고 날짜를 보여 줌(CP방은 멤버 중 가장 이른 예정) */}
            {retireAt && !actor.retiredAt ? (
              <View style={[styles.release, { backgroundColor: `${theme.danger}14` }]}>
                <ThemedText type="headline">{t('actorProfile.retiringOn', { date: formatReleaseAt(retireAt, i18n.language) })}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {t('actorProfile.retiringHint')}
                </ThemedText>
              </View>
            ) : null}
            {isSubscribed ? (
              <Button title={t('actorProfile.openChat')} iconRight={ArrowRight} onPress={() => router.push(`/chat/${id}`)} />
            ) : actor.retiredAt ? (
              <Button title={t('actorProfile.retired')} variant="secondary" disabled />
            ) : retireAt ? (
              <Button title={t('actorProfile.retiringNoNew')} variant="secondary" disabled />
            ) : upcoming ? (
              <Button
                title={release.watching ? t('release.notifying') : t('release.notifyMe')}
                icon={release.watching ? BellRing : Bell}
                variant={release.watching ? 'secondary' : 'primary'}
                disabled={!release.canWatch || release.toggle.isPending}
                onPress={() =>
                  release.toggle.mutate(!release.watching, {
                    onSuccess: (result) => setNotice(result.watching ? t('release.notifyOn') : t('release.notifyOff')),
                    onError: (error) => setNotice(error instanceof ApiError ? error.message : t('release.notifyFailed')),
                  })
                }
              />
            ) : (
              <Button
                title={t('actorProfile.subscribeCta')}
                iconRight={ArrowRight}
                onPress={() => router.push({ pathname: '/subscribe/[actorId]', params: { actorId: id } })}
              />
            )}
            <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
              {isSubscribed ? t('actorProfile.subscribed') : upcoming ? (notice ?? t('release.notifyHint')) : t('actorProfile.noFreeTier')}
            </ThemedText>
          </View>

          {/* 묶음으로 더 저렴하게 — 구독 버튼 바로 아래(2026-10-15 사용자 요청: 개인방·CP방·묶음 관계가 헷갈려서). 1인 아티스트는 "CP와 함께",
              CP방은 "아티스트 개인방과 함께". 이미 구독 중인 묶음은 빼고, 활동 종료한 배우면 안 보임(서버가 걸러 줌) */}
          {offers.length > 0 && !actor.retiredAt && !retireAt ? (
            <View style={styles.bundles}>
              <ThemedText type="headline">{t(isCouple ? 'bundle.withSoloTitle' : withCouple ? 'bundle.withCoupleTitle' : 'bundle.sectionTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t(isCouple || withCouple ? 'bundle.withCoupleHint' : 'bundle.sectionHint')}
              </ThemedText>
              {offers.map((bundle) => (
                <BundleCard
                  key={bundle.id}
                  bundle={bundle}
                  onPress={() => router.push({ pathname: '/subscribe/bundle/[bundleId]', params: { bundleId: bundle.id } })}
                />
              ))}
            </View>
          ) : null}

          {/* 이 배우의 CP방 따로 구독(2026-10-15 — 묶음 아래로, 묶음에 들어 있으면 그렇다고) */}
          {!isCouple && (couples?.length ?? 0) > 0 ? (
            <View style={styles.bundles}>
              <ThemedText type="headline">{t('couple.soloSectionTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {withCouple && !actor.retiredAt ? t('couple.inBundleHint') : t('couple.sectionHint')}
              </ThemedText>
              {couples!.map((room) => (
                <CoupleCard key={room.id} room={room} onPress={() => router.push({ pathname: '/actor/[id]', params: { id: room.id } })} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      {/* 사진 위에 떠 있는 뒤로 버튼 */}
      <IconButton
        icon={ChevronLeft}
        label={t('actorProfile.back')}
        onPress={back}
        color="#ffffff"
        style={[styles.backFloating, { top: insets.top + Spacing.two }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: 'center' },
  hero: { alignSelf: 'center', overflow: 'hidden' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%' },
  body: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, marginTop: -Spacing.five, gap: 2 },
  card: { marginTop: Spacing.four, borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.four },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
  price: { flexDirection: 'row', alignItems: 'baseline' },
  center: { textAlign: 'center', marginTop: -Spacing.two },
  release: { borderRadius: Radius.lg, padding: Spacing.three, gap: 2, alignItems: 'center' },
  bundles: { marginTop: Spacing.five, gap: Spacing.two },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.one },
  member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backFloating: { position: 'absolute', left: Spacing.three, backgroundColor: 'rgba(15,17,21,0.35)' },
  backPlain: { margin: Spacing.three },
  loading: { marginTop: Spacing.six },
});
