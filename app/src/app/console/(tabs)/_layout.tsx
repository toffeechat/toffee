import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ClipboardList, LayoutDashboard, Settings, Users } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { useWideLayout } from '@/components/wide-shell';
import { fontFor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useConsoleUnread } from '@/lib/console-alerts';

/**
 * 소속사 하단 탭(2026-10-13 사용자 요청: "앱일 땐 팬 화면처럼 아래 메뉴로") — 대시보드 / 소속 아티스트 / 기록 / 설정.
 * 정산은 PC 웹 전용이라 탭에 없음(좁은 웹 창은 설정 안에 바로가기). PC 넓은 화면은 왼쪽 메뉴(WideShell)가 있어서 탭 줄을 숨김.
 */
export default function ConsoleTabsLayout() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const wide = useWideLayout();
  const unread = [...useConsoleUnread().values()].reduce((a, b) => a + b, 0);

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
        tabBarStyle: wide ? { display: 'none' } : { backgroundColor: theme.background, borderTopColor: theme.border },
        sceneStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('consoleNav.dashboard'),
          // 대시보드는 화면 안에 큰 제목이 있어서 위쪽 막대 없이
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <Icon as={LayoutDashboard} size={24} color={focused ? theme.tint : color} />,
        }}
      />
      <Tabs.Screen
        name="artists"
        options={{
          title: t('console.title'),
          tabBarLabel: t('consoleNav.artists'),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.tint },
          tabBarIcon: ({ color, focused }) => <Icon as={Users} size={24} color={focused ? theme.tint : color} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: t('records.title'),
          tabBarIcon: ({ color, focused }) => <Icon as={ClipboardList} size={24} color={focused ? theme.tint : color} />,
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
