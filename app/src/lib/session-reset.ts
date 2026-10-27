/**
 * 로그아웃·로그인 끊김 때 비울 모듈 상태 모음(2026-10-27) — react-query 캐시(queryClient.clear) 밖에 있는 메모리 상태
 * (소속사 웹 안 읽은 수·탭 제목, 못 보낸 답장 키, 결제 대기 등)가 다음 사람 계정에 남지 않게. 각 모듈이 불러올 때 등록하고
 * auth-context가 로그아웃할 때 한 번에 부름(auth-context가 각 모듈을 직접 불러오면 순환 import가 생겨서 이렇게)
 */
const resets = new Set<() => void>();

export function onSessionReset(reset: () => void): () => void {
  resets.add(reset);
  return () => resets.delete(reset);
}

export function resetSessionState() {
  resets.forEach((reset) => {
    try {
      reset();
    } catch {
      // 하나가 실패해도 나머지는 비움
    }
  });
}
