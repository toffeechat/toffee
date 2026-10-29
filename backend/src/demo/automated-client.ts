import { BlockList, isIP } from 'node:net';

/**
 * 링크 자동 검사 거르기(2026-10-29 사용자 요청) — 인스타그램 DM으로 데모 링크를 보내면 Meta 서버가 링크를 미리 열어 봐서 "첫 접속" 메일이
 * 갔음(Becky·North Star). 메신저·검색 회사의 미리보기·검사 서버를 IP 대역·브라우저 정보로 알아보고, 그런 접속은 기록만 남기고 알림은 안 보냄.
 * 처음 보는 검사 서버나 대역이 바뀐 경우는 놓칠 수 있음 — 그땐 운영자 화면 기록의 IP로 다시 확인.
 */

// 회사별 공개 IP 대역(2026-10 기준). Meta: AS32934 공개 대역 / Google: 크롤러·사용자 요청 가져오기(googlebot·special-crawlers·
// user-triggered-fetchers JSON) / LINE: AS38631. 대역을 더하려면 여기에만
const RANGES: Record<string, string[]> = {
  Meta: [
    '31.13.24.0/21',
    '31.13.64.0/18',
    '45.64.40.0/22',
    '66.220.144.0/20',
    '69.63.176.0/20',
    '69.171.224.0/19',
    '74.119.76.0/22',
    '102.132.96.0/20',
    '103.4.96.0/22',
    '129.134.0.0/16',
    '157.240.0.0/16',
    '163.70.128.0/17',
    '173.252.64.0/18',
    '179.60.192.0/22',
    '185.60.216.0/22',
    '185.89.216.0/22',
    '204.15.20.0/22',
    '2a03:2880::/32',
    '2620:0:1c00::/40',
  ],
  Google: [
    '64.233.160.0/19',
    '66.102.0.0/20',
    '66.249.64.0/19',
    '72.14.192.0/18',
    '74.125.0.0/16',
    '108.177.0.0/17',
    '172.217.0.0/16',
    '209.85.128.0/17',
    '2001:4860:4801::/48',
  ],
  LINE: ['147.92.128.0/17', '203.104.128.0/19'],
  // 2026-10-29 Becky·North Star에 인스타 DM을 보낸 순간 여러 IP로 몰려 들어온 검사 서버(소유자 확인 못 함 — 두 소속사 코드에 같은 IP가 찍힘)
  '링크 검사': ['152.233.0.0/16'],
};

const blocks = Object.entries(RANGES).map(([owner, cidrs]) => {
  const list = new BlockList();
  for (const cidr of cidrs) {
    const [address, prefix] = cidr.split('/');
    list.addSubnet(address, Number(prefix), isIP(address) === 6 ? 'ipv6' : 'ipv4');
  }
  return { owner, list };
});

// 미리보기·검사 봇이 스스로 밝히는 이름. 메신저 앱 안 브라우저(Instagram·Line·KAKAOTALK·DaumApps 등)는 실제 사람이라 넣지 않음
const BOT_AGENT =
  /facebookexternalhit|facebot|meta-external(agent|fetcher)|googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|apis-google|feedfetcher-google|google-read-aloud|bingbot|slackbot|twitterbot|linkedinbot|whatsapp\/|telegrambot|discordbot|kakaotalk-scrap|yeti\/|headlesschrome|lighthouse|phantomjs|python-requests|curl\/|\b(bot|crawler|spider)\b/i;

// 검사용 브라우저는 서버 시간대(세계 표준시)인 경우가 많음 — 태국·한국 소속사는 아님
const UTC_ZONES = new Set(['UTC', 'Etc/UTC', 'Etc/GMT', 'GMT', 'Etc/Universal', 'Universal']);

export interface AutomationSignals {
  ip: string | null;
  userAgent: string | null;
  /** 브라우저가 "자동 조종 중"이라고 밝힘(navigator.webdriver) — 데모 웹이 X-Client-Automation 헤더로 보냄 */
  automationHint?: boolean;
  /** 브라우저 시간대(X-Client-TZ) */
  timeZone?: string | null;
}

/** 자동 검사로 보이면 이유("Meta 서버" 등), 사람이면 null */
export function automatedReason(signals: AutomationSignals): string | null {
  const ip = normalizeIp(signals.ip);
  if (ip) {
    const type = isIP(ip) === 6 ? 'ipv6' : 'ipv4';
    const hit = blocks.find(({ list }) => list.check(ip, type));
    if (hit) return `${hit.owner} 서버`;
  }
  const agent = signals.userAgent?.match(BOT_AGENT)?.[0];
  if (agent) return `검사 봇(${agent})`;
  if (signals.automationHint) return '자동 조종 브라우저';
  if (signals.timeZone && UTC_ZONES.has(signals.timeZone)) return '세계 표준시 브라우저';
  return null;
}

// "::ffff:1.2.3.4"(IPv6 안의 IPv4) → "1.2.3.4". 모르는 모양이면 null
function normalizeIp(raw: string | null): string | null {
  const ip = raw?.trim().replace(/^::ffff:/i, '');
  return ip && isIP(ip) ? ip : null;
}

// ── 패턴으로 거르기(2026-10-29) — IP 대역 표에 없는 검사 서버(Becky·North Star: 1~2분에 IP 5개, 두 소속사에 같은 IP) ──
// 서로 다른 소속사 코드에 같은 IP가 이 시간 안에 찍히면 — 다른 회사 사람이 같은 IP일 리 없음(링크를 여러 곳에 보낸 순간 검사 서버가 다 열어 봄)
export const SHARED_IP_WINDOW_MS = 2 * 60 * 60 * 1000;
// 같은 코드에 짧은 시간 서로 다른 IP가 몰리면 — 사람 한 명은 IP가 보통 하나(검사기는 여러 서버로 동시에 열어 봄)
const BURSTS = [
  { windowMs: 60 * 1000, ips: 2 },
  { windowMs: 3 * 60 * 1000, ips: 3 },
];
export const PATTERN_WINDOW_MS = Math.max(SHARED_IP_WINDOW_MS, ...BURSTS.map((burst) => burst.windowMs));

export interface PatternRow {
  codeId: string | null;
  ip: string | null;
  createdAt: Date;
}

/** 주변 기록(다른 코드 포함, 앞뒤 PATTERN_WINDOW_MS)과 견줘 자동 검사 패턴이면 이유. 공용 코드(codeId null)는 내부 테스트라 안 봄 */
export function patternReason(row: PatternRow, neighbors: readonly PatternRow[]): string | null {
  if (!row.codeId || !row.ip) return null;
  const at = row.createdAt.getTime();
  const near = (other: PatternRow, windowMs: number) => Math.abs(other.createdAt.getTime() - at) <= windowMs;
  if (neighbors.some((other) => other.codeId && other.codeId !== row.codeId && other.ip === row.ip && near(other, SHARED_IP_WINDOW_MS))) {
    return '여러 소속사 코드에 같은 IP';
  }
  const sameCode = neighbors.filter((other) => other !== row && other.codeId === row.codeId && other.ip);
  for (const burst of BURSTS) {
    // 이 줄이 들어가는 길이 windowMs 창 하나라도 서로 다른 IP가 burst.ips개 이상이면 — 창의 시작은 이 줄 또는 앞쪽 기록
    const starts = [at, ...sameCode.map((other) => other.createdAt.getTime()).filter((t) => t <= at && at - t <= burst.windowMs)];
    for (const from of starts) {
      const inWindow = sameCode.filter((other) => other.createdAt.getTime() >= from && other.createdAt.getTime() <= from + burst.windowMs);
      if (new Set([row.ip, ...inWindow.map((other) => other.ip)]).size >= burst.ips) return '짧은 시간에 여러 IP';
    }
  }
  return null;
}

