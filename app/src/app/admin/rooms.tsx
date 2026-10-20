import { ScreenIntro } from '@/components/console-stats';
import { RoomMonitorList } from '@/components/room-monitor-list';

/**
 * 토피룸 모니터링(2026-10-20 사용자 요청: "운영자도 모든 아티스트의 메시지와 팬 답장을 모니터링") — 소속사 "소속 아티스트"와 같은 목록에
 * 소속사 필터·스토어 상품 ID 없음 표시. 누르면 소속사와 같은 모니터링 화면(/console/[id], 서버는 운영자에게 모든 방을 허용)
 */
export default function AdminRoomsScreen() {
  return (
    <RoomMonitorList
      admin
      header={<ScreenIntro text="모든 토피룸 목록이에요. 누르면 아티스트가 보낸 메시지·스토리, 팬 답장, 통계를 소속사와 같은 화면으로 봐요. 회색 줄은 팬에겐 안 보이는 운영 정보예요." />}
    />
  );
}
