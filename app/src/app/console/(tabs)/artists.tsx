import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenIntro } from '@/components/console-stats';
import { RoomMonitorList } from '@/components/room-monitor-list';

/**
 * 소속 아티스트(2026-10-13 하단 탭/왼쪽 메뉴 두 번째, 2026-10-14 팬 토피룸 목록처럼, 2026-10-20 운영 정보·검색·정렬) — 목록은 운영자
 * "토피룸 모니터링"과 같은 RoomMonitorList. PC 웹 새 메시지 수는 숫자 배지. 누르면 모니터링·답장·통계
 */
export default function ConsoleArtistsScreen() {
  const { t } = useTranslation();
  return <RoomMonitorList header={<ScreenIntro text={t('console.description')} style={styles.intro} />} />;
}

const styles = StyleSheet.create({
  intro: { marginBottom: 0 },
});
