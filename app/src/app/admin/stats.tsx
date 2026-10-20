import { Redirect } from 'expo-router';

// 통계는 운영자 홈과 합쳐짐(2026-10-20) — 옛 주소로 들어오면 홈으로
export default function AdminStatsRedirect() {
  return <Redirect href="/admin" />;
}
