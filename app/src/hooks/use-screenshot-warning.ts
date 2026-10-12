import { useRef } from 'react';
import { Alert } from 'react-native';
import { useScreenshotListener } from 'expo-screen-capture';
import { useTranslation } from 'react-i18next';

/**
 * 화면 캡처 감지 경고(2026-10-12, 버블 비교 점검 → 1차) — 팬 대화방·사진/영상 크게 보기에서 캡처하면 "구독자 전용 콘텐츠라
 * 외부 공유 금지" 안내를 띄움(막지는 않음 — 버블도 경고만). 서버에 기록하지 않음.
 * iOS는 권한 없이 감지, 안드로이드는 14 이상만(DETECT_SCREEN_CAPTURE, 설치 때 자동 허용) — 13 이하는 사진 읽기 권한을
 * 따로 받아야 해서 이것 때문에 묻지 않음(그 기기에선 경고가 안 뜸). 연달아 찍어도 창은 하나만.
 */
export function useScreenshotWarning(enabled = true) {
  const { t } = useTranslation();
  const showing = useRef(false);
  useScreenshotListener(() => {
    if (!enabled || showing.current) return;
    showing.current = true;
    Alert.alert(t('screenshot.title'), t('screenshot.body'), [{ text: t('screenshot.ok'), onPress: () => (showing.current = false) }], {
      onDismiss: () => (showing.current = false),
    });
  });
}
