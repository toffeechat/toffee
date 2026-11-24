import { Redirect } from 'expo-router';

import { SettlementSummary } from '@/components/settlement-summary';
import { useWideLayout } from '@/components/wide-shell';

/**
 * 폰 하단 탭 "정산"(2026-11-24 사용자 결정 — 폰에는 요약만): 지급 예상·수수료 흐름·아티스트별 막대. PC 넓은 화면은 지금 정산 표(/console/settlements)로.
 */
export default function ConsoleEarningsScreen() {
  const wide = useWideLayout();
  if (wide) return <Redirect href="/console/settlements" />;
  return <SettlementSummary />;
}
