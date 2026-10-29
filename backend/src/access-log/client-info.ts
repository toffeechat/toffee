import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** 요청을 보낸 기기 정보 — 앱이 요청마다 X-Client-* 헤더로 보냄(app/src/lib/api-client.ts). 비어 있을 수 있음 */
export interface ClientInfo {
  platform: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  userAgent: string | null;
  ip: string | null;
  /** 데모 접속 자동 검사 거르기용(2026-10-29, demo/automated-client.ts) — 브라우저가 "자동 조종 중"(navigator.webdriver)이라고 밝힘 */
  automationHint?: boolean;
  /** 브라우저 시간대(X-Client-TZ) */
  timeZone?: string | null;
}

/** 접속 기록 표(AccessLog)에 없는 칸은 빼고 */
export function withoutAutomationSignals({ automationHint: _hint, timeZone: _zone, ...rest }: ClientInfo) {
  return rest;
}

// 헤더는 누구나 아무 값이나 보낼 수 있어서 길이만 자르고 그대로 기록(화면 표시용, 판단 근거로 쓰지 않음)
function header(req: Request, name: string, max = 60): string | null {
  const raw = req.headers[name];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value.slice(0, max) : null;
}

export function clientInfoFromRequest(req: Request): ClientInfo {
  const userAgent = header(req, 'user-agent', 300);
  return {
    platform: header(req, 'x-client-platform', 20),
    // 웹(브라우저)은 기기 이름을 못 보내서 브라우저·OS로 대신("Chrome · macOS")
    deviceModel: header(req, 'x-client-device') ?? describeUserAgent(userAgent),
    osVersion: header(req, 'x-client-os'),
    appVersion: header(req, 'x-client-version', 30),
    userAgent,
    // TRUST_PROXY를 켜야 호스팅 프록시 뒤의 실제 IP(main.ts)
    ip: req.ip?.slice(0, 64) ?? null,
    automationHint: header(req, 'x-client-automation', 5) === '1',
    timeZone: header(req, 'x-client-tz', 64),
  };
}

/** 컨트롤러에서 `@Client() client: ClientInfo`로 받음 */
export const Client = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClientInfo =>
  clientInfoFromRequest(ctx.switchToHttp().getRequest<Request>()),
);

// userAgent를 "Chrome · macOS"처럼 줄임(운영자 화면용, 대략이면 충분)
export function describeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser\//.test(ua)
      ? 'Samsung Internet'
      : /(Chrome|CriOS)\//.test(ua)
        ? 'Chrome'
        : /(Firefox|FxiOS)\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
