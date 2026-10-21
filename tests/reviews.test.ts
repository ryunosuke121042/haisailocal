import { describe, expect, it } from 'vitest';
import { bars, ReviewInput } from '../server/reviews';

describe('レビュー', () => {
  it('「あなたについて」に答えたら同意が必要。答えなければ同意なしで送れる', () => {
    expect(ReviewInput.safeParse({ stars: 5, tags: [] }).success).toBe(true);
    expect(ReviewInput.safeParse({ stars: 5, tags: [], religion: 'islam' }).success).toBe(false);
    expect(ReviewInput.safeParse({ stars: 5, tags: [], religion: 'islam', profileConsent: true }).success).toBe(true);
    expect(ReviewInput.safeParse({ stars: 5, tags: [], country: 'XX', profileConsent: true }).success).toBe(false);
  });

  it('写真は3枚まで、SVG は受け付けない', () => {
    const jpg = 'data:image/jpeg;base64,AAAA';
    expect(ReviewInput.safeParse({ stars: 4, tags: [], photos: [jpg, jpg, jpg] }).success).toBe(true);
    expect(ReviewInput.safeParse({ stars: 4, tags: [], photos: [jpg, jpg, jpg, jpg] }).success).toBe(false);
    expect(ReviewInput.safeParse({ stars: 4, tags: [], photos: ['data:image/svg+xml;base64,AAAA'] }).success).toBe(false);
  });

  it('国は上位5つまで出し、残りは「その他」にまとめる。年代は年齢順', () => {
    const countries = ['US', 'US', 'US', 'FR', 'FR', 'DE', 'CN', 'KR', 'TW', 'SG', 'OTHER'];
    expect(bars(countries, 'country')).toEqual([
      { key: 'US', count: 3 },
      { key: 'FR', count: 2 },
      { key: 'DE', count: 1 },
      { key: 'CN', count: 1 },
      { key: 'KR', count: 1 },
      { key: 'OTHER', count: 3 },
    ]);
    expect(bars(['40s', '20s', '20s', '70plus'], 'ageBand').map((b) => b.key)).toEqual(['20s', '40s', '70plus']);
  });
});
