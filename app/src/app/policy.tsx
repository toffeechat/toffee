import { LegalDocument } from '@/components/legal-document';

// 운영정책(초안, 2026-10-28) — 금지 행위·제재 단계·이의 제기. 본문은 서버(backend/src/legal/legal-texts.ts)가 원본, 공개 웹페이지 /legal/policy와 같은 글
export default function PolicyScreen() {
  return <LegalDocument doc="policy" />;
}
