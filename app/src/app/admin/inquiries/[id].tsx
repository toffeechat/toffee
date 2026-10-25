import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminMessage, AdminSection } from '@/components/admin-ui';
import { ROLE_LABELS } from '@/components/admin-user-panels';
import { InquiryPhotoPicker, InquiryPhotoStrip } from '@/components/inquiry-photos';
import { useAdminInquiry, useCloseInquiry, useDeleteAdminInquiry, useReplyInquiry } from '@/hooks/use-admin';
import type { PickedPhoto } from '@/hooks/use-support';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { INQUIRY_CATEGORY_LABEL, INQUIRY_STATUS_LABEL } from './index';

/**
 * 문의 한 건(2026-10-20) — 답하면 문의한 사람에게 푸시(이름은 "토피 운영팀"). 회원 상세로 바로(결제·구독 내역 확인).
 * 2026-10-25: 붙은 사진은 크게(누르면 전체 화면 확대·저장), 답변에도 사진 3장까지, 문의 지우기(사진 파일까지)
 */
export default function AdminInquiryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useAdminInquiry(id);
  const reply = useReplyInquiry(id);
  const close = useCloseInquiry(id);
  const remove = useDeleteAdminInquiry(id);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  if (isLoading || !data) return <ActivityIndicator style={styles.loading} color={theme.tint} />;
  const onClose = async () => {
    if (await confirm('문의 종료', '이 문의를 끝낼까요? 문의한 사람은 더 쓸 수 없고 새로 문의해야 해요.', '종료', '취소')) close.mutate();
  };
  const onDelete = async () => {
    if (!(await confirm('문의 지우기', '이 문의의 글과 사진(회원·운영팀 모두)을 지워요. 되돌릴 수 없고, 작업 기록엔 제목만 남아요.', '지우기', '취소'))) return;
    remove.mutate(undefined, { onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/admin/inquiries')) });
  };
  const send = () =>
    reply.mutate(
      { body: body.trim(), photos },
      {
        onSuccess: () => {
          setBody('');
          setPhotos([]);
        },
      },
    );
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: data.title }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AdminSection title={`[${INQUIRY_CATEGORY_LABEL[data.category] ?? data.category}] ${data.title}`}>
          <ThemedText type="small" themeColor="textSecondary">
            {data.user.nickname ?? data.user.displayName} ({data.user.displayName}) · {ROLE_LABELS[data.user.role]} · {data.user.email ?? '이메일 없음'} · {INQUIRY_STATUS_LABEL[data.status]}
          </ThemedText>
          <AdminButtonRow>
            <AdminButton secondary label="회원 상세(결제·구독)" onPress={() => router.push({ pathname: '/admin/users/[id]', params: { id: data.user.id } })} />
            {data.status !== 'CLOSED' ? <AdminButton secondary label="문의 종료" disabled={close.isPending} onPress={() => void onClose()} /> : null}
            <AdminButton secondary label="문의 지우기" disabled={remove.isPending} onPress={() => void onDelete()} />
          </AdminButtonRow>
          <AdminMessage text={remove.isError ? (remove.error instanceof ApiError ? remove.error.message : '지우지 못했어요.') : null} error />
        </AdminSection>
        {data.messages.map((message) => (
          <View
            key={message.id}
            style={[styles.bubble, message.fromAdmin ? { alignSelf: 'flex-end', backgroundColor: theme.tintSoft } : { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="captionBold" themeColor="textSecondary">
              {message.fromAdmin ? '운영팀' : '문의한 사람'} · {new Date(message.createdAt).toLocaleString('ko-KR')}
            </ThemedText>
            {message.body ? (
              <ThemedText type="small" selectable>
                {message.body}
              </ThemedText>
            ) : null}
            <InquiryPhotoStrip photos={message.attachments ?? []} size={160} openLabel="사진 크게 보기" unavailableLabel="사진을 불러올 수 없어요(저장소 설정 확인)" />
          </View>
        ))}
        {data.status !== 'CLOSED' ? (
          <AdminSection title="답변" hint="보내면 문의한 사람에게 푸시가 가요(이름은 '토피 운영팀'). 그 사람 언어로 써 주세요(태국 팬이면 태국어나 영어). 설명용 사진(설정 화면 캡처 등)을 3장까지 붙일 수 있어요.">
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
              placeholder="답변"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}
            />
            <InquiryPhotoPicker photos={photos} onChange={setPhotos} addLabel="사진 추가" removeLabel="사진 빼기" disabled={reply.isPending} />
            <AdminButtonRow>
              <AdminButton label={reply.isPending ? '보내는 중…' : '답변 보내기'} disabled={(!body.trim() && photos.length === 0) || reply.isPending} onPress={send} />
            </AdminButtonRow>
            <AdminMessage text={reply.isError ? (reply.error instanceof ApiError ? reply.error.message : '보내지 못했어요.') : null} error />
          </AdminSection>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  bubble: { maxWidth: '85%', borderRadius: 14, padding: Spacing.three, gap: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: Spacing.three, minHeight: 110, fontSize: 15, textAlignVertical: 'top' },
  loading: { marginTop: Spacing.six },
});
