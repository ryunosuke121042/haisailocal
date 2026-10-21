import type { Lang } from '../../shared/constants';
import en, { type Dict } from './en';
import zh from './zh';
import ko from './ko';
import fr from './fr';
import es from './es';
import ja from './ja';

export const DICTS: Record<Lang, Dict> = { en, zh, ko, fr, es, ja };
export type Key = keyof Dict;

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICTS[lang]?.[key] ?? en[key] ?? String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** 選択肢などのキーを動的に引く（見つからなければキーそのもの） */
export function translateDyn(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  return key in en ? translate(lang, key as Key, vars) : key;
}
