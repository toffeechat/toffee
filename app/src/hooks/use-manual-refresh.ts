import { useCallback, useState } from 'react';

/**
 * 당겨서 새로고침 스피너는 "손으로 당겼을 때만" 돌게(2026-10-15 실기기 — 화면을 옮길 때마다 위쪽 로딩 표시가 멈춘 채 남아 있었음).
 * 예전엔 RefreshControl의 refreshing을 react-query의 isRefetching/isFetching에 바로 물려서, 화면 복귀·실시간 갱신·주기적 갱신처럼
 * 사람이 당기지 않은 자동 새로고침에도 스피너가 프로그램으로 켜졌다 꺼졌고, 네이티브 스피너는 그럴 때 멈춘 채 눌어붙는 경우가 있음
 * (젤리에서 2026-08-28에 같은 문제를 같은 방법으로 고침). 자동 새로고침은 스피너 없이 조용히.
 */
export function useManualRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refetch().finally(() => setRefreshing(false));
  }, [refetch]);
  return { refreshing, onRefresh };
}
