import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { API_URL } from './env';
import { loadToken } from './token-storage';
import i18n from '@/i18n';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** 서버 오류 코드(예: REPLY_LIMIT) — 문구 대신 이걸로 분기할 것(문구는 언어마다 다름) */
    public code?: string,
  ) {
    super(message);
  }
}

// 로그인이 끊겼을 때(정지·영구차단·토큰 만료) 알림 받을 곳 — AuthProvider가 등록해서 로그아웃 처리
let unauthorizedHandler: ((message: string) => void) | null = null;
export function onUnauthorized(handler: ((message: string) => void) | null) {
  unauthorizedHandler = handler;
}

// 운영자 2단계 인증 필요(401 ADMIN_MFA_REQUIRED — 로그아웃이 아니라 코드 입력 화면)·점검 중(503 MAINTENANCE — 앱 설정을 다시 받아 점검 화면) 알림(2026-10-20)
let mfaRequiredHandler: (() => void) | null = null;
let maintenanceHandler: (() => void) | null = null;
export function onMfaRequired(handler: (() => void) | null) {
  mfaRequiredHandler = handler;
}
export function onMaintenance(handler: (() => void) | null) {
  maintenanceHandler = handler;
}

// 접속 기록용 기기 정보(2026-10-14) — 운영자 회원 관리에서 "어떤 기기·앱 버전으로 들어왔는지" 확인.
// 웹은 기기 이름이 없어서 서버가 브라우저 정보로 대신 채움. 헤더 값은 영문·숫자만 안전해서 그 밖의 글자는 지움
function clientHeaders(): Record<string, string> {
  const clean = (value: string | null | undefined) => value?.replace(/[^\x20-\x7E]/g, '').trim().slice(0, 60) || undefined;
  const entries: [string, string | undefined][] = [
    ['X-Client-Platform', Platform.OS],
    ['X-Client-Device', Platform.OS === 'web' ? undefined : clean(Device.modelName)],
    ['X-Client-OS', clean([Device.osName, Device.osVersion].filter(Boolean).join(' '))],
    ['X-Client-Version', clean(Constants.expoConfig?.version)],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1])));
}
const CLIENT_HEADERS = clientHeaders();

async function request<T>(path: string, options: RequestInit = {}, as: 'json' | 'text' = 'json'): Promise<T> {
  const token = await loadToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // 서버가 오류 문구를 지금 앱 언어로 번역해서 줌(backend LocalizedExceptionFilter)
    'Accept-Language': i18n.language,
    ...CLIENT_HEADERS,
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; code?: string };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    const error = new ApiError(res.status, message ?? i18n.t('common.requestFailed', { status: res.status }), body.code);
    if (res.status === 401 && body.code === 'ADMIN_MFA_REQUIRED') mfaRequiredHandler?.();
    else if (res.status === 401 && token) unauthorizedHandler?.(error.message);
    if (res.status === 503 && body.code === 'MAINTENANCE') maintenanceHandler?.();
    throw error;
  }
  // 본문 없는 성공 응답(204, 또는 void를 돌려주는 POST의 201)은 undefined — 예전엔 201 빈 본문을 JSON으로 읽다가
  // 실패해서, 부모 동의 메일이 실제로는 발송됐는데 화면엔 "보내지 못했어요"가 떴음
  const bodyText = res.status === 204 ? '' : await res.text();
  if (as === 'text') return bodyText as T;
  return (bodyText ? JSON.parse(bodyText) : undefined) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  // CSV 같은 글자 응답(정산 내려받기)
  getText: (path: string) => request<string>(path, {}, 'text'),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
