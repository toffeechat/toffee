// 제안서 슬라이드(project/slides/*.html) → 소속사별 PDF(2026-10-25)
// 사용: node pdf.cjs <scratchpad> — 결과는 <scratchpad>/pdf/Toffee_Proposal_<TH|EN>_<회사>.pdf
const { chromium } = require(require.resolve('playwright', { paths: ['/home/user/toffee/app'] }));
const fs = require('fs');
const path = require('path');

const S = process.argv[2];
const OUT = path.join(S, 'pdf');
fs.mkdirSync(OUT, { recursive: true });
const ORDER = ['cover', 'what', 'market', 'why', 'screens-fan', 'screens-artist', 'gets', 'roles', 'screens-agency', 'built', 'future', 'team', 'terms', 'safety', 'demo', 'contact'];
const SAMPLE = 'qkzw-cgn3';
const codes = JSON.parse(fs.readFileSync(path.join(S, 'codes/codes.json'), 'utf8'));
const FILE_NAME = { gmmtv: 'GMMTV', ch3: 'Channel3', change: 'Change2561', becky: 'BeckyEntertainment', solenn: 'SolennEntertainment', faymay: 'FAYMAYEntertainment', fabel: 'FabelEntertainment', northstar: 'NorthStarEntertainment' };

const A = (f) => path.join(S, f);
const IMG = {
  th: {
    '0b3738da82961743de33f26605b1c22d': A('assets/0b3738da82961743de33f26605b1c22d.png'),
    dc22305784d47240cbdd5c284ad6eff8: A('assets/dc22305784d47240cbdd5c284ad6eff8.png'),
    '4d3e4a45cd2bc6c4a4b7c7548b824642': A('assets/4d3e4a45cd2bc6c4a4b7c7548b824642.png'),
    f7256ab95b37aab8a06409db1a42c93e: A('assets/f7256ab95b37aab8a06409db1a42c93e.png'),
    '15240fe43a9269d1fd07e28cd219e736': A('assets/15240fe43a9269d1fd07e28cd219e736.png'),
    fa64ed7317bef7939816118153ee3bfe: A('shots4/th-chat.png'),
    bb31ae075c111c5892e55ddde23c83d3: A('shots3/th-discover.png'),
    a21592d881b1d1aaa3f20b49a1e5008f: A('shots3/th-profile.png'),
    c5a2573dc3db476efd8de72240cee5a0: A('shots4/th-studio.png'),
    '49b4c2843770f41d3037cce59b88b4f4': A('shots3/th-replies.png'),
    '048e5fbabfaf269bfa39dc9e3269a8d9': A('shots/th-console-dashboard.png'),
    '401a3057d33f2081e4890bfc2b8ac10d': A('shots/th-console-replies.png'),
  },
  en: {
    '87bc9e3f9fe22bc2094f935d35aa6328': A('assets/0b3738da82961743de33f26605b1c22d.png'),
    '8c3ea49b9d32ee256fac0a83cd40607e': A('assets/dc22305784d47240cbdd5c284ad6eff8.png'),
    '6c2618f5b90fc0720e884acd739c8f44': A('assets/4d3e4a45cd2bc6c4a4b7c7548b824642.png'),
    '0ae024c3897f137817921175835f6a72': A('assets/f7256ab95b37aab8a06409db1a42c93e.png'),
    b25c62f5456d164c1a58202db7a9d3b0: A('assets/15240fe43a9269d1fd07e28cd219e736.png'),
    '2967cac311e9224c833ed2a35b1720bf': A('en2/en-chat.png'),
    '113d180cbb7d00fdda7709341a7dbcdd': A('en2/en-discover.png'),
    '12f2900f8487bebdecf98ffae23ad2d4': A('en2/en-profile.png'),
    '705480b072312ab875091aa63b0b7b16': A('en2/en-studio.png'),
    '685bfe5e3256b662a68f7e5ec5c614c7': A('en2/en-replies.png'),
    '499b10bddd1c77de736bc31cef64fce6': A('en2/en-console-dashboard.png'),
    d53410297b3e9ae5eaa11adcff1c2379: A('en2/en-console-replies.png'),
  },
};
const SAMPLE_QR = { th: 'a638940c844364d7988996f93c546b18', en: '22c819629240cc2bdfc2eeb6fa7d4280' };
const agencyQr = (lang, k) => (lang === 'th' ? A(`codes/qr-${k}.png`) : A(`enqr/qr-en-${k}.png`));

const svg = (body) => `<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#3B47B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  Chart: svg('<path d="M3 3v18h18"/><path d="M8 16v-5M13 16V8M18 16V5"/>'),
  Lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  Wrench: svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
};

const FONTS = {
  th: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;700&family=DM+Sans:wght@400;500;700&display=swap',
  en: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap',
};

function build(lang, agency) {
  const dir = path.join(S, 'tr/out', lang, 'project/slides');
  let body = '';
  for (const id of ORDER) {
    let s = fs.readFileSync(path.join(dir, `${id}.html`), 'utf8');
    s = s.replace(/<aside>[\s\S]*?<\/aside>/g, '');
    s = s.replace(/<x-icon name="(\w+)"[^>]*><\/x-icon>/g, (_, n) => ICONS[n] ?? '');
    if (id === 'demo') {
      s = s.split(SAMPLE).join(agency.code);
      s = s.replace(`/_blob/${SAMPLE_QR[lang]}`, 'file://' + agencyQr(lang, agency.k));
    }
    s = s.replace(/\/_blob\/([0-9a-f]{32})/g, (m, h) => {
      if (!IMG[lang][h]) throw new Error(`${lang} ${id}: 이미지 ${h} 없음`);
      return 'file://' + IMG[lang][h];
    });
    body += s + '\n';
  }
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS[lang]}">
<style>
@page { size: 1920px 1080px; margin: 0 }
* { box-sizing: border-box }
html, body { margin: 0; padding: 0 }
section { position: relative; width: 1920px; height: 1080px; overflow: hidden; break-after: page; page-break-after: always }
h1, h2, h3, p, ul, ol, table { margin: 0 }
h1 { font-size: 96px; font-weight: 600; line-height: 1.1 }
h2 { font-size: 64px; font-weight: 600; line-height: 1.15 }
h3 { font-size: 44px; font-weight: 600; line-height: 1.2 }
p { line-height: 1.4 }
ul { padding-left: 40px }
table { border-collapse: collapse; width: 100% }
th, td { padding: 0.35em 0.6em; border-bottom: 1px solid #D5DAEA; vertical-align: top; text-align: left }
a { text-decoration: underline }
</style></head><body>${body}</body></html>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const only = process.argv[3]; // 예: th:gmmtv (미리보기용)
  for (const lang of ['th', 'en']) {
    for (const agency of codes) {
      if (only && only !== `${lang}:${agency.k}`) continue;
      const html = build(lang, agency);
      const file = path.join(OUT, `page-${lang}-${agency.k}.html`);
      fs.writeFileSync(file, html);
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.goto('file://' + file, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      if (only) {
        // 미리보기: 쪽마다 PNG
        const n = await page.locator('section').count();
        for (let i = 0; i < n; i++) await page.locator('section').nth(i).screenshot({ path: path.join(OUT, `prev-${lang}-${String(i + 1).padStart(2, '0')}.png`) });
      }
      const pdf = path.join(OUT, `Toffee_Proposal_${lang.toUpperCase()}_${FILE_NAME[agency.k]}.pdf`);
      await page.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
      console.log('ok', path.basename(pdf));
      await page.close();
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
