/** Sentry 이슈 목록 API(`/api/0/projects/{org}/{project}/issues/`) 응답 중 쓰는 부분 — statsPeriod=24h면 stats['24h']가 한 시간 묶음 [유닉스 초, 횟수][] */
export type SentryApiIssue = {
  id: string;
  shortId?: string;
  title?: string;
  culprit?: string;
  permalink?: string;
  level?: string;
  count?: string | number;
  userCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  project?: { slug?: string };
  stats?: { '24h'?: [number, number][] };
};

/** 운영자 홈 "최근 오류" 카드 한 줄 */
export type ErrorIssue = {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: string;
  project: string;
  /** Sentry 누적 횟수 */
  count: number;
  /** 최근 24시간 횟수(시간 묶음 합) */
  count24h: number;
  userCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  url: string;
  /** 시간 묶음 [유닉스 초, 횟수] — 알림 판단용(화면엔 안 보냄) */
  hourly: [number, number][];
};

export function toErrorIssue(raw: SentryApiIssue, project: string): ErrorIssue {
  const hourly = raw.stats?.['24h'] ?? [];
  return {
    id: String(raw.id),
    shortId: raw.shortId ?? String(raw.id),
    title: raw.title ?? '(제목 없음)',
    culprit: raw.culprit ?? '',
    level: raw.level ?? 'error',
    project: raw.project?.slug ?? project,
    count: Number(raw.count ?? 0) || 0,
    count24h: hourly.reduce((sum, [, n]) => sum + (Number(n) || 0), 0),
    userCount: raw.userCount ?? 0,
    firstSeen: raw.firstSeen ?? null,
    lastSeen: raw.lastSeen ?? null,
    url: raw.permalink ?? '',
    hourly,
  };
}

export type ErrorAlertCandidate = { issue: ErrorIssue; kind: 'NEW' | 'SPIKE'; bucket: string; hourCount?: number };

/**
 * 보낼 만한 알림 — 새 오류: 처음 발생이 newWindowMs 안(서버가 잠깐 꺼져 있던 사이 생긴 것도 잡되, 처음 켤 때 옛 오류가 한꺼번에 오지 않게).
 * 많이 남: 최근 두 시간 묶음(지금 시간대 + 막 끝난 시간대 — 5분마다 보므로 정각을 넘길 때 놓치지 않게) 중 threshold 이상인 것, 묶음마다 한 번.
 * threshold가 0이면 "많이 남" 알림은 끔. 실제로 보낼지는 ErrorAlertSent 기록으로 한 번 더 거름.
 */
export function alertCandidates(issues: ErrorIssue[], now: Date, threshold: number, newWindowMs = 30 * 60_000): ErrorAlertCandidate[] {
  const out: ErrorAlertCandidate[] = [];
  for (const issue of issues) {
    const first = issue.firstSeen ? new Date(issue.firstSeen).getTime() : NaN;
    if (Number.isFinite(first) && now.getTime() - first <= newWindowMs) out.push({ issue, kind: 'NEW', bucket: 'first' });
    if (threshold > 0) {
      for (const [ts, n] of issue.hourly.slice(-2)) {
        if (n >= threshold) out.push({ issue, kind: 'SPIKE', bucket: String(ts), hourCount: n });
      }
    }
  }
  return out;
}
