import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import type { MessageQuote } from '@/hooks/use-messages';
import { useTheme } from '@/hooks/use-theme';

/**
 * 스타가 팬 메시지를 인용해서 답장했을 때 말풍선 위쪽에 보이는 인용 부분(카톡 답장처럼) — 팬은 닉네임으로만.
 * 인용된 팬이 정지됐거나 메시지가 신고 처리되면 서버가 hidden으로 내려줘서 "가려진 메시지"로 표시.
 */
// mine: 인용된 게 내 메시지(팬 본인 화면, 2026-10-13) — "내 메시지에 답장" 배지·강조색
// artistName: 팬 화면 — 다른 팬 닉네임 대신 "○○의 답장"(2026-10-13 사용자 결정, 버블처럼). 서버도 팬 화면엔 닉네임을 안 내려줌.
// 아티스트·소속사 화면은 artistName 없이 "○○님에게 답장"(누구에게 답했는지 알아야 해서)
export function QuoteBlock({ quote, tone, mine, artistName }: { quote: MessageQuote; tone: 'light' | 'dark'; mine?: boolean; artistName?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  // 'dark'(밝은 말풍선 위) 글자는 테마 글자색 — 예전엔 #3A3D4A로 고정이라 다크 모드의 남색 말풍선 위에서 거의 안 보였음(2026-10-12 실기기)
  const color = tone === 'light' ? '#fff' : theme.text;
  const border = tone === 'light' ? '#fff' : theme.tint;
  return (
    <View
      style={[
        styles.box,
        { borderLeftColor: border, backgroundColor: tone === 'light' ? 'rgba(255,255,255,0.18)' : mine ? theme.tintSoft : 'rgba(127,127,140,0.14)' },
      ]}>
      {mine && !quote.hidden ? (
        <View style={[styles.mineBadge, { backgroundColor: theme.tint }]}>
          <ThemedText type="captionBold" style={{ color: theme.onPrimary }}>
            {t('quote.replyToMe')}
          </ThemedText>
        </View>
      ) : null}
      {quote.hidden ? (
        <ThemedText type="small" style={{ color, opacity: 0.8 }}>
          {t(quote.retracted ? 'retract.placeholder' : 'quote.hidden')}
        </ThemedText>
      ) : (
        <>
          {mine ? null : (
            <ThemedText type="smallBold" style={{ color }}>
              {artistName !== undefined
                ? t('quote.artistReply', { name: artistName })
                : t('quote.replyTo', { nickname: quote.nickname ?? t('console.noNickname') })}
            </ThemedText>
          )}
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
  mineBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, marginBottom: 2 },
});
