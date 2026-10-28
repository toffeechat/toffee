import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/text-field';
import { InquiryPhotoPicker, InquiryPhotoStrip } from '@/components/inquiry-photos';
import { useAddInquiryMessage, useDeleteInquiry, useMyInquiry, type PickedPhoto } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

/**
 * 문의 대화(2026-10-20) — 내 글은 오른쪽, 운영팀 답은 왼쪽. 끝난 문의엔 더 못 씀.
 * 2026-10-25: 사진 3장까지(사진만 보내도 됨), 누르면 크게 보기. 맨 아래 "문의 지우기"(붙인 사진까지 지워짐 — 개인정보)
 */
export default function InquiryScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useMyInquiry(id);
  const add = useAddInquiryMessage(id);
  const remove = useDeleteInquiry(id);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const backToList = () => (router.canGoBack() ? router.back() : router.replace('/support'));
  if (isLoading) return <ActivityIndicator style={styles.loading} color={theme.tint} />;
  // 지운 문의(404)·불러오기 실패(2026-10-28) — 예전엔 로딩만 계속 돌았음
  if (!data) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <EmptyState
          icon={SearchX}
          title={t('inquiry.notFound')}
          action={<Button title={t('inquiry.backToList')} variant="secondary" onPress={backToList} />}
        />
      </View>
    );
  }
  const closed = data.status === 'CLOSED';
  const send = () =>
    add.mutate(
      { body: body.trim(), photos },
      {
        onSuccess: () => {
          setBody('');
          setPhotos([]);
        },
      },
    );
  const onDelete = async () => {
    if (!(await confirm(t('inquiry.deleteTitle'), t('inquiry.deleteConfirm'), t('inquiry.delete'), t('common.cancel')))) return;
    remove.mutate(undefined, { onSuccess: backToList });
  };
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
          {message.body ? (
            <ThemedText type="small" selectable>
              {message.body}
            </ThemedText>
          ) : null}
          <InquiryPhotoStrip photos={message.attachments ?? []} openLabel={t('inquiry.openPhoto')} unavailableLabel={t('inquiry.photoUnavailable')} />
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
          <InquiryPhotoPicker photos={photos} onChange={setPhotos} addLabel={t('inquiry.addPhoto')} removeLabel={t('inquiry.removePhoto')} disabled={add.isPending} />
          {add.isError ? (
            <ThemedText type="small" themeColor="danger">
              {add.error instanceof ApiError ? add.error.message : t('inquiry.failed')}
            </ThemedText>
          ) : null}
          <Button title={t('inquiry.send')} disabled={!body.trim() && photos.length === 0} loading={add.isPending} onPress={send} />
        </>
      )}
      <Button title={t('inquiry.delete')} variant="danger" disabled={remove.isPending} onPress={() => void onDelete()} style={styles.delete} />
      {remove.isError ? (
        <ThemedText type="small" themeColor="danger" style={styles.center}>
          {remove.error instanceof ApiError ? remove.error.message : t('inquiry.failed')}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  bubble: { maxWidth: '85%', borderRadius: Radius.lg, padding: Spacing.three, gap: 4 },
  center: { textAlign: 'center', marginTop: Spacing.three },
  input: { minHeight: 90, textAlignVertical: 'top' },
  delete: { marginTop: Spacing.four },
  loading: { marginTop: Spacing.six },
});
