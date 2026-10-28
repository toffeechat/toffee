import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { apiClient } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

interface PartnerLink {
  partner: string;
  name: string;
  consentedAt: string;
  lastUsedAt: string | null;
}

/** 연결된 서비스(2026-10-28) — 토피 계정으로 로그인한 디저트랩 서비스(검볼). 끊으면 그 서비스는 구독 정보를 더 받지 못함 */
export default function ConnectedServicesScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const links = useQuery({ queryKey: ['partner-links'], queryFn: () => apiClient.get<PartnerLink[]>('/me/partner-links') });
  const revoke = useMutation({
    mutationFn: (partner: string) => apiClient.delete(`/me/partner-links/${encodeURIComponent(partner)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner-links'] }),
  });

  const ask = async (link: PartnerLink) => {
    if (await confirm(t('connected.revokeTitle', { name: link.name }), t('connected.revokeBody', { name: link.name }), t('connected.revoke'), t('common.cancel'))) {
      revoke.mutate(link.partner);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {t('connected.hint')}
      </ThemedText>
      {links.data?.length === 0 ? <EmptyState icon={Link2} title={t('connected.empty')} /> : null}
      {links.data?.map((link) => (
        <ListRow
          key={link.partner}
          icon={Link2}
          title={link.name}
          subtitle={t('connected.since', { date: new Date(link.consentedAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' }) })}
          showChevron={false}
          trailing={<Button title={t('connected.revoke')} variant="ghost" onPress={() => void ask(link)} />}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  hint: { paddingHorizontal: Spacing.one },
});
