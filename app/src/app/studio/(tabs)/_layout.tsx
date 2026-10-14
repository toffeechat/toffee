import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Settings } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { fontFor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 아티스트 하단 탭(2026-10-14 사용자 결정: "사용자랑 비슷하게") — 토피룸(내 방 목록) / 설정(마이페이지를 합침: 알림·화면 모드·언어·로그인 정보·
 * 로그아웃). 방별 프로필(사진·배경·이름·환영 메시지)은 토피룸 안 오른쪽 위 사람 아이콘.
 */
export default function StudioTabsLayout() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { ...fontFor(600, i18n.language), fontSize: 17 },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: { ...fontFor(500, i18n.language), fontSize: 11, lineHeight: 14 },
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        sceneStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('rooms.title'),
          tabBarIcon: ({ color, focused }) => <Icon as={MessageCircle} size={24} color={focused ? theme.tint : color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('staffSettings.title'),
          tabBarIcon: ({ color, focused }) => <Icon as={Settings} size={24} color={focused ? theme.tint : color} />,
        }}
      />
    </Tabs>
  );
}
