import { describe, expect, it } from 'vitest';
import { detectLang } from '../server/translate';

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
