/**
 * 기본 금칙어(2026-10-20 사용자 요청: "나라별 욕을 잘 모르니 알아서") — 운영자 화면 [기본 목록 넣기]로 빠진 것만 추가(isDefault = true).
 * 범위(사용자 결정): 욕설·성적 표현·혐오 표현 + 외부 연락처 유도·광고 문구.
 *
 * 고르는 기준 — 멀쩡한 말이 막히지 않게:
 * - 띄어쓰기가 없는 언어(한국어·태국어·일본어·중국어)는 "포함되면" 막으므로, 다른 낱말 안에 들어가는 짧은 말은 뺌
 *   (예: 한국어 "시발"(시발점), "보지"(보지 마), "꺼져"(불이 꺼져) / 태국어 "แม่ง"(แม่งาน), "กะหรี่"(แกงกะหรี่ 카레), "หี"(หีบ))
 * - 띄어쓰기가 있는 언어(영어·스페인어·포르투갈어·베트남어)는 단어 단위로 비교(matchesBannedWord) — "ass"가 "class"를 막지 않게.
 *   그래도 뜻이 둘인 말은 뺌(영어 "pussy"(고양이), 스페인어 "zorra"(여우)·"perra"(암캐), 베트남어 "ngu" 단독 등)
 * - 팬이 칭찬하며 흔히 쓰는 강조어(한국어 "존나", 영어 "shit" 등)는 뺌 — 아티스트를 향한 욕·성적 괴롭힘을 막는 게 목적
 * 원어민 검토 전 초안이라, 운영하면서 운영자 화면에서 더하고 뺌.
 */
export const DEFAULT_BANNED_WORDS: Record<string, string[]> = {
  ko: [
    // 욕설
    '씨발', '씨바', '씨빨', 'ㅅㅂ', 'ㅆㅂ', '병신', '븅신', 'ㅂㅅ', '좆', '개새끼', '개새기', '개색기', '개색히', '니애미', '느금마', '느그엄마',
    '애미뒤진', '애비뒤진', '미친년', '미친놈', '썅년', '쌍년', '닥쳐', '엠창', '창녀', '걸레년', '지랄', '염병',
    // 혐오
    '틀딱', '급식충', '김치녀', '맘충', '짱깨', '쪽바리', '똥남아', '장애새끼',
    // 성적
    '섹스', '섹1스', '야동', '자위', '보빨', '사까시', '딸딸이', '몸캠', '조건만남', '원나잇',
    // 외부 연락·광고
    '카톡아이디', '카톡 아이디', '카톡id', '오픈채팅', '오픈카톡', 'open.kakao', '텔레그램', '라인아이디', '라인 아이디', '부업', '수익보장', '토토사이트',
  ],
  th: [
    // 욕설
    'เหี้ย', 'ควย', 'ไอสัส', 'ไอ้สัส', 'สัสหมา', 'ส้นตีน', 'ชาติหมา', 'ไอ้ชาติชั่ว', 'อีดอก', 'อีตอแหล', 'ตอแหล', 'ระยำ', 'จัญไร', 'อีเวร', 'ไอ้เวร',
    'อีควาย', 'ไอ้ควาย', 'พ่อมึงตาย', 'แม่มึงตาย', 'ไปตายซะ', 'ไปตาย',
    // 성적
    'เย็ด', 'เงี่ยน', 'ร่าน', 'โม๊ก', 'ชักว่าว', 'หนังโป๊', 'คลิปหลุด', 'ขายตัว',
    // 외부 연락·광고
    'ไลน์ไอดี', 'แอดไลน์', 'ทักไลน์', 'ไอดีไลน์', 'เทเลแกรม', 'รายได้เสริม', 'เว็บพนัน', 'บาคาร่า',
  ],
  en: [
    // 욕설·혐오
    'fuck', 'fucking', 'fucker', 'motherfucker', 'fck', 'fuk', 'stfu', 'bitch', 'bastard', 'cunt', 'dickhead', 'asshole', 'slut', 'whore',
    'faggot', 'fag', 'nigger', 'nigga', 'retard', 'kys', 'kill yourself', 'go die', 'ugly bitch',
    // 성적
    'porn', 'nudes', 'send nudes', 'blowjob', 'handjob', 'dick pic', 'onlyfans', 'sex chat', 'horny',
    // 외부 연락·광고
    'line id', 'add my line', 'telegram', 'whatsapp', 'wechat id', 'kakao id', 'dm me on', 'check my bio', 'crypto investment', 'free followers',
  ],
  ja: [
    // 욕설·혐오
    '死ね', 'しね', '殺す', 'ころす', '消えろ', 'クソ野郎', 'くそやろう', 'ブス', 'キモい', 'きもい', 'ゴミ野郎', 'カス野郎', 'ガイジ', 'チョン',
    // 성적
    'セックス', 'ちんこ', 'ちんぽ', 'まんこ', 'オナニー', 'エロ動画', 'パパ活', '援交', '売春',
    // 외부 연락·광고
    'LINE交換', 'ライン交換', 'LINEID', 'カカオID', 'テレグラム', '副業', '稼げる',
  ],
  'zh-Hans': [
    // 욕설·혐오
    '傻逼', '煞笔', '傻屄', '操你', '草泥马', '肏', '他妈的', '去死', '贱人', '婊子', '脑残', '狗娘养', '死全家',
    // 성적
    '做爱', '约炮', '裸照', '色情', '卖淫',
    // 외부 연락·광고
    '加微信', '微信号', '加我微信', '电报群', '兼职', '博彩',
  ],
  'zh-Hant': [
    // 욕설·혐오
    '幹你娘', '幹你', '傻屄', '他媽的', '去死', '賤人', '婊子', '腦殘', '死全家', '白痴',
    // 성적
    '做愛', '約炮', '裸照', '色情', '賣淫',
    // 외부 연락·광고
    '加賴', '加line', '加微信', '微信號', '兼職', '博彩',
  ],
  vi: [
    // 욕설·혐오
    'địt', 'đụ', 'đm', 'đcm', 'dcm', 'đmm', 'vcl', 'vkl', 'lồn', 'buồi', 'cặc', 'đĩ', 'óc chó', 'đồ ngu', 'thằng ngu', 'con đĩ', 'chết đi', 'mẹ mày',
    // 성적
    'làm tình', 'phim sex', 'chat sex', 'gái gọi',
    // 외부 연락·광고
    'kết bạn zalo', 'add zalo', 'zalo của', 'telegram', 'kiếm tiền online', 'cá độ',
  ],
  es: [
    // 욕설·혐오
    'puta', 'puto', 'hijo de puta', 'hdp', 'pendejo', 'pendeja', 'cabrón', 'cabron', 'maricón', 'maricon', 'chinga', 'chingada', 'chingar',
    'verga', 'coño', 'culero', 'gilipollas', 'muérete', 'muerete', 'mátate', 'matate',
    // 성적
    'porno', 'sexo', 'desnudos', 'nudes', 'mamada',
    // 외부 연락·광고
    'telegram', 'whatsapp', 'escríbeme al', 'gana dinero',
  ],
  'pt-BR': [
    // 욕설·혐오
    'porra', 'caralho', 'puta', 'filho da puta', 'fdp', 'viado', 'buceta', 'arrombado', 'arrombada', 'otário', 'otario', 'vagabunda', 'foda-se',
    'vai se foder', 'vai tomar no cu', 'se mata', 'desgraçado', 'desgraçada',
    // 성적
    'pornô', 'porno', 'nudes', 'putaria', 'sexo',
    // 외부 연락·광고
    'telegram', 'whatsapp', 'me chama no', 'ganhe dinheiro',
  ],
};

/** 띄어쓰기로 단어가 나뉘는 언어 — 단어 단위로 비교 */
export const WORD_BOUNDARY_LANGUAGES = new Set(['en', 'es', 'pt-BR', 'vi']);

/** 금칙어 언어(앱 언어 9개와 같음) */
export const BANNED_WORD_LANGUAGES = ['ko', 'th', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'es', 'pt-BR'] as const;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 글에 금칙어가 있는지 — 대소문자 무시. 단어 단위 언어는 앞뒤가 글자·숫자가 아닐 때만(뒤에 붙는 성조 부호(\p{M})도 글자로 봄),
 * 나머지는 포함되면. 유니코드 정규화(NFC)를 맞춰 베트남어처럼 같은 글자가 다르게 저장된 경우도 잡음.
 */
export function matchesBannedWord(text: string, term: string, language: string): boolean {
  const haystack = text.normalize('NFC').toLowerCase();
  const needle = term.normalize('NFC').toLowerCase().trim();
  if (!needle) return false;
  if (!WORD_BOUNDARY_LANGUAGES.has(language)) return haystack.includes(needle);
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{M}\\p{N}])`, 'u').test(haystack);
}
