import { areaLabel } from '../../shared/areas';
import type { Lang } from '../../shared/constants';
import type { FilterKey, Filters } from '../../shared/filters';
import { translate, translateDyn } from '../i18n';

export interface ChipLabel {
  key: FilterKey;
  value?: string;
  label: string;
}

/** 使った条件を画面に表示し、そこから一つずつ外せるようにするためのラベル */
export function filterChipLabels(f: Filters, lang: Lang): ChipLabel[] {
  const td = (k: string, vars?: Record<string, string | number>) => translateDyn(lang, k, vars);
  const out: ChipLabel[] = [];
  const arr = (key: FilterKey, prefix: string) => {
    for (const x of (f[key] as string[] | undefined) ?? []) out.push({ key, value: x, label: td(`${prefix}${x}`) });
  };
  arr('crowd', 'crowd_');
  arr('regulars', 'regulars_');
  if (f.guidebook) out.push({ key: 'guidebook', label: td(`guidebook_${f.guidebook}`) });
  arr('years', 'years_');
  arr('ownerDistance', 'owner_');
  if (f.stationMax) out.push({ key: 'stationMax', label: `${translate(lang, 'f_stationMax')}: ${translate(lang, 'withinMin', { n: f.stationMax })}` });
  arr('category', 'cat_');
  for (const a of f.area ?? []) out.push({ key: 'area', value: a, label: areaLabel(a, lang) });
  if (f.date) {
    const d = new Date(`${f.date}T00:00:00+09:00`).toLocaleDateString(lang, { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', weekday: 'short' });
    out.push({ key: 'date', label: `${d}${f.time ? ` ${f.time}` : ''}` });
  }
  if (f.party) out.push({ key: 'party', label: translate(lang, f.party === 1 ? 'onePerson' : 'people', { n: f.party }) });
  arr('budget', 'budget_');
  arr('dietary', 'diet_');
  if (f.halal) out.push({ key: 'halal', label: translate(lang, 'halalMark') });
  for (const a of f.allergens ?? []) out.push({ key: 'allergens', value: a, label: `− ${td(`allergen_${a}`)}` });
  arr('adjust', 'adjust_');
  for (const l of f.languages ?? []) out.push({ key: 'languages', value: l, label: translate(lang, 'speaksLang', { lang: td(`lang_${l}`) }) });
  if (f.solo) out.push({ key: 'solo', label: translate(lang, 'soloWelcome') });
  return out;
}

/** チップの「✕」：配列の条件は1つの値だけ外す */
export function removeChip(f: Filters, c: ChipLabel): Filters {
  const n: Filters = { ...f };
  const v = n[c.key];
  if (Array.isArray(v) && c.value) {
    const rest = (v as string[]).filter((x) => x !== c.value);
    (n as Record<string, unknown>)[c.key] = rest.length ? rest : undefined;
  } else {
    delete n[c.key];
    if (c.key === 'date') delete n.time;
  }
  return JSON.parse(JSON.stringify(n)) as Filters;
}
