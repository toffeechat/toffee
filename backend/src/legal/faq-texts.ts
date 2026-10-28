import type { SupportedLocale } from '../common/i18n/locales.js';

/**
 * 자주 묻는 질문(2026-10-12, 버블 비교 점검 → 1차 / 2026-10-28 버블처럼 9분류 43개로 확대 — 계정·설정·알림·결제·구독·토피룸·답장·사진·신고) — 공개 웹페이지 GET /faq(고객센터 페이지에서 링크)와 앱 FAQ 화면
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
      title: '계정',
      items: [
        {
          q: '어떤 방법으로 가입·로그인하나요?',
          a: '구글·애플·카카오·네이버·LINE 계정으로 가입하고 로그인해요(나라와 기기에 따라 보이는 버튼이 달라요). 토피는 따로 비밀번호를 만들지 않아요. 성인만 가입할 수 있어요(나라별 성년 나이 기준).',
        },
        {
          q: '비밀번호를 잊어버렸어요.',
          a: '토피는 비밀번호 없이 구글·애플 같은 계정으로 로그인해서 토피 비밀번호는 없어요. 그 계정의 비밀번호를 잊었다면 해당 회사(구글·애플·카카오·네이버·LINE)에서 비밀번호를 찾아 주세요.',
        },
        {
          q: '로그인 계정(이메일)을 바꿀 수 있나요?',
          a: '아니요. 가입할 때 쓴 로그인 방법과 이메일은 바꿀 수 없어요. 다른 방법으로 로그인하면 새 계정이 만들어지고, 구독은 옮겨지지 않아요. 내가 어떤 방법으로 가입했는지는 프로필 > 로그인 정보에서 볼 수 있어요. 로그인 화면에도 마지막으로 쓴 버튼에 "최근 로그인"이 표시돼요.',
        },
        {
          q: '여러 기기에서 쓸 수 있나요?',
          a: '네. 같은 방법으로 로그인하면 휴대폰·태블릿·PC 웹에서 함께 쓸 수 있고, 알림은 로그인한 앱 모두로 가요. 기기를 잃어버렸다면 프로필 > 모든 기기에서 로그아웃을 눌러 주세요.',
        },
        {
          q: '로그아웃은 어떻게 하나요?',
          a: '프로필 화면 맨 아래 "로그아웃"을 눌러 주세요. 로그아웃해도 구독은 그대로이고, 같은 방법으로 다시 로그인하면 이어서 쓸 수 있어요.',
        },
        {
          q: '탈퇴하고 싶어요.',
          a: '프로필 화면 맨 아래 "회원 탈퇴"에서 할 수 있어요. 탈퇴해도 스토어 구독은 자동으로 해지되지 않으니 먼저 스토어에서 해지해 주세요. 탈퇴하면 대화 내용과 구독 기록을 되살릴 수 없어요.',
        },
        {
          q: '생년월일을 잘못 입력했어요.',
          a: '생년월일은 성인 확인에 쓰여서 앱에서 직접 바꿀 수 없어요. 프로필 > 고객센터에서 1:1 문의를 남겨 주세요.',
        },
      ],
    },
    {
      title: '설정',
      items: [
        {
          q: '닉네임은 어떻게 바꾸나요?',
          a: '프로필 화면에서 "닉네임 바꾸기"를 눌러 주세요. 가입 후 24시간 동안은 몇 번이든 바꿀 수 있고, 그 뒤에는 7일에 한 번 바꿀 수 있어요. 아티스트에게는 닉네임만 보이고 로그인 계정의 이름은 보이지 않아요.',
        },
        {
          q: '프로필 사진과 상태메시지는 누가 보나요?',
          a: '다른 팬에게는 보이지 않아요. 아티스트와 소속사가 답장을 볼 때만 보여요. 프로필 화면 위쪽 내 이름 카드를 눌러 바꿀 수 있어요.',
        },
        {
          q: '앱 언어를 바꾸고 싶어요.',
          a: '처음엔 휴대폰 언어로 보여요. 프로필 > 언어에서 바꿀 수 있어요. 아티스트 메시지는 앱 언어로 자동 번역돼 원문 아래에 보이고, 같은 화면의 "메시지 자동 번역"에서 끌 수 있어요. 번역은 기계 번역이라 원문과 조금 다를 수 있어요.',
        },
        {
          q: '다크 모드로 볼 수 있나요?',
          a: '네. 프로필 > 화면 모드에서 기기 설정 따르기·라이트·다크 중에 고를 수 있어요.',
        },
      ],
    },
    {
      title: '알림',
      items: [
        {
          q: '새 메시지 알림이 오지 않아요.',
          a: '기기 설정 > 알림 > Toffee에서 알림이 허용돼 있는지, 토피룸 오른쪽 위 ⋯ 메뉴에서 그 아티스트 알림이 켜져 있는지 확인해 주세요. 휴대폰의 절전 모드·집중 모드가 켜져 있으면 알림이 늦거나 오지 않을 수 있어요. PC 웹에서는 알림이 오지 않아요.',
        },
        {
          q: '한 아티스트의 알림만 끌 수 있나요?',
          a: '네. 그 아티스트의 토피룸 오른쪽 위 ⋯ > 알림 끄기를 눌러 주세요. 메시지는 그대로 받고 알림만 오지 않아요. 토피룸 목록에 🔕 표시가 붙어요.',
        },
        {
          q: '공지사항은 어디서 보나요?',
          a: '프로필 > 공지사항에서 볼 수 있어요. 새 공지가 올라오면 프로필 탭에 N 표시가 붙어요. 서비스 점검처럼 중요한 공지는 알림으로도 보내요.',
        },
      ],
    },
    {
      title: '결제·해지·환불',
      items: [
        {
          q: '구독은 어떻게 해지하나요?',
          a: '결제한 스토어에서 해지할 수 있어요. iPhone: 설정 > Apple ID(내 이름) > 구독 > Toffee > 구독 취소. Android: Play 스토어 > 프로필 > 결제 및 정기 결제 > 정기 결제 > Toffee > 구독 취소. 토피 앱의 프로필 > 구독 관리에서 스토어 화면으로 바로 갈 수도 있어요. 이용 기간이 끝나기 24시간 전까지 해지해야 다음 결제가 되지 않아요. 앱을 지우거나 탈퇴해도 구독은 자동으로 해지되지 않아요.',
        },
        {
          q: '환불받을 수 있나요?',
          a: '결제(자동 갱신 결제 포함) 후 7일 안이면 전액 환불을 요청할 수 있어요. App Store 결제는 Apple 환불 요청 페이지(reportaproblem.apple.com)에서, Google Play 결제는 Google Play 또는 토피 고객센터로 요청해 주세요. 또 결제한 이용 기간 동안 아티스트 메시지가 하나도 없었거나, 아티스트 활동이 종료돼 결제 후 14일 안에 구독할 수 없게 되면 구독 관리에서 환불을 요청할 수 있어요. 단, 활동 종료 예정 안내를 받은 뒤 종료일 전에 결제된 구독료는 활동 종료 환불 대상이 아니에요(7일 안 환불은 그대로).',
        },
        {
          q: '해지했다가 다시 구독하면 예전 대화가 보이나요?',
          a: '아니요. 다시 구독하면 새로 구독한 때부터의 메시지만 볼 수 있어요. 간직하고 싶은 사진·음성·영상은 해지 전에 저장해 두세요.',
        },
        {
          q: '휴대폰을 바꿨거나 앱을 다시 설치했어요.',
          a: '전에 쓰던 것과 같은 방법(구글·애플·카카오·네이버·LINE)으로 로그인하면 구독이 그대로 있어요. 보이지 않으면 프로필 > 구독 관리 > 구매 복원을 눌러 주세요. 결제했던 스토어 계정으로 로그인돼 있어야 해요.',
        },
        {
          q: '"결제 수단을 확인해 주세요"라고 떠요.',
          a: '카드 만료·잔액 부족 등으로 스토어 자동 결제가 실패한 상태예요. 스토어가 정한 유예 기간 동안은 그대로 이용할 수 있어요. 구독 관리에서 스토어 화면으로 가서 결제 수단을 바꾸면 스토어가 다시 결제하고 표시가 사라져요. 유예 기간이 끝날 때까지 결제되지 않으면 구독이 끝나요.',
        },
        {
          q: '다음 결제일이 실제 결제일과 달라요.',
          a: '구독 관리에 보이는 다음 결제일은 참고용이에요. 실제 결제일과 금액은 스토어가 정하고, 시간대에 따라 하루쯤 다를 수 있어요. 정확한 내역은 App Store 또는 Google Play의 구독·구매 내역에서 확인해 주세요.',
        },
        {
          q: '구독료가 나라마다 다른가요?',
          a: '네. 결제는 스토어가 정한 그 나라 가격과 통화로 해요. 앱 목록에 "≈"로 보이는 금액은 참고용 환산 금액이고, 실제 금액은 결제 화면에 보이는 스토어 가격이에요.',
        },
        {
          q: '구매 복원을 눌러도 구독이 보이지 않아요.',
          a: '결제했던 스토어 계정(Apple ID 또는 Google 계정)으로 휴대폰이 로그인돼 있어야 해요. 다른 스토어 계정이면 구매 내역이 나오지 않아요. 또 결제할 때 쓰던 토피 계정(같은 로그인 방법)으로 로그인했는지 확인해 주세요. 그래도 안 되면 1:1 문의에 스토어 영수증을 첨부해 주세요.',
        },
      ],
    },
    {
      title: '구독',
      items: [
        {
          q: '묶음 구독은 무엇인가요?',
          a: '여러 아티스트를 함께 구독해서 따로 구독할 때보다 저렴한 상품이에요. 아티스트 프로필의 "묶음으로 더 저렴하게"에서 볼 수 있어요. 해지는 묶음 단위로만 할 수 있어요. 이미 개인 구독 중인 아티스트가 든 묶음을 사면, 중복 결제를 피하려면 개인 구독을 스토어에서 해지해 주세요(대화는 그대로 이어져요).',
        },
        {
          q: 'CP 토피룸은 무엇인가요?',
          a: '두 아티스트가 함께 메시지를 보내는 토피룸이에요. 각 아티스트의 개인 토피룸과는 따로 구독하거나, CP와 함께 묶은 묶음으로 구독할 수 있어요. 말풍선에 누가 보냈는지 표시돼요.',
        },
        {
          q: '같은 CP의 다른 묶음으로 바꿀 수 있나요?',
          a: '네. 같은 CP의 묶음을 구독 중이면 다른 묶음 화면에 [이 묶음으로 바꾸기]가 보여요. 결제는 하나로 이어지고, 언제 바뀌는지는 바꾸기 전에 화면에 안내돼요. 겹치는 토피룸의 대화는 그대로예요.',
        },
        {
          q: '아티스트 활동이 끝나면 어떻게 되나요?',
          a: '새로 구독할 수 없게 되고, 구독 중인 팬에게는 알림을 보내요. 활동 종료 예정일이 정해지면 프로필에 미리 표시돼요. 결제 후 14일 안에 활동이 끝났다면 구독 관리에서 환불을 요청할 수 있어요("환불받을 수 있나요?" 참고).',
        },
        {
          q: '구독한 지 며칠 됐는지 볼 수 있나요?',
          a: '프로필 > 구독 관리에서 아티스트를 누르면 구독 시작일과 "N일째"가 보여요. 해지했다가 다시 구독하면 처음부터 다시 세요.',
        },
      ],
    },
    {
      title: '토피룸',
      items: [
        {
          q: '아티스트 메시지는 얼마나 자주 오나요?',
          a: '아티스트가 직접 보내기 때문에 아티스트 사정에 따라 비정기적으로 와요. 토피는 메시지 횟수를 보장하지 않지만, 결제한 기간 동안 메시지가 하나도 없었다면 환불을 요청할 수 있어요.',
        },
        {
          q: '예전 메시지를 찾고 싶어요.',
          a: '토피룸 오른쪽 위 🔍를 누르면 토피룸 안에서 글을 검색할 수 있어요. 받은 사진·영상은 ⋯ > 사진·영상 모아보기에서 한눈에 볼 수 있어요. 이번 구독을 시작한 뒤의 메시지만 찾을 수 있어요.',
        },
        {
          q: '"회수된 메시지입니다"는 무엇인가요?',
          a: '메시지를 보낸 사람이 회수한 메시지예요. 아티스트가 회수했거나, 내가 회수한 내 답장이에요.',
        },
        {
          q: '"가려진 메시지예요"는 무엇인가요?',
          a: '아티스트가 인용한 팬 답장이 신고 처리 등 운영 정책에 따라 가려졌다는 뜻이에요.',
        },
        {
          q: '구독하자마자 온 메시지는 무엇인가요?',
          a: '아티스트가 새로 구독한 팬을 위해 미리 써 둔 환영 메시지예요. 실제로 보낸 메시지 수에는 세지 않아요.',
        },
        {
          q: '생일 축하 메시지는 어떻게 받나요?',
          a: '프로필 화면에서 "생일 축하 메시지 받기"를 켜 주세요. 가입할 때 입력한 생년월일의 날짜에, 생일 메시지를 준비한 아티스트에게서 축하 메시지가 와요. 아티스트에게 내 생일 날짜가 보이지는 않아요.',
        },
      ],
    },
    {
      title: '답장',
      items: [
        {
          q: '답장은 몇 개까지 보낼 수 있나요?',
          a: '아티스트 메시지 하나에 3개까지 글과 이모지로 답장할 수 있어요. 입력창 위에 남은 개수가 보여요. 아티스트가 내 답장을 인용해서 답하면 다른 구독자에게도 내 답장 내용이 보여요(닉네임은 안 보여요).',
        },
        {
          q: '보낸 답장을 지울 수 있나요?',
          a: '내 답장을 길게 눌러 "회수"하면 "회수된 메시지입니다"로 바뀌어요. 시간 제한은 없지만, 회수해도 쓴 답장 개수는 돌아오지 않아요.',
        },
        {
          q: '내 답장은 누가 보나요?',
          a: '아티스트와 소속사만 봐요. 다른 팬에게는 보이지 않아요. 아티스트가 내 답장을 인용해서 답하면 그 답장 내용이 다른 구독자에게도 보이지만 닉네임은 보이지 않고, 나에게는 "내 메시지에 답장했어요" 알림이 와요.',
        },
        {
          q: '답장이 보내지지 않아요.',
          a: '남은 답장 개수를 다 썼는지 입력창 위를 확인해 주세요. 욕설이나 외부 연락을 유도하는 문구 등 금지된 표현이 들어간 답장은 보내지지 않아요. 이용이 제한됐거나 그 토피룸에서 답장이 막힌 경우에도 보낼 수 없어요.',
        },
      ],
    },
    {
      title: '사진·영상',
      items: [
        {
          q: '받은 사진·영상을 저장해도 되나요?',
          a: '개인 소장용으로는 저장할 수 있어요. 화면 캡처를 포함해 SNS나 다른 사이트에 올리거나 공유하면 이용이 제한되고 법적 책임을 질 수 있어요.',
        },
        {
          q: '화면을 캡처하면 경고가 떠요.',
          a: '아티스트 메시지·사진·영상과 프로필은 구독자를 위한 콘텐츠라 캡처하면 안내가 떠요. 캡처를 막지는 않지만, 캡처한 내용을 외부에 올리거나 공유하면 이용이 제한될 수 있어요.',
        },
        {
          q: '사진·영상·음성이 열리지 않아요.',
          a: '인터넷 연결을 확인하고 앱을 최신 버전으로 업데이트해 주세요. 계속 열리지 않으면 1:1 문의에 화면 캡처를 첨부해 알려 주세요.',
        },
      ],
    },
    {
      title: '신고·이용 제한·문의',
      items: [
        {
          q: '불쾌하거나 이상한 메시지를 받았어요.',
          a: '말풍선을 길게 눌러 "신고"를 눌러 주세요. 운영자가 확인해서 처리해요. 아티스트 계정이 해킹된 것처럼 보일 때도 신고해 주세요.',
        },
        {
          q: '이용이 제한됐어요.',
          a: '운영정책을 어기면 기간을 정해 이용을 멈추거나 영구히 제한할 수 있어요. 제한 사유와 기간은 앱에 안내돼요. 기준은 프로필 > 운영정책에서 볼 수 있고, 잘못 제한됐다고 생각되면 1:1 문의로 알려 주세요.',
        },
        {
          q: '문의는 어디로 하나요?',
          a: '프로필 > 고객센터 > 1:1 문의에서 남겨 주세요. 회원번호와 앱 버전이 자동으로 들어가고 사진도 첨부할 수 있어요. 답변이 오면 알림으로 알려 드려요.',
        },
      ],
    },
  ],
  en: [
    {
      title: 'Account',
      items: [
        {
          q: 'How do I sign up and log in?',
          a: 'Sign up and log in with your Google, Apple, Kakao, Naver or LINE account (the buttons you see depend on your country and device). Toffee doesn’t ask you to create a separate password. Only adults can sign up (based on the age of majority in each country).',
        },
        {
          q: 'I forgot my password.',
          a: 'Toffee has no password of its own. You log in with an account like Google or Apple. If you forgot the password for that account, recover it with that company (Google, Apple, Kakao, Naver or LINE).',
        },
        {
          q: 'Can I change my login account (email)?',
          a: 'No. You can’t change the login method or email you signed up with. Logging in another way creates a new account, and your subscriptions don’t move over. You can see how you signed up in Profile > Login info. The login screen also shows "Last used" on the button you used last.',
        },
        {
          q: 'Can I use Toffee on more than one device?',
          a: 'Yes. Log in the same way and you can use it on your phone, tablet and the web on a PC. Notifications go to every app you’re logged in to. If you lose a device, tap Profile > Log out of all devices.',
        },
        {
          q: 'How do I log out?',
          a: 'Tap "Log Out" at the bottom of Profile. Your subscriptions stay as they are. Log in the same way again to pick up where you left off.',
        },
        {
          q: 'I want to delete my account.',
          a: 'You can do it from "Delete account" at the bottom of Profile. Deleting your account doesn’t cancel store subscriptions, so cancel them in the store first. After you delete your account, your chats and subscription history can’t be restored.',
        },
        {
          q: 'I entered the wrong date of birth.',
          a: 'Your date of birth is used to confirm you’re an adult, so you can’t change it in the app. Please send us an inquiry from Profile > Help Center.',
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          q: 'How do I change my nickname?',
          a: 'Tap "Change nickname" in Profile. For 24 hours after sign-up you can change it as often as you like. After that, you can change it once every 7 days. Artists only see your nickname, not the name on your login account.',
        },
        {
          q: 'Who can see my profile photo and status message?',
          a: 'Other fans can’t see them. Only the artist and agency see them when they read your replies. Tap your profile in Profile to change them.',
        },
        {
          q: 'I want to change the app language.',
          a: 'At first the app uses your phone’s language. You can change it in Profile > Language. Artist messages are automatically translated into the app language and shown under the original. You can turn this off with "Translate messages automatically" on the same screen. Translations are machine-made, so they may differ a little from the original.',
        },
        {
          q: 'Is there a dark mode?',
          a: 'Yes. In Profile > Appearance, choose Use device setting, Light or Dark.',
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          q: 'I’m not getting new message notifications.',
          a: 'Check that notifications are allowed in your device Settings > Notifications > Toffee, and that notifications for that artist are on in the ⋯ menu at the top right of the Toffee Room. If your phone’s battery saver or focus mode is on, notifications may be late or not arrive. Notifications aren’t sent to the web on a PC.',
        },
        {
          q: 'Can I turn off notifications for just one artist?',
          a: 'Yes. In that artist’s Toffee Room, tap ⋯ at the top right > Mute notifications. You’ll still receive messages, just without notifications. A 🔕 mark appears next to it in your Toffee Room list.',
        },
        {
          q: 'Where can I see notices?',
          a: 'Go to Profile > Notices. When a new notice is posted, an N mark appears on the Profile tab. Important notices, like service maintenance, are also sent as notifications.',
        },
      ],
    },
    {
      title: 'Payment, cancellation and refunds',
      items: [
        {
          q: 'How do I cancel my subscription?',
          a: 'Cancel in the store you paid with. iPhone: Settings > Apple ID (your name) > Subscriptions > Toffee > Cancel Subscription. Android: Play Store > Profile > Payments & subscriptions > Subscriptions > Toffee > Cancel subscription. You can also go there from Profile > Manage subscriptions in Toffee. Cancel at least 24 hours before the period ends to avoid the next charge. Deleting the app or your account does not cancel the subscription.',
        },
        {
          q: 'Can I get a refund?',
          a: 'You can request a full refund within 7 days of a payment (including auto-renewals). For App Store payments, use Apple’s refund page (reportaproblem.apple.com); for Google Play payments, use Google Play or Toffee support. You can also request a refund in Manage subscriptions if the artist sent no messages during the paid period, or if the artist ended their activity within 14 days after you paid. However, payments made after an activity-end notice and before the end date aren’t eligible for the activity-end refund (the 7-day refund still applies).',
        },
        {
          q: 'If I subscribe again, can I see my old conversation?',
          a: 'No. After subscribing again you only see messages from your new subscription start. Save any photos, voice or videos you want to keep before canceling.',
        },
        {
          q: 'I changed phones or reinstalled the app.',
          a: 'Log in the same way as before (Google, Apple, Kakao, Naver or LINE) and your subscriptions will be there. If not, tap Profile > Manage subscriptions > Restore purchases while signed in to the store account you paid with.',
        },
        {
          q: 'It says "Please check your payment method."',
          a: 'Your store’s automatic payment failed, for example because your card expired or there wasn’t enough balance. You can keep using Toffee during the grace period set by the store. Go from Manage subscriptions to the store screen and change your payment method. The store will charge again and the message will go away. If the payment still doesn’t go through by the end of the grace period, your subscription ends.',
        },
        {
          q: 'The next billing date is different from the actual charge date.',
          a: 'The next billing date in Manage subscriptions is for reference only. The store sets the actual date and amount, and it can differ by about a day depending on time zones. For exact details, check your subscriptions and purchase history in the App Store or Google Play.',
        },
        {
          q: 'Is the price different in each country?',
          a: 'Yes. You pay the store’s price for your country, in your local currency. Amounts shown with "≈" in the app are converted for reference only. The actual amount is the store price shown on the payment screen.',
        },
        {
          q: 'I tapped Restore purchases, but my subscription doesn’t appear.',
          a: 'Your phone needs to be signed in to the store account you paid with (Apple ID or Google account). With a different store account, your purchases won’t show up. Also check that you’re logged in to the same Toffee account you used to pay (same login method). If it still doesn’t work, send us an inquiry with your store receipt attached.',
        },
      ],
    },
    {
      title: 'Subscriptions',
      items: [
        {
          q: 'What is a bundle subscription?',
          a: 'It lets you subscribe to several artists together for less than subscribing to each one separately. You can find it under "Save with a bundle" on an artist’s profile. A bundle can only be canceled as a whole. If you buy a bundle that includes an artist you already subscribe to on their own, cancel that individual subscription in the store to avoid paying twice (your chat continues as it is).',
        },
        {
          q: 'What is a CP Toffee Room?',
          a: 'It’s a Toffee Room where two artists send messages together. You can subscribe to it separately from each artist’s own Toffee Room, or as a bundle that includes the CP. Each message bubble shows who sent it.',
        },
        {
          q: 'Can I switch to another bundle from the same CP?',
          a: 'Yes. If you subscribe to a bundle from the same CP, other bundles show [Switch to this bundle]. Your payment continues as one, and the screen tells you when the switch happens before you confirm. Chats in Toffee Rooms that are in both bundles stay as they are.',
        },
        {
          q: 'What happens when an artist ends their activity?',
          a: 'New subscriptions are no longer possible, and current subscribers get a notification. When an end date is set, it’s shown on the profile in advance. If the activity ended within 14 days after you paid, you can request a refund in Manage subscriptions (see "Can I get a refund?").',
        },
        {
          q: 'Can I see how long I’ve been subscribed?',
          a: 'In Profile > Manage subscriptions, tap an artist to see your start date and "day N". If you cancel and subscribe again, the count starts over.',
        },
      ],
    },
    {
      title: 'Toffee Room',
      items: [
        {
          q: 'How often do artists send messages?',
          a: 'Artists write their own messages, so they arrive irregularly depending on their schedule. Toffee does not guarantee a number of messages, but if there were none during a paid period you can request a refund.',
        },
        {
          q: 'I want to find an old message.',
          a: 'Tap 🔍 at the top right of the Toffee Room to search messages in that Toffee Room. To see all the photos and videos you received at a glance, go to ⋯ > Photos & videos. You can only find messages from after your current subscription started.',
        },
        {
          q: 'What does "This message was unsent" mean?',
          a: 'The person who sent it unsent the message. Either the artist unsent it, or it’s one of your own replies that you unsent.',
        },
        {
          q: 'What does "This message is hidden" mean?',
          a: 'A fan reply the artist quoted was hidden under our Community policy, for example after a report was reviewed.',
        },
        {
          q: 'What was the message I got right after subscribing?',
          a: 'It’s a welcome message the artist wrote in advance for new subscribers. It doesn’t count toward the number of messages the artist actually sent.',
        },
        {
          q: 'How do I get a birthday message?',
          a: 'Turn on "Birthday messages" in Profile. On the date of the birth date you entered at sign-up, artists who prepared a birthday message will send you one. Artists cannot see your birth date.',
        },
      ],
    },
    {
      title: 'Replies',
      items: [
        {
          q: 'How many replies can I send?',
          a: 'Up to 3 text or emoji replies per artist message. The remaining count is shown above the input box. If the artist quotes your reply, other subscribers can see what you wrote (but not your nickname).',
        },
        {
          q: 'Can I delete a reply I sent?',
          a: 'Long-press your reply and tap "Unsend". It changes to "This message was unsent". There’s no time limit, but unsending doesn’t give you back the reply you used.',
        },
        {
          q: 'Who can see my replies?',
          a: 'Only the artist and agency. Other fans can’t see them. If the artist quotes your reply in their answer, other subscribers can see what you wrote, but not your nickname. You’ll get a "Replied to your message" notification.',
        },
        {
          q: 'My reply won’t send.',
          a: 'Check above the input box whether you’ve used all your remaining replies. Replies with banned content, such as swearing or asking to contact someone outside the app, can’t be sent. You also can’t send replies if your account is restricted or replies are blocked in that Toffee Room.',
        },
      ],
    },
    {
      title: 'Photos and videos',
      items: [
        {
          q: 'Can I save photos and videos I received?',
          a: 'Yes, for personal use. Posting or sharing them on social media or other sites, including screenshots, may lead to restrictions and legal liability.',
        },
        {
          q: 'A warning appears when I take a screenshot.',
          a: 'Artist messages, photos, videos and profiles are content for subscribers, so a notice appears when you take a screenshot. Screenshots aren’t blocked, but posting or sharing them outside the app may lead to restrictions.',
        },
        {
          q: 'Photos, videos or voice messages won’t open.',
          a: 'Check your internet connection and update the app to the latest version. If they still won’t open, send us an inquiry with a screenshot attached.',
        },
      ],
    },
    {
      title: 'Reports, restrictions and support',
      items: [
        {
          q: 'I got an upsetting or strange message.',
          a: 'Long-press the message bubble and tap "Report". Our team will review and handle it. Please also report it if an artist’s account looks hacked.',
        },
        {
          q: 'My account has been restricted.',
          a: 'If you break our Community policy, we may suspend your account for a set period or restrict it permanently. The app shows the reason and how long it lasts. You can read the rules in Profile > Community policy. If you think the restriction is a mistake, let us know with an inquiry.',
        },
        {
          q: 'How do I contact support?',
          a: 'Send an inquiry from Profile > Help Center. Your member ID and app version are added automatically, and you can attach photos. We’ll send you a notification when we reply.',
        },
      ],
    },
  ],
  th: [
    {
      title: 'บัญชี',
      items: [
        {
          q: 'สมัครและเข้าสู่ระบบด้วยวิธีไหนได้บ้าง',
          a: 'สมัครและเข้าสู่ระบบด้วยบัญชี Google, Apple, Kakao, Naver หรือ LINE (ปุ่มที่เห็นอาจต่างกันไปตามประเทศและอุปกรณ์) Toffee ไม่มีการตั้งรหัสผ่านแยก และสมัครได้เฉพาะผู้ที่บรรลุนิติภาวะแล้วเท่านั้น (ตามเกณฑ์อายุของแต่ละประเทศ)',
        },
        {
          q: 'ลืมรหัสผ่าน',
          a: 'Toffee เข้าสู่ระบบด้วยบัญชีอย่าง Google หรือ Apple โดยไม่ใช้รหัสผ่าน จึงไม่มีรหัสผ่านของ Toffee หากลืมรหัสผ่านของบัญชีนั้น โปรดกู้คืนรหัสผ่านกับผู้ให้บริการนั้นๆ (Google, Apple, Kakao, Naver หรือ LINE)',
        },
        {
          q: 'เปลี่ยนบัญชีที่ใช้เข้าสู่ระบบ (อีเมล) ได้ไหม',
          a: 'ไม่ได้ วิธีเข้าสู่ระบบและอีเมลที่ใช้ตอนสมัครเปลี่ยนไม่ได้ หากเข้าสู่ระบบด้วยวิธีอื่นจะเป็นการสร้างบัญชีใหม่ และการสมัครสมาชิกจะไม่ย้ายตามไป ดูได้ว่าสมัครด้วยวิธีไหนที่ โปรไฟล์ > ข้อมูลการเข้าสู่ระบบ และในหน้าเข้าสู่ระบบ ปุ่มที่ใช้ครั้งล่าสุดจะมีป้าย "ใช้ล่าสุด"',
        },
        {
          q: 'ใช้หลายอุปกรณ์ได้ไหม',
          a: 'ได้ หากเข้าสู่ระบบด้วยวิธีเดิม จะใช้ได้ทั้งบนโทรศัพท์ แท็บเล็ต และเว็บบน PC และการแจ้งเตือนจะส่งไปยังแอปทุกเครื่องที่เข้าสู่ระบบอยู่ หากทำอุปกรณ์หาย ให้กด โปรไฟล์ > ออกจากระบบทุกอุปกรณ์',
        },
        {
          q: 'ออกจากระบบอย่างไร',
          a: 'กด "ออกจากระบบ" ที่ด้านล่างสุดของหน้าโปรไฟล์ การสมัครสมาชิกจะยังอยู่เหมือนเดิม เมื่อเข้าสู่ระบบด้วยวิธีเดิมอีกครั้งก็ใช้งานต่อได้เลย',
        },
        {
          q: 'อยากลบบัญชี',
          a: 'ลบได้ที่ "ลบบัญชี" ด้านล่างสุดของหน้าโปรไฟล์ การลบบัญชีไม่ได้ยกเลิกการสมัครสมาชิกในสโตร์ให้อัตโนมัติ จึงควรยกเลิกในสโตร์ก่อน เมื่อลบบัญชีแล้วจะกู้คืนแชทและประวัติการสมัครสมาชิกไม่ได้',
        },
        {
          q: 'กรอกวันเกิดผิด',
          a: 'วันเกิดใช้ยืนยันว่าเป็นผู้บรรลุนิติภาวะ จึงเปลี่ยนเองในแอปไม่ได้ โปรดส่งคำถามมาที่ โปรไฟล์ > ศูนย์ช่วยเหลือ',
        },
      ],
    },
    {
      title: 'การตั้งค่า',
      items: [
        {
          q: 'เปลี่ยนชื่อเล่นอย่างไร',
          a: 'กด "เปลี่ยนชื่อเล่น" ในหน้าโปรไฟล์ ภายใน 24 ชั่วโมงหลังสมัครเปลี่ยนได้ไม่จำกัด หลังจากนั้นเปลี่ยนได้ 7 วันครั้ง ศิลปินจะเห็นแค่ชื่อเล่น ไม่เห็นชื่อในบัญชีที่ใช้เข้าสู่ระบบ',
        },
        {
          q: 'ใครเห็นรูปโปรไฟล์และข้อความสถานะของฉัน',
          a: 'แฟนคนอื่นไม่เห็น จะเห็นเฉพาะศิลปินและต้นสังกัดตอนดูข้อความตอบกลับ เปลี่ยนได้โดยแตะโปรไฟล์ของคุณในหน้าโปรไฟล์',
        },
        {
          q: 'อยากเปลี่ยนภาษาของแอป',
          a: 'ตอนแรกแอปจะแสดงตามภาษาของโทรศัพท์ เปลี่ยนได้ที่ โปรไฟล์ > ภาษา ข้อความของศิลปินจะแปลเป็นภาษาของแอปให้อัตโนมัติและแสดงใต้ข้อความต้นฉบับ ปิดได้ที่ "แปลข้อความอัตโนมัติ" ในหน้าเดียวกัน คำแปลเป็นการแปลด้วยเครื่อง จึงอาจต่างจากต้นฉบับเล็กน้อย',
        },
        {
          q: 'ใช้โหมดมืดได้ไหม',
          a: 'ได้ เลือกได้ที่ โปรไฟล์ > โหมดหน้าจอ ระหว่าง ตามการตั้งค่าอุปกรณ์ สว่าง หรือ มืด',
        },
      ],
    },
    {
      title: 'การแจ้งเตือน',
      items: [
        {
          q: 'ไม่ได้รับการแจ้งเตือนข้อความใหม่',
          a: 'ตรวจสอบว่าอนุญาตการแจ้งเตือนใน การตั้งค่าเครื่อง > การแจ้งเตือน > Toffee และเปิดการแจ้งเตือนของศิลปินคนนั้นในเมนู ⋯ มุมขวาบนของ Toffee Room แล้ว หากเปิดโหมดประหยัดพลังงานหรือโหมดโฟกัสในโทรศัพท์ การแจ้งเตือนอาจมาช้าหรือไม่มา ส่วนเว็บบน PC จะไม่มีการแจ้งเตือน',
        },
        {
          q: 'ปิดการแจ้งเตือนเฉพาะศิลปินคนเดียวได้ไหม',
          a: 'ได้ กด ⋯ > ปิดการแจ้งเตือน ที่มุมขวาบนของ Toffee Room ของศิลปินคนนั้น ยังได้รับข้อความตามปกติ แค่ไม่มีการแจ้งเตือน และจะมีไอคอน 🔕 ในรายการ Toffee Room',
        },
        {
          q: 'ดูประกาศได้ที่ไหน',
          a: 'ดูได้ที่ โปรไฟล์ > ประกาศ เมื่อมีประกาศใหม่ แท็บโปรไฟล์จะมีเครื่องหมาย N ประกาศสำคัญ เช่น การปิดปรับปรุงระบบ จะส่งเป็นการแจ้งเตือนด้วย',
        },
      ],
    },
    {
      title: 'การชำระเงิน การยกเลิก และการคืนเงิน',
      items: [
        {
          q: 'ยกเลิกการสมัครสมาชิกได้อย่างไร',
          a: 'ยกเลิกได้ที่สโตร์ที่ชำระเงิน iPhone: การตั้งค่า > Apple ID (ชื่อของคุณ) > การสมัครรับ > Toffee > ยกเลิกการสมัครรับ Android: Play Store > โปรไฟล์ > การชำระเงินและการสมัครใช้บริการ > การสมัครใช้บริการ > Toffee > ยกเลิก หรือไปจากโปรไฟล์ > จัดการการสมัครสมาชิกในแอป Toffee ได้เลย ต้องยกเลิกอย่างน้อย 24 ชั่วโมงก่อนหมดรอบ จึงจะไม่ถูกเรียกเก็บรอบถัดไป การลบแอปหรือลบบัญชีไม่ได้ยกเลิกการสมัครสมาชิกให้อัตโนมัติ',
        },
        {
          q: 'ขอคืนเงินได้ไหม',
          a: 'ขอคืนเงินเต็มจำนวนได้ภายใน 7 วันหลังชำระเงิน (รวมการต่ออายุอัตโนมัติ) การชำระผ่าน App Store ให้ขอที่หน้าคืนเงินของ Apple (reportaproblem.apple.com) ส่วน Google Play ให้ขอผ่าน Google Play หรือฝ่ายบริการลูกค้าของ Toffee นอกจากนี้ หากศิลปินไม่ได้ส่งข้อความเลยตลอดรอบที่ชำระ หรือศิลปินยุติกิจกรรมภายใน 14 วันหลังชำระเงิน สามารถขอคืนเงินได้ที่จัดการการสมัครสมาชิก ทั้งนี้ การชำระเงินหลังได้รับประกาศยุติกิจกรรมและก่อนวันยุติจะไม่ได้รับเงินคืนกรณียุติกิจกรรม (ยังขอคืนเงินภายใน 7 วันได้ตามปกติ)',
        },
        {
          q: 'ถ้าสมัครใหม่ จะเห็นแชทเก่าไหม',
          a: 'ไม่เห็น เมื่อสมัครใหม่จะเห็นเฉพาะข้อความตั้งแต่วันที่สมัครใหม่ รูป เสียง และวิดีโอที่อยากเก็บไว้ ควรบันทึกก่อนยกเลิก',
        },
        {
          q: 'เปลี่ยนโทรศัพท์หรือติดตั้งแอปใหม่',
          a: 'เข้าสู่ระบบด้วยวิธีเดิม (Google, Apple, Kakao, Naver หรือ LINE) การสมัครสมาชิกจะยังอยู่ หากไม่เห็น ให้กดโปรไฟล์ > จัดการการสมัครสมาชิก > กู้คืนการซื้อ โดยต้องเข้าสู่ระบบบัญชีสโตร์ที่ใช้ชำระเงิน',
        },
        {
          q: 'ขึ้นข้อความ "โปรดตรวจสอบวิธีการชำระเงิน"',
          a: 'การชำระเงินอัตโนมัติของสโตร์ไม่สำเร็จ เช่น บัตรหมดอายุหรือยอดเงินไม่พอ คุณยังใช้งานได้ตามปกติในช่วงผ่อนผันที่สโตร์กำหนด ไปที่หน้าสโตร์จาก จัดการการสมัครสมาชิก แล้วเปลี่ยนวิธีการชำระเงิน สโตร์จะเรียกเก็บเงินอีกครั้งและข้อความนี้จะหายไป หากยังชำระเงินไม่สำเร็จจนหมดช่วงผ่อนผัน การสมัครสมาชิกจะสิ้นสุด',
        },
        {
          q: 'วันเรียกเก็บเงินครั้งถัดไปไม่ตรงกับวันที่ถูกเรียกเก็บจริง',
          a: 'วันเรียกเก็บเงินครั้งถัดไปใน จัดการการสมัครสมาชิก เป็นเพียงข้อมูลอ้างอิง วันและจำนวนเงินจริงสโตร์เป็นผู้กำหนด และอาจต่างกันได้ประมาณ 1 วันตามเขตเวลา ดูรายละเอียดที่ถูกต้องได้ในประวัติการสมัครหรือประวัติการซื้อของ App Store หรือ Google Play',
        },
        {
          q: 'ค่าสมาชิกแต่ละประเทศไม่เท่ากันใช่ไหม',
          a: 'ใช่ การชำระเงินจะใช้ราคาและสกุลเงินของประเทศนั้นตามที่สโตร์กำหนด ราคาที่มีเครื่องหมาย "≈" ในรายการในแอปเป็นราคาแปลงค่าโดยประมาณเพื่อใช้อ้างอิง ราคาจริงคือราคาของสโตร์ที่แสดงในหน้าชำระเงิน',
        },
        {
          q: 'กดกู้คืนการซื้อแล้วแต่ไม่เห็นการสมัครสมาชิก',
          a: 'โทรศัพท์ต้องเข้าสู่ระบบบัญชีสโตร์ที่ใช้ชำระเงิน (Apple ID หรือบัญชี Google) หากเป็นบัญชีสโตร์อื่นจะไม่พบประวัติการซื้อ และโปรดตรวจสอบว่าเข้าสู่ระบบ Toffee ด้วยบัญชีเดียวกับตอนชำระเงิน (วิธีเข้าสู่ระบบเดียวกัน) หากยังไม่ได้ โปรดส่งคำถามมาที่ศูนย์ช่วยเหลือพร้อมแนบใบเสร็จจากสโตร์',
        },
      ],
    },
    {
      title: 'การสมัครสมาชิก',
      items: [
        {
          q: 'การสมัครแบบแพ็กเกจคืออะไร',
          a: 'เป็นการสมัครศิลปินหลายคนพร้อมกันในราคาที่ถูกกว่าสมัครแยก ดูได้ที่ "สมัครแบบแพ็กเกจ คุ้มกว่า" ในหน้าโปรไฟล์ของศิลปิน การยกเลิกทำได้ทั้งแพ็กเกจเท่านั้น หากซื้อแพ็กเกจที่มีศิลปินที่คุณสมัครแบบเดี่ยวอยู่แล้ว โปรดยกเลิกการสมัครเดี่ยวในสโตร์เพื่อไม่ให้ถูกเรียกเก็บเงินซ้ำ (แชทจะยังต่อเนื่องเหมือนเดิม)',
        },
        {
          q: 'ห้อง CP คืออะไร',
          a: 'เป็น Toffee Room ที่ศิลปินสองคนส่งข้อความหาคุณด้วยกัน สมัครแยกจาก Toffee Room เดี่ยวของศิลปินแต่ละคน หรือสมัครแบบแพ็กเกจที่รวมห้อง CP ไว้ด้วยก็ได้ ในบับเบิลข้อความจะแสดงว่าใครเป็นคนส่ง',
        },
        {
          q: 'เปลี่ยนเป็นแพ็กเกจอื่นของ CP เดียวกันได้ไหม',
          a: 'ได้ หากสมัครแพ็กเกจของ CP นั้นอยู่ หน้าของแพ็กเกจอื่นจะมีปุ่ม [เปลี่ยนเป็นแพ็กเกจนี้] การชำระเงินจะต่อเนื่องเป็นรายการเดียว และหน้าจอจะแจ้งก่อนเปลี่ยนว่าจะเปลี่ยนเมื่อไร แชทใน Toffee Room ที่ซ้ำกันจะยังอยู่เหมือนเดิม',
        },
        {
          q: 'ถ้าศิลปินยุติกิจกรรมจะเป็นอย่างไร',
          a: 'จะสมัครใหม่ไม่ได้ และแฟนที่สมัครอยู่จะได้รับการแจ้งเตือน หากกำหนดวันยุติกิจกรรมแล้ว จะแสดงในโปรไฟล์ของศิลปินล่วงหน้า หากศิลปินยุติกิจกรรมภายใน 14 วันหลังชำระเงิน สามารถขอคืนเงินได้ที่จัดการการสมัครสมาชิก (ดู "ขอคืนเงินได้ไหม")',
        },
        {
          q: 'ดูได้ไหมว่าสมัครมากี่วันแล้ว',
          a: 'ไปที่ โปรไฟล์ > จัดการการสมัครสมาชิก แล้วแตะศิลปิน จะเห็นวันเริ่มสมัครและ "วันที่ N" หากยกเลิกแล้วสมัครใหม่ จะเริ่มนับใหม่ตั้งแต่ต้น',
        },
      ],
    },
    {
      title: 'Toffee Room',
      items: [
        {
          q: 'ศิลปินส่งข้อความบ่อยแค่ไหน',
          a: 'ศิลปินเขียนข้อความเอง จึงส่งไม่สม่ำเสมอตามความสะดวกของศิลปิน Toffee ไม่รับประกันจำนวนข้อความ แต่หากไม่มีข้อความเลยตลอดรอบที่ชำระ สามารถขอคืนเงินได้',
        },
        {
          q: 'อยากหาข้อความเก่า',
          a: 'กด 🔍 ที่มุมขวาบนของ Toffee Room เพื่อค้นหาข้อความใน Toffee Room นั้น ส่วนรูปและวิดีโอที่ได้รับ ดูรวมได้ที่ ⋯ > ดูรูปภาพและวิดีโอทั้งหมด ค้นหาได้เฉพาะข้อความตั้งแต่เริ่มการสมัครครั้งนี้',
        },
        {
          q: '"ข้อความนี้ถูกยกเลิกการส่งแล้ว" คืออะไร',
          a: 'เป็นข้อความที่ผู้ส่งยกเลิกการส่ง อาจเป็นข้อความที่ศิลปินยกเลิกการส่ง หรือข้อความตอบกลับที่คุณยกเลิกการส่งเอง',
        },
        {
          q: '"ข้อความนี้ถูกซ่อน" คืออะไร',
          a: 'หมายความว่าข้อความตอบกลับของแฟนที่ศิลปินยกมาอ้างถูกซ่อนตามนโยบายการใช้งาน เช่น หลังจากตรวจสอบการรายงานแล้ว',
        },
        {
          q: 'ข้อความที่ได้รับทันทีหลังสมัครคืออะไร',
          a: 'เป็นข้อความต้อนรับที่ศิลปินเขียนเตรียมไว้สำหรับแฟนที่เพิ่งสมัคร ไม่นับรวมในจำนวนข้อความที่ศิลปินส่งจริง',
        },
        {
          q: 'รับข้อความอวยพรวันเกิดได้อย่างไร',
          a: 'เปิด "รับข้อความอวยพรวันเกิด" ในโปรไฟล์ ในวันเกิดตามวันเกิดที่กรอกตอนสมัคร ศิลปินที่เตรียมข้อความวันเกิดไว้จะส่งข้อความอวยพรถึงคุณ ศิลปินไม่เห็นวันเกิดของคุณ',
        },
      ],
    },
    {
      title: 'การตอบกลับ',
      items: [
        {
          q: 'ตอบกลับได้กี่ข้อความ',
          a: 'ตอบกลับเป็นข้อความหรืออีโมจิได้สูงสุด 3 ข้อความต่อข้อความของศิลปิน จำนวนที่เหลือแสดงอยู่เหนือช่องพิมพ์ หากศิลปินอ้างอิงข้อความของคุณ สมาชิกคนอื่นจะเห็นข้อความนั้น (แต่ไม่เห็นชื่อเล่นของคุณ)',
        },
        {
          q: 'ลบข้อความตอบกลับที่ส่งไปแล้วได้ไหม',
          a: 'กดค้างที่ข้อความตอบกลับของคุณแล้วเลือก "ยกเลิกการส่ง" ข้อความจะเปลี่ยนเป็น "ข้อความนี้ถูกยกเลิกการส่งแล้ว" ไม่มีจำกัดเวลา แต่จำนวนครั้งที่ตอบกลับไปแล้วจะไม่คืนมา',
        },
        {
          q: 'ใครเห็นข้อความตอบกลับของฉัน',
          a: 'เฉพาะศิลปินและต้นสังกัดเท่านั้น แฟนคนอื่นไม่เห็น หากศิลปินอ้างอิงข้อความของคุณแล้วตอบกลับ สมาชิกคนอื่นจะเห็นเนื้อหาข้อความนั้นแต่ไม่เห็นชื่อเล่นของคุณ และคุณจะได้รับการแจ้งเตือน "ตอบกลับข้อความของคุณแล้ว"',
        },
        {
          q: 'ส่งข้อความตอบกลับไม่ได้',
          a: 'ตรวจสอบจำนวนครั้งที่เหลือเหนือช่องพิมพ์ว่าใช้หมดแล้วหรือยัง ข้อความตอบกลับที่มีคำต้องห้าม เช่น คำหยาบหรือการชวนติดต่อกันนอกแอป จะส่งไม่ได้ และหากถูกจำกัดการใช้งานหรือถูกปิดการตอบกลับใน Toffee Room นั้นก็จะส่งไม่ได้เช่นกัน',
        },
      ],
    },
    {
      title: 'รูปภาพและวิดีโอ',
      items: [
        {
          q: 'บันทึกรูปและวิดีโอที่ได้รับได้ไหม',
          a: 'บันทึกเพื่อเก็บไว้ดูส่วนตัวได้ การโพสต์หรือแชร์บนโซเชียลหรือเว็บไซต์อื่น รวมถึงภาพหน้าจอ อาจถูกจำกัดการใช้งานและต้องรับผิดทางกฎหมาย',
        },
        {
          q: 'แคปหน้าจอแล้วมีคำเตือนขึ้นมา',
          a: 'ข้อความ รูป วิดีโอ และโปรไฟล์ของศิลปินเป็นเนื้อหาสำหรับสมาชิก จึงมีคำเตือนเมื่อแคปหน้าจอ แอปไม่ได้บล็อกการแคปหน้าจอ แต่หากนำภาพที่แคปไปโพสต์หรือแชร์ภายนอก อาจถูกจำกัดการใช้งาน',
        },
        {
          q: 'เปิดรูป วิดีโอ หรือเสียงไม่ได้',
          a: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและอัปเดตแอปเป็นเวอร์ชันล่าสุด หากยังเปิดไม่ได้ โปรดแนบภาพหน้าจอแล้วแจ้งเราทางศูนย์ช่วยเหลือ',
        },
      ],
    },
    {
      title: 'การรายงาน การจำกัดการใช้งาน และการติดต่อ',
      items: [
        {
          q: 'ได้รับข้อความที่ไม่เหมาะสมหรือแปลกๆ',
          a: 'กดค้างที่บับเบิลข้อความแล้วเลือก "รายงาน" ทีมงานจะตรวจสอบและดำเนินการ หากดูเหมือนบัญชีศิลปินถูกแฮ็กก็รายงานได้เช่นกัน',
        },
        {
          q: 'ถูกจำกัดการใช้งาน',
          a: 'หากละเมิดนโยบายการใช้งาน อาจถูกระงับการใช้งานตามระยะเวลาที่กำหนดหรือถูกจำกัดถาวร เหตุผลและระยะเวลาจะแจ้งในแอป ดูเกณฑ์ได้ที่ โปรไฟล์ > นโยบายการใช้งาน หากคิดว่าถูกจำกัดโดยไม่ถูกต้อง โปรดแจ้งเราทางศูนย์ช่วยเหลือ',
        },
        {
          q: 'ติดต่อสอบถามได้ที่ไหน',
          a: 'ส่งคำถามได้ที่ โปรไฟล์ > ศูนย์ช่วยเหลือ ระบบจะใส่รหัสสมาชิกและเวอร์ชันแอปให้อัตโนมัติ และแนบรูปได้ด้วย เมื่อมีคำตอบจะแจ้งเตือนให้ทราบ',
        },
      ],
    },
  ],
  ja: [
    {
      title: 'アカウント',
      items: [
        {
          q: 'どの方法で登録・ログインしますか？',
          a: 'Google・Apple・Kakao・Naver・LINEのアカウントで登録・ログインします（国や端末によって表示されるボタンが異なります）。Toffee専用のパスワードは作りません。登録できるのは成人のみです（各国の成年年齢が基準です）。',
        },
        {
          q: 'パスワードを忘れました。',
          a: 'ToffeeはパスワードなしでGoogleやAppleなどのアカウントでログインするため、Toffeeのパスワードはありません。そのアカウントのパスワードを忘れた場合は、各社（Google・Apple・Kakao・Naver・LINE）でパスワードを再設定してください。',
        },
        {
          q: 'ログインアカウント（メールアドレス）を変更できますか？',
          a: 'いいえ。登録時に使ったログイン方法とメールアドレスは変更できません。別の方法でログインすると新しいアカウントが作られ、購読は引き継がれません。どの方法で登録したかはプロフィール > ログイン情報で確認できます。ログイン画面でも、最後に使ったボタンに「前回のログイン」と表示されます。',
        },
        {
          q: '複数の端末で使えますか？',
          a: 'はい。同じ方法でログインすれば、スマートフォン・タブレット・PCのウェブで一緒に使え、通知はログインしているすべてのアプリに届きます。端末をなくした場合は、プロフィール > すべてのデバイスからログアウトをタップしてください。',
        },
        {
          q: 'ログアウトはどうすればいいですか？',
          a: 'プロフィールの一番下にある「ログアウト」をタップしてください。ログアウトしても購読はそのままで、同じ方法でもう一度ログインすれば続けて使えます。',
        },
        {
          q: '退会したいです。',
          a: 'プロフィールの一番下にある「退会」からできます。退会してもストアの購読は自動で解約されないので、先にストアで解約してください。退会すると、トーク内容や購読履歴は元に戻せません。',
        },
        {
          q: '生年月日を間違えて入力しました。',
          a: '生年月日は成人確認に使われるため、アプリで直接変更できません。プロフィール > ヘルプセンターからお問い合わせください。',
        },
      ],
    },
    {
      title: '設定',
      items: [
        {
          q: 'ニックネームはどうやって変更しますか？',
          a: 'プロフィールで「ニックネームを変更」をタップしてください。登録後24時間は何度でも変更でき、その後は7日に1回変更できます。アーティストにはニックネームだけが表示され、ログインアカウントの名前は表示されません。',
        },
        {
          q: 'プロフィール写真とステータスメッセージは誰が見られますか？',
          a: '他のファンには表示されません。アーティストと事務所があなたの返信を見るときだけ表示されます。プロフィール画面で自分のプロフィールをタップすると変更できます。',
        },
        {
          q: 'アプリの言語を変えたいです。',
          a: '最初はスマートフォンの言語で表示されます。プロフィール > 言語で変更できます。アーティストのメッセージはアプリの言語に自動翻訳されて原文の下に表示され、同じ画面の「メッセージを自動翻訳」でオフにできます。機械翻訳のため、原文と少し異なる場合があります。',
        },
        {
          q: 'ダークモードで使えますか？',
          a: 'はい。プロフィール > 画面モードで「端末の設定に合わせる」「ライト」「ダーク」から選べます。',
        },
      ],
    },
    {
      title: '通知',
      items: [
        {
          q: '新着メッセージの通知が届きません。',
          a: '端末の設定 > 通知 > Toffeeで通知が許可されているか、Toffee Room右上の⋯メニューでそのアーティストの通知がオンになっているか確認してください。スマートフォンの省電力モードや集中モードがオンだと、通知が遅れたり届かなかったりすることがあります。PCのウェブでは通知は届きません。',
        },
        {
          q: '特定のアーティストの通知だけオフにできますか？',
          a: 'はい。そのアーティストのToffee Room右上の⋯ > 通知をオフをタップしてください。メッセージはこれまでどおり届き、通知だけが来なくなります。Toffee Room一覧に🔕マークが付きます。',
        },
        {
          q: 'お知らせはどこで見られますか？',
          a: 'プロフィール > お知らせで見られます。新しいお知らせがあるとプロフィールタブにNマークが付きます。サービスのメンテナンスなど大切なお知らせは通知でもお送りします。',
        },
      ],
    },
    {
      title: '支払い・解約・返金',
      items: [
        {
          q: 'サブスクリプションはどうやって解約しますか？',
          a: '支払ったストアで解約できます。iPhone：設定 > Apple ID（自分の名前）> サブスクリプション > Toffee > サブスクリプションをキャンセル。Android：Playストア > プロフィール > お支払いと定期購入 > 定期購入 > Toffee > 解約。Toffeeアプリのプロフィール > 購読の管理からも移動できます。期間終了の24時間前までに解約しないと次回の請求が発生します。アプリの削除や退会では自動で解約されません。',
        },
        {
          q: '返金してもらえますか？',
          a: 'お支払い（自動更新を含む）から7日以内なら全額返金を申請できます。App Storeでのお支払いはAppleの返金リクエストページ（reportaproblem.apple.com）、Google Playでのお支払いはGoogle PlayまたはToffeeのサポートへお申し込みください。また、支払った期間中にアーティストからのメッセージが一度もなかった場合や、お支払いから14日以内にアーティストの活動が終了した場合も、購読の管理から返金を申請できます。ただし、活動終了予定のお知らせ後、終了日より前に行われた決済は、活動終了による返金の対象外です（7日以内の返金はそのまま適用）。',
        },
        {
          q: '解約後にまた購読すると、以前のトークは見られますか？',
          a: 'いいえ。再購読すると、新しく購読した時点からのメッセージのみ表示されます。残したい写真・音声・動画は解約前に保存してください。',
        },
        {
          q: '機種変更・アプリを再インストールしました。',
          a: '以前と同じ方法（Google・Apple・Kakao・Naver・LINE）でログインすれば購読はそのままです。表示されない場合は、支払ったストアのアカウントでログインした状態でプロフィール > 購読の管理 > 購入を復元をタップしてください。',
        },
        {
          q: '「お支払い方法をご確認ください」と表示されます。',
          a: 'カードの有効期限切れや残高不足などで、ストアの自動決済が失敗した状態です。ストアが定める猶予期間中はそのまま利用できます。購読の管理からストアの画面に移動して支払い方法を変更すると、ストアがもう一度決済し、表示が消えます。猶予期間が終わるまでに決済されないと、購読は終了します。',
        },
        {
          q: '次回請求日が実際の請求日と違います。',
          a: '購読の管理に表示される次回請求日は目安です。実際の請求日と金額はストアが決めるため、タイムゾーンによって1日ほどずれることがあります。正確な内容はApp StoreまたはGoogle Playのサブスクリプション・購入履歴で確認してください。',
        },
        {
          q: '購読料は国によって違いますか？',
          a: 'はい。お支払いは、ストアが定めたその国の価格と通貨で行われます。アプリの一覧に「≈」で表示される金額は参考用の換算額で、実際の金額は決済画面に表示されるストアの価格です。',
        },
        {
          q: '「購入を復元」をタップしても購読が表示されません。',
          a: '決済したストアのアカウント（Apple IDまたはGoogleアカウント）でスマートフォンにログインしている必要があります。別のストアアカウントだと購入履歴が表示されません。また、決済時に使っていたToffeeのアカウント（同じログイン方法）でログインしているか確認してください。それでも表示されない場合は、お問い合わせにストアの領収書を添付してください。',
        },
      ],
    },
    {
      title: '購読',
      items: [
        {
          q: 'セット購読とは何ですか？',
          a: '複数のアーティストをまとめて購読でき、別々に購読するよりお得な商品です。アーティストのプロフィールの「セットでお得に」で確認できます。解約はセット単位でのみできます。すでに単独で購読中のアーティストが含まれるセットを購入した場合は、二重請求を避けるため、単独の購読をストアで解約してください（トークはそのまま続きます）。',
        },
        {
          q: 'CPルームとは何ですか？',
          a: '2人のアーティストが一緒にメッセージを送るToffee Roomです。それぞれのアーティストの個人ルームとは別に購読するか、CPと組み合わせたセットで購読できます。吹き出しに誰が送ったかが表示されます。',
        },
        {
          q: '同じCPの別のセットに変更できますか？',
          a: 'はい。同じCPのセットを購読中なら、別のセットの画面に［このセットに変更］が表示されます。お支払いは1つのまま続き、いつ切り替わるかは変更前に画面でご案内します。重なるToffee Roomのトークはそのままです。',
        },
        {
          q: 'アーティストの活動が終了したらどうなりますか？',
          a: '新しく購読できなくなり、購読中のファンには通知でお知らせします。活動終了予定日が決まると、プロフィールに前もって表示されます。お支払いから14日以内に活動が終了した場合は、購読の管理から返金を申請できます（「返金してもらえますか？」を参照）。',
        },
        {
          q: '購読して何日目か確認できますか？',
          a: 'プロフィール > 購読の管理でアーティストをタップすると、購読開始日と「N日目」が表示されます。解約してから再購読すると、最初から数え直します。',
        },
      ],
    },
    {
      title: 'Toffee Room',
      items: [
        {
          q: 'アーティストからのメッセージはどのくらい届きますか？',
          a: 'アーティスト本人が送るため、本人の都合により不定期に届きます。Toffeeはメッセージの回数を保証しませんが、支払った期間中に一度もなかった場合は返金を申請できます。',
        },
        {
          q: '以前のメッセージを探したいです。',
          a: 'Toffee Room右上の🔍をタップすると、Toffee Room内のメッセージを検索できます。受け取った写真・動画は⋯ > 写真・動画を見るでまとめて見られます。検索できるのは、今回の購読を開始した後のメッセージだけです。',
        },
        {
          q: '「取り消されたメッセージです」とは何ですか？',
          a: '送った人が取り消したメッセージです。アーティストが取り消したメッセージか、自分で取り消した自分の返信です。',
        },
        {
          q: '「非表示のメッセージ」とは何ですか？',
          a: 'アーティストが引用したファンの返信が、通報の対応など運営ポリシーにより非表示になったという意味です。',
        },
        {
          q: '購読してすぐに届いたメッセージは何ですか？',
          a: 'アーティストが新しく購読したファンのために用意しておいたウェルカムメッセージです。実際に送ったメッセージの数には含まれません。',
        },
        {
          q: '誕生日メッセージはどうやって受け取りますか？',
          a: 'プロフィールで「誕生日メッセージを受け取る」をオンにしてください。登録時に入力した生年月日の日付に、誕生日メッセージを用意したアーティストからお祝いのメッセージが届きます。アーティストにあなたの誕生日は見えません。',
        },
      ],
    },
    {
      title: '返信',
      items: [
        {
          q: '返信はいくつまで送れますか？',
          a: 'アーティストのメッセージ1件につき、文字と絵文字で3件まで返信できます。残りの件数は入力欄の上に表示されます。アーティストがあなたの返信を引用すると、他の購読者にも返信の内容が表示されます（ニックネームは表示されません）。',
        },
        {
          q: '送った返信を消せますか？',
          a: '自分の返信を長押しして「送信取消」をタップすると、「取り消されたメッセージです」に変わります。時間の制限はありませんが、取り消しても送った返信の回数は戻りません。',
        },
        {
          q: '自分の返信は誰が見られますか？',
          a: 'アーティストと事務所だけです。他のファンには表示されません。アーティストがあなたの返信を引用して返信すると、その返信の内容は他の購読者にも表示されますが、ニックネームは表示されません。あなたには「あなたのメッセージに返信しました」という通知が届きます。',
        },
        {
          q: '返信が送れません。',
          a: '入力欄の上で、残りの返信回数を使い切っていないか確認してください。暴言や外部での連絡を誘う文言など、禁止されている表現を含む返信は送れません。利用が制限されている場合や、そのToffee Roomで返信が制限されている場合も送れません。',
        },
      ],
    },
    {
      title: '写真・動画',
      items: [
        {
          q: '受け取った写真・動画を保存してもいいですか？',
          a: '個人で楽しむためなら保存できます。スクリーンショットを含め、SNSや他のサイトに投稿・共有すると利用が制限され、法的責任を負う場合があります。',
        },
        {
          q: 'スクリーンショットを撮ると警告が表示されます。',
          a: 'アーティストのメッセージ・写真・動画とプロフィールは購読者向けのコンテンツのため、スクリーンショットを撮るとお知らせが表示されます。撮影自体は制限しませんが、撮った内容を外部に投稿・共有すると利用が制限されることがあります。',
        },
        {
          q: '写真・動画・音声が開きません。',
          a: 'インターネット接続を確認し、アプリを最新バージョンにアップデートしてください。それでも開かない場合は、お問い合わせにスクリーンショットを添付してお知らせください。',
        },
      ],
    },
    {
      title: '通報・利用制限・お問い合わせ',
      items: [
        {
          q: '不快なメッセージや不審なメッセージが届きました。',
          a: '吹き出しを長押しして「通報」をタップしてください。運営が確認して対応します。アーティストのアカウントが乗っ取られたように見えるときも通報してください。',
        },
        {
          q: '利用が制限されました。',
          a: '運営ポリシーに違反すると、期間を決めて利用を停止したり、永久に制限したりすることがあります。制限の理由と期間はアプリでお知らせします。基準はプロフィール > 運営ポリシーで確認できます。誤って制限されたと思われる場合は、お問い合わせからお知らせください。',
        },
        {
          q: '問い合わせはどこからできますか？',
          a: 'プロフィール > ヘルプセンター > お問い合わせから送ってください。会員番号とアプリのバージョンが自動で入り、写真も添付できます。返信が届くと通知でお知らせします。',
        },
      ],
    },
  ],
  'zh-Hans': [
    {
      title: '账号',
      items: [
        {
          q: '如何注册和登录？',
          a: '使用 Google、Apple、Kakao、Naver 或 LINE 账号注册和登录（显示的按钮因国家和设备而异）。Toffee 不需要另外设置密码。仅限成年人注册（以各国的成年年龄为准）。',
        },
        {
          q: '我忘记密码了。',
          a: 'Toffee 不使用密码，而是用 Google、Apple 等账号登录，所以没有 Toffee 密码。如果忘记了这些账号的密码，请到对应的公司（Google、Apple、Kakao、Naver、LINE）找回密码。',
        },
        {
          q: '可以更改登录账号（邮箱）吗？',
          a: '不可以。注册时使用的登录方式和邮箱无法更改。用其他方式登录会创建新账号，订阅也不会转移。你可以在 我的 > 登录信息 中查看自己是用哪种方式注册的。登录页面上，你上次使用的按钮也会显示“上次使用”。',
        },
        {
          q: '可以在多台设备上使用吗？',
          a: '可以。用同一种方式登录，就能在手机、平板和电脑网页上一起使用，通知会发送到所有已登录的应用。如果设备丢失，请点击 我的 > 在所有设备上退出登录。',
        },
        {
          q: '如何退出登录？',
          a: '请点击“我的”页面最下方的“退出登录”。退出登录后订阅仍然有效，用同一种方式重新登录即可继续使用。',
        },
        {
          q: '我想注销账号。',
          a: '可以在“我的”页面最下方的“注销账号”中操作。注销账号不会自动取消商店订阅，请先在商店中取消。注销后，聊天内容和订阅记录将无法恢复。',
        },
        {
          q: '出生日期填错了。',
          a: '出生日期用于成年验证，无法在应用中直接修改。请在 我的 > 帮助中心 提交在线咨询。',
        },
      ],
    },
    {
      title: '设置',
      items: [
        {
          q: '如何修改昵称？',
          a: '请在“我的”页面点击“修改昵称”。注册后24小时内可以随意修改，之后每7天可以修改一次。艺人只能看到你的昵称，看不到登录账号的名字。',
        },
        {
          q: '谁能看到我的头像和状态消息？',
          a: '其他粉丝看不到。只有艺人和经纪公司在查看你的回复时才能看到。在“我的”页面点击你的资料即可修改。',
        },
        {
          q: '我想更改应用语言。',
          a: '默认显示手机的语言，可以在 我的 > 语言 中更改。艺人的消息会自动翻译成应用语言，显示在原文下方，可以在同一页面的“自动翻译消息”中关闭。翻译为机器翻译，可能与原文略有不同。',
        },
        {
          q: '可以使用深色模式吗？',
          a: '可以。在 我的 > 显示模式 中可以选择“跟随设备设置”“浅色”或“深色”。',
        },
      ],
    },
    {
      title: '通知',
      items: [
        {
          q: '收不到新消息通知。',
          a: '请确认设备的 设置 > 通知 > Toffee 已允许通知，并且 Toffee Room 右上角 ⋯ 菜单中该艺人的通知已开启。如果手机开启了省电模式或专注模式，通知可能会延迟或收不到。电脑网页版不会收到通知。',
        },
        {
          q: '可以只关闭某位艺人的通知吗？',
          a: '可以。请点击该艺人 Toffee Room 右上角的 ⋯ > 关闭通知。消息仍会照常收到，只是不再通知。Toffee Room 列表中会显示 🔕 标记。',
        },
        {
          q: '在哪里查看公告？',
          a: '可以在 我的 > 公告 中查看。有新公告时，“我的”标签上会显示 N 标记。服务维护等重要公告也会通过通知发送。',
        },
      ],
    },
    {
      title: '付款、取消与退款',
      items: [
        {
          q: '如何取消订阅？',
          a: '请在付款的商店中取消。iPhone：设置 > Apple ID（你的名字）> 订阅 > Toffee > 取消订阅。Android：Play 商店 > 个人资料 > 付款和订阅 > 订阅 > Toffee > 取消订阅。也可以从 Toffee 的 我的 > 管理订阅 直接前往。需在当期结束前至少24小时取消，才不会产生下次扣费。删除应用或注销账号不会自动取消订阅。',
        },
        {
          q: '可以退款吗？',
          a: '付款（包括自动续订）后7天内可申请全额退款。App Store 付款请在 Apple 退款页面（reportaproblem.apple.com）申请，Google Play 付款请通过 Google Play 或 Toffee 客服申请。此外，如在已付费期间内艺人未发送任何消息，或付款后14天内艺人停止活动，也可在「管理订阅」中申请退款。但收到活动结束预告后、结束日之前的付款不属于活动结束退款范围（7 天内退款仍然适用）。',
        },
        {
          q: '取消后再次订阅，能看到以前的聊天吗？',
          a: '不能。再次订阅后只能看到新订阅之后的消息。想保留的照片、语音和视频请在取消前保存。',
        },
        {
          q: '换了手机或重新安装了应用。',
          a: '用之前的方式（Google、Apple、Kakao、Naver 或 LINE）登录，订阅仍然有效。如果看不到，请在登录付款商店账号的状态下点击 我的 > 管理订阅 > 恢复购买。',
        },
        {
          q: '显示“请检查付款方式”。',
          a: '这是因为卡片过期或余额不足等原因，商店自动扣款失败了。在商店规定的宽限期内可以照常使用。从 管理订阅 前往商店页面更换付款方式后，商店会重新扣款，提示也会消失。如果宽限期结束前仍未扣款成功，订阅将会结束。',
        },
        {
          q: '下次扣款日和实际扣款日不一样。',
          a: '管理订阅 中显示的下次扣款日仅供参考。实际扣款日期和金额由商店决定，可能因时区相差一天左右。准确记录请在 App Store 或 Google Play 的订阅和购买记录中查看。',
        },
        {
          q: '订阅费在各个国家都一样吗？',
          a: '不一样。付款会按商店规定的当地价格和货币进行。应用列表中以“≈”显示的金额是参考换算金额，实际金额以付款页面显示的商店价格为准。',
        },
        {
          q: '点击恢复购买后还是看不到订阅。',
          a: '手机需要登录付款时使用的商店账号（Apple ID 或 Google 账号）。如果是其他商店账号，就不会显示购买记录。另外，请确认你登录的是付款时使用的 Toffee 账号（同一种登录方式）。如果仍无法解决，请在在线咨询中附上商店收据。',
        },
      ],
    },
    {
      title: '订阅',
      items: [
        {
          q: '什么是套餐订阅？',
          a: '一次订阅多位艺人，比分别订阅更便宜。可以在艺人资料页的“套餐更划算”中查看。只能按整个套餐取消。如果购买的套餐中包含你已单独订阅的艺人，为避免重复扣费，请在商店中取消单独订阅（聊天会照常继续）。',
        },
        {
          q: '什么是CP房？',
          a: '两位艺人一起发消息的 Toffee Room。可以与各艺人的个人房分开订阅，也可以通过和CP一起打包的套餐订阅。消息气泡上会显示是谁发的。',
        },
        {
          q: '可以换成同一CP的其他套餐吗？',
          a: '可以。如果你正在订阅同一CP的套餐，其他套餐页面会显示［切换到此套餐］。付款会作为一笔继续，切换的生效时间会在切换前显示在页面上。重叠的 Toffee Room 聊天保持不变。',
        },
        {
          q: '艺人停止活动后会怎样？',
          a: '将无法再新订阅，正在订阅的粉丝会收到通知。活动结束日期确定后，会提前显示在艺人资料页上。如果在付款后14天内艺人停止活动，可以在 管理订阅 中申请退款（请参阅“可以退款吗？”）。',
        },
        {
          q: '可以查看订阅了多少天吗？',
          a: '在 我的 > 管理订阅 中点击艺人，即可看到订阅开始日期和“第 N 天”。取消后重新订阅会从头开始计算。',
        },
      ],
    },
    {
      title: 'Toffee Room',
      items: [
        {
          q: '艺人多久发一次消息？',
          a: '消息由艺人亲自发送，会根据艺人情况不定期到达。Toffee 不保证消息数量，但如果已付费期间内一条消息都没有，可以申请退款。',
        },
        {
          q: '我想找以前的消息。',
          a: '点击 Toffee Room 右上角的 🔍，即可在 Toffee Room 内搜索消息。收到的照片和视频可以在 ⋯ > 查看全部照片和视频 中一次看完。只能搜索本次订阅开始后的消息。',
        },
        {
          q: '“此消息已撤回”是什么意思？',
          a: '是发送者撤回的消息，可能是艺人撤回的，也可能是你自己撤回的回复。',
        },
        {
          q: '“已被隐藏的消息”是什么意思？',
          a: '表示艺人引用的粉丝回复因举报处理等原因，已根据运营政策被隐藏。',
        },
        {
          q: '刚订阅就收到的消息是什么？',
          a: '是艺人为新订阅的粉丝提前写好的欢迎消息，不计入实际发送的消息数量。',
        },
        {
          q: '如何收到生日祝福？',
          a: '请在「我的」中开启“接收生日祝福”。在注册时填写的生日当天，准备了生日消息的艺人会给你发来祝福。艺人看不到你的生日。',
        },
      ],
    },
    {
      title: '回复',
      items: [
        {
          q: '可以回复几条？',
          a: '每条艺人消息最多可用文字或表情回复3条，剩余条数显示在输入框上方。如果艺人引用了你的回复，其他订阅者也能看到回复内容（看不到你的昵称）。',
        },
        {
          q: '可以删除已发送的回复吗？',
          a: '长按自己的回复并点击“撤回”，就会变成“此消息已撤回”。没有时间限制，但撤回后已用的回复次数不会恢复。',
        },
        {
          q: '谁能看到我的回复？',
          a: '只有艺人和经纪公司能看到，其他粉丝看不到。如果艺人引用你的回复来回答，其他订阅者也能看到该回复内容，但看不到昵称，你会收到“回复了你的消息”的通知。',
        },
        {
          q: '回复发送不出去。',
          a: '请查看输入框上方，确认是否已用完剩余的回复次数。含有脏话或引导站外联系等禁止内容的回复无法发送。如果你被限制使用，或在该 Toffee Room 中无法回复，也无法发送。',
        },
      ],
    },
    {
      title: '照片和视频',
      items: [
        {
          q: '可以保存收到的照片和视频吗？',
          a: '可以保存供个人收藏。包括截图在内，发布或分享到社交媒体或其他网站，可能会被限制使用并承担法律责任。',
        },
        {
          q: '截屏时会弹出警告。',
          a: '艺人的消息、照片、视频和资料是给订阅者的内容，所以截屏时会弹出提示。我们不会阻止截屏，但将截图内容发布或分享到外部，可能会被限制使用。',
        },
        {
          q: '照片、视频或语音打不开。',
          a: '请检查网络连接，并将应用更新到最新版本。如果仍然打不开，请在在线咨询中附上截图告诉我们。',
        },
      ],
    },
    {
      title: '举报、使用限制与咨询',
      items: [
        {
          q: '收到了令人不适或奇怪的消息。',
          a: '请长按消息气泡并点击“举报”，运营人员会核查并处理。如果艺人账号看起来像被盗用，也请举报。',
        },
        {
          q: '我被限制使用了。',
          a: '违反运营政策时，可能会被暂停使用一段时间或被永久限制。限制原因和期限会在应用中告知。具体标准可在 我的 > 运营政策 中查看。如果你认为限制有误，请通过在线咨询告诉我们。',
        },
        {
          q: '如何联系客服？',
          a: '请在 我的 > 帮助中心 > 在线咨询 中提交。会员编号和应用版本会自动附上，也可以附加照片。收到回复时会通过通知告诉你。',
        },
      ],
    },
  ],
  'zh-Hant': [
    {
      title: '帳號',
      items: [
        {
          q: '如何註冊和登入？',
          a: '使用 Google、Apple、Kakao、Naver 或 LINE 帳號註冊和登入（顯示的按鈕依國家和裝置而不同）。Toffee 不需要另外設定密碼。僅限成年人註冊（以各國的成年年齡為準）。',
        },
        {
          q: '我忘記密碼了。',
          a: 'Toffee 不使用密碼，而是用 Google、Apple 等帳號登入，所以沒有 Toffee 密碼。如果忘記了這些帳號的密碼，請到對應的公司（Google、Apple、Kakao、Naver、LINE）重設密碼。',
        },
        {
          q: '可以更改登入帳號（電子郵件）嗎？',
          a: '不行。註冊時使用的登入方式和電子郵件無法更改。用其他方式登入會建立新帳號，訂閱也不會轉移。你可以在 我的 > 登入資訊 查看自己是用哪種方式註冊的。登入畫面上，你上次使用的按鈕也會顯示「上次使用」。',
        },
        {
          q: '可以在多台裝置上使用嗎？',
          a: '可以。用同一種方式登入，就能在手機、平板和電腦網頁上一起使用，通知會傳送到所有已登入的 App。如果裝置遺失，請點選 我的 > 在所有裝置上登出。',
        },
        {
          q: '如何登出？',
          a: '請點選「我的」頁面最下方的「登出」。登出後訂閱仍然有效，用同一種方式重新登入即可繼續使用。',
        },
        {
          q: '我想刪除帳號。',
          a: '可以在「我的」頁面最下方的「刪除帳號」中操作。刪除帳號不會自動取消商店訂閱，請先在商店中取消。刪除後，聊天內容和訂閱紀錄將無法復原。',
        },
        {
          q: '出生日期填錯了。',
          a: '出生日期用於成年驗證，無法在 App 中直接修改。請在 我的 > 幫助中心 提交線上諮詢。',
        },
      ],
    },
    {
      title: '設定',
      items: [
        {
          q: '如何修改暱稱？',
          a: '請在「我的」頁面點選「修改暱稱」。註冊後24小時內可以隨意修改，之後每7天可以修改一次。藝人只看得到你的暱稱，看不到登入帳號的名字。',
        },
        {
          q: '誰看得到我的頭像和狀態訊息？',
          a: '其他粉絲看不到。只有藝人和經紀公司在查看你的回覆時才看得到。在「我的」頁面點選你的個人資料即可修改。',
        },
        {
          q: '我想更改 App 語言。',
          a: '預設顯示手機的語言，可以在 我的 > 語言 中更改。藝人的訊息會自動翻譯成 App 語言，顯示在原文下方，可以在同一頁面的「自動翻譯訊息」中關閉。翻譯為機器翻譯，可能與原文略有不同。',
        },
        {
          q: '可以使用深色模式嗎？',
          a: '可以。在 我的 > 顯示模式 中可以選擇「跟隨裝置設定」「淺色」或「深色」。',
        },
      ],
    },
    {
      title: '通知',
      items: [
        {
          q: '收不到新訊息通知。',
          a: '請確認裝置的 設定 > 通知 > Toffee 已允許通知，並且 Toffee Room 右上角 ⋯ 選單中該藝人的通知已開啟。如果手機開啟了省電模式或專注模式，通知可能會延遲或收不到。電腦網頁版不會收到通知。',
        },
        {
          q: '可以只關閉某位藝人的通知嗎？',
          a: '可以。請點選該藝人 Toffee Room 右上角的 ⋯ > 關閉通知。訊息仍會照常收到，只是不再通知。Toffee Room 列表中會顯示 🔕 標記。',
        },
        {
          q: '在哪裡查看公告？',
          a: '可以在 我的 > 公告 中查看。有新公告時，「我的」分頁上會顯示 N 標記。服務維護等重要公告也會透過通知傳送。',
        },
      ],
    },
    {
      title: '付款、取消與退款',
      items: [
        {
          q: '如何取消訂閱？',
          a: '請在付款的商店中取消。iPhone：設定 > Apple ID（你的名字）> 訂閱項目 > Toffee > 取消訂閱。Android：Play 商店 > 個人資料 > 付款和訂閱 > 訂閱 > Toffee > 取消訂閱。也可以從 Toffee 的 我的 > 管理訂閱 直接前往。需在當期結束前至少24小時取消，才不會產生下次扣款。刪除 App 或刪除帳號不會自動取消訂閱。',
        },
        {
          q: '可以退款嗎？',
          a: '付款（包含自動續訂）後7天內可申請全額退款。App Store 付款請在 Apple 退款頁面（reportaproblem.apple.com）申請，Google Play 付款請透過 Google Play 或 Toffee 客服申請。此外，若在已付費期間內藝人未傳送任何訊息，或付款後14天內藝人停止活動，也可在「管理訂閱」中申請退款。但收到活動結束預告後、結束日之前的付款不適用活動結束退款（7 天內退款仍然適用）。',
        },
        {
          q: '取消後再次訂閱，看得到以前的聊天嗎？',
          a: '看不到。再次訂閱後只能看到新訂閱之後的訊息。想保留的照片、語音和影片請在取消前儲存。',
        },
        {
          q: '換了手機或重新安裝了 App。',
          a: '用之前的方式（Google、Apple、Kakao、Naver 或 LINE）登入，訂閱仍然有效。若看不到，請在登入付款商店帳號的狀態下點選 我的 > 管理訂閱 > 恢復購買。',
        },
        {
          q: '顯示「請確認付款方式」。',
          a: '這是因為卡片過期或餘額不足等原因，商店自動扣款失敗了。在商店規定的寬限期內可以照常使用。從 管理訂閱 前往商店頁面更換付款方式後，商店會重新扣款，提示也會消失。如果寬限期結束前仍未扣款成功，訂閱將會結束。',
        },
        {
          q: '下次扣款日和實際扣款日不一樣。',
          a: '管理訂閱 中顯示的下次扣款日僅供參考。實際扣款日期和金額由商店決定，可能因時區相差一天左右。正確紀錄請在 App Store 或 Google Play 的訂閱和購買紀錄中查看。',
        },
        {
          q: '訂閱費在各個國家都一樣嗎？',
          a: '不一樣。付款會依商店規定的當地價格和貨幣進行。App 列表中以「≈」顯示的金額是參考換算金額，實際金額以付款頁面顯示的商店價格為準。',
        },
        {
          q: '點選恢復購買後還是看不到訂閱。',
          a: '手機需要登入付款時使用的商店帳號（Apple ID 或 Google 帳號）。如果是其他商店帳號，就不會顯示購買紀錄。另外，請確認你登入的是付款時使用的 Toffee 帳號（同一種登入方式）。如果仍無法解決，請在線上諮詢中附上商店收據。',
        },
      ],
    },
    {
      title: '訂閱',
      items: [
        {
          q: '什麼是組合訂閱？',
          a: '一次訂閱多位藝人，比分別訂閱更便宜。可以在藝人個人資料頁的「組合更划算」中查看。只能以整個組合為單位取消。如果購買的組合中包含你已單獨訂閱的藝人，為避免重複扣款，請在商店中取消單獨訂閱（聊天會照常繼續）。',
        },
        {
          q: '什麼是CP房？',
          a: '兩位藝人一起傳訊息的 Toffee Room。可以與各藝人的個人房分開訂閱，也可以透過和CP一起搭配的組合訂閱。訊息泡泡上會顯示是誰傳的。',
        },
        {
          q: '可以換成同一CP的其他組合嗎？',
          a: '可以。如果你正在訂閱同一CP的組合，其他組合頁面會顯示［改成這個組合］。付款會作為一筆繼續，更換的生效時間會在更換前顯示在頁面上。重疊的 Toffee Room 聊天保持不變。',
        },
        {
          q: '藝人停止活動後會怎樣？',
          a: '將無法再新訂閱，正在訂閱的粉絲會收到通知。活動結束日期確定後，會提前顯示在藝人個人資料頁上。如果在付款後14天內藝人停止活動，可以在 管理訂閱 中申請退款（請參閱「可以退款嗎？」）。',
        },
        {
          q: '可以查看訂閱了幾天嗎？',
          a: '在 我的 > 管理訂閱 中點選藝人，即可看到訂閱開始日期和「第 N 天」。取消後重新訂閱會從頭開始計算。',
        },
      ],
    },
    {
      title: 'Toffee Room',
      items: [
        {
          q: '藝人多久傳一次訊息？',
          a: '訊息由藝人親自傳送，會依藝人情況不定期到達。Toffee 不保證訊息數量，但若已付費期間內一則訊息都沒有，可以申請退款。',
        },
        {
          q: '我想找以前的訊息。',
          a: '點選 Toffee Room 右上角的 🔍，即可在 Toffee Room 內搜尋訊息。收到的照片和影片可以在 ⋯ > 查看全部照片和影片 中一次看完。只能搜尋這次訂閱開始後的訊息。',
        },
        {
          q: '「此訊息已收回」是什麼意思？',
          a: '是傳送者收回的訊息，可能是藝人收回的，也可能是你自己收回的回覆。',
        },
        {
          q: '「已被隱藏的訊息」是什麼意思？',
          a: '表示藝人引用的粉絲回覆因檢舉處理等原因，已依營運政策被隱藏。',
        },
        {
          q: '剛訂閱就收到的訊息是什麼？',
          a: '是藝人為新訂閱的粉絲預先寫好的歡迎訊息，不計入實際傳送的訊息數量。',
        },
        {
          q: '如何收到生日祝福？',
          a: '請在「我的」中開啟「接收生日祝福」。在註冊時填寫的生日當天，準備了生日訊息的藝人會傳來祝福。藝人看不到你的生日。',
        },
      ],
    },
    {
      title: '回覆',
      items: [
        {
          q: '可以回覆幾則？',
          a: '每則藝人訊息最多可用文字或表情回覆3則，剩餘則數顯示在輸入框上方。若藝人引用了你的回覆，其他訂閱者也看得到回覆內容（看不到你的暱稱）。',
        },
        {
          q: '可以刪除已傳送的回覆嗎？',
          a: '長按自己的回覆並點選「收回」，就會變成「此訊息已收回」。沒有時間限制，但收回後已用的回覆次數不會恢復。',
        },
        {
          q: '誰看得到我的回覆？',
          a: '只有藝人和經紀公司看得到，其他粉絲看不到。如果藝人引用你的回覆來回答，其他訂閱者也看得到該回覆內容，但看不到暱稱，你會收到「回覆了你的訊息」的通知。',
        },
        {
          q: '回覆傳送不出去。',
          a: '請查看輸入框上方，確認是否已用完剩餘的回覆次數。含有髒話或引導站外聯絡等禁止內容的回覆無法傳送。如果你被限制使用，或在該 Toffee Room 中無法回覆，也無法傳送。',
        },
      ],
    },
    {
      title: '照片和影片',
      items: [
        {
          q: '可以儲存收到的照片和影片嗎？',
          a: '可以儲存供個人收藏。包含截圖在內，發布或分享到社群媒體或其他網站，可能會被限制使用並負法律責任。',
        },
        {
          q: '截圖時會跳出警告。',
          a: '藝人的訊息、照片、影片和個人資料是給訂閱者的內容，所以截圖時會跳出提示。我們不會阻止截圖，但將截圖內容發布或分享到外部，可能會被限制使用。',
        },
        {
          q: '照片、影片或語音打不開。',
          a: '請檢查網路連線，並將 App 更新到最新版本。如果仍然打不開，請在線上諮詢中附上截圖告訴我們。',
        },
      ],
    },
    {
      title: '檢舉、使用限制與諮詢',
      items: [
        {
          q: '收到了令人不舒服或奇怪的訊息。',
          a: '請長按訊息泡泡並點選「檢舉」，營運人員會確認並處理。如果藝人帳號看起來像被盜用，也請檢舉。',
        },
        {
          q: '我被限制使用了。',
          a: '違反營運政策時，可能會被暫停使用一段時間或被永久限制。限制原因和期限會在 App 中告知。具體標準可在 我的 > 營運政策 中查看。如果你認為限制有誤，請透過線上諮詢告訴我們。',
        },
        {
          q: '如何聯絡客服？',
          a: '請在 我的 > 幫助中心 > 線上諮詢 中提交。會員編號和 App 版本會自動附上，也可以附加照片。收到回覆時會透過通知告訴你。',
        },
      ],
    },
  ],
  vi: [
    {
      title: 'Tài khoản',
      items: [
        {
          q: 'Tôi đăng ký và đăng nhập bằng cách nào?',
          a: 'Bạn đăng ký và đăng nhập bằng tài khoản Google, Apple, Kakao, Naver hoặc LINE (các nút hiển thị có thể khác nhau tùy quốc gia và thiết bị). Toffee không yêu cầu tạo mật khẩu riêng. Chỉ người đã đủ tuổi trưởng thành mới đăng ký được (theo độ tuổi trưởng thành của từng quốc gia).',
        },
        {
          q: 'Tôi quên mật khẩu.',
          a: 'Toffee đăng nhập bằng tài khoản như Google hay Apple, không dùng mật khẩu, nên không có mật khẩu Toffee. Nếu bạn quên mật khẩu của tài khoản đó, hãy lấy lại mật khẩu tại công ty cung cấp tài khoản (Google, Apple, Kakao, Naver hoặc LINE).',
        },
        {
          q: 'Tôi có đổi được tài khoản đăng nhập (email) không?',
          a: 'Không. Cách đăng nhập và email bạn dùng khi đăng ký không thể đổi. Nếu đăng nhập bằng cách khác, một tài khoản mới sẽ được tạo và gói đăng ký không được chuyển sang. Bạn có thể xem mình đã đăng ký bằng cách nào ở Hồ sơ > Thông tin đăng nhập. Trên màn hình đăng nhập, nút bạn dùng lần gần nhất cũng có nhãn "Dùng gần đây".',
        },
        {
          q: 'Tôi có dùng được trên nhiều thiết bị không?',
          a: 'Được. Đăng nhập bằng cùng một cách là bạn có thể dùng trên điện thoại, máy tính bảng và web trên PC, và thông báo sẽ gửi đến mọi ứng dụng đang đăng nhập. Nếu bị mất thiết bị, hãy chạm Hồ sơ > Đăng xuất khỏi mọi thiết bị.',
        },
        {
          q: 'Làm sao để đăng xuất?',
          a: 'Chạm "Đăng xuất" ở cuối trang Hồ sơ. Đăng xuất không ảnh hưởng đến gói đăng ký, đăng nhập lại bằng cùng cách là bạn dùng tiếp được.',
        },
        {
          q: 'Tôi muốn xóa tài khoản.',
          a: 'Bạn có thể xóa ở mục "Xóa tài khoản" cuối trang Hồ sơ. Xóa tài khoản không tự động hủy gói đăng ký trong cửa hàng, nên hãy hủy trong cửa hàng trước. Sau khi xóa, cuộc trò chuyện và lịch sử đăng ký không thể khôi phục.',
        },
        {
          q: 'Tôi nhập sai ngày sinh.',
          a: 'Ngày sinh được dùng để xác nhận bạn đã đủ tuổi trưởng thành nên không thể tự đổi trong ứng dụng. Hãy gửi yêu cầu tại Hồ sơ > Trung tâm trợ giúp.',
        },
      ],
    },
    {
      title: 'Cài đặt',
      items: [
        {
          q: 'Làm sao để đổi biệt danh?',
          a: 'Chạm "Đổi biệt danh" trong trang Hồ sơ. Trong 24 giờ đầu sau khi đăng ký, bạn đổi bao nhiêu lần cũng được; sau đó mỗi 7 ngày đổi được một lần. Nghệ sĩ chỉ thấy biệt danh, không thấy tên trong tài khoản đăng nhập của bạn.',
        },
        {
          q: 'Ai thấy ảnh hồ sơ và lời giới thiệu của tôi?',
          a: 'Fan khác không thấy. Chỉ nghệ sĩ và công ty quản lý thấy khi xem câu trả lời của bạn. Bạn có thể đổi bằng cách chạm vào hồ sơ của mình trong trang Hồ sơ.',
        },
        {
          q: 'Tôi muốn đổi ngôn ngữ ứng dụng.',
          a: 'Ban đầu ứng dụng hiển thị theo ngôn ngữ của điện thoại. Bạn có thể đổi ở Hồ sơ > Ngôn ngữ. Tin nhắn của nghệ sĩ được tự động dịch sang ngôn ngữ ứng dụng và hiện bên dưới bản gốc; bạn có thể tắt ở mục "Tự động dịch tin nhắn" trong cùng màn hình. Bản dịch là dịch máy nên có thể hơi khác bản gốc.',
        },
        {
          q: 'Có chế độ tối không?',
          a: 'Có. Ở Hồ sơ > Chế độ hiển thị, bạn có thể chọn Theo cài đặt thiết bị, Sáng hoặc Tối.',
        },
      ],
    },
    {
      title: 'Thông báo',
      items: [
        {
          q: 'Tôi không nhận được thông báo tin nhắn mới.',
          a: 'Hãy kiểm tra đã cho phép thông báo trong Cài đặt thiết bị > Thông báo > Toffee, và đã bật thông báo của nghệ sĩ đó trong menu ⋯ ở góc trên bên phải Toffee Room. Nếu điện thoại đang bật chế độ tiết kiệm pin hoặc chế độ tập trung, thông báo có thể đến chậm hoặc không đến. Web trên PC không có thông báo.',
        },
        {
          q: 'Tôi có tắt thông báo của riêng một nghệ sĩ được không?',
          a: 'Được. Chạm ⋯ > Tắt thông báo ở góc trên bên phải Toffee Room của nghệ sĩ đó. Bạn vẫn nhận tin nhắn như bình thường, chỉ không có thông báo. Toffee Room đó sẽ có biểu tượng 🔕 trong danh sách.',
        },
        {
          q: 'Xem tin tức, thông báo từ Toffee ở đâu?',
          a: 'Bạn xem ở Hồ sơ > Thông báo (trong mục Hỗ trợ). Khi có thông báo mới, tab Hồ sơ sẽ hiện dấu N. Thông báo quan trọng như bảo trì dịch vụ cũng sẽ được gửi qua thông báo đẩy.',
        },
      ],
    },
    {
      title: 'Thanh toán, hủy và hoàn tiền',
      items: [
        {
          q: 'Làm sao để hủy gói đăng ký?',
          a: 'Hủy trong cửa hàng bạn đã thanh toán. iPhone: Cài đặt > Apple ID (tên bạn) > Đăng ký > Toffee > Hủy đăng ký. Android: Cửa hàng Play > Hồ sơ > Thanh toán và gói đăng ký > Gói đăng ký > Toffee > Hủy. Bạn cũng có thể vào từ Hồ sơ > Quản lý gói đăng ký trong Toffee. Cần hủy ít nhất 24 giờ trước khi kỳ hạn kết thúc để không bị tính phí kỳ sau. Xóa ứng dụng hay xóa tài khoản không tự động hủy gói đăng ký.',
        },
        {
          q: 'Tôi có được hoàn tiền không?',
          a: 'Bạn có thể yêu cầu hoàn tiền toàn bộ trong vòng 7 ngày sau khi thanh toán (kể cả tự động gia hạn). Thanh toán qua App Store hãy yêu cầu tại trang hoàn tiền của Apple (reportaproblem.apple.com); thanh toán qua Google Play hãy yêu cầu qua Google Play hoặc bộ phận hỗ trợ của Toffee. Ngoài ra, nếu nghệ sĩ không gửi tin nhắn nào trong kỳ đã thanh toán, hoặc nghệ sĩ ngừng hoạt động trong vòng 14 ngày sau khi bạn thanh toán, bạn có thể yêu cầu hoàn tiền trong Quản lý gói đăng ký. Tuy nhiên, các khoản thanh toán sau khi có thông báo dừng hoạt động và trước ngày dừng không được hoàn tiền do dừng hoạt động (vẫn áp dụng hoàn tiền trong 7 ngày).',
        },
        {
          q: 'Nếu đăng ký lại, tôi có xem được cuộc trò chuyện cũ không?',
          a: 'Không. Sau khi đăng ký lại, bạn chỉ thấy tin nhắn từ lúc đăng ký mới. Hãy lưu ảnh, giọng nói và video muốn giữ trước khi hủy.',
        },
        {
          q: 'Tôi đổi điện thoại hoặc cài lại ứng dụng.',
          a: 'Đăng nhập bằng cách như trước (Google, Apple, Kakao, Naver hoặc LINE) thì gói đăng ký vẫn còn. Nếu không thấy, hãy chạm Hồ sơ > Quản lý gói đăng ký > Khôi phục giao dịch khi đang đăng nhập tài khoản cửa hàng đã thanh toán.',
        },
        {
          q: 'Ứng dụng hiện "Vui lòng kiểm tra phương thức thanh toán".',
          a: 'Cửa hàng không tự động thu tiền được, ví dụ do thẻ hết hạn hoặc không đủ số dư. Bạn vẫn dùng bình thường trong thời gian gia hạn do cửa hàng quy định. Vào trang cửa hàng từ Quản lý gói đăng ký và đổi phương thức thanh toán, cửa hàng sẽ thu tiền lại và dòng nhắc này sẽ biến mất. Nếu đến hết thời gian gia hạn vẫn chưa thanh toán được, gói đăng ký sẽ kết thúc.',
        },
        {
          q: 'Ngày thanh toán tiếp theo khác với ngày bị trừ tiền thực tế.',
          a: 'Ngày thanh toán tiếp theo trong Quản lý gói đăng ký chỉ để tham khảo. Ngày và số tiền thực tế do cửa hàng quyết định, và có thể lệch khoảng một ngày tùy múi giờ. Hãy xem chi tiết chính xác trong lịch sử gói đăng ký hoặc lịch sử mua hàng của App Store hoặc Google Play.',
        },
        {
          q: 'Phí đăng ký có khác nhau giữa các quốc gia không?',
          a: 'Có. Bạn thanh toán theo giá và đơn vị tiền tệ của quốc gia mình do cửa hàng quy định. Số tiền có dấu "≈" trong danh sách của ứng dụng là số tiền quy đổi để tham khảo; số tiền thực tế là giá của cửa hàng hiển thị ở màn hình thanh toán.',
        },
        {
          q: 'Tôi đã chạm Khôi phục giao dịch mua nhưng không thấy gói đăng ký.',
          a: 'Điện thoại cần đăng nhập tài khoản cửa hàng (Apple ID hoặc tài khoản Google) đã dùng để thanh toán. Nếu là tài khoản cửa hàng khác thì sẽ không thấy lịch sử mua. Hãy kiểm tra thêm bạn đã đăng nhập đúng tài khoản Toffee (cùng cách đăng nhập) như lúc thanh toán. Nếu vẫn không được, hãy gửi yêu cầu tại Trung tâm trợ giúp kèm biên lai của cửa hàng.',
        },
      ],
    },
    {
      title: 'Gói đăng ký',
      items: [
        {
          q: 'Gói combo là gì?',
          a: 'Là gói đăng ký nhiều nghệ sĩ cùng lúc với giá rẻ hơn đăng ký riêng lẻ. Bạn có thể xem ở mục "Tiết kiệm với gói combo" trong trang hồ sơ của nghệ sĩ. Gói combo chỉ hủy được theo cả gói. Nếu mua gói combo có nghệ sĩ bạn đang đăng ký riêng, hãy hủy gói đăng ký riêng đó trong cửa hàng để tránh bị trừ tiền hai lần (cuộc trò chuyện vẫn tiếp tục như cũ).',
        },
        {
          q: 'Phòng CP là gì?',
          a: 'Là Toffee Room nơi hai nghệ sĩ cùng nhắn tin cho bạn. Bạn có thể đăng ký riêng, tách biệt với Toffee Room cá nhân của từng nghệ sĩ, hoặc đăng ký gói combo có kèm phòng CP. Bong bóng tin nhắn sẽ hiện ai là người gửi.',
        },
        {
          q: 'Tôi có đổi sang gói combo khác của cùng CP được không?',
          a: 'Được. Nếu bạn đang đăng ký một gói combo của CP đó, màn hình gói combo khác sẽ có nút [Đổi sang gói này]. Thanh toán được nối tiếp thành một, và thời điểm đổi sẽ được hiển thị trên màn hình trước khi bạn đổi. Cuộc trò chuyện ở các Toffee Room trùng nhau vẫn giữ nguyên.',
        },
        {
          q: 'Nếu nghệ sĩ ngừng hoạt động thì sao?',
          a: 'Sẽ không thể đăng ký mới, và fan đang đăng ký sẽ nhận được thông báo. Khi đã có ngày dự kiến ngừng hoạt động, ngày đó sẽ được hiển thị trước trên hồ sơ của nghệ sĩ. Nếu nghệ sĩ ngừng hoạt động trong vòng 14 ngày sau khi bạn thanh toán, bạn có thể yêu cầu hoàn tiền trong Quản lý gói đăng ký (xem "Tôi có được hoàn tiền không?").',
        },
        {
          q: 'Tôi có xem được mình đã đăng ký bao nhiêu ngày không?',
          a: 'Vào Hồ sơ > Quản lý gói đăng ký rồi chạm vào nghệ sĩ, bạn sẽ thấy ngày bắt đầu đăng ký và "ngày thứ N". Nếu hủy rồi đăng ký lại, số ngày sẽ được tính lại từ đầu.',
        },
      ],
    },
    {
      title: 'Toffee Room',
      items: [
        {
          q: 'Nghệ sĩ gửi tin nhắn thường xuyên không?',
          a: 'Nghệ sĩ tự viết tin nhắn nên tin đến không định kỳ tùy lịch của nghệ sĩ. Toffee không đảm bảo số lượng tin nhắn, nhưng nếu trong kỳ đã thanh toán không có tin nào, bạn có thể yêu cầu hoàn tiền.',
        },
        {
          q: 'Tôi muốn tìm tin nhắn cũ.',
          a: 'Chạm 🔍 ở góc trên bên phải Toffee Room để tìm tin nhắn trong Toffee Room đó. Ảnh và video đã nhận có thể xem tập trung ở ⋯ > Ảnh & video. Bạn chỉ tìm được tin nhắn từ khi bắt đầu gói đăng ký hiện tại.',
        },
        {
          q: '"Tin nhắn đã được thu hồi" là gì?',
          a: 'Là tin nhắn đã bị người gửi thu hồi: tin nhắn nghệ sĩ đã thu hồi, hoặc câu trả lời bạn đã tự thu hồi.',
        },
        {
          q: '"Tin nhắn này đã bị ẩn" là gì?',
          a: 'Nghĩa là câu trả lời của fan mà nghệ sĩ trích dẫn đã bị ẩn theo chính sách vận hành, ví dụ sau khi xem xét báo cáo.',
        },
        {
          q: 'Tin nhắn đến ngay khi tôi vừa đăng ký là gì?',
          a: 'Là tin nhắn chào mừng nghệ sĩ viết sẵn cho fan mới đăng ký. Tin này không được tính vào số tin nhắn nghệ sĩ thực sự gửi.',
        },
        {
          q: 'Làm sao để nhận lời chúc sinh nhật?',
          a: 'Bật "Nhận lời chúc sinh nhật" trong Hồ sơ. Vào ngày sinh nhật theo ngày sinh bạn nhập khi đăng ký, các nghệ sĩ đã chuẩn bị tin nhắn sinh nhật sẽ gửi lời chúc cho bạn. Nghệ sĩ không thấy ngày sinh của bạn.',
        },
      ],
    },
    {
      title: 'Trả lời',
      items: [
        {
          q: 'Tôi trả lời được bao nhiêu tin?',
          a: 'Tối đa 3 tin trả lời bằng chữ hoặc biểu tượng cảm xúc cho mỗi tin nhắn của nghệ sĩ. Số còn lại hiển thị phía trên ô nhập. Nếu nghệ sĩ trích dẫn tin trả lời của bạn, người đăng ký khác cũng thấy nội dung tin đó (nhưng không thấy biệt danh của bạn).',
        },
        {
          q: 'Tôi có xóa được câu trả lời đã gửi không?',
          a: 'Nhấn giữ câu trả lời của bạn và chọn "Thu hồi", tin đó sẽ đổi thành "Tin nhắn đã được thu hồi". Không giới hạn thời gian, nhưng thu hồi không trả lại lượt trả lời đã dùng.',
        },
        {
          q: 'Ai thấy câu trả lời của tôi?',
          a: 'Chỉ nghệ sĩ và công ty quản lý. Fan khác không thấy. Nếu nghệ sĩ trích dẫn câu trả lời của bạn để trả lời, người đăng ký khác cũng thấy nội dung câu trả lời đó nhưng không thấy biệt danh của bạn, và bạn sẽ nhận được thông báo "Đã trả lời tin nhắn của bạn".',
        },
        {
          q: 'Tôi không gửi được câu trả lời.',
          a: 'Hãy xem phía trên ô nhập để kiểm tra bạn đã dùng hết lượt trả lời chưa. Câu trả lời có từ ngữ bị cấm như lời lẽ thô tục hoặc rủ liên lạc bên ngoài sẽ không gửi được. Bạn cũng không gửi được nếu đang bị hạn chế sử dụng hoặc bị chặn trả lời trong Toffee Room đó.',
        },
      ],
    },
    {
      title: 'Ảnh & video',
      items: [
        {
          q: 'Tôi có được lưu ảnh và video đã nhận không?',
          a: 'Được, để lưu giữ cá nhân. Đăng hoặc chia sẻ lên mạng xã hội hay trang web khác, kể cả ảnh chụp màn hình, có thể bị hạn chế sử dụng và chịu trách nhiệm pháp lý.',
        },
        {
          q: 'Chụp màn hình thì hiện cảnh báo.',
          a: 'Tin nhắn, ảnh, video và hồ sơ của nghệ sĩ là nội dung dành cho người đăng ký nên khi chụp màn hình sẽ hiện thông báo nhắc. Ứng dụng không chặn chụp màn hình, nhưng nếu đăng hoặc chia sẻ nội dung đã chụp ra bên ngoài, bạn có thể bị hạn chế sử dụng.',
        },
        {
          q: 'Không mở được ảnh, video hoặc tin nhắn thoại.',
          a: 'Hãy kiểm tra kết nối internet và cập nhật ứng dụng lên phiên bản mới nhất. Nếu vẫn không mở được, hãy gửi yêu cầu tại Trung tâm trợ giúp kèm ảnh chụp màn hình.',
        },
      ],
    },
    {
      title: 'Báo cáo, hạn chế sử dụng và liên hệ',
      items: [
        {
          q: 'Tôi nhận được tin nhắn khó chịu hoặc lạ.',
          a: 'Nhấn giữ bong bóng tin nhắn và chọn "Báo cáo". Đội ngũ vận hành sẽ xem xét và xử lý. Nếu tài khoản nghệ sĩ có vẻ bị hack, bạn cũng hãy báo cáo.',
        },
        {
          q: 'Tài khoản của tôi bị hạn chế.',
          a: 'Nếu vi phạm chính sách vận hành, bạn có thể bị tạm ngừng sử dụng trong một thời gian hoặc bị hạn chế vĩnh viễn. Lý do và thời hạn sẽ được thông báo trong ứng dụng. Bạn có thể xem tiêu chí ở Hồ sơ > Chính sách vận hành. Nếu nghĩ mình bị hạn chế nhầm, hãy cho chúng tôi biết qua Trung tâm trợ giúp.',
        },
        {
          q: 'Tôi liên hệ hỗ trợ ở đâu?',
          a: 'Hãy gửi yêu cầu tại Hồ sơ > Trung tâm trợ giúp. ID tài khoản và phiên bản ứng dụng sẽ được thêm tự động, và bạn có thể đính kèm ảnh. Khi có câu trả lời, chúng tôi sẽ gửi thông báo cho bạn.',
        },
      ],
    },
  ],
  es: [
    {
      title: 'Cuenta',
      items: [
        {
          q: '¿Cómo me registro e inicio sesión?',
          a: 'Regístrate e inicia sesión con tu cuenta de Google, Apple, Kakao, Naver o LINE (los botones que ves dependen de tu país y dispositivo). Toffee no te pide crear una contraseña aparte. Solo pueden registrarse personas adultas (según la mayoría de edad de cada país).',
        },
        {
          q: 'Olvidé mi contraseña.',
          a: 'Toffee no tiene contraseña propia. Inicias sesión con una cuenta como Google o Apple. Si olvidaste la contraseña de esa cuenta, recupérala con esa empresa (Google, Apple, Kakao, Naver o LINE).',
        },
        {
          q: '¿Puedo cambiar mi cuenta de inicio de sesión (correo)?',
          a: 'No. No puedes cambiar el método de inicio de sesión ni el correo con los que te registraste. Si inicias sesión de otra forma, se crea una cuenta nueva y tus suscripciones no se trasladan. Puedes ver cómo te registraste en Perfil > Datos de inicio de sesión. La pantalla de inicio de sesión también muestra "Último usado" en el botón que usaste por última vez.',
        },
        {
          q: '¿Puedo usar Toffee en varios dispositivos?',
          a: 'Sí. Inicia sesión de la misma forma y podrás usarlo en tu teléfono, tableta y en la web desde un PC. Las notificaciones llegan a todas las apps en las que hayas iniciado sesión. Si pierdes un dispositivo, toca Perfil > Cerrar sesión en todos los dispositivos.',
        },
        {
          q: '¿Cómo cierro sesión?',
          a: 'Toca "Cerrar sesión" al final de Perfil. Tus suscripciones siguen igual. Vuelve a iniciar sesión de la misma forma para seguir donde lo dejaste.',
        },
        {
          q: 'Quiero eliminar mi cuenta.',
          a: 'Puedes hacerlo desde "Eliminar cuenta" al final de Perfil. Eliminar tu cuenta no cancela las suscripciones de la tienda, así que cancélalas primero en la tienda. Después de eliminar tu cuenta, no se pueden recuperar tus chats ni tu historial de suscripciones.',
        },
        {
          q: 'Introduje mal mi fecha de nacimiento.',
          a: 'Tu fecha de nacimiento sirve para confirmar que eres adulto, así que no puedes cambiarla en la app. Envíanos una consulta desde Perfil > Centro de ayuda.',
        },
      ],
    },
    {
      title: 'Ajustes',
      items: [
        {
          q: '¿Cómo cambio mi apodo?',
          a: 'Toca "Cambiar apodo" en Perfil. Durante las 24 horas siguientes al registro puedes cambiarlo todas las veces que quieras. Después, puedes cambiarlo una vez cada 7 días. Los artistas solo ven tu apodo, no el nombre de tu cuenta de inicio de sesión.',
        },
        {
          q: '¿Quién puede ver mi foto de perfil y mi mensaje de estado?',
          a: 'Otros fans no pueden verlos. Solo los ven el artista y la agencia cuando leen tus respuestas. Toca tu perfil en Perfil para cambiarlos.',
        },
        {
          q: 'Quiero cambiar el idioma de la app.',
          a: 'Al principio la app usa el idioma de tu teléfono. Puedes cambiarlo en Perfil > Idioma. Los mensajes de los artistas se traducen automáticamente al idioma de la app y se muestran debajo del original. Puedes desactivarlo en "Traducir mensajes automáticamente", en la misma pantalla. La traducción es automática, así que puede diferir un poco del original.',
        },
        {
          q: '¿Hay modo oscuro?',
          a: 'Sí. En Perfil > Apariencia, elige Usar el ajuste del dispositivo, Claro u Oscuro.',
        },
      ],
    },
    {
      title: 'Notificaciones',
      items: [
        {
          q: 'No me llegan las notificaciones de mensajes nuevos.',
          a: 'Comprueba que las notificaciones estén permitidas en Ajustes del dispositivo > Notificaciones > Toffee, y que las notificaciones de ese artista estén activadas en el menú ⋯ de la esquina superior derecha de la Toffee Room. Si tu teléfono tiene activado el ahorro de batería o el modo concentración, las notificaciones pueden llegar tarde o no llegar. En la web desde un PC no llegan notificaciones.',
        },
        {
          q: '¿Puedo desactivar las notificaciones de un solo artista?',
          a: 'Sí. En la Toffee Room de ese artista, toca ⋯ arriba a la derecha > Silenciar notificaciones. Seguirás recibiendo los mensajes, solo que sin notificaciones. Aparece una marca 🔕 junto a ella en tu lista de Toffee Rooms.',
        },
        {
          q: '¿Dónde veo los avisos?',
          a: 'En Perfil > Avisos. Cuando se publica un aviso nuevo, aparece una marca N en la pestaña Perfil. Los avisos importantes, como el mantenimiento del servicio, también se envían como notificación.',
        },
      ],
    },
    {
      title: 'Pagos, cancelación y reembolsos',
      items: [
        {
          q: '¿Cómo cancelo mi suscripción?',
          a: 'Cancélala en la tienda con la que pagaste. iPhone: Ajustes > Apple ID (tu nombre) > Suscripciones > Toffee > Cancelar suscripción. Android: Play Store > Perfil > Pagos y suscripciones > Suscripciones > Toffee > Cancelar suscripción. También puedes ir desde Perfil > Gestionar suscripciones en Toffee. Cancela al menos 24 horas antes de que termine el periodo para evitar el siguiente cobro. Borrar la app o tu cuenta no cancela la suscripción.',
        },
        {
          q: '¿Puedo pedir un reembolso?',
          a: 'Puedes pedir el reembolso completo dentro de los 7 días posteriores a un pago (incluidas las renovaciones automáticas). Para pagos en App Store, usa la página de reembolsos de Apple (reportaproblem.apple.com); para pagos en Google Play, usa Google Play o el soporte de Toffee. También puedes pedir un reembolso en Gestionar suscripciones si el artista no envió ningún mensaje durante el periodo pagado, o si el artista terminó su actividad en los 14 días posteriores a tu pago. Sin embargo, los pagos realizados después del aviso de fin de actividad y antes de la fecha de fin no tienen ese reembolso (el reembolso de 7 días sigue aplicando).',
        },
        {
          q: 'Si me vuelvo a suscribir, ¿puedo ver mi conversación anterior?',
          a: 'No. Al volver a suscribirte solo verás los mensajes desde el inicio de la nueva suscripción. Guarda las fotos, audios o videos que quieras conservar antes de cancelar.',
        },
        {
          q: 'Cambié de teléfono o reinstalé la app.',
          a: 'Inicia sesión igual que antes (Google, Apple, Kakao, Naver o LINE) y tus suscripciones seguirán ahí. Si no aparecen, toca Perfil > Gestionar suscripciones > Restaurar compras con la sesión iniciada en la cuenta de la tienda con la que pagaste.',
        },
        {
          q: 'Aparece "Revisa tu método de pago".',
          a: 'El pago automático de la tienda falló, por ejemplo porque tu tarjeta venció o no tenía saldo suficiente. Puedes seguir usando Toffee durante el periodo de gracia que fija la tienda. Ve de Gestionar suscripciones a la pantalla de la tienda y cambia tu método de pago. La tienda volverá a cobrar y el aviso desaparecerá. Si el pago no se completa antes de que termine el periodo de gracia, tu suscripción termina.',
        },
        {
          q: 'La fecha del próximo cobro no coincide con la fecha real del cargo.',
          a: 'La fecha del próximo cobro que ves en Gestionar suscripciones es solo de referencia. La tienda fija la fecha y el importe reales, y pueden variar alrededor de un día según la zona horaria. Para ver los datos exactos, revisa tus suscripciones e historial de compras en App Store o Google Play.',
        },
        {
          q: '¿El precio cambia según el país?',
          a: 'Sí. Pagas el precio que fija la tienda para tu país, en tu moneda local. Los importes que aparecen con "≈" en la app son una conversión solo de referencia. El importe real es el precio de la tienda que aparece en la pantalla de pago.',
        },
        {
          q: 'Toqué Restaurar compras, pero no aparece mi suscripción.',
          a: 'Tu teléfono debe tener la sesión iniciada en la cuenta de la tienda con la que pagaste (Apple ID o cuenta de Google). Con otra cuenta de la tienda, tus compras no aparecen. Comprueba también que iniciaste sesión en la misma cuenta de Toffee con la que pagaste (mismo método de inicio de sesión). Si sigue sin funcionar, envíanos una consulta con el recibo de la tienda adjunto.',
        },
      ],
    },
    {
      title: 'Suscripciones',
      items: [
        {
          q: '¿Qué es una suscripción a paquete?',
          a: 'Te permite suscribirte a varios artistas juntos por menos de lo que costaría suscribirte a cada uno por separado. La encontrarás en "Ahorra con un paquete", en el perfil del artista. Un paquete solo se puede cancelar completo. Si compras un paquete que incluye a un artista al que ya estás suscrito por separado, cancela esa suscripción individual en la tienda para no pagar dos veces (tu chat sigue como está).',
        },
        {
          q: '¿Qué es una CP Toffee Room?',
          a: 'Es una Toffee Room en la que dos artistas envían mensajes juntos. Puedes suscribirte a ella por separado de la Toffee Room de cada artista, o con un paquete que incluya la CP. Cada burbuja de mensaje muestra quién lo envió.',
        },
        {
          q: '¿Puedo cambiar a otro paquete de la misma CP?',
          a: 'Sí. Si tienes un paquete de la misma CP, en los otros paquetes aparece [Cambiar a este paquete]. El pago sigue siendo uno solo, y la pantalla te indica cuándo se hará el cambio antes de confirmar. Los chats de las Toffee Rooms que están en ambos paquetes siguen como están.',
        },
        {
          q: '¿Qué pasa cuando un artista termina su actividad?',
          a: 'Ya no es posible suscribirse, y los suscriptores actuales reciben una notificación. Cuando se fija una fecha de fin, se muestra con antelación en el perfil. Si la actividad terminó en los 14 días posteriores a tu pago, puedes pedir un reembolso en Gestionar suscripciones (consulta "¿Puedo pedir un reembolso?").',
        },
        {
          q: '¿Puedo ver cuánto tiempo llevo suscrito?',
          a: 'En Perfil > Gestionar suscripciones, toca un artista para ver la fecha de inicio y "día N". Si cancelas y te vuelves a suscribir, la cuenta empieza de nuevo.',
        },
      ],
    },
    {
      title: 'Toffee Room',
      items: [
        {
          q: '¿Con qué frecuencia envían mensajes los artistas?',
          a: 'Los artistas escriben sus propios mensajes, así que llegan de forma irregular según su agenda. Toffee no garantiza un número de mensajes, pero si no hubo ninguno durante un periodo pagado puedes pedir un reembolso.',
        },
        {
          q: 'Quiero encontrar un mensaje antiguo.',
          a: 'Toca 🔍 arriba a la derecha de la Toffee Room para buscar mensajes en esa Toffee Room. Para ver de un vistazo todas las fotos y videos que recibiste, ve a ⋯ > Fotos y videos. Solo puedes encontrar mensajes posteriores al inicio de tu suscripción actual.',
        },
        {
          q: '¿Qué significa "Este mensaje fue retirado"?',
          a: 'La persona que lo envió retiró el mensaje. Puede que lo haya retirado el artista, o que sea una respuesta tuya que retiraste.',
        },
        {
          q: '¿Qué significa "Este mensaje está oculto"?',
          a: 'Una respuesta de un fan que el artista citó se ocultó según nuestra política de uso, por ejemplo tras revisar un reporte.',
        },
        {
          q: '¿Qué es el mensaje que recibí justo al suscribirme?',
          a: 'Es un mensaje de bienvenida que el artista escribió de antemano para quienes se suscriben. No cuenta en el número de mensajes que el artista ha enviado realmente.',
        },
        {
          q: '¿Cómo recibo un mensaje de cumpleaños?',
          a: 'Activa "Mensajes de cumpleaños" en Perfil. En la fecha de nacimiento que indicaste al registrarte, los artistas que hayan preparado un mensaje de cumpleaños te lo enviarán. Los artistas no pueden ver tu fecha de nacimiento.',
        },
      ],
    },
    {
      title: 'Respuestas',
      items: [
        {
          q: '¿Cuántas respuestas puedo enviar?',
          a: 'Hasta 3 respuestas de texto o emoji por cada mensaje del artista. Las que te quedan se muestran encima del cuadro de texto. Si el artista cita tu respuesta, otros suscriptores podrán ver lo que escribiste (pero no tu apodo).',
        },
        {
          q: '¿Puedo borrar una respuesta que envié?',
          a: 'Mantén pulsada tu respuesta y toca "Retirar". Cambiará a "Este mensaje fue retirado". No hay límite de tiempo, pero retirarla no te devuelve la respuesta que usaste.',
        },
        {
          q: '¿Quién puede ver mis respuestas?',
          a: 'Solo el artista y la agencia. Otros fans no pueden verlas. Si el artista cita tu respuesta al contestar, otros suscriptores podrán ver lo que escribiste, pero no tu apodo. Recibirás la notificación "Respondió a tu mensaje".',
        },
        {
          q: 'Mi respuesta no se envía.',
          a: 'Revisa encima del cuadro de texto si ya usaste todas las respuestas que te quedan. Las respuestas con contenido prohibido, como insultos o pedir contacto fuera de la app, no se envían. Tampoco puedes enviar respuestas si tu cuenta está restringida o si las respuestas están bloqueadas en esa Toffee Room.',
        },
      ],
    },
    {
      title: 'Fotos y videos',
      items: [
        {
          q: '¿Puedo guardar las fotos y videos que recibo?',
          a: 'Sí, para uso personal. Publicarlos o compartirlos en redes sociales u otros sitios, incluidas capturas de pantalla, puede conllevar restricciones y responsabilidad legal.',
        },
        {
          q: 'Aparece un aviso cuando hago una captura de pantalla.',
          a: 'Los mensajes, fotos, videos y perfiles de los artistas son contenido para suscriptores, por eso aparece un aviso al hacer una captura. Las capturas no se bloquean, pero publicarlas o compartirlas fuera de la app puede conllevar restricciones.',
        },
        {
          q: 'No se abren las fotos, los videos o los audios.',
          a: 'Comprueba tu conexión a internet y actualiza la app a la última versión. Si siguen sin abrirse, envíanos una consulta con una captura de pantalla adjunta.',
        },
      ],
    },
    {
      title: 'Reportes, restricciones y soporte',
      items: [
        {
          q: 'Recibí un mensaje molesto o extraño.',
          a: 'Mantén pulsada la burbuja del mensaje y toca "Reportar". Nuestro equipo lo revisará y lo gestionará. Repórtalo también si parece que la cuenta de un artista fue hackeada.',
        },
        {
          q: 'Mi cuenta está restringida.',
          a: 'Si incumples nuestra Política de uso, podemos suspender tu cuenta durante un tiempo o restringirla de forma permanente. La app muestra el motivo y la duración. Puedes leer las normas en Perfil > Política de uso. Si crees que la restricción es un error, avísanos con una consulta.',
        },
        {
          q: '¿Cómo contacto con soporte?',
          a: 'Envía una consulta desde Perfil > Centro de ayuda. Tu número de miembro y la versión de la app se añaden automáticamente, y puedes adjuntar fotos. Te avisaremos con una notificación cuando respondamos.',
        },
      ],
    },
  ],
  'pt-BR': [
    {
      title: 'Conta',
      items: [
        {
          q: 'Como faço cadastro e login?',
          a: 'Cadastre-se e entre com sua conta Google, Apple, Kakao, Naver ou LINE (os botões que aparecem dependem do seu país e aparelho). A Toffee não pede para você criar uma senha separada. Só adultos podem se cadastrar (conforme a maioridade de cada país).',
        },
        {
          q: 'Esqueci minha senha.',
          a: 'A Toffee não tem senha própria. Você entra com uma conta como Google ou Apple. Se esqueceu a senha dessa conta, recupere-a com a empresa (Google, Apple, Kakao, Naver ou LINE).',
        },
        {
          q: 'Posso mudar minha conta de login (e-mail)?',
          a: 'Não. Não é possível mudar o método de login nem o e-mail usados no cadastro. Se você entrar de outro jeito, uma conta nova é criada e suas assinaturas não são transferidas. Você pode ver como se cadastrou em Perfil > Dados de login. A tela de login também mostra "Último usado" no botão que você usou por último.',
        },
        {
          q: 'Posso usar a Toffee em mais de um aparelho?',
          a: 'Sim. Entre do mesmo jeito e você pode usar no celular, no tablet e na web pelo PC. As notificações vão para todos os apps em que você estiver conectado. Se perder um aparelho, toque em Perfil > Sair de todos os dispositivos.',
        },
        {
          q: 'Como saio da conta?',
          a: 'Toque em "Sair" no fim do Perfil. Suas assinaturas continuam como estão. Entre do mesmo jeito de novo para continuar de onde parou.',
        },
        {
          q: 'Quero excluir minha conta.',
          a: 'Você pode fazer isso em "Excluir conta", no fim do Perfil. Excluir a conta não cancela as assinaturas da loja, então cancele-as na loja primeiro. Depois de excluir a conta, não é possível recuperar suas conversas nem seu histórico de assinaturas.',
        },
        {
          q: 'Informei a data de nascimento errada.',
          a: 'A data de nascimento é usada para confirmar que você é adulto, então não dá para mudá-la no app. Envie uma solicitação por Perfil > Central de ajuda.',
        },
      ],
    },
    {
      title: 'Configurações',
      items: [
        {
          q: 'Como mudo meu apelido?',
          a: 'Toque em "Alterar apelido" no Perfil. Nas 24 horas depois do cadastro, você pode mudar quantas vezes quiser. Depois disso, pode mudar uma vez a cada 7 dias. Os artistas só veem seu apelido, não o nome da sua conta de login.',
        },
        {
          q: 'Quem vê minha foto do perfil e minha mensagem de status?',
          a: 'Outros fãs não veem. Só o artista e a agência veem quando leem suas respostas. Toque no seu perfil no Perfil para alterá-las.',
        },
        {
          q: 'Quero mudar o idioma do app.',
          a: 'No início, o app usa o idioma do seu celular. Você pode mudar em Perfil > Idioma. As mensagens dos artistas são traduzidas automaticamente para o idioma do app e aparecem abaixo do original. Você pode desativar isso em "Traduzir mensagens automaticamente", na mesma tela. A tradução é automática, então pode ficar um pouco diferente do original.',
        },
        {
          q: 'Tem modo escuro?',
          a: 'Sim. Em Perfil > Aparência, escolha Usar a configuração do aparelho, Claro ou Escuro.',
        },
      ],
    },
    {
      title: 'Notificações',
      items: [
        {
          q: 'Não estou recebendo notificações de novas mensagens.',
          a: 'Verifique se as notificações estão permitidas em Ajustes do aparelho > Notificações > Toffee e se as notificações desse artista estão ativadas no menu ⋯ no canto superior direito da Toffee Room. Se o modo de economia de bateria ou o modo foco do celular estiver ativado, as notificações podem atrasar ou não chegar. Na web pelo PC não chegam notificações.',
        },
        {
          q: 'Posso desativar as notificações de um artista só?',
          a: 'Sim. Na Toffee Room desse artista, toque em ⋯ no canto superior direito > Silenciar notificações. Você continua recebendo as mensagens, só que sem notificações. Uma marca 🔕 aparece ao lado dela na sua lista de Toffee Rooms.',
        },
        {
          q: 'Onde vejo os avisos?',
          a: 'Em Perfil > Avisos. Quando um aviso novo é publicado, aparece uma marca N na aba Perfil. Avisos importantes, como manutenção do serviço, também são enviados como notificação.',
        },
      ],
    },
    {
      title: 'Pagamento, cancelamento e reembolso',
      items: [
        {
          q: 'Como cancelo minha assinatura?',
          a: 'Cancele na loja em que você pagou. iPhone: Ajustes > Apple ID (seu nome) > Assinaturas > Toffee > Cancelar Assinatura. Android: Play Store > Perfil > Pagamentos e assinaturas > Assinaturas > Toffee > Cancelar assinatura. Você também pode ir por Perfil > Gerenciar assinaturas na Toffee. Cancele pelo menos 24 horas antes do fim do período para evitar a próxima cobrança. Apagar o app ou excluir a conta não cancela a assinatura.',
        },
        {
          q: 'Posso pedir reembolso?',
          a: 'Você pode pedir o reembolso total em até 7 dias após um pagamento (incluindo renovações automáticas). Para pagamentos na App Store, use a página de reembolso da Apple (reportaproblem.apple.com); para pagamentos no Google Play, use o Google Play ou o suporte da Toffee. Você também pode pedir reembolso em Gerenciar assinaturas se o artista não enviou nenhuma mensagem durante o período pago, ou se o artista encerrou as atividades em até 14 dias após o seu pagamento. Porém, pagamentos feitos depois do aviso de encerramento e antes da data final não têm esse reembolso (o reembolso de 7 dias continua valendo).',
        },
        {
          q: 'Se eu assinar de novo, consigo ver a conversa antiga?',
          a: 'Não. Ao assinar de novo, você só vê as mensagens a partir do início da nova assinatura. Salve as fotos, áudios ou vídeos que quiser guardar antes de cancelar.',
        },
        {
          q: 'Troquei de celular ou reinstalei o app.',
          a: 'Entre do mesmo jeito que antes (Google, Apple, Kakao, Naver ou LINE) e suas assinaturas continuarão lá. Se não aparecerem, toque em Perfil > Gerenciar assinaturas > Restaurar compras com a conta da loja em que você pagou conectada.',
        },
        {
          q: 'Aparece "Verifique sua forma de pagamento".',
          a: 'O pagamento automático da loja falhou, por exemplo porque o cartão venceu ou não havia saldo suficiente. Você pode continuar usando a Toffee durante o período de carência definido pela loja. Vá de Gerenciar assinaturas para a tela da loja e troque a forma de pagamento. A loja vai cobrar de novo e o aviso vai sumir. Se o pagamento não for concluído até o fim do período de carência, a assinatura termina.',
        },
        {
          q: 'A data da próxima cobrança é diferente da data real.',
          a: 'A data da próxima cobrança em Gerenciar assinaturas é só uma referência. A loja define a data e o valor reais, e pode haver cerca de um dia de diferença por causa do fuso horário. Para ver os detalhes exatos, confira suas assinaturas e o histórico de compras na App Store ou no Google Play.',
        },
        {
          q: 'O preço muda conforme o país?',
          a: 'Sim. Você paga o preço definido pela loja para o seu país, na sua moeda local. Os valores com "≈" no app são conversões só para referência. O valor real é o preço da loja mostrado na tela de pagamento.',
        },
        {
          q: 'Toquei em Restaurar compras, mas a assinatura não aparece.',
          a: 'Seu celular precisa estar conectado à conta da loja em que você pagou (Apple ID ou conta Google). Com outra conta da loja, suas compras não aparecem. Verifique também se você entrou na mesma conta da Toffee usada no pagamento (mesmo método de login). Se ainda não funcionar, envie uma solicitação com o recibo da loja anexado.',
        },
      ],
    },
    {
      title: 'Assinaturas',
      items: [
        {
          q: 'O que é uma assinatura de pacote?',
          a: 'Ela permite assinar vários artistas juntos por menos do que assinar cada um separadamente. Você encontra em "Economize com um pacote", no perfil do artista. Um pacote só pode ser cancelado inteiro. Se você comprar um pacote com um artista que já assina separadamente, cancele essa assinatura individual na loja para não pagar duas vezes (sua conversa continua como está).',
        },
        {
          q: 'O que é uma CP Toffee Room?',
          a: 'É uma Toffee Room em que dois artistas mandam mensagens juntos. Você pode assiná-la separadamente da Toffee Room de cada artista, ou em um pacote que inclua a CP. Cada balão de mensagem mostra quem enviou.',
        },
        {
          q: 'Posso mudar para outro pacote da mesma CP?',
          a: 'Sim. Se você assina um pacote da mesma CP, os outros pacotes mostram [Mudar para este pacote]. O pagamento continua sendo um só, e a tela mostra quando a mudança acontece antes de você confirmar. As conversas das Toffee Rooms que estão nos dois pacotes continuam como estão.',
        },
        {
          q: 'O que acontece quando um artista encerra as atividades?',
          a: 'Não é mais possível fazer novas assinaturas, e quem já assina recebe uma notificação. Quando uma data de encerramento é definida, ela aparece no perfil com antecedência. Se as atividades terminaram em até 14 dias após o seu pagamento, você pode pedir reembolso em Gerenciar assinaturas (veja "Posso pedir reembolso?").',
        },
        {
          q: 'Posso ver há quanto tempo sou assinante?',
          a: 'Em Perfil > Gerenciar assinaturas, toque em um artista para ver a data de início e "dia N". Se você cancelar e assinar de novo, a contagem recomeça.',
        },
      ],
    },
    {
      title: 'Toffee Room',
      items: [
        {
          q: 'Com que frequência os artistas mandam mensagens?',
          a: 'Os próprios artistas escrevem as mensagens, então elas chegam de forma irregular, conforme a agenda deles. A Toffee não garante um número de mensagens, mas, se não houver nenhuma durante um período pago, você pode pedir reembolso.',
        },
        {
          q: 'Quero encontrar uma mensagem antiga.',
          a: 'Toque em 🔍 no canto superior direito da Toffee Room para pesquisar mensagens nessa Toffee Room. Para ver de uma vez todas as fotos e vídeos que você recebeu, vá em ⋯ > Fotos e vídeos. Só é possível encontrar mensagens de depois do início da sua assinatura atual.',
        },
        {
          q: 'O que significa "Esta mensagem foi retirada"?',
          a: 'Quem enviou a mensagem a retirou. Ou o artista a retirou, ou é uma resposta sua que você retirou.',
        },
        {
          q: 'O que significa "Esta mensagem está oculta"?',
          a: 'Uma resposta de fã citada pelo artista foi ocultada de acordo com a nossa Política de uso, por exemplo depois da análise de uma denúncia.',
        },
        {
          q: 'Que mensagem foi aquela que chegou logo depois que assinei?',
          a: 'É uma mensagem de boas-vindas que o artista escreveu antes para quem assina. Ela não conta no número de mensagens que o artista realmente enviou.',
        },
        {
          q: 'Como recebo uma mensagem de aniversário?',
          a: 'Ative "Mensagens de aniversário" no Perfil. Na data de nascimento que você informou no cadastro, os artistas que prepararam uma mensagem de aniversário vão enviá-la para você. Os artistas não veem sua data de nascimento.',
        },
      ],
    },
    {
      title: 'Respostas',
      items: [
        {
          q: 'Quantas respostas posso enviar?',
          a: 'Até 3 respostas em texto ou emoji para cada mensagem do artista. O número restante aparece acima da caixa de texto. Se o artista citar sua resposta, outros assinantes poderão ver o que você escreveu (mas não o seu apelido).',
        },
        {
          q: 'Posso apagar uma resposta que enviei?',
          a: 'Toque e segure sua resposta e toque em "Retirar". Ela muda para "Esta mensagem foi retirada". Não há limite de tempo, mas retirar não devolve a resposta que você usou.',
        },
        {
          q: 'Quem vê minhas respostas?',
          a: 'Só o artista e a agência. Outros fãs não veem. Se o artista citar sua resposta ao responder, outros assinantes poderão ver o que você escreveu, mas não o seu apelido. Você vai receber a notificação "Respondeu à sua mensagem".',
        },
        {
          q: 'Minha resposta não é enviada.',
          a: 'Veja acima da caixa de texto se você já usou todas as respostas restantes. Respostas com conteúdo proibido, como palavrões ou pedidos de contato fora do app, não são enviadas. Você também não pode enviar respostas se sua conta estiver restrita ou se as respostas estiverem bloqueadas nessa Toffee Room.',
        },
      ],
    },
    {
      title: 'Fotos e vídeos',
      items: [
        {
          q: 'Posso salvar as fotos e os vídeos que recebo?',
          a: 'Sim, para uso pessoal. Postar ou compartilhar em redes sociais ou outros sites, incluindo capturas de tela, pode gerar restrições e responsabilidade legal.',
        },
        {
          q: 'Aparece um aviso quando faço uma captura de tela.',
          a: 'As mensagens, fotos, vídeos e perfis dos artistas são conteúdo para assinantes, por isso aparece um aviso quando você faz uma captura. As capturas não são bloqueadas, mas postá-las ou compartilhá-las fora do app pode gerar restrições.',
        },
        {
          q: 'Fotos, vídeos ou áudios não abrem.',
          a: 'Verifique sua conexão com a internet e atualize o app para a versão mais recente. Se ainda não abrirem, envie uma solicitação com uma captura de tela anexada.',
        },
      ],
    },
    {
      title: 'Denúncias, restrições e suporte',
      items: [
        {
          q: 'Recebi uma mensagem desagradável ou estranha.',
          a: 'Toque e segure o balão da mensagem e toque em "Denunciar". Nossa equipe vai analisar e resolver. Denuncie também se a conta de um artista parecer ter sido hackeada.',
        },
        {
          q: 'Minha conta foi restrita.',
          a: 'Se você descumprir nossa Política de uso, podemos suspender sua conta por um período ou restringi-la permanentemente. O app mostra o motivo e a duração. Você pode ler as regras em Perfil > Política de uso. Se achar que a restrição foi um erro, avise a gente por uma solicitação.',
        },
        {
          q: 'Como entro em contato com o suporte?',
          a: 'Envie uma solicitação por Perfil > Central de ajuda. Seu número de membro e a versão do app são adicionados automaticamente, e você pode anexar fotos. Vamos avisar por notificação quando respondermos.',
        },
      ],
    },
  ],
};
