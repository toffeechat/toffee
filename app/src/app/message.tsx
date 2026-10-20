import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MessageSquareText } from 'lucide-react-native';

import { MessageText } from '@/components/message-text';
import { ThemedText } from '@/components/themed-text';
import { TranslatableText } from '@/components/translatable-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getFullMessage } from '@/lib/full-message';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * 긴 메시지 전체보기(2026-10-19 사용자 결정, 카톡 방식) — 말풍선에서 "전체보기"를 누르면 이 화면에 글 전체. 위에 보낸 사람·시각,
 * 길게 눌러 복사, 번역이 되는 글이면 "번역 보기"도 그대로. 뒤로 가면 대화방의 원래 자리.
 */
export default function FullMessageScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const message = getFullMessage();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!message) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
        <EmptyState icon={MessageSquareText} title={t('longMessage.gone')} action={<Button title={t('longMessage.back')} variant="secondary" onPress={back} />} />
      </SafeAreaView>
    );
  }

  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: MaxContentWidth }]}>
        {message.senderName || time ? (
          <View style={[styles.head, { borderBottomColor: theme.border }]}>
            {message.senderName ? <Avatar uri={message.senderAvatar ?? null} size={40} /> : null}
            <View style={styles.headText}>
              {message.senderName ? <ThemedText type="defaultSemiBold">{message.senderName}</ThemedText> : null}
              {time ? (
                <ThemedText type="caption" themeColor="textTertiary">
                  {time}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ) : null}
        {message.actorId && message.messageId ? (
          <TranslatableText
            actorId={message.actorId}
            messageId={message.messageId}
            text={message.text}
            welcome={message.welcome}
            fanReply={message.fanReply}
            full
          />
        ) : (
          <MessageText message={message} full />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  headText: { flex: 1, gap: 2 },
});
