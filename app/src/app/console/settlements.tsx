import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { SettlementReportView } from '@/components/settlement-report';
import { useWideLayout } from '@/components/wide-shell';

/** 소속사 월 정산 표 — 자기 소속사 배우만(서버가 좁힘), PC 웹 전용. 폰·좁은 화면은 요약 탭(/console/earnings, 2026-11-24)으로 */
export default function ConsoleSettlementsScreen() {
  const wide = useWideLayout();
  if (!wide) return <Redirect href="/console/earnings" />;
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <SettlementReportView />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
