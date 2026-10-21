import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiProviders, toGeminiSchema, wishToFilters } from '../server/ai';

describe('Gemini 対応', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('JSON Schema を Gemini の形に変える（型は大文字、additionalProperties は外す）', () => {
    const out = toGeminiSchema({
      type: 'object',
      additionalProperties: false,
      properties: { list: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } }, n: { type: 'integer', description: 'x' } },
      required: ['list'],
    });
    expect(out).toEqual({
      type: 'OBJECT',
      properties: { list: { type: 'ARRAY', items: { type: 'STRING', enum: ['a', 'b'] } }, n: { type: 'INTEGER', description: 'x' } },
      required: ['list'],
    });
  });

  it('キーのある AI を順に使う（AI_PRIMARY=gemini なら Gemini が先）', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(aiProviders()).toEqual([]);
    process.env.GEMINI_API_KEY = 'g';
    expect(aiProviders()).toEqual(['gemini']);
    process.env.ANTHROPIC_API_KEY = 'a';
    expect(aiProviders()).toEqual(['claude', 'gemini']);
    process.env.AI_PRIMARY = 'gemini';
    expect(aiProviders()).toEqual(['gemini', 'claude']);
  });

  it('Gemini の答え（JSON）を絞り込み条件として使い、失敗したらルールで答える', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"filters":{"category":["RESTAURANT"],"area":["osaka"]},"understood":true}' }] } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await wishToFilters('dinner in osaka', 'en');
    expect(r).toEqual({ filters: { category: ['RESTAURANT'], area: ['osaka'] }, understood: true, source: 'ai' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(':generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    expect(JSON.parse(String(init.body)).generationConfig.responseSchema.type).toBe('OBJECT');

    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }));
    const fallback = await wishToFilters('dinner in osaka', 'en');
    expect(fallback.source).toBe('rules');
    expect(fallback.filters.area).toEqual(['osaka']);
    vi.unstubAllGlobals();
  });
});
