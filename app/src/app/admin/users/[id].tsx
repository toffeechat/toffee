import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminSection } from '@/components/admin-ui';
import { AccessHistory, ProfileSection, ROLE_LABELS, RoleSection, SanctionSection, statusText } from '@/components/admin-user-panels';
import { useAdminUser } from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

/** 회원 상세(2026-10-20 — 목록은 한눈에 보는 표, 바꾸는 일은 여기서: 역할·소속사, 제재, 프로필 지우기, 접속 기록) */
export default function AdminUserDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user, isLoading } = useAdminUser(id);

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
          {user.role !== 'ADMIN' && !user.deletedAt ? <RoleSection user={user} /> : null}
          {user.role !== 'ADMIN' && !user.deletedAt ? <SanctionSection user={user} /> : null}
          <ProfileSection user={user} />
          <AccessHistory user={user} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  loading: { marginTop: Spacing.six },
});
