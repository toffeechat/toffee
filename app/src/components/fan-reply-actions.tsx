import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ban, Copy, CornerUpLeft, Flag, MoreHorizontal } from 'lucide-react-native';

import { MessageMenu, type MessageAction } from '@/components/message-menu';
import { IconButton } from '@/components/ui/icon-button';
import { useBlockFan } from '@/hooks/use-safety';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { copyText } from '@/lib/copy-text';

/**
 * 스타·소속사 화면의 팬 답장 메뉴 — 말풍선을 길게 누르거나(2026-10-14) 시간 옆 ⋯: 복사 / (스타만) 답장하기(인용) / 신고(운영자 대기열로) /
 * 이 토피룸에서 차단(답장만 막힘). 차단은 되돌릴 수 있고(차단 관리 화면), 구독·열람은 그대로라는 걸 확인 창에서 알려줌.
 * open·onOpenChange를 주면 바깥(길게 누르기)에서 열고 닫음.
 */
export function FanReplyActions({ actorId, messageId, fanUserId, nickname, body, onQuote, open: openProp, onOpenChange }: {
  actorId: string;
  messageId: string;
  fanUserId: string;
  nickname: string;
  /** 복사할 글(회수된 답장이면 없음) */
  body?: string | null;
  /** 스타 화면에서만 — 이 답장을 인용해서 답장하기 */
  onQuote?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOpenState(next));
  const block = useBlockFan(actorId);

  const confirmBlock = async () => {
    const ok = await confirm(
      t('block.confirmTitle', { nickname }),
      t('block.confirmBody'),
      t('block.action'),
      t('common.cancel'),
    );
    if (ok) block.mutate({ fanUserId, messageId }, { onSuccess: () => setOpen(false) });
  };

  if (!open) {
    return (
      <IconButton icon={MoreHorizontal} size={18} label={t('safety.more')} color={theme.textTertiary} onPress={() => setOpen(true)} style={styles.more} />
    );
  }
  const actions: MessageAction[] = [
    ...(body ? [{ key: 'copy', label: t('chat.copy'), icon: Copy, onPress: () => (setOpen(false), copyText(body)) }] : []),
    ...(onQuote && body ? [{ key: 'quote', label: t('quote.action'), icon: CornerUpLeft, accent: true, onPress: onQuote }] : []),
    { key: 'report', label: t('report.action'), icon: Flag, danger: true, onPress: () => router.push({ pathname: '/report', params: { messageId } }) },
    { key: 'block', label: t('block.action'), icon: Ban, danger: true, onPress: () => void (block.isPending ? null : confirmBlock()) },
  ];
  return <MessageMenu actions={actions} onClose={() => setOpen(false)} />;
}

const styles = StyleSheet.create({
  more: { width: 28, height: 28 },
});
