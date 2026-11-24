import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react-native';

import { IconButton } from '@/components/ui/icon-button';

/** 폰 소속사 화면 오른쪽 위 설정 톱니(2026-11-24 — 하단 탭이 한눈에·대시보드·아티스트·정산·기록이 되면서 설정은 여기로) */
export function ConsoleHeaderActions() {
  const router = useRouter();
  const { t } = useTranslation();
  return <IconButton icon={Settings} label={t('staffSettings.title')} filled onPress={() => router.push('/console/settings')} />;
}
