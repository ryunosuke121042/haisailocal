import { describe, expect, it } from 'vitest';
import { suggestReplies } from '../src/biz/quickReplies';
import en from '../src/i18n/en';
import es from '../src/i18n/es';
import fr from '../src/i18n/fr';
import ja from '../src/i18n/ja';
import ko from '../src/i18n/ko';
import zh from '../src/i18n/zh';

describe('事業者のよく使う返信', () => {
  it('旅行者の「よくある質問」は、どの言語でも合う返信（おすすめ）が出る', () => {
    for (const [lang, dict] of Object.entries({ ja, en, zh, ko, fr, es })) {
      for (const q of dict.chatQuick.split('|')) {
        expect(suggestReplies(q).suggested.length, `${lang}: ${q}`).toBeGreaterThan(0);
      }
    }
  });

  it('質問がないときは共通の返信だけ', () => {
    const r = suggestReplies('');
    expect(r.suggested).toEqual([]);
    expect(r.common.length).toBeGreaterThan(0);
  });
});
