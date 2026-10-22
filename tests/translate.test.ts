import { describe, expect, it } from 'vitest';
import { detectLang, looksLike } from '../server/translate';

describe('detectLang', () => {
  it('detects the language from the script, not the display language', () => {
    expect(detectLang('Is it OK for kids?', 'ja')).toBe('en');
    expect(detectLang('안녕하세요 😊\n주차장이 있나요?', 'en')).toBe('ko');
    expect(detectLang('こんにちは。駐車場はありますか？', 'en')).toBe('ja');
    expect(detectLang('有停车场吗？', 'en')).toBe('zh');
    expect(detectLang('Y a-t-il un parking ?', 'fr')).toBe('fr');
    expect(detectLang('👍', 'es')).toBe('es');
  });
});

describe('looksLike（訳が目的の言語か）', () => {
  it('韓国語なのに英語で返ってきた訳は使わない', () => {
    expect(looksLike('말차와 단맛 시즈쿠안', 'ko')).toBe(true);
    expect(looksLike('Matcha & Sweets Shizukuan', 'ko')).toBe(false);
    expect(looksLike('抹茶与甜品 雫庵', 'zh')).toBe(true);
    expect(looksLike('抹茶と甘味', 'zh')).toBe(false);
    expect(looksLike('Matcha & Sweets', 'en')).toBe(true);
    expect(looksLike('抹茶と甘味', 'en')).toBe(false);
    expect(looksLike('¥1,500', 'ko')).toBe(true);
    expect(looksLike('Wi-Fi', 'ko', 'Wi-Fi')).toBe(true);
    expect(looksLike('Test_Mentor cafeteria', 'ko', 'TEST_メンター食堂')).toBe(false);
  });
});
