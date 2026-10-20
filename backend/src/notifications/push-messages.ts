import { MessageMediaType } from '../generated/prisma/enums.js';
import { resolveLocale, type SupportedLocale } from '../common/i18n/locales.js';

// 서버가 만드는 푸시 문구 — 받는 사람의 User.locale로 고름. 앱 쪽 번역과 마찬가지로 th/ja/zh는
// 원어민 검수 전(2026-09-28 기계 작성, vi는 2026-10-02).
interface PushStrings {
  media: Record<MessageMediaType, string>;
  /** 아티스트가 사진·영상을 여러 개 한꺼번에 보냈을 때 알림 한 건(2026-10-13) */
  mediaBatch: (count: number) => string;
  /** 스타가 내 메시지를 인용해 답장했을 때(인용된 팬에게만) */
  quotedReplyTitle: (actor: string) => string;
  /** 인용 답장 알림 본문 앞 — 아이폰 대화 알림은 제목이 보낸 사람 이름으로 바뀌어서 */
  quotedReplyPrefix: string;
  staffNewStoryTitle: (actor: string) => string;
  staffNewStoryBody: string;
  /** 장기 미발송 알림(배우 본인) — 팬 수, 며칠째, 커플방이면 방 이름 */
  idleActorTitle: (fans: number) => string;
  idleActorBody: (days: number, room?: string) => string;
  /** 장기 미발송 알림(소속사, 7일부터) */
  idleStaffTitle: (actor: string, days: number) => string;
  idleStaffBody: (fans: number) => string;
  // 환불 기준(30일 미발송) 경고 — 배우·소속사·운영자 공통
  idleRefundTitle: (room: string, daysLeft: number) => string;
  idleRefundBody: (days: number, fans: number) => string;
  // 배우 활동 종료·입대 — 구독 팬에게(환불 안내)
  retiredFanTitle: (actor: string) => string;
  retiredFanBody: (days: number) => string;
  // 생일 축하 메시지(2026-10-12) — 생일 알림을 켠 팬에게, 생일 아침
  birthdayTitle: (actor: string) => string;
  birthdayBody: string;
  // 예약 오픈(2026-10-19) — "곧 공개"에서 알림 받기를 누른 팬에게, 공개 시각에. 제목은 아티스트·묶음 이름
  releasedBody: string;
  releasedBundleBody: string;
}

const STRINGS: Record<SupportedLocale, PushStrings> = {
  ko: {
    media: { TEXT: '새 메시지가 도착했어요', PHOTO: '사진을 보냈어요', AUDIO: '음성 메시지를 보냈어요', VIDEO: '동영상을 보냈어요' },
    mediaBatch: (count) => `사진·동영상 ${count}개를 보냈어요`,
    quotedReplyTitle: (actor) => `${actor}님이 내 메시지에 답장했어요`,
    quotedReplyPrefix: '내 메시지에 답장 · ',
    staffNewStoryTitle: (actor) => `${actor}님이 새 스토리를 올렸어요`,
    staffNewStoryBody: '지금 확인해보세요',
    idleActorTitle: (fans) => `팬 ${fans}명이 기다리고 있어요`,
    idleActorBody: (days, room) => `${room ? `${room} · ` : ''}마지막 메시지가 ${days}일 전이에요. 짧은 인사라도 남겨 볼까요?`,
    idleStaffTitle: (actor, days) => `${actor}님이 ${days}일째 메시지를 보내지 않았어요`,
    idleStaffBody: (fans) => `구독 중인 팬 ${fans}명`,
    idleRefundTitle: (room, left) => `${room} · ${left === 1 ? '내일' : `${left}일 뒤`}부터 팬이 환불을 요청할 수 있어요`,
    idleRefundBody: (days, fans) => `${days}일째 메시지가 없어요. 30일 동안 메시지가 없으면 팬 ${fans}명이 그 달 구독료 환불을 요청할 수 있어요. 지금 한 마디 남겨 주세요.`,
    retiredFanTitle: (actor) => `${actor}님의 활동이 종료됐어요`,
    retiredFanBody: (days) => `지난 대화는 계속 볼 수 있어요. 결제한 지 ${days}일 안이라면 구독 관리에서 이번 달 환불을 요청할 수 있어요.`,
    birthdayTitle: (actor) => `${actor}님이 생일 축하 메시지를 보냈어요`,
    birthdayBody: '생일 축하해요! 지금 확인해 보세요 🎂',
    releasedBody: '지금 토피룸이 열렸어요! 가장 먼저 만나 보세요',
    releasedBundleBody: '묶음 구독이 열렸어요! 지금 확인해 보세요',
  },
  en: {
    media: { TEXT: 'You have a new message', PHOTO: 'Sent a photo', AUDIO: 'Sent a voice message', VIDEO: 'Sent a video' },
    mediaBatch: (count) => `Sent ${count} photos and videos`,
    quotedReplyTitle: (actor) => `${actor} replied to your message`,
    quotedReplyPrefix: 'Replied to you · ',
    staffNewStoryTitle: (actor) => `${actor} posted a new story`,
    staffNewStoryBody: 'Check it out now',
    idleActorTitle: (fans) => `${fans} fans are waiting for you`,
    idleActorBody: (days, room) => `${room ? `${room} · ` : ''}Your last message was ${days} days ago. How about a quick hello?`,
    idleStaffTitle: (actor, days) => `${actor} hasn't sent a message in ${days} days`,
    idleStaffBody: (fans) => `${fans} active subscribers`,
    idleRefundTitle: (room, left) => `${room} · fans can request refunds ${left === 1 ? 'from tomorrow' : `in ${left} days`}`,
    idleRefundBody: (days, fans) => `No messages for ${days} days. After 30 days without a message, ${fans} fans can request a refund for that month. Please send a message now.`,
    retiredFanTitle: (actor) => `${actor} has ended their activity`,
    retiredFanBody: (days) => `You can still read past messages. If you paid within the last ${days} days, you can request a refund for this month in Manage subscriptions.`,
    birthdayTitle: (actor) => `${actor} sent you a birthday message`,
    birthdayBody: 'Happy birthday! Check it out now 🎂',
    releasedBody: 'Their Toffee Room is now open! Be one of the first to join',
    releasedBundleBody: 'This bundle is now open! Check it out',
  },
  th: {
    media: { TEXT: 'มีข้อความใหม่', PHOTO: 'ส่งรูปภาพ', AUDIO: 'ส่งข้อความเสียง', VIDEO: 'ส่งวิดีโอ' },
    mediaBatch: (count) => `ส่งรูปภาพและวิดีโอ ${count} รายการ`,
    quotedReplyTitle: (actor) => `${actor} ตอบกลับข้อความของคุณ`,
    quotedReplyPrefix: 'ตอบกลับข้อความของคุณ · ',
    staffNewStoryTitle: (actor) => `${actor} ลงสตอรี่ใหม่`,
    staffNewStoryBody: 'ดูเลยตอนนี้',
    idleActorTitle: (fans) => `แฟน ${fans} คนกำลังรออยู่`,
    idleActorBody: (days, room) => `${room ? `${room} · ` : ''}ข้อความล่าสุดเมื่อ ${days} วันก่อน ลองทักทายสั้น ๆ ดูไหม?`,
    idleStaffTitle: (actor, days) => `${actor} ไม่ได้ส่งข้อความมา ${days} วันแล้ว`,
    idleStaffBody: (fans) => `ผู้สมัครสมาชิก ${fans} คน`,
    idleRefundTitle: (room, left) => `${room} · แฟนจะขอคืนเงินได้${left === 1 ? 'ตั้งแต่พรุ่งนี้' : `ในอีก ${left} วัน`}`,
    idleRefundBody: (days, fans) => `ไม่มีข้อความมา ${days} วันแล้ว หากไม่มีข้อความครบ 30 วัน แฟน ${fans} คนจะขอคืนเงินค่าสมาชิกของเดือนนั้นได้ ส่งข้อความสักประโยคตอนนี้เลย`,
    retiredFanTitle: (actor) => `${actor} ยุติกิจกรรมแล้ว`,
    retiredFanBody: (days) => `ยังดูข้อความเก่าได้ตามปกติ หากชำระเงินภายใน ${days} วันที่ผ่านมา สามารถขอคืนเงินของเดือนนี้ได้ที่จัดการการสมัครสมาชิก`,
    birthdayTitle: (actor) => `${actor} ส่งข้อความอวยพรวันเกิดถึงคุณ`,
    birthdayBody: 'สุขสันต์วันเกิด! เปิดดูได้เลย 🎂',
    releasedBody: 'Toffee Room เปิดแล้ว! เข้าไปพบกันก่อนใคร',
    releasedBundleBody: 'แพ็กเกจนี้เปิดแล้ว! เข้าไปดูได้เลย',
  },
  ja: {
    media: {
      TEXT: '新しいメッセージが届きました',
      PHOTO: '写真を送信しました',
      AUDIO: 'ボイスメッセージを送信しました',
      VIDEO: '動画を送信しました',
    },
    mediaBatch: (count) => `写真・動画を${count}件送りました`,
    quotedReplyTitle: (actor) => `${actor}さんがあなたのメッセージに返信しました`,
    quotedReplyPrefix: 'あなたへの返信 · ',
    staffNewStoryTitle: (actor) => `${actor}さんが新しいストーリーを投稿しました`,
    staffNewStoryBody: '今すぐチェック',
    idleActorTitle: (fans) => `ファン${fans}人が待っています`,
    idleActorBody: (days, room) => `${room ? `${room} · ` : ''}最後のメッセージは${days}日前です。ひとことだけでも送ってみませんか？`,
    idleStaffTitle: (actor, days) => `${actor}さんが${days}日間メッセージを送っていません`,
    idleStaffBody: (fans) => `購読中のファン${fans}人`,
    idleRefundTitle: (room, left) => `${room}・${left === 1 ? '明日' : `${left}日後`}からファンが返金を申請できます`,
    idleRefundBody: (days, fans) => `${days}日間メッセージがありません。30日間メッセージがないと、ファン${fans}人がその月の購読料の返金を申請できます。今ひとこと送ってください。`,
    retiredFanTitle: (actor) => `${actor}さんの活動が終了しました`,
    retiredFanBody: (days) => `これまでのメッセージは引き続き見られます。お支払いから${days}日以内なら、購読管理から今月分の返金を申請できます。`,
    birthdayTitle: (actor) => `${actor}さんから誕生日メッセージが届きました`,
    birthdayBody: 'お誕生日おめでとう！今すぐチェック 🎂',
    releasedBody: 'Toffee Roomがオープンしました！いち早く会いに行こう',
    releasedBundleBody: 'セット購読がオープンしました！今すぐチェック',
  },
  'zh-Hans': {
    media: { TEXT: '你有一条新消息', PHOTO: '发送了一张照片', AUDIO: '发送了一条语音消息', VIDEO: '发送了一段视频' },
    mediaBatch: (count) => `发送了 ${count} 张照片和视频`,
    quotedReplyTitle: (actor) => `${actor} 回复了你的消息`,
    quotedReplyPrefix: '回复了你 · ',
    staffNewStoryTitle: (actor) => `${actor} 发布了新的限时动态`,
    staffNewStoryBody: '立即查看',
    idleActorTitle: (fans) => `${fans} 位粉丝在等你`,
    idleActorBody: (days, room) => `${room ? `${room} · ` : ''}上一条消息是 ${days} 天前。发一句简短的问候吧？`,
    idleStaffTitle: (actor, days) => `${actor} 已 ${days} 天没有发送消息`,
    idleStaffBody: (fans) => `订阅中的粉丝 ${fans} 人`,
    idleRefundTitle: (room, left) => `${room} · ${left === 1 ? '明天起' : `${left} 天后`}粉丝可申请退款`,
    idleRefundBody: (days, fans) => `已 ${days} 天没有消息。30 天没有消息的话，${fans} 位粉丝可以申请当月订阅费退款。现在就发一句吧。`,
    retiredFanTitle: (actor) => `${actor} 已结束活动`,
    retiredFanBody: (days) => `仍可查看以往的消息。如果是 ${days} 天内付款的，可以在订阅管理中申请本月退款。`,
    birthdayTitle: (actor) => `${actor} 给你发来了生日祝福`,
    birthdayBody: '生日快乐！快去看看吧 🎂',
    releasedBody: 'Toffee Room 已开放！快来抢先见面',
    releasedBundleBody: '套餐已开放！快去看看吧',
  },
  'zh-Hant': {
    media: { TEXT: '你有一則新訊息', PHOTO: '傳送了一張照片', AUDIO: '傳送了一則語音訊息', VIDEO: '傳送了一段影片' },
    mediaBatch: (count) => `傳送了 ${count} 張照片和影片`,
    quotedReplyTitle: (actor) => `${actor} 回覆了你的訊息`,
    quotedReplyPrefix: '回覆了你 · ',
    staffNewStoryTitle: (actor) => `${actor} 發布了新的限時動態`,
    staffNewStoryBody: '立即查看',
    idleActorTitle: (fans) => `${fans} 位粉絲在等你`,
    idleActorBody: (days, room) => `${room ? `${room} · ` : ''}上一則訊息是 ${days} 天前。傳一句簡短的問候吧？`,
    idleStaffTitle: (actor, days) => `${actor} 已 ${days} 天沒有傳送訊息`,
    idleStaffBody: (fans) => `訂閱中的粉絲 ${fans} 人`,
    idleRefundTitle: (room, left) => `${room} · ${left === 1 ? '明天起' : `${left} 天後`}粉絲可申請退款`,
    idleRefundBody: (days, fans) => `已 ${days} 天沒有訊息。30 天沒有訊息的話，${fans} 位粉絲可以申請當月訂閱費退款。現在就傳一句吧。`,
    retiredFanTitle: (actor) => `${actor} 已結束活動`,
    retiredFanBody: (days) => `仍可查看以往的訊息。如果是 ${days} 天內付款的，可以在訂閱管理中申請本月退款。`,
    birthdayTitle: (actor) => `${actor} 傳來了生日祝福`,
    birthdayBody: '生日快樂！快去看看吧 🎂',
    releasedBody: 'Toffee Room 已開放！快來搶先見面',
    releasedBundleBody: '組合已開放！快去看看吧',
  },
  vi: {
    media: { TEXT: 'Bạn có tin nhắn mới', PHOTO: 'Đã gửi một ảnh', AUDIO: 'Đã gửi một tin nhắn thoại', VIDEO: 'Đã gửi một video' },
    mediaBatch: (count) => `Đã gửi ${count} ảnh và video`,
    quotedReplyTitle: (actor) => `${actor} đã trả lời tin nhắn của bạn`,
    quotedReplyPrefix: 'Đã trả lời bạn · ',
    staffNewStoryTitle: (actor) => `${actor} đã đăng story mới`,
    staffNewStoryBody: 'Xem ngay',
    idleActorTitle: (fans) => `${fans} fan đang chờ bạn`,
    idleActorBody: (days, room) => `${room ? `${room} · ` : ''}Tin nhắn gần nhất của bạn là ${days} ngày trước. Gửi một lời chào ngắn nhé?`,
    idleStaffTitle: (actor, days) => `${actor} đã ${days} ngày không gửi tin nhắn`,
    idleStaffBody: (fans) => `${fans} người đang đăng ký`,
    idleRefundTitle: (room, left) => `${room} · fan có thể yêu cầu hoàn tiền ${left === 1 ? 'từ ngày mai' : `sau ${left} ngày`}`,
    idleRefundBody: (days, fans) => `Đã ${days} ngày không có tin nhắn. Nếu 30 ngày không có tin nhắn, ${fans} fan có thể yêu cầu hoàn phí đăng ký của tháng đó. Hãy gửi một tin nhắn ngay nhé.`,
    retiredFanTitle: (actor) => `${actor} đã ngừng hoạt động`,
    retiredFanBody: (days) => `Bạn vẫn xem được các tin nhắn cũ. Nếu bạn thanh toán trong ${days} ngày qua, bạn có thể yêu cầu hoàn tiền tháng này trong Quản lý gói đăng ký.`,
    birthdayTitle: (actor) => `${actor} đã gửi lời chúc mừng sinh nhật cho bạn`,
    birthdayBody: 'Chúc mừng sinh nhật! Xem ngay nhé 🎂',
    releasedBody: 'Toffee Room đã mở! Hãy là người gặp đầu tiên',
    releasedBundleBody: 'Gói combo đã mở! Xem ngay nhé',
  },
};

export function pushStrings(locale: string | null | undefined): PushStrings {
  return STRINGS[resolveLocale(locale)];
}
