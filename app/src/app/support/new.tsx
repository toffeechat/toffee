import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { INQUIRY_CATEGORIES, useCreateInquiry, type InquiryCategory } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** 새 문의(2026-10-20) — 종류·제목·내용 */
export default function NewInquiryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const create = useCreateInquiry();
  const [category, setCategory] = useState<InquiryCategory | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const ready = !!category && !!title.trim() && !!body.trim();
  const send = () => {
    if (!ready) return;
    create.mutate(
      { category: category!, title: title.trim(), body: body.trim() },
      { onSuccess: (inquiry) => router.replace({ pathname: '/support/[id]', params: { id: inquiry.id } }) },
    );
  };
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="smallBold">{t('inquiry.category')}</ThemedText>
      <View style={styles.chips}>
        {INQUIRY_CATEGORIES.map((key) => (
          <Chip key={key} label={t(`inquiry.cat_${key}`)} selected={category === key} onPress={() => setCategory(key)} />
        ))}
      </View>
      <TextField label={t('inquiry.titleLabel')} value={title} onChangeText={setTitle} maxLength={100} />
      <TextField
        label={t('inquiry.bodyLabel')}
        hint={t('inquiry.bodyHint')}
        value={body}
        onChangeText={setBody}
        maxLength={2000}
        multiline
        style={styles.body}
      />
      {create.isError ? (
        <ThemedText type="small" themeColor="danger">
          {create.error instanceof ApiError ? create.error.message : t('inquiry.failed')}
        </ThemedText>
      ) : null}
      <Button title={t('inquiry.send')} disabled={!ready} loading={create.isPending} onPress={send} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  body: { minHeight: 160, textAlignVertical: 'top' },
});
