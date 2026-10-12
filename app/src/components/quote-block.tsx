import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import type { MessageQuote } from '@/hooks/use-messages';
import { useTheme } from '@/hooks/use-theme';

/**
 * 스타가 팬 메시지를 인용해서 답장했을 때 말풍선 위쪽에 보이는 인용 부분(카톡 답장처럼) — 팬은 닉네임으로만.
 * 인용된 팬이 정지됐거나 메시지가 신고 처리되면 서버가 hidden으로 내려줘서 "가려진 메시지"로 표시.
 */
export function QuoteBlock({ quote, tone }: { quote: MessageQuote; tone: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const theme = useTheme();
  // 'dark'(밝은 말풍선 위) 글자는 테마 글자색 — 예전엔 #3A3D4A로 고정이라 다크 모드의 남색 말풍선 위에서 거의 안 보였음(2026-10-12 실기기)
  const color = tone === 'light' ? '#fff' : theme.text;
  const border = tone === 'light' ? '#fff' : theme.tint;
  return (
    <View
      style={[
        styles.box,
        { borderLeftColor: border, backgroundColor: tone === 'light' ? 'rgba(255,255,255,0.18)' : 'rgba(127,127,140,0.14)' },
      ]}>
      {quote.hidden ? (
        <ThemedText type="small" style={{ color, opacity: 0.8 }}>
          {t('quote.hidden')}
        </ThemedText>
      ) : (
        <>
          <ThemedText type="smallBold" style={{ color }}>
            {t('quote.replyTo', { nickname: quote.nickname ?? t('console.noNickname') })}
          </ThemedText>
          <ThemedText type="small" style={{ color, opacity: 0.85 }} numberOfLines={2}>
            {quote.body ?? ''}
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, gap: 2 },
});
