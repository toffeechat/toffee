import { Ban, Building2, MessagesSquare, Flag, History, Megaphone, Package, RotateCcw, Star, UserCog, Wallet, type LucideIcon } from 'lucide-react-native';

/** 운영자 메뉴 — 운영자 홈 목록과 PC 웹 왼쪽 메뉴가 같이 씀. 운영자 화면은 한국어 전용 */
export type AdminHref =
  | '/admin'
  | '/admin/rooms'
  | '/admin/reports'
  | '/admin/banned-words'
  | '/admin/users'
  | '/admin/actors'
  | '/admin/bundles'
  | '/admin/agencies'
  | '/admin/settlements'
  | '/admin/refunds'
  | '/admin/notices'
  | '/admin/actions';

// 통계는 2026-10-20 운영자 홈과 합침(홈 = 통계 대시보드) — 메뉴에서 빠짐, 옛 주소 /admin/stats는 홈으로 넘김
export const ADMIN_MENU: { href: AdminHref; label: string; description: string; icon: LucideIcon; webOnly?: boolean }[] = [
  { href: '/admin/rooms', label: '토피룸 모니터링', description: '모든 방의 보낸 메시지·팬 답장·스토리, 공식 이름·소속사·구독자 수', icon: MessagesSquare },
  { href: '/admin/reports', label: '신고 처리', description: '신고된 메시지를 검토하고 승인/기각해요', icon: Flag },
  { href: '/admin/actors', label: '아티스트 관리', description: '아티스트·CP방 등록, 사진, 소속사 이적, 본인 계정 연결, 메시지 모니터링', icon: Star },
  { href: '/admin/bundles', label: '묶음 상품', description: '여러 아티스트를 할인가로 묶어 파는 구독 상품, 스토어 상품 ID', icon: Package },
  { href: '/admin/agencies', label: '소속사 관리', description: '소속사 등록, 이름·로고·정산 배분율', icon: Building2 },
  { href: '/admin/users', label: '회원 관리', description: '회원 정지·영구차단, 아티스트·소속사 직원 계정 지정', icon: UserCog },
  { href: '/admin/settlements', label: '정산', description: '월별 결제액·스토어 수수료·소속사 지급액, CSV(PC 웹 전용)', icon: Wallet, webOnly: true },
  { href: '/admin/refunds', label: '환불 요청', description: '아티스트 미발송·활동 종료 환불 요청, 애플 환불 여부', icon: RotateCcw },
  { href: '/admin/banned-words', label: '금칙어 관리', description: '팬 답장에서 자동으로 차단할 단어를 관리해요', icon: Ban },
  { href: '/admin/notices', label: '공지사항', description: '앱 마이페이지 > 공지사항에 보이는 글(점검·약관 변경·서비스 종료 안내), 고정', icon: Megaphone },
  { href: '/admin/actions', label: '작업 기록', description: '누가 언제 정지·차단·역할 변경·신고 처리·가격·정산 비율을 바꿨는지', icon: History },
];
