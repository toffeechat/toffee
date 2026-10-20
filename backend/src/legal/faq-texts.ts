import type { SupportedLocale } from '../common/i18n/locales.js';

/**
 * 자주 묻는 질문(2026-10-12, 버블 비교 점검 → 1차) — 공개 웹페이지 GET /faq(고객센터 페이지에서 링크)와 앱 FAQ 화면
 * (GET /faq/items)이 같은 글을 씀. 결제·해지·환불부터(문의가 가장 많을 곳). 내용은 약관 초안·STATUS 잠정 정책과 맞출 것 —
 * 정책(환불 기준·답장 개수 등)을 바꾸면 여기도 같이. th·ja·zh·vi·es·pt-BR은 원어민 검수 전.
 */
export interface FaqSection {
  title: string;
  items: { q: string; a: string }[];
}

export const FAQ_TITLES: Record<SupportedLocale, string> = {
  ko: '자주 묻는 질문',
  en: 'FAQ',
  th: 'คำถามที่พบบ่อย',
  ja: 'よくある質問',
  'zh-Hans': '常见问题',
  'zh-Hant': '常見問題',
  vi: 'Câu hỏi thường gặp',
  es: 'Preguntas frecuentes',
  'pt-BR': 'Perguntas frequentes',
};

export const FAQ: Record<SupportedLocale, FaqSection[]> = {
  ko: [
    {
      title: '결제·해지·환불',
      items: [
        {
          q: '구독은 어떻게 해지하나요?',
          a: '결제한 스토어에서 해지할 수 있어요. iPhone: 설정 > Apple ID(내 이름) > 구독 > Toffee > 구독 취소. Android: Play 스토어 > 프로필 > 결제 및 정기 결제 > 정기 결제 > Toffee > 구독 취소. 토피 앱의 마이페이지 > 구독 관리에서 스토어 화면으로 바로 갈 수도 있어요. 이용 기간이 끝나기 24시간 전까지 해지해야 다음 결제가 되지 않아요. 앱을 지우거나 탈퇴해도 구독은 자동으로 해지되지 않아요.',
        },
        {
          q: '환불받을 수 있나요?',
          a: '결제(자동 갱신 결제 포함) 후 7일 안이면 전액 환불을 요청할 수 있어요. App Store 결제는 Apple 환불 요청 페이지(reportaproblem.apple.com)에서, Google Play 결제는 Google Play 또는 토피 고객센터로 요청해 주세요. 또 결제한 이용 기간 동안 아티스트 메시지가 하나도 없었거나, 아티스트 활동이 종료돼 결제 후 14일 안에 구독할 수 없게 되면 구독 관리에서 환불을 요청할 수 있어요.',
        },
        {
          q: '해지했다가 다시 구독하면 예전 대화가 보이나요?',
          a: '아니요. 다시 구독하면 새로 구독한 때부터의 메시지만 볼 수 있어요. 간직하고 싶은 사진·음성·영상은 해지 전에 저장해 두세요.',
        },
        {
          q: '휴대폰을 바꿨거나 앱을 다시 설치했어요.',
          a: '전에 쓰던 것과 같은 방법(구글·애플·카카오·네이버·LINE)으로 로그인하면 구독이 그대로 있어요. 보이지 않으면 마이페이지 > 구독 관리 > 구매 복원을 눌러 주세요. 결제했던 스토어 계정으로 로그인돼 있어야 해요.',
        },
      ],
    },
    {
      title: '메시지',
      items: [
        {
          q: '아티스트 메시지는 얼마나 자주 오나요?',
          a: '아티스트가 직접 보내기 때문에 아티스트 사정에 따라 비정기적으로 와요. 토피는 메시지 횟수를 보장하지 않지만, 결제한 기간 동안 메시지가 하나도 없었다면 환불을 요청할 수 있어요.',
        },
        {
          q: '답장은 몇 개까지 보낼 수 있나요?',
          a: '아티스트 메시지 하나에 3개까지 글과 이모지로 답장할 수 있어요. 입력창 위에 남은 개수가 보여요. 아티스트가 내 답장을 인용해서 답하면 다른 구독자에게도 내 답장 내용이 보여요(닉네임은 안 보여요).',
        },
        {
          q: '받은 사진·영상을 저장해도 되나요?',
          a: '개인 소장용으로는 저장할 수 있어요. 화면 캡처를 포함해 SNS나 다른 사이트에 올리거나 공유하면 이용이 제한되고 법적 책임을 질 수 있어요.',
        },
        {
          q: '생일 축하 메시지는 어떻게 받나요?',
          a: '마이페이지에서 "생일 축하 메시지 받기"를 켜 주세요. 가입할 때 입력한 생년월일의 날짜에, 생일 메시지를 준비한 아티스트에게서 축하 메시지가 와요. 아티스트에게 내 생일 날짜가 보이지는 않아요.',
        },
      ],
    },
    {
      title: '계정·설정',
      items: [
        {
          q: '새 메시지 알림이 오지 않아요.',
          a: '기기 설정 > 알림 > Toffee에서 알림이 허용돼 있는지, 채팅방 오른쪽 위 ⋯ 메뉴에서 알림이 켜져 있는지 확인해 주세요.',
        },
        {
          q: '문의는 어디로 하나요?',
          a: '마이페이지 > 고객센터에서 메일을 보내 주세요. 회원번호와 앱 버전이 자동으로 들어가서 더 빨리 확인할 수 있어요.',
        },
      ],
    },
  ],
  en: [
    {
      title: 'Payment, cancellation and refunds',
      items: [
        {
          q: 'How do I cancel my subscription?',
          a: 'Cancel in the store you paid with. iPhone: Settings > Apple ID (your name) > Subscriptions > Toffee > Cancel Subscription. Android: Play Store > Profile > Payments & subscriptions > Subscriptions > Toffee > Cancel subscription. You can also go there from Profile > Manage subscriptions in Toffee. Cancel at least 24 hours before the period ends to avoid the next charge. Deleting the app or your account does not cancel the subscription.',
        },
        {
          q: 'Can I get a refund?',
          a: 'You can request a full refund within 7 days of a payment (including auto-renewals). For App Store payments, use Apple’s refund page (reportaproblem.apple.com); for Google Play payments, use Google Play or Toffee support. You can also request a refund in Manage subscriptions if the artist sent no messages during the paid period, or if the artist ended their activity within 14 days after you paid.',
        },
        {
          q: 'If I subscribe again, can I see my old conversation?',
          a: 'No. After subscribing again you only see messages from your new subscription start. Save any photos, voice or videos you want to keep before canceling.',
        },
        {
          q: 'I changed phones or reinstalled the app.',
          a: 'Log in the same way as before (Google, Apple, Kakao, Naver or LINE) and your subscriptions will be there. If not, tap Profile > Manage subscriptions > Restore purchases while signed in to the store account you paid with.',
        },
      ],
    },
    {
      title: 'Messages',
      items: [
        {
          q: 'How often do artists send messages?',
          a: 'Artists write their own messages, so they arrive irregularly depending on their schedule. Toffee does not guarantee a number of messages, but if there were none during a paid period you can request a refund.',
        },
        {
          q: 'How many replies can I send?',
          a: 'Up to 3 text or emoji replies per artist message. The remaining count is shown above the input box. If the artist quotes your reply, other subscribers can see what you wrote (but not your nickname).',
        },
        {
          q: 'Can I save photos and videos I received?',
          a: 'Yes, for personal use. Posting or sharing them on social media or other sites, including screenshots, may lead to restrictions and legal liability.',
        },
        {
          q: 'How do I get a birthday message?',
          a: 'Turn on "Birthday messages" in Profile. On the date of the birth date you entered at sign-up, artists who prepared a birthday message will send you one. Artists cannot see your birth date.',
        },
      ],
    },
    {
      title: 'Account and settings',
      items: [
        {
          q: 'I’m not getting new message notifications.',
          a: 'Check that notifications are allowed in your device Settings > Notifications > Toffee, and that notifications are on in the ⋯ menu at the top right of the chat.',
        },
        {
          q: 'How do I contact support?',
          a: 'Send an email from Profile > Help. Your member ID and app version are added automatically so we can help faster.',
        },
      ],
    },
  ],
  th: [
    {
      title: 'การชำระเงิน การยกเลิก และการคืนเงิน',
      items: [
        {
          q: 'ยกเลิกการสมัครสมาชิกได้อย่างไร',
          a: 'ยกเลิกได้ที่สโตร์ที่ชำระเงิน iPhone: การตั้งค่า > Apple ID (ชื่อของคุณ) > การสมัครรับ > Toffee > ยกเลิกการสมัครรับ Android: Play Store > โปรไฟล์ > การชำระเงินและการสมัครใช้บริการ > การสมัครใช้บริการ > Toffee > ยกเลิก หรือไปจากโปรไฟล์ > จัดการการสมัครสมาชิกในแอป Toffee ได้เลย ต้องยกเลิกอย่างน้อย 24 ชั่วโมงก่อนหมดรอบ จึงจะไม่ถูกเรียกเก็บรอบถัดไป การลบแอปหรือลบบัญชีไม่ได้ยกเลิกการสมัครสมาชิกให้อัตโนมัติ',
        },
        {
          q: 'ขอคืนเงินได้ไหม',
          a: 'ขอคืนเงินเต็มจำนวนได้ภายใน 7 วันหลังชำระเงิน (รวมการต่ออายุอัตโนมัติ) การชำระผ่าน App Store ให้ขอที่หน้าคืนเงินของ Apple (reportaproblem.apple.com) ส่วน Google Play ให้ขอผ่าน Google Play หรือฝ่ายบริการลูกค้าของ Toffee นอกจากนี้ หากศิลปินไม่ได้ส่งข้อความเลยตลอดรอบที่ชำระ หรือศิลปินยุติกิจกรรมภายใน 14 วันหลังชำระเงิน สามารถขอคืนเงินได้ที่จัดการการสมัครสมาชิก',
        },
        {
          q: 'ถ้าสมัครใหม่ จะเห็นแชทเก่าไหม',
          a: 'ไม่เห็น เมื่อสมัครใหม่จะเห็นเฉพาะข้อความตั้งแต่วันที่สมัครใหม่ รูป เสียง และวิดีโอที่อยากเก็บไว้ ควรบันทึกก่อนยกเลิก',
        },
        {
          q: 'เปลี่ยนโทรศัพท์หรือติดตั้งแอปใหม่',
          a: 'เข้าสู่ระบบด้วยวิธีเดิม (Google, Apple, Kakao, Naver หรือ LINE) การสมัครสมาชิกจะยังอยู่ หากไม่เห็น ให้กดโปรไฟล์ > จัดการการสมัครสมาชิก > กู้คืนการซื้อ โดยต้องเข้าสู่ระบบบัญชีสโตร์ที่ใช้ชำระเงิน',
        },
      ],
    },
    {
      title: 'ข้อความ',
      items: [
        {
          q: 'ศิลปินส่งข้อความบ่อยแค่ไหน',
          a: 'ศิลปินเขียนข้อความเอง จึงส่งไม่สม่ำเสมอตามความสะดวกของศิลปิน Toffee ไม่รับประกันจำนวนข้อความ แต่หากไม่มีข้อความเลยตลอดรอบที่ชำระ สามารถขอคืนเงินได้',
        },
        {
          q: 'ตอบกลับได้กี่ข้อความ',
          a: 'ตอบกลับเป็นข้อความหรืออีโมจิได้สูงสุด 3 ข้อความต่อข้อความของศิลปิน จำนวนที่เหลือแสดงอยู่เหนือช่องพิมพ์ หากศิลปินอ้างอิงข้อความของคุณ สมาชิกคนอื่นจะเห็นข้อความนั้น (แต่ไม่เห็นชื่อเล่นของคุณ)',
        },
        {
          q: 'บันทึกรูปและวิดีโอที่ได้รับได้ไหม',
          a: 'บันทึกเพื่อเก็บไว้ดูส่วนตัวได้ การโพสต์หรือแชร์บนโซเชียลหรือเว็บไซต์อื่น รวมถึงภาพหน้าจอ อาจถูกจำกัดการใช้งานและต้องรับผิดทางกฎหมาย',
        },
        {
          q: 'รับข้อความอวยพรวันเกิดได้อย่างไร',
          a: 'เปิด "รับข้อความอวยพรวันเกิด" ในโปรไฟล์ ในวันเกิดตามวันเกิดที่กรอกตอนสมัคร ศิลปินที่เตรียมข้อความวันเกิดไว้จะส่งข้อความอวยพรถึงคุณ ศิลปินไม่เห็นวันเกิดของคุณ',
        },
      ],
    },
    {
      title: 'บัญชีและการตั้งค่า',
      items: [
        {
          q: 'ไม่ได้รับการแจ้งเตือนข้อความใหม่',
          a: 'ตรวจสอบว่าอนุญาตการแจ้งเตือนใน การตั้งค่าเครื่อง > การแจ้งเตือน > Toffee และเปิดการแจ้งเตือนในเมนู ⋯ มุมขวาบนของห้องแชทแล้ว',
        },
        {
          q: 'ติดต่อฝ่ายบริการลูกค้าได้ที่ไหน',
          a: 'ส่งอีเมลจากโปรไฟล์ > ศูนย์ช่วยเหลือ ระบบจะแนบหมายเลขสมาชิกและเวอร์ชันแอปให้อัตโนมัติ ช่วยให้ตรวจสอบได้เร็วขึ้น',
        },
      ],
    },
  ],
  ja: [
    {
      title: '支払い・解約・返金',
      items: [
        {
          q: 'サブスクリプションはどうやって解約しますか？',
          a: '支払ったストアで解約できます。iPhone：設定 > Apple ID（自分の名前）> サブスクリプション > Toffee > サブスクリプションをキャンセル。Android：Playストア > プロフィール > お支払いと定期購入 > 定期購入 > Toffee > 解約。Toffeeアプリのプロフィール > 購読管理からも移動できます。期間終了の24時間前までに解約しないと次回の請求が発生します。アプリの削除や退会では自動で解約されません。',
        },
        {
          q: '返金してもらえますか？',
          a: 'お支払い（自動更新を含む）から7日以内なら全額返金を申請できます。App Storeでのお支払いはAppleの返金リクエストページ（reportaproblem.apple.com）、Google Playでのお支払いはGoogle PlayまたはToffeeのサポートへお申し込みください。また、支払った期間中にアーティストからのメッセージが一度もなかった場合や、お支払いから14日以内にアーティストの活動が終了した場合も、購読管理から返金を申請できます。',
        },
        {
          q: '解約後にまた購読すると、以前のトークは見られますか？',
          a: 'いいえ。再購読すると、新しく購読した時点からのメッセージのみ表示されます。残したい写真・音声・動画は解約前に保存してください。',
        },
        {
          q: '機種変更・アプリを再インストールしました。',
          a: '以前と同じ方法（Google・Apple・Kakao・Naver・LINE）でログインすれば購読はそのままです。表示されない場合は、支払ったストアのアカウントでログインした状態でプロフィール > 購読管理 > 購入を復元をタップしてください。',
        },
      ],
    },
    {
      title: 'メッセージ',
      items: [
        {
          q: 'アーティストからのメッセージはどのくらい届きますか？',
          a: 'アーティスト本人が送るため、本人の都合により不定期に届きます。Toffeeはメッセージの回数を保証しませんが、支払った期間中に一度もなかった場合は返金を申請できます。',
        },
        {
          q: '返信はいくつまで送れますか？',
          a: 'アーティストのメッセージ1件につき、文字と絵文字で3件まで返信できます。残りの件数は入力欄の上に表示されます。アーティストがあなたの返信を引用すると、他の購読者にも返信の内容が表示されます（ニックネームは表示されません）。',
        },
        {
          q: '受け取った写真・動画を保存してもいいですか？',
          a: '個人で楽しむためなら保存できます。スクリーンショットを含め、SNSや他のサイトに投稿・共有すると利用が制限され、法的責任を負う場合があります。',
        },
        {
          q: '誕生日メッセージはどうやって受け取りますか？',
          a: 'プロフィールで「誕生日メッセージを受け取る」をオンにしてください。登録時に入力した生年月日の日付に、誕生日メッセージを用意したアーティストからお祝いのメッセージが届きます。アーティストにあなたの誕生日は見えません。',
        },
      ],
    },
    {
      title: 'アカウント・設定',
      items: [
        {
          q: '新着メッセージの通知が届きません。',
          a: '端末の設定 > 通知 > Toffeeで通知が許可されているか、チャット右上の⋯メニューで通知がオンになっているか確認してください。',
        },
        {
          q: '問い合わせはどこからできますか？',
          a: 'プロフィール > ヘルプからメールを送ってください。会員番号とアプリのバージョンが自動で入るので、より早く確認できます。',
        },
      ],
    },
  ],
  'zh-Hans': [
    {
      title: '付款、取消与退款',
      items: [
        {
          q: '如何取消订阅？',
          a: '请在付款的商店中取消。iPhone：设置 > Apple ID（你的名字）> 订阅 > Toffee > 取消订阅。Android：Play 商店 > 个人资料 > 付款和订阅 > 订阅 > Toffee > 取消订阅。也可以从 Toffee 的 个人资料 > 订阅管理 直接前往。需在当期结束前至少24小时取消，才不会产生下次扣费。删除应用或注销账号不会自动取消订阅。',
        },
        {
          q: '可以退款吗？',
          a: '付款（包括自动续订）后7天内可申请全额退款。App Store 付款请在 Apple 退款页面（reportaproblem.apple.com）申请，Google Play 付款请通过 Google Play 或 Toffee 客服申请。此外，如在已付费期间内艺人未发送任何消息，或付款后14天内艺人停止活动，也可在订阅管理中申请退款。',
        },
        {
          q: '取消后再次订阅，能看到以前的聊天吗？',
          a: '不能。再次订阅后只能看到新订阅之后的消息。想保留的照片、语音和视频请在取消前保存。',
        },
        {
          q: '换了手机或重新安装了应用。',
          a: '用之前的方式（Google、Apple、Kakao、Naver 或 LINE）登录，订阅仍然有效。如果看不到，请在登录付款商店账号的状态下点击 个人资料 > 订阅管理 > 恢复购买。',
        },
      ],
    },
    {
      title: '消息',
      items: [
        {
          q: '艺人多久发一次消息？',
          a: '消息由艺人亲自发送，会根据艺人情况不定期到达。Toffee 不保证消息数量，但如果已付费期间内一条消息都没有，可以申请退款。',
        },
        {
          q: '可以回复几条？',
          a: '每条艺人消息最多可用文字或表情回复3条，剩余条数显示在输入框上方。如果艺人引用了你的回复，其他订阅者也能看到回复内容（看不到你的昵称）。',
        },
        {
          q: '可以保存收到的照片和视频吗？',
          a: '可以保存供个人收藏。包括截图在内，发布或分享到社交媒体或其他网站，可能会被限制使用并承担法律责任。',
        },
        {
          q: '如何收到生日祝福？',
          a: '请在个人资料中开启“接收生日祝福”。在注册时填写的生日当天，准备了生日消息的艺人会给你发来祝福。艺人看不到你的生日。',
        },
      ],
    },
    {
      title: '账号与设置',
      items: [
        {
          q: '收不到新消息通知。',
          a: '请确认设备的 设置 > 通知 > Toffee 已允许通知，并且聊天室右上角 ⋯ 菜单中的通知已开启。',
        },
        {
          q: '如何联系客服？',
          a: '请在 个人资料 > 客服中心 发送邮件。会员编号和应用版本会自动附上，便于更快处理。',
        },
      ],
    },
  ],
  'zh-Hant': [
    {
      title: '付款、取消與退款',
      items: [
        {
          q: '如何取消訂閱？',
          a: '請在付款的商店中取消。iPhone：設定 > Apple ID（你的名字）> 訂閱項目 > Toffee > 取消訂閱。Android：Play 商店 > 個人資料 > 付款和訂閱 > 訂閱 > Toffee > 取消訂閱。也可以從 Toffee 的 個人資料 > 訂閱管理 直接前往。需在當期結束前至少24小時取消，才不會產生下次扣款。刪除 App 或刪除帳號不會自動取消訂閱。',
        },
        {
          q: '可以退款嗎？',
          a: '付款（包含自動續訂）後7天內可申請全額退款。App Store 付款請在 Apple 退款頁面（reportaproblem.apple.com）申請，Google Play 付款請透過 Google Play 或 Toffee 客服申請。此外，若在已付費期間內藝人未傳送任何訊息，或付款後14天內藝人停止活動，也可在訂閱管理中申請退款。',
        },
        {
          q: '取消後再次訂閱，看得到以前的聊天嗎？',
          a: '看不到。再次訂閱後只能看到新訂閱之後的訊息。想保留的照片、語音和影片請在取消前儲存。',
        },
        {
          q: '換了手機或重新安裝了 App。',
          a: '用之前的方式（Google、Apple、Kakao、Naver 或 LINE）登入，訂閱仍然有效。若看不到，請在登入付款商店帳號的狀態下點選 個人資料 > 訂閱管理 > 恢復購買。',
        },
      ],
    },
    {
      title: '訊息',
      items: [
        {
          q: '藝人多久傳一次訊息？',
          a: '訊息由藝人親自傳送，會依藝人情況不定期到達。Toffee 不保證訊息數量，但若已付費期間內一則訊息都沒有，可以申請退款。',
        },
        {
          q: '可以回覆幾則？',
          a: '每則藝人訊息最多可用文字或表情回覆3則，剩餘則數顯示在輸入框上方。若藝人引用了你的回覆，其他訂閱者也看得到回覆內容（看不到你的暱稱）。',
        },
        {
          q: '可以儲存收到的照片和影片嗎？',
          a: '可以儲存供個人收藏。包含截圖在內，發布或分享到社群媒體或其他網站，可能會被限制使用並負法律責任。',
        },
        {
          q: '如何收到生日祝福？',
          a: '請在個人資料中開啟「接收生日祝福」。在註冊時填寫的生日當天，準備了生日訊息的藝人會傳來祝福。藝人看不到你的生日。',
        },
      ],
    },
    {
      title: '帳號與設定',
      items: [
        {
          q: '收不到新訊息通知。',
          a: '請確認裝置的 設定 > 通知 > Toffee 已允許通知，並且聊天室右上角 ⋯ 選單中的通知已開啟。',
        },
        {
          q: '如何聯絡客服？',
          a: '請在 個人資料 > 客服中心 寄送郵件。會員編號和 App 版本會自動附上，方便更快處理。',
        },
      ],
    },
  ],
  vi: [
    {
      title: 'Thanh toán, hủy và hoàn tiền',
      items: [
        {
          q: 'Làm sao để hủy gói đăng ký?',
          a: 'Hủy trong cửa hàng bạn đã thanh toán. iPhone: Cài đặt > Apple ID (tên bạn) > Đăng ký > Toffee > Hủy đăng ký. Android: Cửa hàng Play > Hồ sơ > Thanh toán và gói đăng ký > Gói đăng ký > Toffee > Hủy. Bạn cũng có thể vào từ Hồ sơ > Quản lý gói đăng ký trong Toffee. Cần hủy ít nhất 24 giờ trước khi kỳ hạn kết thúc để không bị tính phí kỳ sau. Xóa ứng dụng hay xóa tài khoản không tự động hủy gói đăng ký.',
        },
        {
          q: 'Tôi có được hoàn tiền không?',
          a: 'Bạn có thể yêu cầu hoàn tiền toàn bộ trong vòng 7 ngày sau khi thanh toán (kể cả tự động gia hạn). Thanh toán qua App Store hãy yêu cầu tại trang hoàn tiền của Apple (reportaproblem.apple.com); thanh toán qua Google Play hãy yêu cầu qua Google Play hoặc bộ phận hỗ trợ của Toffee. Ngoài ra, nếu nghệ sĩ không gửi tin nhắn nào trong kỳ đã thanh toán, hoặc nghệ sĩ ngừng hoạt động trong vòng 14 ngày sau khi bạn thanh toán, bạn có thể yêu cầu hoàn tiền trong Quản lý gói đăng ký.',
        },
        {
          q: 'Nếu đăng ký lại, tôi có xem được cuộc trò chuyện cũ không?',
          a: 'Không. Sau khi đăng ký lại, bạn chỉ thấy tin nhắn từ lúc đăng ký mới. Hãy lưu ảnh, giọng nói và video muốn giữ trước khi hủy.',
        },
        {
          q: 'Tôi đổi điện thoại hoặc cài lại ứng dụng.',
          a: 'Đăng nhập bằng cách như trước (Google, Apple, Kakao, Naver hoặc LINE) thì gói đăng ký vẫn còn. Nếu không thấy, hãy chạm Hồ sơ > Quản lý gói đăng ký > Khôi phục giao dịch khi đang đăng nhập tài khoản cửa hàng đã thanh toán.',
        },
      ],
    },
    {
      title: 'Tin nhắn',
      items: [
        {
          q: 'Nghệ sĩ gửi tin nhắn thường xuyên không?',
          a: 'Nghệ sĩ tự viết tin nhắn nên tin đến không định kỳ tùy lịch của nghệ sĩ. Toffee không đảm bảo số lượng tin nhắn, nhưng nếu trong kỳ đã thanh toán không có tin nào, bạn có thể yêu cầu hoàn tiền.',
        },
        {
          q: 'Tôi trả lời được bao nhiêu tin?',
          a: 'Tối đa 3 tin trả lời bằng chữ hoặc biểu tượng cảm xúc cho mỗi tin nhắn của nghệ sĩ. Số còn lại hiển thị phía trên ô nhập. Nếu nghệ sĩ trích dẫn tin trả lời của bạn, người đăng ký khác cũng thấy nội dung tin đó (nhưng không thấy biệt danh của bạn).',
        },
        {
          q: 'Tôi có được lưu ảnh và video đã nhận không?',
          a: 'Được, để lưu giữ cá nhân. Đăng hoặc chia sẻ lên mạng xã hội hay trang web khác, kể cả ảnh chụp màn hình, có thể bị hạn chế sử dụng và chịu trách nhiệm pháp lý.',
        },
        {
          q: 'Làm sao để nhận lời chúc sinh nhật?',
          a: 'Bật "Nhận lời chúc sinh nhật" trong Hồ sơ. Vào ngày sinh nhật theo ngày sinh bạn nhập khi đăng ký, các nghệ sĩ đã chuẩn bị tin nhắn sinh nhật sẽ gửi lời chúc cho bạn. Nghệ sĩ không thấy ngày sinh của bạn.',
        },
      ],
    },
    {
      title: 'Tài khoản và cài đặt',
      items: [
        {
          q: 'Tôi không nhận được thông báo tin nhắn mới.',
          a: 'Hãy kiểm tra đã cho phép thông báo trong Cài đặt thiết bị > Thông báo > Toffee, và đã bật thông báo trong menu ⋯ ở góc trên bên phải phòng chat.',
        },
        {
          q: 'Liên hệ hỗ trợ ở đâu?',
          a: 'Gửi email từ Hồ sơ > Trợ giúp. Mã thành viên và phiên bản ứng dụng sẽ được thêm tự động để chúng tôi hỗ trợ nhanh hơn.',
        },
      ],
    },
  ],
  es: [
    {
      title: 'Pagos, cancelación y reembolsos',
      items: [
        {
          q: '¿Cómo cancelo mi suscripción?',
          a: 'Cancélala en la tienda con la que pagaste. iPhone: Ajustes > Apple ID (tu nombre) > Suscripciones > Toffee > Cancelar suscripción. Android: Play Store > Perfil > Pagos y suscripciones > Suscripciones > Toffee > Cancelar suscripción. También puedes ir desde Perfil > Gestionar suscripciones en Toffee. Cancela al menos 24 horas antes de que termine el periodo para evitar el siguiente cobro. Borrar la app o tu cuenta no cancela la suscripción.',
        },
        {
          q: '¿Puedo pedir un reembolso?',
          a: 'Puedes pedir el reembolso completo dentro de los 7 días posteriores a un pago (incluidas las renovaciones automáticas). Para pagos en App Store, usa la página de reembolsos de Apple (reportaproblem.apple.com); para pagos en Google Play, usa Google Play o el soporte de Toffee. También puedes pedir un reembolso en Gestionar suscripciones si el artista no envió ningún mensaje durante el periodo pagado, o si el artista terminó su actividad en los 14 días posteriores a tu pago.',
        },
        {
          q: 'Si me vuelvo a suscribir, ¿puedo ver mi conversación anterior?',
          a: 'No. Al volver a suscribirte solo verás los mensajes desde el inicio de la nueva suscripción. Guarda las fotos, audios o videos que quieras conservar antes de cancelar.',
        },
        {
          q: 'Cambié de teléfono o reinstalé la app.',
          a: 'Inicia sesión igual que antes (Google, Apple, Kakao, Naver o LINE) y tus suscripciones seguirán ahí. Si no aparecen, toca Perfil > Gestionar suscripciones > Restaurar compras con la sesión iniciada en la cuenta de la tienda con la que pagaste.',
        },
      ],
    },
    {
      title: 'Mensajes',
      items: [
        {
          q: '¿Con qué frecuencia envían mensajes los artistas?',
          a: 'Los artistas escriben sus propios mensajes, así que llegan de forma irregular según su agenda. Toffee no garantiza un número de mensajes, pero si no hubo ninguno durante un periodo pagado puedes pedir un reembolso.',
        },
        {
          q: '¿Cuántas respuestas puedo enviar?',
          a: 'Hasta 3 respuestas de texto o emoji por cada mensaje del artista. Las que te quedan se muestran encima del cuadro de texto. Si el artista cita tu respuesta, otros suscriptores podrán ver lo que escribiste (pero no tu apodo).',
        },
        {
          q: '¿Puedo guardar las fotos y videos que recibo?',
          a: 'Sí, para uso personal. Publicarlos o compartirlos en redes sociales u otros sitios, incluidas capturas de pantalla, puede conllevar restricciones y responsabilidad legal.',
        },
        {
          q: '¿Cómo recibo un mensaje de cumpleaños?',
          a: 'Activa "Mensajes de cumpleaños" en Perfil. En la fecha de nacimiento que indicaste al registrarte, los artistas que hayan preparado un mensaje de cumpleaños te lo enviarán. Los artistas no pueden ver tu fecha de nacimiento.',
        },
      ],
    },
    {
      title: 'Cuenta y ajustes',
      items: [
        {
          q: 'No me llegan las notificaciones de mensajes nuevos.',
          a: 'Comprueba que las notificaciones estén permitidas en Ajustes del dispositivo > Notificaciones > Toffee, y que estén activadas en el menú ⋯ de la esquina superior derecha del chat.',
        },
        {
          q: '¿Cómo contacto con soporte?',
          a: 'Envía un correo desde Perfil > Ayuda. Tu número de miembro y la versión de la app se añaden automáticamente para que podamos ayudarte más rápido.',
        },
      ],
    },
  ],
  'pt-BR': [
    {
      title: 'Pagamento, cancelamento e reembolso',
      items: [
        {
          q: 'Como cancelo minha assinatura?',
          a: 'Cancele na loja em que você pagou. iPhone: Ajustes > Apple ID (seu nome) > Assinaturas > Toffee > Cancelar Assinatura. Android: Play Store > Perfil > Pagamentos e assinaturas > Assinaturas > Toffee > Cancelar assinatura. Você também pode ir por Perfil > Gerenciar assinaturas na Toffee. Cancele pelo menos 24 horas antes do fim do período para evitar a próxima cobrança. Apagar o app ou excluir a conta não cancela a assinatura.',
        },
        {
          q: 'Posso pedir reembolso?',
          a: 'Você pode pedir o reembolso total em até 7 dias após um pagamento (incluindo renovações automáticas). Para pagamentos na App Store, use a página de reembolso da Apple (reportaproblem.apple.com); para pagamentos no Google Play, use o Google Play ou o suporte da Toffee. Você também pode pedir reembolso em Gerenciar assinaturas se o artista não enviou nenhuma mensagem durante o período pago, ou se o artista encerrou as atividades em até 14 dias após o seu pagamento.',
        },
        {
          q: 'Se eu assinar de novo, consigo ver a conversa antiga?',
          a: 'Não. Ao assinar de novo, você só vê as mensagens a partir do início da nova assinatura. Salve as fotos, áudios ou vídeos que quiser guardar antes de cancelar.',
        },
        {
          q: 'Troquei de celular ou reinstalei o app.',
          a: 'Entre do mesmo jeito que antes (Google, Apple, Kakao, Naver ou LINE) e suas assinaturas continuarão lá. Se não aparecerem, toque em Perfil > Gerenciar assinaturas > Restaurar compras com a conta da loja em que você pagou conectada.',
        },
      ],
    },
    {
      title: 'Mensagens',
      items: [
        {
          q: 'Com que frequência os artistas mandam mensagens?',
          a: 'Os próprios artistas escrevem as mensagens, então elas chegam de forma irregular, conforme a agenda deles. A Toffee não garante um número de mensagens, mas, se não houver nenhuma durante um período pago, você pode pedir reembolso.',
        },
        {
          q: 'Quantas respostas posso enviar?',
          a: 'Até 3 respostas em texto ou emoji para cada mensagem do artista. O número restante aparece acima da caixa de texto. Se o artista citar sua resposta, outros assinantes poderão ver o que você escreveu (mas não o seu apelido).',
        },
        {
          q: 'Posso salvar as fotos e os vídeos que recebo?',
          a: 'Sim, para uso pessoal. Postar ou compartilhar em redes sociais ou outros sites, incluindo capturas de tela, pode gerar restrições e responsabilidade legal.',
        },
        {
          q: 'Como recebo uma mensagem de aniversário?',
          a: 'Ative "Mensagens de aniversário" no Perfil. Na data de nascimento que você informou no cadastro, os artistas que prepararam uma mensagem de aniversário vão enviá-la para você. Os artistas não veem sua data de nascimento.',
        },
      ],
    },
    {
      title: 'Conta e configurações',
      items: [
        {
          q: 'Não estou recebendo notificações de novas mensagens.',
          a: 'Verifique se as notificações estão permitidas em Ajustes do aparelho > Notificações > Toffee e se estão ativadas no menu ⋯ no canto superior direito do chat.',
        },
        {
          q: 'Como entro em contato com o suporte?',
          a: 'Envie um e-mail por Perfil > Ajuda. Seu número de membro e a versão do app são adicionados automaticamente para podermos ajudar mais rápido.',
        },
      ],
    },
  ],
};
