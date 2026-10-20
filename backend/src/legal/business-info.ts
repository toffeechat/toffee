import type { SupportedLocale } from '../common/i18n/locales.js';
import { escapeHtml } from '../parental-consent/consent-texts.js';

/**
 * 사업자 정보 표시(전자상거래법 제10조 — 상호·대표자·주소·전화·이메일·사업자등록번호·통신판매업 신고번호, 2026-10-12).
 * 법인 설립·통신판매업 신고 전이라 값은 비워 두고, 생기면 서버 설정값(BUSINESS_*)만 넣으면 공개 약관·고객센터 페이지와
 * 앱 마이페이지 아래에 나옴. 비어 있는 항목은 안 보임.
 */
export const BUSINESS_FIELDS = ['name', 'representative', 'address', 'phone', 'email', 'registrationNumber', 'mailOrderNumber'] as const;
export type BusinessField = (typeof BUSINESS_FIELDS)[number];
export type BusinessInfo = Partial<Record<BusinessField, string>>;

const ENV_KEYS: Record<BusinessField, string> = {
  name: 'BUSINESS_NAME',
  representative: 'BUSINESS_REPRESENTATIVE',
  address: 'BUSINESS_ADDRESS',
  phone: 'BUSINESS_PHONE',
  email: 'SUPPORT_EMAIL',
  registrationNumber: 'BUSINESS_REGISTRATION_NUMBER',
  mailOrderNumber: 'BUSINESS_MAIL_ORDER_NUMBER',
};

/** 상호가 없으면(사업자 등록 전) 아무것도 안 보여 줌 — 이메일만 있는 반쪽짜리 표시를 막기 위해 */
export function readBusinessInfo(get: (key: string) => string | undefined): BusinessInfo | null {
  const info: BusinessInfo = {};
  for (const field of BUSINESS_FIELDS) {
    const value = get(ENV_KEYS[field])?.trim();
    if (value) info[field] = value;
  }
  return info.name ? info : null;
}

const LABELS: Record<SupportedLocale, Record<BusinessField, string> & { title: string }> = {
  ko: { title: '사업자 정보', name: '상호', representative: '대표자', address: '주소', phone: '전화', email: '이메일', registrationNumber: '사업자등록번호', mailOrderNumber: '통신판매업 신고번호' },
  en: { title: 'Business information', name: 'Company', representative: 'Representative', address: 'Address', phone: 'Phone', email: 'Email', registrationNumber: 'Business registration no.', mailOrderNumber: 'Mail-order business report no.' },
  th: { title: 'ข้อมูลผู้ประกอบการ', name: 'ชื่อบริษัท', representative: 'ผู้แทน', address: 'ที่อยู่', phone: 'โทรศัพท์', email: 'อีเมล', registrationNumber: 'เลขทะเบียนธุรกิจ', mailOrderNumber: 'เลขที่แจ้งประกอบธุรกิจขายทางไกล' },
  ja: { title: '事業者情報', name: '商号', representative: '代表者', address: '住所', phone: '電話', email: 'メール', registrationNumber: '事業者登録番号', mailOrderNumber: '通信販売業申告番号' },
  'zh-Hans': { title: '经营者信息', name: '公司名称', representative: '代表人', address: '地址', phone: '电话', email: '邮箱', registrationNumber: '营业登记号', mailOrderNumber: '通信销售业申报号' },
  'zh-Hant': { title: '經營者資訊', name: '公司名稱', representative: '代表人', address: '地址', phone: '電話', email: '電子郵件', registrationNumber: '營業登記號', mailOrderNumber: '通信銷售業申報號' },
  vi: { title: 'Thông tin doanh nghiệp', name: 'Tên công ty', representative: 'Người đại diện', address: 'Địa chỉ', phone: 'Điện thoại', email: 'Email', registrationNumber: 'Số đăng ký kinh doanh', mailOrderNumber: 'Số đăng ký bán hàng từ xa' },
  es: { title: 'Información de la empresa', name: 'Empresa', representative: 'Representante', address: 'Dirección', phone: 'Teléfono', email: 'Correo electrónico', registrationNumber: 'N.º de registro mercantil', mailOrderNumber: 'N.º de registro de venta a distancia' },
  'pt-BR': { title: 'Informações da empresa', name: 'Empresa', representative: 'Representante', address: 'Endereço', phone: 'Telefone', email: 'E-mail', registrationNumber: 'N.º de registro da empresa', mailOrderNumber: 'N.º de registro de venda a distância' },
};

export function businessInfoHtml(info: BusinessInfo | null, locale: SupportedLocale): string {
  if (!info) return '';
  const labels = LABELS[locale];
  const rows = BUSINESS_FIELDS.filter((field) => info[field])
    .map((field) => `${escapeHtml(labels[field])}: ${escapeHtml(info[field] ?? '')}`)
    .join('<br>');
  return `<div class="meta"><strong>${escapeHtml(labels.title)}</strong><br>${rows}</div>`;
}
