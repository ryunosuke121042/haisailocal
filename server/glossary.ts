import type { Lang } from '../shared/constants.js';

// 直訳で意味が崩れる語の固定訳（日本語 → 各言語）
export const GLOSSARY: Record<string, Partial<Record<Lang, string>>> = {
  抹茶: { en: 'matcha', zh: '抹茶', ko: '말차', fr: 'matcha', es: 'matcha' },
  煎茶: { en: 'sencha (green tea)', zh: '煎茶', ko: '센차(녹차)', fr: 'sencha (thé vert)', es: 'sencha (té verde)' },
  玉露: { en: 'gyokuro (shade-grown green tea)', zh: '玉露', ko: '교쿠로(옥로차)', fr: 'gyokuro (thé vert ombré)', es: 'gyokuro (té verde de sombra)' },
  茶摘み: { en: 'tea-leaf picking', zh: '采茶', ko: '찻잎 따기', fr: 'cueillette du thé', es: 'recolección de té' },
  お通し: {
    en: 'otoshi (small starter served with a table charge)',
    zh: '小菜（含座位费）',
    ko: '오토시(자릿세 포함 기본 안주)',
    fr: 'otoshi (petite entrée facturée avec le couvert)',
    es: 'otoshi (pequeño entrante con cargo por mesa)',
  },
  座敷: { en: 'zashiki (tatami-mat seating)', zh: '榻榻米座位', ko: '좌식(다다미) 자리', fr: 'zashiki (places sur tatamis)', es: 'zashiki (asientos sobre tatami)' },
  居酒屋: { en: 'izakaya (Japanese pub)', zh: '居酒屋', ko: '이자카야', fr: 'izakaya (bistrot japonais)', es: 'izakaya (taberna japonesa)' },
  一見さん: { en: 'first-time customers', zh: '初次来店的客人', ko: '처음 오는 손님', fr: 'clients de passage', es: 'clientes primerizos' },
  常連: { en: 'regulars', zh: '常客', ko: '단골', fr: 'habitués', es: 'clientes habituales' },
  女将: { en: 'okami (proprietress)', zh: '老板娘', ko: '오카미(여주인)', fr: 'okami (patronne)', es: 'okami (dueña)' },
  大将: { en: 'taisho (head chef/owner)', zh: '老板（主厨）', ko: '다이쇼(주인 겸 셰프)', fr: 'taisho (chef-patron)', es: 'taisho (chef y dueño)' },
  おまかせ: { en: "omakase (chef's choice)", zh: '主厨精选', ko: '오마카세', fr: 'omakase (au choix du chef)', es: 'omakase (a elección del chef)' },
  宇治: { en: 'Uji', zh: '宇治', ko: '우지', fr: 'Uji', es: 'Uji' },
};

/** 長い語から先に置き換える */
export const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
