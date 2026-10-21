// エリアは選択式（初期は関西）。地図の初期表示と距離の目安に、エリアの中心を持つ
import type { Lang } from './constants.js';

export const AREAS = ['uji', 'kyoto_center', 'kyoto_outer', 'osaka', 'nara', 'kobe', 'kansai_other'] as const;
export type AreaCode = (typeof AREAS)[number];

export const AREA_LABELS: Record<AreaCode, Record<Lang, string>> = {
  uji: { ja: '宇治', en: 'Uji', zh: '宇治', ko: '우지', fr: 'Uji', es: 'Uji' },
  kyoto_center: { ja: '京都市内（中心部）', en: 'Central Kyoto', zh: '京都市中心', ko: '교토 시내', fr: 'Centre de Kyoto', es: 'Centro de Kioto' },
  kyoto_outer: { ja: '京都市内（郊外）', en: 'Kyoto outskirts', zh: '京都市郊外', ko: '교토 교외', fr: 'Environs de Kyoto', es: 'Afueras de Kioto' },
  osaka: { ja: '大阪', en: 'Osaka', zh: '大阪', ko: '오사카', fr: 'Osaka', es: 'Osaka' },
  nara: { ja: '奈良', en: 'Nara', zh: '奈良', ko: '나라', fr: 'Nara', es: 'Nara' },
  kobe: { ja: '神戸', en: 'Kobe', zh: '神户', ko: '고베', fr: 'Kobe', es: 'Kobe' },
  kansai_other: { ja: '関西のその他', en: 'Elsewhere in Kansai', zh: '关西其他地区', ko: '간사이 기타', fr: 'Ailleurs dans le Kansai', es: 'Otras zonas de Kansai' },
};

export const AREA_CENTERS: Record<AreaCode, { lat: number; lng: number }> = {
  uji: { lat: 34.8844, lng: 135.7997 },
  kyoto_center: { lat: 35.0116, lng: 135.7681 },
  kyoto_outer: { lat: 34.9858, lng: 135.7588 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  nara: { lat: 34.6851, lng: 135.8048 },
  kobe: { lat: 34.6901, lng: 135.1955 },
  kansai_other: { lat: 34.8, lng: 135.6 },
};

export function isArea(v: unknown): v is AreaCode {
  return typeof v === 'string' && (AREAS as readonly string[]).includes(v);
}

export function areaLabel(area: string, lang: Lang) {
  return isArea(area) ? AREA_LABELS[area][lang] : '';
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
