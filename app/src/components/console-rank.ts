import type { TFunction } from 'i18next';
import { Flame, Hourglass, MessageCircle, UserMinus, UserPlus, Users, type LucideIcon } from 'lucide-react-native';

import type { RankItem } from '@/components/console-charts';
import type { DashboardRow } from '@/hooks/use-console';
import { rankRows, rankValue, repliesPerMessage, type RankMetric } from '@/utils/dashboard-rank';
import { IDLE_WARN_DAYS, idleDays } from '@/utils/idle-days';

export const RANK_ICONS: Record<RankMetric, LucideIcon> = {
  subscribers: Users,
  idle: Hourglass,
  newSubs: UserPlus,
  replies: MessageCircle,
  cancellations: UserMinus,
  engagement: Flame,
};

/** 대시보드 행 → 순위 카드 줄(정렬·표시 글·경고색). 대시보드 카드와 "전체 순위" 화면 공용 */
export function rankItems(rows: DashboardRow[], metric: RankMetric, t: TFunction): RankItem[] {
  const now = Date.now();
  return rankRows(rows, metric, now).map((row) => {
    const idle = idleDays(row.lastBroadcastAt, now);
    const display = (() => {
      switch (metric) {
        case 'subscribers':
          return t('dashboard.countPeople', { count: row.subscriberCount });
        case 'idle':
          return idle === null ? t('console.noMessagesYet') : idle === 0 ? t('console.lastMessageToday') : t('dashboard.daysAgo', { count: idle });
        case 'newSubs':
          return t('dashboard.countPeople', { count: row.newSubscriptions });
        case 'replies':
          return t('dashboard.countItems', { count: row.fanReplies });
        case 'cancellations':
          return t('dashboard.countPeople', { count: row.cancellations });
        case 'engagement':
          return t('dashboard.perMessage', { value: (repliesPerMessage(row) ?? 0).toFixed(1) });
      }
    })();
    // 막대 길이 — 오래 안 보낸 순에서 한 번도 안 보낸 방은 가장 긴 막대로
    const value = metric === 'idle' ? (idle ?? Math.max(30, IDLE_WARN_DAYS * 2)) : rankValue(row, metric, now);
    return {
      id: row.id,
      name: row.chatDisplayName,
      imageUri: row.chatProfileImageUrl,
      value,
      display,
      sub: [row.kind === 'COUPLE' ? t('dashboard.kind.COUPLE') : null, row.retiredAt ? t('dashboard.retired') : null].filter(Boolean).join(' · ') || undefined,
      warn: metric === 'idle' && (idle ?? IDLE_WARN_DAYS) >= IDLE_WARN_DAYS,
    };
  });
}
