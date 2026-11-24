import { ConsoleOverview } from '@/components/console-overview';
import { useWideLayout } from '@/components/wide-shell';

import { AgencyDashboardScreen } from './dashboard';

/**
 * 소속사 첫 화면(/console) — PC 웹(넓은 배치)은 지금처럼 통계 대시보드, 폰·좁은 화면은 "한눈에"(2026-11-24 사용자 결정, 소속사 폰 화면 개선 1번).
 * 폰에서 대시보드는 두 번째 탭(/console/dashboard).
 */
export default function ConsoleHomeScreen() {
  const wide = useWideLayout();
  return wide ? <AgencyDashboardScreen /> : <ConsoleOverview />;
}
