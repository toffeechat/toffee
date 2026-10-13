// 아이폰 알림 확장(Notification Service Extension)을 앱에 넣는 Expo 설정 플러그인(2026-10-13).
// 푸시를 띄우기 직전에 확장(notification-service/NotificationService.swift)이 서버가 보낸 senderName·senderImage로
// 카톡처럼 보낸 사람 사진이 있는 "대화 알림"(Communication Notifications)으로 바꿈.
// - 앱: Communication Notifications 권한(entitlement) + NSUserActivityTypes에 INSendMessageIntent
// - Xcode 프로젝트: 확장 타깃 ToffeeNotificationService(번들 ID = 앱 번들 ID + .NotificationService), 앱에 포함(Embed)
// - EAS 서명: app.config extra.eas.build.experimental.ios.appExtensions에 같은 타깃을 적어 둬야 확장용 프로비저닝 프로파일을 만듦
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const TARGET = 'ToffeeNotificationService';
const FILES = ['NotificationService.swift', 'Info.plist'];
// 앱과 같은 최소 iOS 버전(Expo 57 기본) — 대화 알림 자체는 iOS 15부터라 그 아래면 확장이 원래 알림 그대로 둠
const DEPLOYMENT_TARGET = '15.1';

const withCommunicationEntitlement = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['com.apple.developer.usernotifications.communication'] = true;
    return cfg;
  });

const withMessageIntent = (config) =>
  withInfoPlist(config, (cfg) => {
    const types = new Set(cfg.modResults.NSUserActivityTypes ?? []);
    types.add('INSendMessageIntent');
    cfg.modResults.NSUserActivityTypes = [...types];
    return cfg;
  });

const withExtensionFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, TARGET);
      fs.mkdirSync(dir, { recursive: true });
      for (const file of FILES) fs.copyFileSync(path.join(__dirname, 'notification-service', file), path.join(dir, file));
      return cfg;
    },
  ]);

const withExtensionTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    if (project.pbxTargetByName(TARGET)) return cfg;
    const bundleId = `${cfg.ios.bundleIdentifier}.NotificationService`;

    // 새 프로젝트엔 이 두 섹션이 없어서 addTarget이 의존성 연결 중에 실패함 — 빈 섹션을 먼저
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    const group = project.addPbxGroup(FILES, TARGET, TARGET);
    const mainGroupId = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(group.uuid, mainGroupId);

    const target = project.addTarget(TARGET, 'app_extension', TARGET, bundleId);
    project.addBuildPhase(['NotificationService.swift'], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    // 앱 타깃: 확장을 담는 단계 이름을 Xcode 기본과 같게, 스크립트 단계들(번들·Pods·Sentry)보다 앞으로 — 뒤에 있으면 Xcode가
    // "Cycle inside ToffeeDev" 의존성 순환 오류를 내는 경우가 있음
    const mainTarget = project.getFirstTarget().firstTarget;
    const copyPhases = project.hash.project.objects.PBXCopyFilesBuildPhase ?? {};
    const embedId = mainTarget.buildPhases
      .map((phase) => phase.value)
      .find((id) => copyPhases[id] && copyPhases[id].dstSubfolderSpec === 13 && JSON.stringify(copyPhases[id].files ?? []).includes(TARGET));
    if (embedId) {
      copyPhases[embedId].name = '"Embed Foundation Extensions"';
      const phases = mainTarget.buildPhases;
      const embed = phases.splice(phases.findIndex((phase) => phase.value === embedId), 1)[0];
      embed.comment = 'Embed Foundation Extensions';
      const resources = phases.findIndex((phase) => phase.comment === 'Resources');
      phases.splice(resources + 1, 0, embed);
    }
    // xcode 라이브러리가 확장 결과물 파일에 "undefined" 값을 그대로 적어서 지움
    const fileRefs = project.pbxFileReferenceSection();
    for (const key of Object.keys(fileRefs)) {
      const ref = fileRefs[key];
      if (typeof ref !== 'object' || !String(ref.path ?? '').includes(`${TARGET}.appex`)) continue;
      for (const field of ['fileEncoding', 'lastKnownFileType']) if (ref[field] === undefined || ref[field] === 'undefined') delete ref[field];
    }

    const version = cfg.version ?? '1.0.0';
    const build = cfg.ios.buildNumber ?? '1';
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key].buildSettings;
      if (!settings || settings.PRODUCT_NAME !== `"${TARGET}"`) continue;
      Object.assign(settings, {
        INFOPLIST_FILE: `${TARGET}/Info.plist`,
        IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
        SWIFT_VERSION: '5.0',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        CODE_SIGN_STYLE: 'Automatic',
        MARKETING_VERSION: version,
        CURRENT_PROJECT_VERSION: build,
        GENERATE_INFOPLIST_FILE: 'NO',
        CLANG_ENABLE_MODULES: 'YES',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
      });
    }
    return cfg;
  });

module.exports = function withNotificationService(config) {
  config = withCommunicationEntitlement(config);
  config = withMessageIntent(config);
  config = withExtensionFiles(config);
  config = withExtensionTarget(config);
  return config;
};

module.exports.NOTIFICATION_SERVICE_TARGET = TARGET;
