import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AdminChip } from '@/components/admin-ui';
import { ScreenIntro } from '@/components/console-stats';
import { RoomMonitorList } from '@/components/room-monitor-list';
import { StatsRangeControl, selectionLabel } from '@/components/stats-range-picker';
import { ThemedText } from '@/components/themed-text';
import { selectionFromParams, type StatsSelection } from '@/hooks/use-console';
import { Spacing } from '@/constants/theme';
import { thaiToday } from '@/utils/stat-range';

/**
 * 토피룸 모니터링(2026-10-20 사용자 요청: "운영자도 모든 아티스트의 메시지와 팬 답장을 모니터링") — 소속사 "소속 아티스트"와 같은 목록에
 * 소속사 필터·스토어 상품 ID 없음 표시. 누르면 소속사와 같은 모니터링 화면(/console/[id], 서버는 운영자에게 모든 방을 허용)
 * 기간 보기(2026-10-25) — [오늘]·기간을 고르면 그 기간 메시지·팬 답장이 있는 방만 건수와 함께. 운영자 홈 "오늘 메시지" 카드가 오늘로 엶.
 */
export default function AdminRoomsScreen() {
  const { i18n } = useTranslation();
  const params = useLocalSearchParams<{ days?: string; from?: string; to?: string }>();
  const today = thaiToday();
  const [period, setPeriod] = useState<StatsSelection | null>(() => (params.days || params.from ? selectionFromParams(params) : null));
  const isToday = !!period && !('days' in period) && period.from === today && period.to === today;
  return (
    <RoomMonitorList
      admin
      messagePeriod={period}
      header={
        <View style={styles.header}>
          <ScreenIntro text="모든 토피룸 목록이에요. 누르면 아티스트가 보낸 메시지·스토리, 팬 답장, 통계를 소속사와 같은 화면으로 봐요. 회색 줄은 팬에겐 안 보이는 운영 정보예요." />
          <View style={styles.chips}>
            <AdminChip label="모든 방" selected={!period} onPress={() => setPeriod(null)} />
            <AdminChip label="오늘 메시지" selected={isToday} onPress={() => setPeriod({ from: today, to: today })} />
            {period ? <StatsRangeControl value={period} onChange={setPeriod} /> : null}
          </View>
          {period ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {`${selectionLabel(period, i18n.language)}(태국 시간) 메시지·팬 답장이 있는 방 — 아티스트 메시지 많은 순`}
            </ThemedText>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
});
