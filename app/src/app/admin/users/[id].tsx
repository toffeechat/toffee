import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminMessage, AdminSection } from '@/components/admin-ui';
import { AccessHistory, BillingSection, ProfileSection, ROLE_LABELS, RoleSection, SanctionSection, statusText } from '@/components/admin-user-panels';
import { useAdminUser } from '@/hooks/use-admin';
import { useMe } from '@/hooks/use-onboarding';
import { confirm } from '@/lib/confirm';
import { exportMyData } from '@/lib/export-my-data';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

/** 회원 상세(2026-10-20 — 목록은 한눈에 보는 표, 바꾸는 일은 여기서: 역할·소속사, 제재, 프로필 지우기, 접속 기록) */
export default function AdminUserDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user, isLoading } = useAdminUser(id);
  const { data: me } = useMe();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: user ? (user.nickname ?? user.displayName) : '회원' }} />
      {isLoading || !user ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <AdminSection title={`${user.displayName}${user.nickname ? ` (${user.nickname})` : ''}`}>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                ROLE_LABELS[user.role],
                user.agency?.name,
                user.actorSelf ? `${user.actorSelf.legalName} 본인` : null,
                user.email ?? '이메일 없음',
                `가입 ${new Date(user.createdAt).toLocaleDateString('ko-KR')}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            <ThemedText type="smallBold" themeColor={user.status === 'ACTIVE' && !user.deletedAt ? 'text' : 'danger'}>
              상태: {statusText(user)}
            </ThemedText>
          </AdminSection>
          {user.role !== 'ADMIN' && !user.deletedAt && me?.adminLevel !== 'SUPPORT' ? <RoleSection user={user} /> : null}
          {user.role !== 'ADMIN' && !user.deletedAt ? <SanctionSection user={user} /> : null}
          {user.role === 'USER' ? <BillingSection userId={user.id} /> : null}
          <ProfileSection user={user} />
          <AccessHistory user={user} />
          <ExportSection userId={user.id} name={user.nickname ?? user.displayName} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** 회원 대신 개인정보 파일 받기(2026-10-20, PDPA — 메일·1:1 문의로 요청이 왔을 때). 받으면 작업 기록에 남음 */
function ExportSection({ userId, name }: { userId: string; name: string }) {
  const [state, setState] = useState<{ busy?: boolean; text?: string; error?: boolean }>({});
  const run = async () => {
    if (!(await confirm('개인정보 파일 받기', `${name} 회원의 가입 정보·구독·결제·답장·문의·접속 기록을 파일로 받아요. 작업 기록에 남아요. 본인 요청이 확인된 경우에만 받으세요.`, '받기', '취소'))) return;
    setState({ busy: true });
    try {
      await exportMyData(`/admin/users/${userId}/export`, `toffee-user-${userId}-${new Date().toISOString().slice(0, 10)}.json`);
      setState({ text: '파일을 만들었어요.' });
    } catch {
      setState({ text: '파일을 만들지 못했어요.', error: true });
    }
  };
  return (
    <AdminSection title="개인정보 파일(PDPA)" hint="회원이 메일·1:1 문의로 내 정보를 요청했을 때. 회원은 앱 마이페이지 [내 정보 받기]로 직접 받을 수도 있어요.">
      <AdminButtonRow>
        <AdminButton secondary label={state.busy ? '만드는 중…' : '파일 받기(JSON)'} disabled={state.busy} onPress={() => void run()} />
      </AdminButtonRow>
      <AdminMessage text={state.text ?? null} error={state.error} />
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  loading: { marginTop: Spacing.six },
});
