import { useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MonitorSmartphone } from 'lucide-react-native';

import { ListRow } from '@/components/ui/list-row';
import { useAuth } from '@/lib/auth-context';
import { confirm } from '@/lib/confirm';
import { ApiError } from '@/lib/api-client';

/** 모든 기기에서 로그아웃(2026-10-27) — 팬 마이페이지·아티스트/소속사 설정에서 같이 씀. 폰을 잃어버렸거나 남의 기기에 로그인해 둔 경우 */
export function LogoutAllRow() {
  const { t } = useTranslation();
  const { logoutAll } = useAuth();
  const busy = useRef(false);

  const onPress = async () => {
    if (busy.current) return;
    const ok = await confirm(t('profile.logoutAll'), t('profile.logoutAllBody'), t('profile.logoutAllConfirm'), t('common.cancel'));
    if (!ok) return;
    busy.current = true;
    try {
      await logoutAll();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('profile.logoutAllFailed');
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert(t('profile.logoutAll'), message);
    } finally {
      busy.current = false;
    }
  };

  return <ListRow icon={MonitorSmartphone} title={t('profile.logoutAll')} onPress={() => void onPress()} showChevron={false} />;
}
