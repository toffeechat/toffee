import { SetMetadata } from '@nestjs/common';

export const ADMIN_OWNER_KEY = 'adminOwnerOnly';
export const SKIP_MFA_KEY = 'skipAdminMfa';

/**
 * 운영자 중 전체 권한(OWNER)만(2026-10-20 운영자 권한 단계) — 고객 응대(SUPPORT) 운영자는 막힘. 운영자가 아닌 역할(소속사 등)은 영향 없음
 * (예: 정산 화면은 소속사도 쓰지만 운영자 중엔 OWNER만).
 */
export const AdminOwnerOnly = () => SetMetadata(ADMIN_OWNER_KEY, true);

/** 2단계 인증 확인 전에도 부를 수 있는 운영자 API(코드 확인·설정 화면) */
export const SkipAdminMfa = () => SetMetadata(SKIP_MFA_KEY, true);
