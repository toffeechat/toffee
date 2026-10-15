import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

// 이만큼 넘게 나가 있다가 돌아오면 그때도 새 업데이트를 바로 적용(짧게 다른 앱에 다녀온 건 그대로 — 쓰던 답장이 날아가지 않게)
const RESUME_APPLY_AFTER_MS = 5 * 60 * 1000;

/**
 * OTA 바로 적용(2026-10-15 사용자 요청) — 기본 동작은 "켤 때 받아 두고 다음에 켤 때 적용"이라 두 번 껐다 켜야 했음.
 * 앱을 켤 때(그리고 5분 넘게 나가 있다 돌아올 때) 새 업데이트가 있으면 받아서 바로 다시 시작. 젤리 use-ota-update를 참고하되, 토피는
 * 잠깐 다른 앱에 다녀올 때마다 다시 시작하면 팬이 쓰던 답장이 사라질 수 있어서 짧은 복귀엔 안 함. 개발 빌드·웹에선 expo-updates가 꺼져 있어 아무 일도 안 함.
 */
export function useOtaUpdate(): void {
  useEffect(() => {
    void checkAndApply();
    let backgroundAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt = Date.now();
      if (state === 'active' && backgroundAt !== null) {
        const away = Date.now() - backgroundAt;
        backgroundAt = null;
        if (away >= RESUME_APPLY_AFTER_MS) void checkAndApply();
      }
    });
    return () => subscription.remove();
  }, []);
}

async function checkAndApply(): Promise<void> {
  if (!Updates.isEnabled) return;
  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (!isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // 네트워크 오류 등은 조용히 — 다음에 켤 때 다시 확인(기본 동작으로도 받아 둔 건 다음 실행 때 적용됨)
  }
}
