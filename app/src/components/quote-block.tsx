import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { showNameToken } from '@/utils/name-token';
import { useMessageTranslation, type MessageQuote } from '@/hooks/use-messages';
import { useTheme } from '@/hooks/use-theme';
import { needsTranslation } from '@/utils/detect-script';
import { Radius, Spacing } from '@/constants/theme';

/**
 * 스타가 팬 메시지를 인용해서 답장했을 때 말풍선 위쪽에 보이는 인용 부분(카톡 답장처럼) — 팬은 닉네임으로만.
 * 인용된 팬이 정지됐거나 메시지가 신고 처리되면 서버가 hidden으로 내려줘서 "가려진 메시지"로 표시.
 */
// mine: 인용된 게 내 메시지(팬 본인 화면, 2026-10-13) — "내 메시지에 답장" 배지·강조색
// artistName: 팬 화면 — 다른 팬 닉네임 대신 "○○의 답장"(2026-10-13 사용자 결정, 버블처럼). 서버도 팬 화면엔 닉네임을 안 내려줌.
// 아티스트·소속사 화면은 artistName 없이 "○○님에게 답장"(누구에게 답했는지 알아야 해서)
// standalone(2026-10-15 사용자 요청): 아티스트 말풍선 안이 아니라 그 위에 따로 선 말풍선으로. translate가 있으면 아티스트 말풍선의 "번역 보기"와
// 같이 펼쳐져 인용 글 번역도 이 말풍선 안에
export function QuoteBlock({
  quote,
  tone,
  mine,
  artistName,
  standalone,
  translate,
}: {
  quote: MessageQuote;
  tone: 'light' | 'dark';
  mine?: boolean;
  artistName?: string;
  standalone?: boolean;
  translate?: { actorId: string; open: boolean };
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const canTranslate = !!translate && !quote.hidden && !!quote.body && needsTranslation(quote.body, i18n.language);
  const translation = useMessageTranslation(translate?.actorId ?? '', quote.id, i18n.language, canTranslate && !!translate?.open);
  // 'dark'(밝은 말풍선 위) 글자는 테마 글자색 — 예전엔 #3A3D4A로 고정이라 다크 모드의 남색 말풍선 위에서 거의 안 보였음(2026-10-12 실기기)
  const color = tone === 'light' ? '#fff' : theme.text;
  const border = tone === 'light' ? '#fff' : theme.tint;
  return (
    <View
      style={[
        standalone ? styles.standalone : styles.box,
        standalone
          ? { backgroundColor: mine ? theme.tintSoft : theme.backgroundElement, borderColor: mine ? theme.tint : theme.border }
          : { borderLeftColor: border, backgroundColor: tone === 'light' ? 'rgba(255,255,255,0.18)' : mine ? theme.tintSoft : 'rgba(127,127,140,0.14)' },
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
              {quote.artistName
                ? t('quote.fromArtist', { name: quote.artistName })
                : artistName !== undefined
                  ? t('quote.artistReply', { name: artistName })
                  : t('quote.replyTo', { nickname: quote.nickname ?? t('console.noNickname') })}
            </ThemedText>
          )}
          <ThemedText type="small" style={{ color, opacity: 0.85 }} numberOfLines={standalone ? 6 : 2}>
            {/* 아티스트·소속사 화면에선 인용된 아티스트 메시지의 {{name}}이 원문 그대로 와서 "〈팬 닉네임〉"으로(2026-10-20, 팬 화면은 서버가 이미 바꿈) */}
            {quote.body ? showNameToken(quote.body, t('studio.fanNickname')) : ''}
          </ThemedText>
          {canTranslate && translate?.open && translation.data ? (
            <View style={[styles.translation, { borderTopColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {translation.data.text}
              </ThemedText>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, gap: 2 },
  // 따로 선 인용 말풍선 — 아티스트 말풍선보다 한 단계 작게, 얇은 테두리로 "인용"인 걸 구분
  standalone: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: 2, flexShrink: 1 },
  translation: { marginTop: Spacing.one, paddingTop: Spacing.one, borderTopWidth: StyleSheet.hairlineWidth },
  mineBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, marginBottom: 2 },
});
