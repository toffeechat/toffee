import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '../common/i18n/locales.js';
import { FAQ, FAQ_TITLES } from './faq-texts.js';
import { faqPage } from './legal-page.js';

describe('FAQ', () => {
  it('모든 언어가 한국어와 같은 개수의 섹션·질문을 가짐(번역 빠짐 방지)', () => {
    const shape = FAQ.ko.map((section) => section.items.length);
    for (const locale of SUPPORTED_LOCALES) {
      expect(FAQ[locale].map((section) => section.items.length)).toEqual(shape);
      expect(FAQ_TITLES[locale]).toBeTruthy();
      for (const section of FAQ[locale]) for (const item of section.items) expect(item.q && item.a).toBeTruthy();
    }
  });

  it('공개 페이지는 HTML을 이스케이프함', () => {
    const html = faqPage('ko');
    expect(html).toContain(FAQ.ko[0].items[0].q);
    expect(html).not.toContain('<script');
  });
});
