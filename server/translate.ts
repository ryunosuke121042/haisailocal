// 翻訳。Claude（ANTHROPIC_API_KEY）か Gemini（GEMINI_API_KEY）があれば AI翻訳（「抹茶」「お通し」など直訳で崩れる語は用語集で固定訳にする）。
// なければ、キー不要の無料の機械翻訳 MyMemory を使う（デモ用。1日あたりの上限がある）。
// TRANSLATOR=none なら翻訳せず原文を返し、画面で「翻訳サービス未設定」と示す。
import { createHash } from 'node:crypto';
import type { Lang } from '../shared/constants.js';
import { aiProviders, aiTranslate } from './ai.js';
import { prisma } from './db.js';
import { GLOSSARY, GLOSSARY_TERMS } from './glossary.js';

export function translatorName(): 'claude' | 'gemini' | 'mymemory' | 'none' {
  if (process.env.TRANSLATOR === 'none') return 'none';
  return aiProviders()[0] ?? 'mymemory';
}

// ---------- MyMemory（無料・キー不要）：1回に送れるのは500バイトまで ----------

const MM_LANG: Record<Lang, string> = { en: 'en', zh: 'zh-CN', ko: 'ko', fr: 'fr', es: 'es', ja: 'ja' };
const MM_MAX_BYTES = 480;

/** 文の区切りで、1回の上限に収まるように分ける */
function splitForMyMemory(text: string): string[] {
  const parts = text.split(/(?<=[。．！？!?\n])/);
  const out: string[] = [];
  let cur = '';
  const bytes = (x: string) => Buffer.byteLength(x, 'utf8');
  for (const p of parts) {
    if (bytes(cur + p) <= MM_MAX_BYTES) cur += p;
    else {
      if (cur) out.push(cur);
      // 1文がそれでも長いときは文字数で切る
      let rest = p;
      while (bytes(rest) > MM_MAX_BYTES) {
        let n = rest.length;
        while (bytes(rest.slice(0, n)) > MM_MAX_BYTES) n = Math.floor(n * 0.8);
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      cur = rest;
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function myMemoryOne(text: string, from: Lang, to: Lang): Promise<string> {
  const pieces = splitForMyMemory(text);
  const out: string[] = [];
  for (const piece of pieces) {
    if (!piece.trim()) {
      out.push(piece);
      continue;
    }
    const q = new URLSearchParams({ q: piece, langpair: `${MM_LANG[from]}|${MM_LANG[to]}` });
    if (process.env.MYMEMORY_EMAIL) q.set('de', process.env.MYMEMORY_EMAIL); // 登録すると1日の上限が増える
    // 遅いときは待ちすぎない（間に合わなければ原文で届け、あとで訳し直す）
    const res = await fetch(`https://api.mymemory.translated.net/get?${q}`, { signal: AbortSignal.timeout(4000) });
    const json = (await res.json()) as { responseStatus: number | string; responseData?: { translatedText?: string } };
    const t = json.responseData?.translatedText;
    // 上限に達したときなどは、訳の代わりに警告文が返るので、失敗として扱う（キャッシュしない）
    if (Number(json.responseStatus) !== 200 || !t || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) throw new Error(`mymemory ${json.responseStatus}`);
    out.push(t);
  }
  // 訳した先の言語に合わせてつなぐ（日本語・中国語は空白なし）。改行は残す
  return out.join(to === 'ja' || to === 'zh' ? '' : ' ').replace(/[ \t]+/g, ' ').trim();
}

/** 失敗した文は null（原文のまま表示し、キャッシュしないので次回に訳し直す） */
async function myMemoryTranslate(texts: string[], from: Lang, to: Lang): Promise<(string | null)[]> {
  // 同時に送りすぎない（4件ずつ）
  const out: (string | null)[] = [];
  for (let i = 0; i < texts.length; i += 4) {
    out.push(
      ...(await Promise.all(
        texts.slice(i, i + 4).map((t) =>
          myMemoryOne(t, from, to).catch((e) => {
            console.error('mymemory failed', String(e));
            return null;
          }),
        ),
      )),
    );
  }
  return out;
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function unescapeXml(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** 用語集の語を固定訳に置き換え、翻訳されないタグで囲む（日本語からの翻訳だけ） */
export function protectGlossary(text: string, from: Lang, to: Lang): string {
  let out = escapeXml(text);
  if (from !== 'ja') return out;
  for (const term of GLOSSARY_TERMS) {
    const fixed = GLOSSARY[term][to];
    if (!fixed) continue;
    out = out.split(term).join(`<x>${escapeXml(fixed)}</x>`);
  }
  return out;
}

export function unprotect(text: string) {
  return unescapeXml(text.replace(/<\/?x>/g, ''));
}

/**
 * 書かれた文字から言語を推定する（かな → 日本語、ハングル → 韓国語、かなのない漢字 → 中国語）。
 * ラテン文字は、表示言語がフランス語・スペイン語ならその言語、そうでなければ英語とみなす
 */
export function detectLang(text: string, hint: Lang): Lang {
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u4e00-\u9fff]/.test(text)) return hint === 'ja' ? 'ja' : 'zh';
  if (/[a-z]/i.test(text)) return hint === 'fr' || hint === 'es' ? hint : 'en';
  return hint;
}

/**
 * 訳が目的の言語になっているか（無料の機械翻訳は、日本語→韓国語を英語で返すことがある）。
 * 文字の種類だけで見る：韓国語ならハングル、日本語ならかな・漢字、中国語なら漢字があり、
 * 英・仏・西なら、かな・ハングルが残っていないこと。数字や記号だけの文は判定しない
 */
export function looksLike(text: string, to: Lang, source = ''): boolean {
  // 原文がローマ字だけ（Wi-Fi など）なら、そのまま残っていてもよい
  if (source && !/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(source) && text.trim() === source.trim()) return true;
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (!letters) return true;
  if (to === 'ko') return /[\uac00-\ud7af]/.test(text);
  if (to === 'ja') return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text);
  if (to === 'zh') return /[\u4e00-\u9fff]/.test(text) && !/[\u3040-\u30ff\uac00-\ud7af]/.test(text);
  return !/[\u3040-\u30ff\uac00-\ud7af]/.test(text);
}

export function cacheKey(text: string, from: Lang, to: Lang) {
  return createHash('sha256').update(`${from}|${to}|${text}`).digest('hex');
}

export interface Translated {
  text: string;
  /** 機械翻訳された文か（false なら原文のまま） */
  machine: boolean;
}

/** まとめて翻訳する。結果はキャッシュし、失敗したら原文を返す */
export async function translateMany(texts: string[], from: Lang, to: Lang): Promise<Translated[]> {
  if (from === to) return texts.map((text) => ({ text, machine: false }));
  const keys = texts.map((t) => cacheKey(t, from, to));
  const cached = await prisma.translation.findMany({ where: { key: { in: [...new Set(keys)] } } });
  // 以前に保存された、別の言語の訳は使わない
  const byKey = new Map(cached.filter((c) => looksLike(c.text, to, c.source)).map((c) => [c.key, c.text]));
  const missing = [...new Set(texts.filter((t, i) => t.trim() && !byKey.has(keys[i])))];
  const provider = translatorName();
  if (missing.length && provider !== 'none') {
    try {
      // 1回の呼び出しに入れすぎない
      for (let i = 0; i < missing.length; i += 40) {
        const chunk = missing.slice(i, i + 40);
        let out: (string | null)[];
        let used: string = provider;
        if (provider === 'mymemory') out = await myMemoryTranslate(chunk, from, to);
        else {
          try {
            out = (await aiTranslate(
              chunk.map((t) => protectGlossary(t, from, to)),
              from,
              to,
            )).map(unprotect);
          } catch (e) {
            // AI がどれも使えないときは、無料の機械翻訳で代わりに訳す
            console.error('ai translate failed; using mymemory', String(e).slice(0, 200));
            out = await myMemoryTranslate(chunk, from, to);
            used = 'mymemory';
          }
        }
        const rows = chunk.flatMap((source, k) => {
          const text = out[k];
          // 別の言語で返ってきた訳は保存しない（原文のまま表示し、次の機会に訳し直す）
          if (text == null || !looksLike(text, to, source)) {
            if (text != null) console.warn('translation in wrong language skipped', used, from, to);
            return [];
          }
          return [{ key: cacheKey(source, from, to), source, sourceLang: from, targetLang: to, text, provider: used }];
        });
        await prisma.translation.createMany({ data: rows, skipDuplicates: true });
        for (const r of rows) byKey.set(r.key, r.text);
      }
    } catch (e) {
      console.error('translate failed', e);
    }
  }
  return texts.map((t, i) => {
    const hit = t.trim() ? byKey.get(keys[i]) : undefined;
    return hit !== undefined ? { text: hit, machine: true } : { text: t, machine: false };
  });
}

export async function translateOne(text: string, from: Lang, to: Lang): Promise<Translated> {
  return (await translateMany([text], from, to))[0];
}
