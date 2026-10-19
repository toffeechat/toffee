import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useMessageTranslation, useWelcomeTranslation } from '@/hooks/use-messages';
import { useAutoTranslate } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { needsTranslation } from '@/utils/detect-script';
import { Spacing } from '@/constants/theme';

/**
 * 말풍선 글 + 번역(2026-09-29) — 글이 지금 앱 언어와 다른 글자로 쓰였으면 아래에 "번역 보기". 누르면 번역이 원문 아래에 붙고, 다시 누르면
 * 접힘(원문은 항상 보임 — 번역이 틀릴 수 있어서). 팬 화면의 스타 메시지, 스타 화면의 팬 답장에 씀.
 * 자동 번역(2026-10-16, 설정 > 언어, 기본 켜짐)이면 처음부터 펼쳐짐 — 단 팬 답장(fanReply)은 서버 설정이 켜져 있을 때만(2026-10-19, 기본 꺼짐). 자동으로 펼친 번역이 실패하면 오류 대신 "번역 보기" 버튼만(엔진이 꺼져
 * 있을 때 모든 말풍선에 오류가 뜨지 않게) — 눌러서 직접 펼쳤을 때만 오류를 보여 줌.
 */
export function TranslatableText(props: {
  actorId: string;
  messageId: string;
  text: string;
  display?: string;
  /** 환영 메시지(메시지 행이 아님) — 따로 번역(2026-10-15) */
  welcome?: boolean;
  /**
   * 번역 펼침을 바깥에서 쥘 때(2026-10-15 인용 답장 — 인용 말풍선과 아티스트 말풍선을 "번역 보기" 하나로 같이). alsoTranslatable이면 이 글은 번역이
   * 필요 없어도(같은 언어) 인용 쪽 때문에 버튼을 보여 줌
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 바깥에서 쥔 open이 자동 번역으로 펼친 것인지(직접 누른 게 아님) */
  autoOpened?: boolean;
  alsoTranslatable?: boolean;
  /** 아티스트·소속사 화면의 팬 답장 — 자동 번역은 서버 설정 TRANSLATION_AUTO_FAN_REPLIES를 따름(기본 꺼짐, "번역 보기"를 눌렀을 때만) */
  fanReply?: boolean;
}) {
  const { actorId, messageId, text, display, welcome } = props;
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const auto = useAutoTranslate(props.fanReply ? 'fanReply' : 'artistMessage');
  // null = 아직 누르지 않음(자동 번역 설정을 따름)
  const [openState, setOpenState] = useState<boolean | null>(null);
  const open = props.open ?? openState ?? auto;
  const autoOpened = props.open !== undefined ? !!props.autoOpened : openState === null;
  const setOpen = (next: boolean) => (props.onOpenChange ? props.onOpenChange(next) : setOpenState(next));
  const selfTranslatable = needsTranslation(text, i18n.language);
  const translatable = selfTranslatable || !!props.alsoTranslatable;
  const messageTranslation = useMessageTranslation(actorId, messageId, i18n.language, !welcome && selfTranslatable && open);
  const welcomeTranslation = useWelcomeTranslation(actorId, i18n.language, !!welcome && selfTranslatable && open);
  const translation = welcome ? welcomeTranslation : messageTranslation;
  // 자동으로 펼쳤는데 실패했으면 접힌 것처럼
  const shownOpen = open && !(autoOpened && translation.isError);

  return (
    <View>
      <ThemedText>{display ?? text}</ThemedText>
      {translatable ? (
        <>
          {shownOpen && translation.data ? (
            <View style={[styles.translation, { borderTopColor: theme.border }]}>
              <ThemedText themeColor="textSecondary">{translation.data.text}</ThemedText>
            </View>
          ) : null}
          {shownOpen && translation.isError ? (
            <ThemedText type="caption" themeColor="danger" style={styles.error}>
              {translation.error instanceof ApiError ? translation.error.message : t('translate.failed')}
            </ThemedText>
          ) : null}
          <Pressable
            onPress={() => {
              if (shownOpen) return setOpen(false);
              setOpen(true);
              // 자동 번역이 실패했던 걸 직접 누르면 다시 시도
              if (translation.isError) void translation.refetch();
            }}
            hitSlop={6}
            accessibilityRole="button"
            style={styles.link}>
            {shownOpen && translation.isFetching ? (
              <ActivityIndicator size="small" color={theme.textTertiary} />
            ) : (
              <Icon as={Languages} size={13} color={theme.textTertiary} />
            )}
            <ThemedText type="caption" themeColor="textTertiary">
              {shownOpen ? t('translate.hide') : t('translate.show')}
            </ThemedText>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  translation: { marginTop: Spacing.two, paddingTop: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.one },
  error: { marginTop: Spacing.one },
});
