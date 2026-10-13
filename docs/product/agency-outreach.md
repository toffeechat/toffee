# 태국 소속사 연락 자료 — 메일 초안·제안서

2026-10-13 작성. 사업화 일정 2단계("영문 제안서", "연락할 곳 목록")와 3단계("소속사 의견 듣기")에서 쓸 자료다.
일정·순서는 [`launch-roadmap.md`](./launch-roadmap.md), 정산 조건 배경은 [`feature-decisions.md`](./feature-decisions.md)
"소속사 계약/정산 조건"과 `STATUS.md` "출시 전 확정할 정책" 표.

- **제안서(슬라이드 9장, 영어 + 태국어 요약 1장)**: https://claude.ai/artifact/8cC6F5tRwug6QgkHSsEmoy
  — 페이지에서 PDF로 내려받아 메일에 첨부한다. 링크는 본인만 열리므로 링크로 보낼 땐 공유 메뉴에서 먼저 공유할 것.
- 아래 메일은 **영어가 기준**, 태국어는 같은 내용을 옮긴 것. 태국어는 보내기 전에 원어민 검수를 받는다(사업 내용 없이 문장만 맡김 — `launch-roadmap.md` "현지 조언" 절).
- `[ ]` 대괄호는 보내기 전에 채울 자리.

---

## 보내기 전 체크리스트

순서가 중요하다 — 데모가 덜 된 상태로 보내면 첫인상을 되돌릴 수 없다.

1. **데모가 끝까지 되는지** — 지금 실기기 테스트에서 사진·음성·영상 보내기가 실패하는 건 데모 서버 파일 저장소(R2) 미연결 때문
   (`STATUS.md`). 이게 연결되고, 팬 → 아티스트 → 소속사 화면을 데모 주소에서 한 바퀴 돌려 본 뒤에 보낸다.
2. **체험용 계정은 소속사마다 따로 만들 필요 없음** — 데모 데이터는 전부 가상이라 모든 소속사가 같은 데모 계정 3개(팬 `fan1@toffee.demo`,
   아티스트 `caramel-self@toffee.demo`, 소속사 `staff@toffee.demo`)와 같은 입장 코드를 쓴다. **단, 지금 입장 코드는 이메일만 바꾸면
   운영자 계정(`admin@toffee.demo`)으로도 들어가져서**, 받은 사람이 "데모 초기화"로 데이터를 지우거나 역할을 바꿀 수 있다 → 외부에
   코드를 주기 전에 데모 서버에서 운영자 로그인을 막아야 한다(2026-10-13 확인, 미반영). 소속사가 데모를 만져서 생긴 메시지는 다른
   소속사에게도 보이므로, 연락이 몰리는 주간엔 운영자 화면 "데모 초기화"로 가끔 되돌린다.
3. **조건은 1차 5곳 반응으로 검증** — 사전 자문은 하지 않기로 함(2026-10-13, 아이디어 노출 우려). 그래서 1차는 5곳만 보내고,
   답장·질문에서 조건(70:30·무료·비독점·3개월)에 대한 반응을 모아 2차 전에 제안서 6장과 메일을 고친다.
4. **보내는 주소** — `@toffeechat.app` 주소로 **보낼 수 있으면** 새로 만들 필요 없다(2026-10-13 사용자 확인: 회사 메일 이미 있음).
   `partners@`는 꼭 필요하진 않고, 나중에 문의 메일과 제안 메일을 나눠 보고 싶을 때 Cloudflare 전달 규칙 하나만 추가하면 된다(무료,
   새 계정 아님). 개인 Gmail 주소로 보내는 것만 피한다(스팸·신뢰도). 제안서·메일의 `[name]@toffeechat.app` 칸은 실제 쓰는 주소로 채운다.
5. **회사 표기** — 법인 전이라 "Co., Ltd."·"주식회사"를 쓰지 않는다. 서명은 "Toffee Team" + 이름.
6. 가격 칸 `฿[__]` — 벤치마킹 중인 버블의 태국 앱스토어 가격을 보고 채운다(데모의 예시 가격은 ฿99~129).

---

## 메일 1. 첫 연락 (영어)

**제목**: Partnership idea for [Artist name]: a paid 1:1 fan messaging app in Thai

> Dear [Name / Team at Agency name],
>
> My name is [Your name], and I am building **Toffee**, a subscription app where Thai artists send messages, photos,
> voice notes and videos to their fans in a private, chat-style room. It is the same kind of service as Bubble in
> Korea, built for Thai artists and Thai fans.
>
> I am reaching out because [one specific sentence: e.g. "the way [Artist] talks with fans on X/IG shows how close
> their fandom is" / "your artists have strong international fan bases"]. I believe your artists could open a new,
> monthly source of income with Toffee.
>
> **We are looking for a few agencies for a 3-month pilot:**
> - No cost and no exclusivity for your agency
> - Revenue share: 70% to your agency, 30% to Toffee (after app store fees)
> - We handle the app, payments, translation, fan support and moderation
> - Your team can see every message and statistic in an agency console
>
> The app is already working. You can try it yourself in about 10 minutes:
> **demo.toffeechat.app** (access code: [demo code]). A short proposal is attached.
>
> Would you be open to a 30-minute online call in the next two weeks? I am happy to adjust the terms to fit your
> artists.
>
> Best regards,
> [Your name]
> Toffee Team · toffeechat.app
> [name]@toffeechat.app · LINE: [ID]

**한국어 뜻(참고용)**: 토피 소개(태국 아티스트가 팬에게 메시지·사진·음성·영상을 보내는 구독 앱, 한국 버블 같은 서비스) →
왜 이 소속사에 연락했는지 한 문장(**반드시 소속사마다 다르게** — 복붙 메일은 바로 티 난다) → 3개월 파일럿 조건 4줄 →
데모 주소·제안서 첨부 → 2주 안에 30분 화상 통화 가능한지.

## 메일 1. 첫 연락 (태국어)

**제목**: ข้อเสนอความร่วมมือสำหรับ [ชื่อศิลปิน]: แอปแชทกับแฟนคลับแบบสมัครสมาชิก

> เรียน [ชื่อ / ทีมงาน ชื่อต้นสังกัด]
>
> ผม/ดิฉันชื่อ [ชื่อ] จากทีม **Toffee** แอปสมัครสมาชิกรายเดือนที่ศิลปินไทยสามารถส่งข้อความ รูปภาพ เสียง และวิดีโอ
> ถึงแฟนคลับได้ในห้องแชทส่วนตัว คล้ายกับแอป Bubble ของเกาหลี แต่ออกแบบมาเพื่อศิลปินและแฟนคลับชาวไทยโดยเฉพาะ
>
> ที่ติดต่อมาเพราะ [เหตุผลเฉพาะของต้นสังกัดนี้ 1 ประโยค] และเชื่อว่า Toffee จะช่วยสร้างรายได้รายเดือนใหม่ให้กับศิลปินของท่าน
>
> **ตอนนี้เรากำลังมองหาต้นสังกัดจำนวนหนึ่งเพื่อทดลองใช้งาน 3 เดือน**
> - ไม่มีค่าใช้จ่ายและไม่มีสัญญาผูกขาด
> - แบ่งรายได้ ต้นสังกัด 70% / Toffee 30% (หลังหักค่าธรรมเนียมแอปสโตร์)
> - ทีมเราดูแลแอป การชำระเงิน การแปลภาษา การดูแลแฟนคลับ และการตรวจสอบเนื้อหาทั้งหมด
> - ต้นสังกัดดูข้อความและสถิติทั้งหมดได้ผ่านหน้าจอสำหรับต้นสังกัด
>
> แอปพร้อมใช้งานแล้ว สามารถทดลองได้เองภายในประมาณ 10 นาทีที่ **demo.toffeechat.app** (รหัสเข้าใช้: [รหัส])
> และได้แนบเอกสารข้อเสนอโดยย่อมาด้วย
>
> หากสะดวก ขอนัดคุยออนไลน์ประมาณ 30 นาทีภายในสองสัปดาห์นี้ได้ไหมครับ/คะ ยินดีปรับเงื่อนไขให้เหมาะกับศิลปินของท่าน
>
> ขอแสดงความนับถือ
> [ชื่อ]
> Toffee Team · toffeechat.app
> [name]@toffeechat.app · LINE: [ID]

(남성이면 ผม/ครับ, 여성이면 ดิฉัน/ค่ะ 하나만 남긴다.)

---

## 짧은 메시지 (LINE·인스타그램 DM·페이스북 페이지용)

태국은 소속사 연락을 LINE 공식 계정이나 페이스북 페이지로 받는 곳이 많다. 길게 쓰지 말고 메일로 넘어가게 한다.

**영어**
> Hello! I'm [Name] from Toffee, a paid 1:1-style fan messaging app for Thai artists (like Bubble in Korea).
> We'd love to invite [Agency] to a free, non-exclusive 3-month pilot. Could you share the best email to send
> a short proposal? Thank you!

**태국어**
> สวัสดีครับ/ค่ะ [ชื่อ] จาก Toffee แอปแชทกับแฟนคลับแบบสมัครสมาชิกสำหรับศิลปินไทย (คล้าย Bubble ของเกาหลี)
> อยากเชิญ [ต้นสังกัด] ร่วมทดลองใช้งาน 3 เดือน ไม่มีค่าใช้จ่ายและไม่ผูกขาด
> รบกวนขออีเมลสำหรับส่งเอกสารข้อเสนอสั้น ๆ ได้ไหมครับ/คะ ขอบคุณครับ/ค่ะ

---

## 메일 2. 답이 없을 때 (1주 뒤, 한 번만)

**제목**: Re: Partnership idea for [Artist name]

> Hi [Name],
>
> Just a short follow-up on my message last week about Toffee. I know your team is busy, so here is the
> one-line version: **a free, non-exclusive 3-month pilot where your artists earn monthly income from fans,
> and we run everything.**
>
> If it is not a fit right now, a quick "not now" is completely fine. It helps me a lot.
>
> Best,
> [Your name]

두 번 보내도 답이 없으면 그 소속사는 멈추고, 3단계 기록에 "연락, 무응답"으로 남긴다.

## 메일 3. 누군가 소개해 줬을 때

소개받은 경우가 콜드 메일보다 답장률이 훨씬 높다(`launch-roadmap.md` 3단계). 첫 줄에 소개한 사람 이름을 넣는다.

**제목**: Introduction from [Introducer name]: Toffee fan messaging app

> Dear [Name],
>
> [Introducer name] kindly suggested I contact you. I am [Your name], building **Toffee**, a paid, chat-style
> messaging app between Thai artists and their fans.
>
> (이하 메일 1의 둘째 문단부터 같음)

## 답장이 왔을 때 — 통화 잡기

> Thank you so much for your reply! Would any of these times work for a 30-minute online call (Bangkok time)?
> - [Date] [time]
> - [Date] [time]
> - [Date] [time]
>
> I will send a Google Meet link once you choose. If LINE call is easier for you, that works too.

시간은 **방콕 시간**으로 적는다(한국보다 2시간 늦음). 퇴근 후 통화라면 한국 20~22시 = 방콕 18~20시.

---

## 자주 나올 질문과 답 (통화·답장용)

| 질문 | 답 (영어) | 메모 |
|---|---|---|
| Are you a registered company? | Not yet. We will incorporate in Korea before the public launch, and every contract will be signed by the company. During the pilot preparation there is no payment between us. | 사실대로. "회사 있어야 계약"이라고 하면 법인 설립을 앞당기는 신호(`launch-roadmap.md` 분기점) |
| When do you launch? | We are targeting [season] 2027, after store review. The pilot starts when your artists are ready. | 날짜 약속 금지 |
| Who owns the content? | Your artist and agency keep all rights. Toffee only needs a licence to show it to subscribers in the app. | 계약서 단계에서 변호사 확인 |
| How do you stop leaks? | Content is only visible inside the app to paying adults, sharing outside is forbidden by our terms, and we can ban accounts. | 화면 캡처 자체를 완전히 막을 수는 없다는 점은 솔직하게 |
| How and when do we get paid? | Monthly statement per artist. Stores pay us about 1 to 2 months after the sale, then we transfer your share in THB. | 송금·원천징수 실무는 법인 설립 때 확정 |
| Can we set the price? | Yes, together per artist. | 스토어 가격표 단계에 맞춤 |
| Can we leave? | Yes. No exclusivity, and either side can end after the pilot. | |
| What if the artist stops sending? | Fans are protected by our refund rules, and the agency console shows artists who have not sent in a while. | `STATUS.md` 환불 정책 |
| Do you need an advance from us / will you pay an advance? | No fee from you. We do not offer an advance during the pilot. | 계약금 요구는 메모만 하고 그 자리에서 답하지 않는다 |

---

## 연락 기록

보낸 곳·날짜·반응은 3단계 근거 자료(지원사업 사업계획서)가 되므로 전부 남긴다. 연락처·이메일 주소 같은 개인정보는 이 저장소에
적지 말고 개인 폴더(또는 스프레드시트)에 둔다 — 여기엔 "N곳 연락, M곳 답장, K곳 통화" 같은 숫자만.
