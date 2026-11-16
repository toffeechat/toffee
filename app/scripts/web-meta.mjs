#!/usr/bin/env node
// 웹 링크 미리보기(2026-11-16) — LINE·메일·메신저에 데모/웹 주소를 붙이면 미리보기 카드가 "Toffee Dev — You need to enable
// JavaScript to run this app."으로 떴음(소속사 LINE 캡처). SPA(output: 'single')라 dist/index.html에 앱 이름(개발 빌드는 'Toffee Dev')과
// <noscript> 문구만 있고 설명·대표 이미지가 없어서. 빌드 뒤 index.html의 <head>에 제목·설명·OG/Twitter 태그를 넣는다.
// 미리보기 봇은 JS를 실행하지 않으므로 이 정적 태그가 카드 내용이 됨. og:image는 절대 주소가 필요 — EXPO_PUBLIC_WEB_URL(운영 빌드)
// 없으면 데모 주소. 이미지 원본: public/og-image.png(1200×630, 브랜드 Charcoal·Lavender).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'dist', 'index.html');
const base = (process.env.EXPO_PUBLIC_WEB_URL || 'https://demo.toffeechat.app').replace(/\/+$/, '');

const TITLE = 'Toffee (ท็อฟฟี่)';
const DESC =
  'ข้อความจากศิลปินไทย ถึงแฟน ๆ ทั่วโลก — อ่านเป็นภาษาของคุณเอง · Messages from Thai artists, in your own language.';
const IMAGE = `${base}/og-image.png`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const tags = [
  `<meta name="description" content="${esc(DESC)}" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="Toffee" />`,
  `<meta property="og:title" content="${esc(TITLE)}" />`,
  `<meta property="og:description" content="${esc(DESC)}" />`,
  `<meta property="og:image" content="${IMAGE}" />`,
  `<meta property="og:image:width" content="1200" />`,
  `<meta property="og:image:height" content="630" />`,
  `<meta property="og:image:alt" content="Toffee" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${esc(TITLE)}" />`,
  `<meta name="twitter:description" content="${esc(DESC)}" />`,
  `<meta name="twitter:image" content="${IMAGE}" />`,
].join('\n    ');

let html = readFileSync(file, 'utf8');
// 제목: 개발 빌드 이름('Toffee Dev')이 그대로 나가지 않게
html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(TITLE)}</title>`);
// 같은 태그가 있으면(다시 실행) 지우고 새로 넣음
html = html.replace(/\s*<meta (?:name|property)="(?:description|og:[^"]+|twitter:[^"]+)"[^>]*>/g, '');
html = html.replace('</head>', `    ${tags}\n  </head>`);
// <noscript> 문구도 사람이 읽을 수 있게(일부 미리보기는 본문 첫 글을 씀)
html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>${esc(DESC)}</noscript>`);
writeFileSync(file, html);
console.log(`dist/index.html: link preview tags (image ${IMAGE})`);
