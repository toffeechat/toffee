// 제안서용 실제 앱 화면 캡처 — 로컬 서버(3000)·웹(8081)·데모 시드 데이터
const { chromium } = require(require.resolve('playwright', { paths: [require('node:path').join(__dirname, '../../app')] }));
const OUT = process.argv[2];
const LOCALES = (process.argv[3] || 'th-TH,ko-KR,en-US').split(',');
const API = 'http://localhost:3000';
const WEB = 'http://localhost:8081';
const CARAMEL = '00000000-0000-4000-8000-000000000011';

async function token(email) {
  const r = await fetch(`${API}/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  return (await r.json()).accessToken;
}

const SHOTS = [
  { name: 'discover', who: 'fan1@toffee.demo', path: '/', mobile: true },
  { name: 'profile', who: 'fan1@toffee.demo', path: `/actor/${CARAMEL}`, mobile: true },
  { name: 'chat', who: 'fan1@toffee.demo', path: `/chat/${CARAMEL}`, mobile: true },
  { name: 'chats', who: 'fan1@toffee.demo', path: '/chats', mobile: true },
  { name: 'replies', who: 'caramel-self@toffee.demo', path: `/studio/${CARAMEL}/replies/ed3a9d2c-0633-4461-9071-0010a097eebd`, mobile: true },
  { name: 'studio', who: 'caramel-self@toffee.demo', path: `/studio/${CARAMEL}`, mobile: true },
  { name: 'console-dashboard', who: 'staff@toffee.demo', path: '/console/dashboard', mobile: false },
  { name: 'console-monitor', who: 'staff@toffee.demo', path: `/console/${CARAMEL}`, mobile: false },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const tokens = {};
  for (const s of SHOTS) tokens[s.who] ??= await token(s.who);
  for (const locale of LOCALES) {
    const lang = locale.slice(0, 2);
    for (const s of SHOTS) {
      const ctx = await browser.newContext({
        locale,
        viewport: s.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: 'light',
      });
      await ctx.addInitScript((t) => localStorage.setItem('toffee_access_token', t), tokens[s.who]);
      const page = await ctx.newPage();
      await page.goto(WEB + s.path, { waitUntil: 'load', timeout: 90000 });
      await page.waitForTimeout(6000);
      if (s.name === 'discover') { await page.mouse.click(65, 815); await page.waitForTimeout(4000); }
      await page.screenshot({ path: `${OUT}/${lang}-${s.name}.png` });
      console.log('ok', lang, s.name, page.url());
      await ctx.close();
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
