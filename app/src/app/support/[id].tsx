import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAddInquiryMessage, useMyInquiry } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

/** 문의 대화(2026-10-20) — 내 글은 오른쪽, 운영팀 답은 왼쪽. 끝난 문의엔 더 못 씀 */
export default function InquiryScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useMyInquiry(id);
  const add = useAddInquiryMessage(id);
  const [body, setBody] = useState('');
  if (isLoading || !data) return <ActivityIndicator style={styles.loading} color={theme.tint} />;
  const closed = data.status === 'CLOSED';
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: data.title }} />
      <ThemedText type="caption" themeColor="textTertiary">
        {t(`inquiry.cat_${data.category}`)} · {t(`inquiry.st_${data.status}`)}
      </ThemedText>
      {data.messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.bubble,
            message.fromAdmin ? { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement } : { alignSelf: 'flex-end', backgroundColor: theme.tintSoft },
          ]}>
          <ThemedText type="captionBold" themeColor="textSecondary">
            {message.fromAdmin ? t('inquiry.team') : t('inquiry.me')}
          </ThemedText>
          <ThemedText type="small" selectable>
            {message.body}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            {new Date(message.createdAt).toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </ThemedText>
        </View>
      ))}
      {closed ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {t('inquiry.closedHint')}
        </ThemedText>
      ) : (
        <>
          <TextField label={t('inquiry.reply')} value={body} onChangeText={setBody} maxLength={2000} multiline style={styles.input} />
          {add.isError ? (
            <ThemedText type="small" themeColor="danger">
              {add.error instanceof ApiError ? add.error.message : t('inquiry.failed')}
            </ThemedText>
          ) : null}
          <Button title={t('inquiry.send')} disabled={!body.trim()} loading={add.isPending} onPress={() => add.mutate(body.trim(), { onSuccess: () => setBody('') })} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  bubble: { maxWidth: '85%', borderRadius: Radius.lg, padding: Spacing.three, gap: 4 },
  center: { textAlign: 'center', marginTop: Spacing.three },
  input: { minHeight: 90, textAlignVertical: 'top' },
  loading: { marginTop: Spacing.six },
});
