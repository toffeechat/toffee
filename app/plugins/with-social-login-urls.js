// 소셜 로그인 앱에서 돌아오는 URL 처리(2026-11-24, Expo SDK 58 업그레이드).
// SDK 58부터 iOS 앱이 SceneDelegate 구조로 바뀌어 AppDelegate에 application(_:open:options:) 함수가 없음. 라이브러리 설정 플러그인들은
// 예전 AppDelegate 모양을 찾아 고치다가 — LINE(@xmartlabs/react-native-line 6.0.1)은 prebuild 실패, Naver는 줄을 못 찾아 조용히 건너뜀,
// Kakao는 함수가 있어야 넣는데 플러그인이 목록 역순으로 실행돼 함수가 아직 없어서 건너뜀 → 로그인 뒤 앱으로 못 돌아옴.
// Expo SceneDelegate가 받은 링크를 AppDelegate의 application(_:open:options:)로 넘겨 주므로(SceneEventForwarder), 그 함수를 만들고
// 세 처리를 직접 넣음. 라이브러리 플러그인이 나중에 같은 코드를 넣으려 해도 이미 있는 문자열을 보고 건너뜀(중복 없음).
// Info.plist(LINE URL scheme 등)는 각 라이브러리 플러그인 것을 그대로 씀. 라이브러리들이 SDK 58을 지원하면 되돌릴 것.
const { withAppDelegate, withPlugins } = require('expo/config-plugins');
const withLineInfoPlist = require('@xmartlabs/react-native-line/plugin/ios/withCustomInfoPlist');
const { addOpenUrlHandler } = require('./open-url-handlers');

function withSocialOpenUrls(config, { kakao = false, naverUrlScheme = '' } = {}) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') throw new Error('with-social-login-urls: Swift AppDelegate만 지원');
    let contents = cfg.modResults.contents;
    // 순서: 먼저 넣은 것이 함수 맨 위 — LINE, Kakao, Naver 순으로 확인(각자 자기 URL이 아니면 false/다음으로)
    if (naverUrlScheme && !contents.includes('NaverThirdPartyLoginConnection.getSharedInstance')) {
      if (!/^[a-z][a-z0-9+.-]*$/i.test(naverUrlScheme)) throw new Error('with-social-login-urls: Naver URL scheme 형식이 이상함');
      contents = addOpenUrlHandler(contents, {
        importLine: 'import NaverThirdPartyLogin',
        tag: 'naver',
        handler: `if url.scheme == "${naverUrlScheme}" { return NaverThirdPartyLoginConnection.getSharedInstance().application(app, open: url, options: options) }`,
      });
    }
    if (kakao && !contents.includes('RNCKakaoUserUtil.handleOpen(url)')) {
      contents = addOpenUrlHandler(contents, {
        importLine: 'import RNCKakaoUser',
        tag: 'kakao',
        handler: 'if RNCKakaoUserUtil.isKakaoTalkLoginUrl(url) { return RNCKakaoUserUtil.handleOpen(url) }',
      });
    }
    contents = addOpenUrlHandler(contents, {
      importLine: 'import react_native_line',
      tag: 'line',
      handler: 'if LineLogin.application(app, open: url, options: options) { return true }',
    });
    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withSocialLoginUrls(config, props) {
  return withPlugins(config, [[withSocialOpenUrls, props], withLineInfoPlist]);
};
