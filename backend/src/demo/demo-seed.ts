// 데모/개발용 시드 데이터 — 전부 가상의 배우/팬이며 실제 배우 정보는 계약 전까지 절대 넣지 않음.
// 기존 데이터를 전부 지우고 다시 넣음. 로컬: npx prisma db seed / 데모 서버: DEMO_SEED 환경변수(seed-cli.ts, 2026-10-01)
// 서버 실행 이미지에서도 돌 수 있게 src 아래로 옮김(이미지엔 tsx 같은 개발 도구가 없어서 빌드된 JS로 실행).
import type { Prisma } from '../generated/prisma/client.js';
import { MessageSenderType, MessageMediaType, Role } from '../generated/prisma/enums.js';
import { CURRENT_TERMS_VERSION } from '../common/legal/terms.js';
import { computeAudienceSnapshot } from '../actors/daily-stats.service.js';
import { DAY_MS, startOfTodayInZone, zoneDays } from '../common/utils/stats-time.js';
import { DEFAULT_BANNED_WORDS } from '../moderation/default-banned-words.js';

// 데모 계정은 약관 동의를 마친 상태로(새로 가입하는 계정은 앱 온보딩에서 동의)
const AGREED = { termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: new Date() };

// 데모 계정·배우·소속사는 고정 ID(2026-10-01) — 초기화해도 ID가 같아서 로그인 토큰(sub = 회원 ID)이 계속 유효하고,
// 즐겨찾기한 배우 화면 주소도 그대로. 소속사가 직접 만든 계정은 초기화 때 지워지니 그 사람만 다시 로그인
const demoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const DEMO_IDS = {
  demoAgency: demoId(1),
  formerAgency: demoId(2),
  caramel: demoId(11),
  nougat: demoId(12),
  couple: demoId(13),
  // 둘러보기·소속사 대시보드가 비어 보이지 않게 더한 가상 아티스트(2026-10-12)
  macaron: demoId(14),
  jellybean: demoId(15),
  cookie: demoId(16),
  choco: demoId(17),
  sweetAgency: demoId(3),
  // CP 묶음 3종(2026-10-15 사용자 결정 — A+AB / B+AB / 전체, CP 없는 A+B 묶음은 뺌)
  caramelCpBundle: demoId(21),
  macaronCpBundle: demoId(22),
  cpAllBundle: demoId(23),
  staff: demoId(101),
  formerStaff: demoId(102),
  admin: demoId(103),
  caramelSelf: demoId(104),
  fan1: demoId(105),
  fan2: demoId(106),
  // 답장 목록·대시보드가 비어 보이지 않게 넣는 팬 4명(2026-10-14)
  fan3: demoId(107),
  fan4: demoId(108),
  fan5: demoId(109),
  fan6: demoId(110),
} as const;

// 데모 이미지(2026-10-12 사용자 요청: "연예인 이미지도 가상으로") — 실존 인물이 아닌 일러스트. 파일은 앱 웹 데모의 정적 폴더
// app/public/demo/에 있고 웹 데모(Cloudflare Pages)가 그대로 서비스함. 다른 곳에 두면 DEMO_ASSET_BASE_URL로 바꿈
const DEMO_ASSET_BASE = (process.env.DEMO_ASSET_BASE_URL || 'https://demo.toffeechat.app/demo').replace(/\/$/, '');
// 사진 파일을 같은 이름으로 바꾸면 앱(expo-image)이 주소 기준으로 저장해 둔 예전 사진을 계속 보여 줌(2026-10-15 실기기: 새 얼굴 사진이 안 바뀜)
// → 사진을 교체할 때마다 이 값을 올리고 데모 초기화. 주소가 달라져서 앱이 새로 받음
const DEMO_ASSET_VERSION = '20261015';
const demoImage = (name: string) => `${DEMO_ASSET_BASE}/${name}.jpg?v=${DEMO_ASSET_VERSION}`;

// 환영·생일 메시지(2026-10-13부터 필수 — 없으면 아티스트가 메시지를 못 보냄) — 데모 아티스트 공통
const DEMO_GREETINGS = {
  welcomeMessage: 'ยินดีต้อนรับนะ {{name}}! ขอบคุณที่สมัครสมาชิก 💛 มาคุยกันบ่อย ๆ นะ',
  birthdayMessage: 'สุขสันต์วันเกิดนะ {{name}}! 🎂 ขอให้วันนี้เป็นวันที่มีความสุขที่สุด',
};

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
// 오늘 보낸 메시지(토피룸 목록에 "어제"·날짜 말고 시각이 보이는지 확인용, 2026-10-16) — 자정 직후에 초기화하면 어제가 될 수 있음
const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);

// PrismaClient나 트랜잭션(tx) 둘 다 받음 — 운영자 화면 초기화는 트랜잭션으로 한 번에(중간에 실패하면 원래대로)
export async function seedDemo(prisma: Prisma.TransactionClient): Promise<void> {
  // 기존 데이터 정리 (FK 순서대로) — 데모 서버에서 사람들이 만든 기록(환불 요청·정산 마감·운영자 조치·차단·구독 기록·푸시 기기)까지
  // 지워야 초기화(DEMO_SEED=reset)가 막히지 않음(2026-10-01)
  await prisma.refundRequest.deleteMany();
  await prisma.settlementPayout.deleteMany();
  await prisma.settlementClose.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.actorFanBlock.deleteMany();
  await prisma.subscriptionEvent.deleteMany();
  // 고정 ID 데모 계정의 푸시 기기는 초기화 뒤에 그대로 되살림(2026-10-15 실기기) — 데모 계정은 초기화해도 로그인이 유지돼서
  // 앱이 기기를 다시 등록하지 않음(앱을 완전히 껐다 켜기 전까지) → 그동안 알림·아이콘 숫자가 조용히 안 오던 문제
  const demoUserIds: string[] = Object.values(DEMO_IDS);
  const keptDevices = await prisma.pushDevice.findMany({
    where: { userId: { in: demoUserIds } },
    select: { userId: true, token: true, platform: true },
  });
  await prisma.pushDevice.deleteMany();
  // 로그인도 그대로 유지(2026-10-29) — 2026-10-27 토큰마다 로그인 세션(sid)·토큰 버전(tv)을 보게 된 뒤로, 계정을 지우면 세션이 같이 지워져
  // 초기화할 때마다 데모 계정 전부가 로그아웃됐음(소속사가 다음 날 데모를 열면 로그인 화면). 고정 ID 계정의 세션·토큰 버전을 기억했다가 되살림
  const keptSessions = await prisma.authSession.findMany({ where: { userId: { in: demoUserIds }, revokedAt: null } });
  const keptTokenVersions = await prisma.user.findMany({ where: { id: { in: demoUserIds }, tokenVersion: { gt: 0 } }, select: { id: true, tokenVersion: true } });
  await prisma.parentalConsent.deleteMany();
  await prisma.report.deleteMany();
  await prisma.messageTranslation.deleteMany();
  await prisma.message.deleteMany();
  await prisma.storyView.deleteMany();
  await prisma.story.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.chargeAllocation.deleteMany();
  await prisma.purchaseCharge.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.bundle.deleteMany();
  await prisma.authIdentity.deleteMany();
  await prisma.coupleMember.deleteMany();
  await prisma.actorAgencyHistory.deleteMany();
  await prisma.actor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.bannedWord.deleteMany();
  // 데모에서 시험 삼아 쓴 공지·켜 둔 점검 모드·앱 최소 버전도 초기화(2026-10-29 — 남아 있으면 다음 날 미팅 때 데모가 점검 중일 수 있었음)
  await prisma.notice.deleteMany();
  await prisma.appSetting.deleteMany();

  // 가상의 소속사 2곳 — 현 소속사 + 이적 이력 데모용 이전 소속사
  const demoAgency = await prisma.agency.create({
    data: { id: DEMO_IDS.demoAgency, name: 'Demo Entertainment (sample)', logoUrl: demoImage('agency-demo') },
  });
  const formerAgency = await prisma.agency.create({
    data: { id: DEMO_IDS.formerAgency, name: 'Former Agency (sample)', logoUrl: demoImage('agency-former') },
  });
  const sweetAgency = await prisma.agency.create({
    data: { id: DEMO_IDS.sweetAgency, name: 'Sweet Music (sample)', logoUrl: demoImage('agency-sweet') },
  });

  // 가상의 배우 2명 — 이름/사진 전부 가상, Toffee 캔디 테마로 지음
  const caramel = await prisma.actor.create({
    data: {
      id: DEMO_IDS.caramel,
      legalName: 'Caramel (sample)',
      officialProfileImageUrl: demoImage('caramel-official'),
      chatDisplayName: 'Caramel',
      chatProfileImageUrl: demoImage('caramel-chat'),
      gender: 'FEMALE',
      ...DEMO_GREETINGS,
      monthlyPriceCents: 14900, // 태국 정가 ฿149(feature-decisions "상품별 태국 가격", 2026-10-29 데모를 지금 가격으로)
      agencyId: demoAgency.id,
    },
  });

  const nougat = await prisma.actor.create({
    data: {
      id: DEMO_IDS.nougat,
      legalName: 'Nougat (sample)',
      officialProfileImageUrl: demoImage('nougat-official'),
      ...DEMO_GREETINGS,
      chatDisplayName: 'Nougat',
      chatProfileImageUrl: demoImage('nougat-chat'),
      gender: 'FEMALE',
      monthlyPriceCents: 14900,
      agencyId: demoAgency.id,
    },
  });

  // 소속사 이력 — 캐러멜은 처음부터 데모 엔터, 누가는 30일 전 이전 소속사에서 이적
  // (이적 전 기록은 이전 소속사가 볼 수 없어야 하고, 정산 이력으로만 남는지 확인용)
  await prisma.actorAgencyHistory.createMany({
    data: [
      { actorId: caramel.id, agencyId: demoAgency.id, startedAt: daysAgo(120) },
      { actorId: nougat.id, agencyId: formerAgency.id, startedAt: daysAgo(120), endedAt: daysAgo(30) },
      { actorId: nougat.id, agencyId: demoAgency.id, startedAt: daysAgo(30) },
    ],
  });

  // 가상 아티스트 4명 더(2026-10-12) — 구독자는 없고 메시지만 몇 개(소속사 대시보드의 "오래 안 보낸 순" 등이 달라 보이게)
  const extras = [
    { id: DEMO_IDS.macaron, name: 'Macaron', legal: 'Macaron (sample)', gender: 'FEMALE' as const, agencyId: demoAgency.id, image: 'macaron', lastDays: 2 },
    { id: DEMO_IDS.jellybean, name: 'Jellybean', legal: 'Jellybean (sample)', gender: 'MALE' as const, agencyId: demoAgency.id, image: 'jellybean', lastDays: 9 },
    { id: DEMO_IDS.cookie, name: 'Cookie', legal: 'Cookie (sample)', gender: 'FEMALE' as const, agencyId: sweetAgency.id, image: 'cookie', lastDays: 0 },
    { id: DEMO_IDS.choco, name: 'Choco', legal: 'Choco (sample)', gender: 'MALE' as const, agencyId: sweetAgency.id, image: 'choco', lastDays: 4 },
  ];
  for (const extra of extras) {
    await prisma.actor.create({
      data: {
        id: extra.id,
        legalName: extra.legal,
        chatDisplayName: extra.name,
        officialProfileImageUrl: demoImage(`${extra.image}-official`),
        chatProfileImageUrl: demoImage(`${extra.image}-chat`),
        gender: extra.gender,
        ...DEMO_GREETINGS,
        monthlyPriceCents: 14900,
        agencyId: extra.agencyId,
      },
    });
    await prisma.actorAgencyHistory.create({ data: { actorId: extra.id, agencyId: extra.agencyId, startedAt: daysAgo(60) } });
    await prisma.message.createMany({
      data: [
        { actorId: extra.id, senderType: MessageSenderType.ARTIST, body: 'สวัสดี {{name}}! ขอให้วันนี้เป็นวันที่ดีนะ', createdAt: daysAgo(extra.lastDays + 3) },
        { actorId: extra.id, senderType: MessageSenderType.ARTIST, body: 'ซ้อมเสร็จแล้ว! ทุกคนกินข้าวกันหรือยัง?', createdAt: daysAgo(extra.lastDays) },
      ],
    });
  }

  // 커플(CP)방 — 캐러멜 + 마카롱 GL(2026-10-13 변경: 태국 CP는 GL·BL이라 같은 성별로, 예전엔 캐러멜 + 누가).
  // 방 이름·대화방 사진은 두 아티스트가 각자 바꿀 수 있음. 마카롱이 위 반복문에서 만들어진 뒤에 만든다
  await prisma.actor.create({
    data: {
      id: DEMO_IDS.couple,
      ...DEMO_GREETINGS,
      kind: 'COUPLE',
      legalName: 'Caramel & Macaron (sample)',
      chatDisplayName: 'Caramel & Macaron',
      officialProfileImageUrl: demoImage('couple-caramel-macaron'),
      chatProfileImageUrl: demoImage('couple-caramel-macaron'),
      monthlyPriceCents: 19900,
      coupleMembers: { create: [{ memberId: caramel.id }, { memberId: DEMO_IDS.macaron }] },
    },
  });

  // 데모 엔터 스태프 1명 — 같은 소속사라 두 배우 모두 모니터링 가능
  const staff = await prisma.user.create({
    data: {
      ...AGREED,
      id: DEMO_IDS.staff,
      role: Role.AGENCY_STAFF,
      displayName: 'Demo Staff',
      email: 'staff@toffee.demo',
      agencyId: demoAgency.id,
    },
  });
  // 이전 소속사 스태프 — 누가가 이적했으므로 누가의 콘솔/메시지에 접근하면 403이어야 함
  await prisma.user.create({
    data: {
      ...AGREED,
      id: DEMO_IDS.formerStaff,
      role: Role.AGENCY_STAFF,
      displayName: 'Former Agency Staff',
      email: 'former-staff@toffee.demo',
      agencyId: formerAgency.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      ...AGREED, id: DEMO_IDS.admin, role: Role.ADMIN, displayName: 'Demo Admin', email: 'admin@toffee.demo' },
  });

  // 배우 본인 계정 — 메시지·스토리 발송은 이제 이 계정만 할 수 있음(소속사는 열람 전용)
  await prisma.user.create({
    data: {
      ...AGREED, id: DEMO_IDS.caramelSelf, role: Role.ACTOR, displayName: 'Caramel', email: 'caramel-self@toffee.demo' },
  });
  await prisma.actor.update({
    where: { id: caramel.id },
    data: { selfUser: { connect: { email: 'caramel-self@toffee.demo' } } },
  });

  // 팬 2명 — fan1은 캐러멜 + CP방(묶음 "Caramel + Caramel & Macaron", 2026-10-16 사용자 요청: 배우 하나 + CP 하나), fan2는 CP 전체 묶음(캐러멜·마카롱·CP방) + 누가 개인 구독. 가입 절차(생년월일)까지 마친 성인 팬으로 —
  // 생년월일이 없으면 로그인하자마자 온보딩 화면만 나오고, 서버도 구독을 막음(2026-09-28)
  const ADULT = { birthDate: new Date('2000-03-03') };
  const fan1 = await prisma.user.create({
    data: {
      ...AGREED, ...ADULT, id: DEMO_IDS.fan1, role: Role.USER, displayName: 'Minji', nickname: 'caramel_love', email: 'fan1@toffee.demo', countryCode: 'KR', locale: 'ko' },
  });
  const fan2 = await prisma.user.create({
    data: {
      ...AGREED, ...ADULT, id: DEMO_IDS.fan2, role: Role.USER, displayName: 'Ploy', nickname: 'nougat_lover', email: 'fan2@toffee.demo', countryCode: 'TH', locale: 'th' },
  });

  // 묶음 상품 — CP(캐러멜·마카롱·CP방)마다 3종(2026-10-15 사용자 결정): 개인방 + CP방 2종(따로 ฿348 → ฿289)과 전체(따로 ฿497 → ฿349).
  // 가격은 feature-decisions "상품별 태국 가격"(2026-10-29 데모를 지금 가격으로 — 예전 ฿99·CP ฿69라 소속사 제안서와 달랐음).
  // 많이 묶을수록 더 싸게 해서 "전체"로 유도. 예전 "캐러멜 + 누가"(CP 없는 A+B)는 헷갈려서 뺌
  const caramelCpBundle = await prisma.bundle.create({
    data: { id: DEMO_IDS.caramelCpBundle, name: 'Caramel + Caramel & Macaron', priceCents: 28900, actors: { create: [{ actorId: caramel.id }, { actorId: DEMO_IDS.couple }] } },
  });
  await prisma.bundle.create({
    data: { id: DEMO_IDS.macaronCpBundle, name: 'Macaron + Caramel & Macaron', priceCents: 28900, actors: { create: [{ actorId: DEMO_IDS.macaron }, { actorId: DEMO_IDS.couple }] } },
  });
  const cpAllBundle = await prisma.bundle.create({
    data: {
      id: DEMO_IDS.cpAllBundle,
      name: 'Caramel & Macaron — All',
      priceCents: 34900,
      actors: { create: [{ actorId: caramel.id }, { actorId: DEMO_IDS.macaron }, { actorId: DEMO_IDS.couple }] },
    },
  });

  // 구매(결제 단위)와 방 이용권(Subscription)을 같이 — fan1은 캐러멜 + CP방 묶음으로 두 방, fan2는 CP 전체 묶음으로 세 방 + 누가 개인
  await prisma.purchase.create({ data: { userId: fan1.id, bundleId: caramelCpBundle.id, priceCents: caramelCpBundle.priceCents, startedAt: daysAgo(5) } });
  await prisma.subscription.create({ data: { userId: fan1.id, actorId: DEMO_IDS.couple, startedAt: daysAgo(5), streakStartedAt: daysAgo(5) } });
  await prisma.purchase.create({ data: { userId: fan2.id, bundleId: cpAllBundle.id, priceCents: cpAllBundle.priceCents, startedAt: daysAgo(20) } });
  await prisma.purchase.create({ data: { userId: fan2.id, actorId: nougat.id, priceCents: nougat.monthlyPriceCents, startedAt: daysAgo(20) } });
  for (const actorId of [DEMO_IDS.macaron, DEMO_IDS.couple]) {
    await prisma.subscription.create({ data: { userId: fan2.id, actorId, startedAt: daysAgo(20), streakStartedAt: daysAgo(20) } });
  }
  const fan1Sub = await prisma.subscription.create({
    data: { userId: fan1.id, actorId: caramel.id, startedAt: daysAgo(5), streakStartedAt: daysAgo(5) },
  });
  await prisma.subscription.create({
    data: { userId: fan2.id, actorId: caramel.id, startedAt: daysAgo(20), streakStartedAt: daysAgo(20) },
  });
  await prisma.subscription.create({
    data: { userId: fan2.id, actorId: nougat.id, startedAt: daysAgo(20), streakStartedAt: daysAgo(20) },
  });
  // 해지된 구독도 하나 넣어서 "방송 대상에서 제외되는지" 확인용
  await prisma.purchase.create({ data: { userId: fan1.id, actorId: nougat.id, priceCents: nougat.monthlyPriceCents, startedAt: daysAgo(30), cancelledAt: daysAgo(2) } });
  const fan1NougatSub = await prisma.subscription.create({
    data: { userId: fan1.id, actorId: nougat.id, startedAt: daysAgo(30), streakStartedAt: daysAgo(30) },
  });
  await prisma.subscription.update({
    where: { id: fan1NougatSub.id },
    data: { cancelledAt: daysAgo(2) },
  });

  // fan1의 구독(5일 전) 이전/이후 메시지를 둘 다 넣어서 열람 제한 로직을 실제로 검증할 수 있게 함
  await prisma.message.create({
    data: {
      actorId: caramel.id,
      senderType: MessageSenderType.ARTIST,
      // fan1(5일 전 구독)에겐 안 보여야 하는 구독 전 메시지
      body: 'ยินดีที่ได้รู้จักนะ {{name}}!',
      createdAt: daysAgo(10),
    },
  });
  const recentBroadcast = await prisma.message.create({
    data: {
      actorId: caramel.id,
      senderType: MessageSenderType.ARTIST,
      body: '{{name}} วันนี้เป็นยังไงบ้าง? ถ่ายงานเสร็จเรียบร้อยแล้วนะ!',
      createdAt: daysAgo(1),
    },
  });
  await prisma.message.create({
    data: {
      actorId: caramel.id,
      senderType: MessageSenderType.ARTIST,
      mediaType: MessageMediaType.PHOTO,
      mediaUrl: demoImage('selfie-caramel'),
      body: 'เซลฟี่วันนี้ 📸',
      createdAt: daysAgo(1),
    },
  });
  const fanReply = await prisma.message.create({
    data: {
      actorId: caramel.id,
      senderType: MessageSenderType.FAN,
      fanUserId: fan1.id,
      replyToMessageId: recentBroadcast.id,
      body: '오늘도 화이팅! 항상 응원해요 💜',
      createdAt: daysAgo(1),
    },
  });
  await prisma.subscription.update({
    where: { id: fan1Sub.id },
    // lastReadAt: "여기까지 읽었어요" 줄 확인용(2026-10-13) — 2.5일 전까지 읽은 것으로, 그 뒤 메시지(태국어 1개 + 어제 것)가 안 읽음
    data: { lastArtistMessageAt: daysAgo(1), lastFanReplyAt: daysAgo(1), lastReadAt: daysAgo(2.5) },
  });

  // 데모 내용은 태국 소속사 기준(2026-10-14): 아티스트·소속사 이름은 영어, 아티스트 메시지는 태국어, 팬 답장은 태국어·한국어·영어·일본어
  // 섞어서 "번역 보기"를 양쪽에서 눌러 볼 수 있게. 화면 글자는 브라우저 언어를 따름
  // 번역 보기 확인용 태국어 메시지(2026-10-13 사용자 요청) — 한국어 화면의 팬(fan1·fan2)이 "번역 보기"를 눌러 볼 수 있게
  // 두 팬의 구독 시작(5일·20일 전) 뒤에 넣음. {{name}}은 팬 이름으로 바뀐 뒤 번역되는지까지 확인됨
  await prisma.message.createMany({
    data: [
      { actorId: caramel.id, senderType: MessageSenderType.ARTIST, body: 'สวัสดี {{name}}! วันนี้กินข้าวหรือยัง? คิดถึงนะ 555', createdAt: daysAgo(3) },
      { actorId: caramel.id, senderType: MessageSenderType.ARTIST, body: 'วันนี้ถ่ายละครเสร็จดึกมากเลย เหนื่อยแต่สนุกมาก ขอบคุณที่รอนะคะ 🥹', createdAt: daysAgo(2) },
      { actorId: nougat.id, senderType: MessageSenderType.ARTIST, body: '{{name}} ค่ะ พรุ่งนี้มีแฟนมีตติ้งที่กรุงเทพฯ ตื่นเต้นมากเลยค่ะ 🥹', createdAt: daysAgo(2) },
    ],
  });
  // CP방 대화(2026-10-15 사용자 요청, 10-16 늘림) — 두 아티스트가 서로의 메시지에 답장(상대 메시지 인용)하며 주고받는 흐름:
  // 촬영 후기 → 비하인드 사진·서로 놀리기 → 라이브 예고 → 오늘 라이브 직전. fan1(캐러멜 + CP 묶음)·fan2(CP 전체 묶음) 둘 다 볼 수 있음
  const cpSay = (senderActorId: string, createdAt: Date, body: string, extra: Partial<Prisma.MessageUncheckedCreateInput> = {}) =>
    prisma.message.create({ data: { actorId: DEMO_IDS.couple, senderActorId, senderType: MessageSenderType.ARTIST, body, createdAt, ...extra } });
  const after = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);
  const cpOpening = await cpSay(caramel.id, daysAgo(3), 'วันนี้ถ่ายซีนคู่กับมาการองสนุกมาก 💕 {{name}} รอดูนะ!');
  await cpSay(DEMO_IDS.macaron, after(daysAgo(3), 4), 'เหนื่อยแต่หัวเราะทั้งวันเลย 555 ขอบคุณที่ดูแลกันนะ', { replyToMessageId: cpOpening.id });
  const cpPhoto = await cpSay(caramel.id, daysAgo(2), 'เบื้องหลังวันนี้ 📸 มาการองแอบกินขนมระหว่างเทคด้วย', {
    mediaType: MessageMediaType.PHOTO,
    mediaUrl: demoImage('couple-caramel-macaron'),
  });
  const cpTease = await cpSay(DEMO_IDS.macaron, after(daysAgo(2), 5), 'รูปนี้หน้าเราตลกมาก ลบได้ไหม 😂', { replyToMessageId: cpPhoto.id });
  await cpSay(caramel.id, after(daysAgo(2), 7), 'ไม่ลบ! น่ารักออก {{name}} ว่าไหม? 💕', { replyToMessageId: cpTease.id });
  const cpLive = await cpSay(DEMO_IDS.macaron, daysAgo(1), '{{name}} พรุ่งนี้สองทุ่มเราจะไลฟ์ด้วยกันนะ! 📺');
  await cpSay(caramel.id, after(daysAgo(1), 2), 'อย่าลืมตื่นนอนก่อนไลฟ์นะ มาการอง 😆', { replyToMessageId: cpLive.id });
  const cpToday = await cpSay(DEMO_IDS.macaron, minutesAgo(40), 'คืนนี้สองทุ่มเจอกันนะ {{name}}! เตรียมคำถามมาเยอะ ๆ เลย 💜');
  await cpSay(caramel.id, minutesAgo(35), 'ตื่นแล้วนะ ไม่สายแน่นอน 555 รอทุกคนอยู่ 🥰', { replyToMessageId: cpToday.id });

  // 반대 방향 — 아티스트(한국어 화면)가 답장 목록에서 태국어 팬 답장의 "번역 보기"를 눌러 볼 수 있게
  const thaiBroadcast = await prisma.message.create({
    data: { actorId: caramel.id, senderType: MessageSenderType.ARTIST, body: '{{name}} สุดสัปดาห์นี้จะไปแถวประตูน้ำ มีร้านอร่อยแนะนำไหม?', createdAt: daysAgo(4) },
  });
  await prisma.message.create({
    data: {
      actorId: caramel.id,
      senderType: MessageSenderType.FAN,
      fanUserId: fan2.id,
      replyToMessageId: thaiBroadcast.id,
      body: 'มาเลยค่ะ! ต้องลองข้าวมันไก่ประตูน้ำนะคะ อร่อยมาก รอเจอนะคะ 💕',
      createdAt: daysAgo(4),
    },
  });

  // 해외 팬 답장 4개 더(2026-10-14) — 아티스트 "팬 답장" 화면이 비어 보이지 않게, 언어를 섞어서(태국어·영어·일본어)
  const moreFans = [
    { id: DEMO_IDS.fan3, nickname: 'minnie', body: 'ร้านข้าวมันไก่โกอ่างเลยค่ะ! คิวยาวแต่คุ้ม', minutes: 2, countryCode: 'TH', locale: 'th' },
    { id: DEMO_IDS.fan4, nickname: 'plai', body: 'Send us photos when you go 📷', minutes: 3, countryCode: 'PH', locale: 'en' },
    { id: DEMO_IDS.fan5, nickname: 'sora', body: 'プラトゥーナムは暑いから水たくさん飲んでね ☀️', minutes: 5, countryCode: 'JP', locale: 'ja' },
    { id: DEMO_IDS.fan6, nickname: 'namwan', body: 'อยากไปเจอจัง ขอให้เที่ยวสนุกนะ 💕', minutes: 7, countryCode: 'TH', locale: 'th' },
  ];
  // 나라·언어를 넣어 둠(2026-10-20) — 비어 있으면 소속사 대시보드 "팬 분포"에 "알 수 없음"·"기기 언어"로 묶여 보였음
  for (const [i, fan] of moreFans.entries()) {
    await prisma.user.create({
      data: { ...AGREED, ...ADULT, id: fan.id, role: Role.USER, displayName: fan.nickname, nickname: fan.nickname, email: `fan${i + 3}@toffee.demo`, countryCode: fan.countryCode, locale: fan.locale },
    });
    await prisma.purchase.create({ data: { userId: fan.id, actorId: caramel.id, priceCents: caramel.monthlyPriceCents, startedAt: daysAgo(8 + i) } });
    // 장기 구독 혜택(2026-10-29) — 두 명은 1년 넘게 이어서 구독한 팬으로(답장 화면 "1년+" 배지). 대화는 구독 시작(startedAt)부터
    const streakDays = [420, 0, 380, 0][i] || 8 + i;
    await prisma.subscription.create({ data: { userId: fan.id, actorId: caramel.id, startedAt: daysAgo(8 + i), streakStartedAt: daysAgo(streakDays) } });
    await prisma.message.create({
      data: {
        actorId: caramel.id,
        senderType: MessageSenderType.FAN,
        fanUserId: fan.id,
        replyToMessageId: thaiBroadcast.id,
        body: fan.body,
        createdAt: new Date(daysAgo(4).getTime() + fan.minutes * 60_000),
      },
    });
  }

  // 신고/모더레이션 큐 데모용
  await prisma.report.create({
    data: {
      messageId: recentBroadcast.id,
      reportedById: fan2.id,
      category: 'SPAM',
      reason: '(demo) reported as spam',
    },
  });

  // 금칙어 데모 — 9개 언어 기본 목록(2026-10-25: 운영자가 [기본 목록 넣기]를 눌러도 새벽 초기화로 사라져서 처음부터 넣음) + 테스트용 문자열(관리자 화면에서 등록/삭제 확인용)
  await prisma.bannedWord.createMany({
    data: [
      ...Object.entries(DEFAULT_BANNED_WORDS).flatMap(([language, terms]) => terms.map((term) => ({ term, language, isDefault: true }))),
      { term: '테스트금칙어', language: 'ko' },
      { term: 'testbadword', language: 'en' },
      { term: 'ทดสอบคำต้องห้าม', language: 'th' },
    ],
    skipDuplicates: true,
  });

  await seedStatsCrowd(prisma, { staffId: staff.id, caramelId: caramel.id, nougatId: nougat.id });
  await seedDailyStats(prisma);

  const recreatedDemo = new Set((await prisma.user.findMany({ where: { id: { in: demoUserIds } }, select: { id: true } })).map((user) => user.id));
  // 데모 계정이 다시 만들어진 뒤 푸시 기기 되살리기(위에서 기억해 둔 것 — 소셜 로그인 계정 것은 계정과 함께 사라짐)
  const recreated = new Set((await prisma.user.findMany({ where: { id: { in: keptDevices.map((device) => device.userId) } }, select: { id: true } })).map((user) => user.id));
  const restorable = keptDevices.filter((device) => recreated.has(device.userId));
  if (restorable.length > 0) await prisma.pushDevice.createMany({ data: restorable, skipDuplicates: true });
  // 로그인 세션·토큰 버전 되살리기(위에서 기억해 둔 것)
  for (const { id, tokenVersion } of keptTokenVersions) {
    if (recreatedDemo.has(id)) await prisma.user.update({ where: { id }, data: { tokenVersion } });
  }
  const sessions = keptSessions.filter((session) => recreatedDemo.has(session.userId));
  if (sessions.length > 0) await prisma.authSession.createMany({ data: sessions, skipDuplicates: true });

  console.log('시드 완료:', {
    actors: [caramel.chatDisplayName, nougat.chatDisplayName],
    agencies: [demoAgency.name, formerAgency.name],
    staff: staff.displayName,
    admin: admin.displayName,
    fans: [fan1.displayName, fan2.displayName],
    sampleFanReplyId: fanReply.id,
    actorSelfLoginEmail: 'caramel-self@toffee.demo',
  });
}

/**
 * 소속사 통계 대시보드·기록 화면이 비어 보이지 않게 넣는 가상 팬 무리(2026-10-13 대시보드 개편) — 이메일 없는 팬 48명이
 * 데모 엔터 아티스트들을 최근 80일에 걸쳐 구독·일부 해지(나라·언어 섞어서)하고 답장을 보냄. 매번 같은 결과가 나오게 고정 난수.
 * 기록 화면용으로 차단 1건(계기 답장 포함)·소속사 신고 1건·소속사가 지운 메시지 1건도.
 */
async function seedStatsCrowd(prisma: Prisma.TransactionClient, ids: { staffId: string; caramelId: string; nougatId: string }) {
  let seed = 20261013;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  // 태국 팬이 가장 많고 한국·일본·베트남 순(주 시장 가정)
  const places = [
    ...Array<[string, string]>(9).fill(['TH', 'th']),
    ...Array<[string, string]>(3).fill(['KR', 'ko']),
    ...Array<[string, string]>(2).fill(['JP', 'ja']),
    ['VN', 'vi'],
    ['TW', 'zh-Hant'],
    ['US', 'en'],
  ] as const;
  // 캐러멜이 제일 인기, CP방·젤리빈은 적게
  const rooms = [ids.caramelId, ids.caramelId, ids.caramelId, DEMO_IDS.macaron, DEMO_IDS.macaron, ids.nougatId, DEMO_IDS.jellybean, DEMO_IDS.couple];
  // 팬은 자기 언어로 답장(2026-10-14 태국 소속사 기준 데모) — 소속사·아티스트 화면에서 "번역 보기"가 여러 언어로 보이게
  const replyLines: Record<string, readonly string[]> = {
    th: ['ขอบคุณค่ะ 💕', 'สู้ๆ นะคะ', 'คิดถึงจัง 🥹', 'รูปสวยมากเลย', 'ฝันดีนะ 🌙'],
    ko: ['오늘도 고마워요!', '보고 싶어요 ㅠㅠ'],
    ja: ['応援してます！', '写真最高です'],
    vi: ['Cảm ơn nhé! 💕'],
    'zh-Hant': ['好想你！'],
    en: ['Love this!', 'Good night 🌙'],
  };

  const replies: Prisma.MessageCreateManyInput[] = [];
  const events: Prisma.SubscriptionEventCreateManyInput[] = [];
  const crowd: string[] = [];
  for (let i = 0; i < 48; i++) {
    const [countryCode, locale] = pick(places);
    const id = demoId(200 + i);
    crowd.push(id);
    await prisma.user.create({
      data: { ...AGREED, birthDate: new Date('1999-05-05'), id, role: Role.USER, displayName: `Fan ${i + 1}`, nickname: `fan${i + 1}`, countryCode, locale },
    });
    const joined = new Set<string>();
    for (let n = 0; n < (random() < 0.3 ? 2 : 1); n++) {
      const actorId = pick(rooms);
      if (joined.has(actorId)) continue;
      joined.add(actorId);
      const startedDays = 1 + Math.floor(random() * 80);
      const cancelledDays = random() < 0.18 ? Math.max(0, startedDays - 1 - Math.floor(random() * startedDays)) : null;
      await prisma.subscription.create({
        data: { userId: id, actorId, startedAt: daysAgo(startedDays), streakStartedAt: daysAgo(startedDays), cancelledAt: cancelledDays === null ? null : daysAgo(cancelledDays) },
      });
      events.push({ userId: id, actorId, type: 'STARTED', priceCents: actorId === DEMO_IDS.couple ? 19900 : 14900, createdAt: daysAgo(startedDays) });
      if (cancelledDays !== null) events.push({ userId: id, actorId, type: 'CANCELLED', createdAt: daysAgo(cancelledDays) });
      // 구독 중인 동안 답장 몇 개
      const until = cancelledDays ?? 0;
      for (let r = 0; r < Math.floor(random() * 5); r++) {
        const day = until + random() * (startedDays - until);
        replies.push({ actorId, senderType: MessageSenderType.FAN, fanUserId: id, body: pick(replyLines[locale] ?? replyLines.en), createdAt: daysAgo(day) });
      }
    }
  }
  await prisma.subscriptionEvent.createMany({ data: events });
  // 앞 기간(31~60일 전) 비교가 되게 캐러멜·마카롱의 예전 메시지도
  await prisma.message.createMany({
    data: [12, 16, 19, 23, 27, 33, 38, 41, 47, 52, 58].map((day, index) => ({
      actorId: index % 3 === 0 ? DEMO_IDS.macaron : ids.caramelId,
      senderType: MessageSenderType.ARTIST,
      body: index % 2 ? '{{name}} ซ้อมเสร็จแล้ว! ฝันดีนะทุกคน 🌙' : 'เร็ว ๆ นี้จะเอาเบื้องหลังการถ่ายทำสัปดาห์นี้มาให้ดูนะ',
      createdAt: daysAgo(day),
    })),
  });
  await prisma.message.createMany({ data: replies });

  // 기록 화면 데모 — 차단(계기 답장 포함), 소속사 신고, 소속사가 지운 메시지
  const rude = await prisma.message.create({
    data: { actorId: ids.caramelId, senderType: MessageSenderType.FAN, fanUserId: crowd[0], body: '(เดโม) ถามช่องทางติดต่อส่วนตัวซ้ำ ๆ', createdAt: daysAgo(3) },
  });
  await prisma.actorFanBlock.create({
    data: { actorId: ids.caramelId, fanUserId: crowd[0], blockedById: ids.staffId, messageId: rude.id, createdAt: daysAgo(3) },
  });
  const spam = await prisma.message.create({
    data: { actorId: DEMO_IDS.macaron, senderType: MessageSenderType.FAN, fanUserId: crowd[1], body: '(เดโม) ข้อความที่มีลิงก์โปรโมตเว็บไซต์อื่น', createdAt: daysAgo(6) },
  });
  await prisma.report.create({ data: { messageId: spam.id, reportedById: ids.staffId, category: 'SPAM', createdAt: daysAgo(6) } });
  await prisma.message.create({
    data: {
      actorId: ids.caramelId,
      senderType: MessageSenderType.ARTIST,
      body: '(เดโม) คำบรรยายรูปที่เผยสถานที่ถ่ายทำ — ต้นสังกัดลบแทน',
      createdAt: daysAgo(8),
      deletedAt: daysAgo(8),
      deletedByStaffId: ids.staffId,
    },
  });
}

/**
 * 하루 기록(ActorDailyStat) 채우기(2026-10-13, 기간 선택) — 실제 서버는 기록을 시작한 날부터만 쌓이지만, 데모에선 지난 기간을 골라 볼 수
 * 있게 최근 120일 치를 구독 시작·해지 시각으로 거꾸로 계산해 넣음(데모 데이터는 재구독이 없어 정확함). 오늘 줄은 서버가 매시간 덮어씀.
 */
async function seedDailyStats(prisma: Prisma.TransactionClient) {
  const actorIds = (await prisma.actor.findMany({ select: { id: true } })).map((actor) => actor.id);
  const today = startOfTodayInZone();
  const days = zoneDays(new Date(today.getTime() - 120 * DAY_MS), 121);
  for (const [index, day] of days.entries()) {
    // 그날 끝(다음 날 0시 직전) 상태
    const snapshot = await computeAudienceSnapshot(prisma, new Date(today.getTime() - (119 - index) * DAY_MS - 1));
    await prisma.actorDailyStat.createMany({
      data: actorIds.map((actorId) => ({ actorId, day, ...(snapshot.get(actorId) ?? { subscribers: 0, countries: {}, languages: {} }) })),
    });
  }
}
