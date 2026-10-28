// 안드로이드 알림 색 meta-data 충돌 해결(2026-10-28) — expo-notifications가 넣는 default_notification_color(@color/notification_icon_color)와
// @react-native-firebase/messaging 라이브러리 매니페스트의 같은 항목(@color/white)이 부딪혀 manifest merger가 실패함
// (10-15 두 플러그인을 같이 넣은 뒤 첫 안드로이드 EAS 빌드에서 발견). 앱 쪽 값을 쓰도록 tools:replace를 붙임.
const { withAndroidManifest } = require('expo/config-plugins');

// 라이브러리 매니페스트에 있는 건 색뿐(아이콘·채널은 앱 쪽에만 있어 충돌 없음)
const KEYS = ['com.google.firebase.messaging.default_notification_color'];

module.exports = function withFcmNotificationMeta(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    for (const application of manifest.application ?? []) {
      for (const item of application['meta-data'] ?? []) {
        if (KEYS.includes(item.$['android:name']) && item.$['android:resource']) item.$['tools:replace'] = 'android:resource';
      }
    }
    return cfg;
  });
};
