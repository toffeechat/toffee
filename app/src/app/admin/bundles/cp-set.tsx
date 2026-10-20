import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminChip, AdminField, AdminMessage, AdminSection, formatBaht, parseBahtToCents } from '@/components/admin-ui';
import { membersOf, useActor, useCoupleRooms, type Actor } from '@/hooks/use-actors';
import { useCreateBundle } from '@/hooks/use-admin';
import { ApiError } from '@/lib/api-client';
import { Spacing } from '@/constants/theme';

// 기본 할인율 — 2개 묶음(개인방 + CP방) 약 17%, 전체(두 개인방 + CP방) 약 25%. 끝자리는 9바트로(예: 139, 199)
const PAIR_DISCOUNT = 0.17;
const ALL_DISCOUNT = 0.25;
const suggest = (regularCents: number, discount: number) => {
  const target = Math.round((regularCents * (1 - discount)) / 100);
  const nine = Math.floor(target / 10) * 10 + 9;
  return String(nine <= target ? nine : nine - 10);
};

/**
 * CP로 묶음 3개 한 번에 만들기(2026-10-15 사용자 결정) — CP(A·B·AB)마다 "A + AB", "B + AB", "전체(A + B + AB)". CP 없는 A + B 묶음은 헷갈려서 안 만듦.
 * 서버엔 새 기능 없이 기존 "묶음 만들기"를 세 번(운영자 작업 기록도 그대로 세 건). 스토어 상품 ID는 각 묶음 화면에서 따로.
 */
export default function AdminCpBundleSetScreen() {
  const router = useRouter();
  const { data: rooms } = useCoupleRooms();
  const [picked, setRoom] = useState<Actor | null>(null);
  // CP방 만들기·CP방 상세에서 넘어오면 그 CP가 골라진 채로(2026-10-20)
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const room = picked ?? rooms?.find((item) => item.id === roomId) ?? null;
  const [memberA, memberB] = room ? membersOf(room) : [];
  const { data: a } = useActor(memberA?.id ?? '');
  const { data: b } = useActor(memberB?.id ?? '');
  const create = useCreateBundle();
  const [pairPrice, setPairPrice] = useState('');
  const [allPrice, setAllPrice] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const pairRegularA = a && room ? a.monthlyPriceCents + room.monthlyPriceCents : 0;
  const pairRegularB = b && room ? b.monthlyPriceCents + room.monthlyPriceCents : 0;
  const allRegular = a && b && room ? a.monthlyPriceCents + b.monthlyPriceCents + room.monthlyPriceCents : 0;

  const pick = (next: Actor) => {
    setRoom(next);
    setPairPrice('');
    setAllPrice('');
    setMessage(null);
  };
  // 가격을 아직 안 넣었으면 추천값(두 멤버 가격을 다 받은 뒤)
  const pairValue = pairPrice || (a && b ? suggest(Math.max(pairRegularA, pairRegularB), PAIR_DISCOUNT) : '');
  const allValue = allPrice || (a && b ? suggest(allRegular, ALL_DISCOUNT) : '');

  const submit = async () => {
    if (!room || !a || !b) return setMessage({ text: 'CP를 골라 주세요.', error: true });
    const pairCents = parseBahtToCents(pairValue);
    const allCents = parseBahtToCents(allValue);
    if (pairCents === null || allCents === null) return setMessage({ text: '가격을 숫자로 입력해 주세요(예: 139).', error: true });
    setSaving(true);
    setMessage(null);
    const plans = [
      { name: `${a.legalName} + ${room.legalName}`, priceCents: pairCents, actorIds: [a.id, room.id] },
      { name: `${b.legalName} + ${room.legalName}`, priceCents: pairCents, actorIds: [b.id, room.id] },
      { name: `${room.legalName} — All`, priceCents: allCents, actorIds: [a.id, b.id, room.id] },
    ];
    try {
      for (const plan of plans) await create.mutateAsync({ ...plan, storeProductId: null });
      router.replace('/admin/bundles');
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : '만들지 못했어요. 이미 만든 묶음은 목록에서 확인해 주세요.', error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdminSection title="CP 고르기" hint="고른 CP로 'A + CP방', 'B + CP방', '전체(A + B + CP방)' 묶음 3개를 한 번에 만들어요.">
          {(rooms ?? []).map((item) => (
            <AdminChip key={item.id} label={item.legalName} selected={room?.id === item.id} onPress={() => pick(item)} />
          ))}
          {rooms?.length === 0 ? <ThemedText type="small" themeColor="textSecondary">아직 CP방이 없어요.</ThemedText> : null}
        </AdminSection>

        {room && a && b ? (
          <AdminSection title="가격" hint="추천 가격(2개 묶음 약 17%, 전체 약 25% 할인)이 미리 들어가 있어요. 소속사와 정한 값으로 바꿔도 돼요.">
            <AdminField label={`2개 묶음 월 가격(바트) — ${a.legalName} + CP, ${b.legalName} + CP`} value={pairValue} onChangeText={setPairPrice} keyboardType="decimal-pad" />
            <ThemedText type="small" themeColor="textSecondary">
              따로 구독하면 {formatBaht(pairRegularA)}
              {pairRegularB !== pairRegularA ? ` / ${formatBaht(pairRegularB)}` : ''}
            </ThemedText>
            <AdminField label="전체 묶음 월 가격(바트)" value={allValue} onChangeText={setAllPrice} keyboardType="decimal-pad" />
            <ThemedText type="small" themeColor="textSecondary">
              따로 구독하면 {formatBaht(allRegular)}
            </ThemedText>
          </AdminSection>
        ) : null}

        <AdminMessage text={message?.text ?? null} error={message?.error} />
        <AdminButton label={saving ? '만드는 중…' : '묶음 3개 만들기'} onPress={() => void submit()} disabled={saving || !room || !a || !b} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
});
