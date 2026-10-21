// 旅行者が選べる表示言語。仕様（01）の5言語＋日本人・在住者向けの日本語
export const LANGS = ['en', 'zh', 'ko', 'fr', 'es', 'ja'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  zh: '简体中文',
  ko: '한국어',
  fr: 'Français',
  es: 'Español',
  ja: '日本語',
};

// 料金は日本円を正とし、選んだ通貨の目安を併記する
export const CURRENCIES = ['JPY', 'SGD', 'USD', 'CNY', 'HKD', 'TWD', 'KRW', 'EUR', 'GBP', 'AUD', 'THB'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CATEGORIES = ['EXPERIENCE', 'RESTAURANT', 'TOUR'] as const;
export type CategoryCode = (typeof CATEGORIES)[number];
export const CATEGORY_JA: Record<CategoryCode, string> = { EXPERIENCE: '体験', RESTAURANT: '飲食店', TOUR: 'ツアー' };

// お店の目安情報（自己申告）。「地元の店かどうか」の判定や点数は載せず、事実として載せる
export const CROWDS = ['LOCAL', 'MIXED', 'TOURIST'] as const;
export type CrowdCode = (typeof CROWDS)[number];
export const CROWD_JA: Record<CrowdCode, string> = { LOCAL: 'ほぼ地元の人', MIXED: '半々', TOURIST: '観光客が多い' };

export const REGULARS = ['REGULARS', 'NEWCOMERS'] as const;
export type RegularsCode = (typeof REGULARS)[number];
export const REGULARS_JA: Record<RegularsCode, string> = { REGULARS: '常連が中心', NEWCOMERS: '一見さんが中心' };

export const YEARS = ['UNDER_10', 'FROM_10_TO_30', 'OVER_30'] as const;
export type YearsCode = (typeof YEARS)[number];
export const YEARS_JA: Record<YearsCode, string> = { UNDER_10: '10年未満', FROM_10_TO_30: '10〜30年', OVER_30: '30年以上' };

export const OWNER_DISTANCES = ['OWNER', 'STAFF'] as const;
export type OwnerCode = (typeof OWNER_DISTANCES)[number];
export const OWNER_JA: Record<OwnerCode, string> = { OWNER: '店主が直接対応', STAFF: 'スタッフが対応' };

export const PAYMENT_METHODS = ['CASH_ONLY', 'CARD_OK'] as const;
export const PAYMENT_JA = { CASH_ONLY: '現金のみ', CARD_OK: 'カード可' } as const;

// 予算の絞り込み（1人あたりの料金）
export const BUDGET_BANDS = ['UNDER_3000', 'FROM_3000_TO_5000', 'FROM_5000_TO_10000', 'OVER_10000'] as const;
export type BudgetBandCode = (typeof BUDGET_BANDS)[number];
export const BUDGET_BAND_RANGE: Record<BudgetBandCode, [number, number | null]> = {
  UNDER_3000: [0, 3000],
  FROM_3000_TO_5000: [3000, 5000],
  FROM_5000_TO_10000: [5000, 10000],
  OVER_10000: [10000, null],
};
export function budgetBandOf(priceJpy: number): BudgetBandCode {
  if (priceJpy < 3000) return 'UNDER_3000';
  if (priceJpy < 5000) return 'FROM_3000_TO_5000';
  if (priceJpy < 10000) return 'FROM_5000_TO_10000';
  return 'OVER_10000';
}

// 主要駅からの所要時間の絞り込み（分以内）
export const STATION_MAX = [5, 10, 20, 30] as const;

// 受付締切
export const CUTOFFS = ['SAME_DAY', 'DAY_BEFORE', 'TWO_DAYS_BEFORE'] as const;
export type CutoffCode = (typeof CUTOFFS)[number];
export const CUTOFF_JA: Record<CutoffCode, string> = { SAME_DAY: '当日OK', DAY_BEFORE: '前日まで', TWO_DAYS_BEFORE: '2日前まで' };

// 無料キャンセルの期限
export const FREE_CANCELS = ['SAME_DAY', 'DAY_BEFORE', 'THREE_DAYS_BEFORE'] as const;
export type FreeCancelCode = (typeof FREE_CANCELS)[number];
export const FREE_CANCEL_JA: Record<FreeCancelCode, string> = { SAME_DAY: '当日まで', DAY_BEFORE: '前日まで', THREE_DAYS_BEFORE: '3日前まで' };

// 食べ物の情報：店が対応できる食事制限（ハラルは認証の有無で別に持つ）
export const DIET_SUPPORT = ['vegetarian', 'vegan', 'glutenFree', 'noPork', 'noBeef', 'noAlcohol'] as const;
export type DietSupport = (typeof DIET_SUPPORT)[number];
export const DIET_SUPPORT_JA: Record<DietSupport, string> = {
  vegetarian: 'ベジタリアン対応',
  vegan: 'ヴィーガン対応',
  glutenFree: 'グルテンフリー対応',
  noPork: '豚肉なしにできる',
  noBeef: '牛肉なしにできる',
  noAlcohol: 'アルコールなしにできる',
};

// アレルギー物質（表示義務8品目＋大豆・ごま）。対象品目は要確認事項
export const ALLERGENS = ['shrimp', 'crab', 'walnut', 'wheat', 'buckwheat', 'egg', 'milk', 'peanut', 'soy', 'sesame'] as const;
export type Allergen = (typeof ALLERGENS)[number];
export const ALLERGEN_JA: Record<Allergen, string> = {
  shrimp: 'えび',
  crab: 'かに',
  walnut: 'くるみ',
  wheat: '小麦',
  buckwheat: 'そば',
  egg: '卵',
  milk: '乳',
  peanut: '落花生',
  soy: '大豆',
  sesame: 'ごま',
};

// 宗教上の制限（要配慮個人情報。同意した人にだけ聞く）
export const RELIGIOUS = ['halal', 'noPork', 'noBeef', 'vegetarian', 'noAlcohol'] as const;
export type Religious = (typeof RELIGIOUS)[number];

// 予約時に旅行者が選ぶ食事制限
export const DIETARY = ['vegetarian', 'vegan', 'halal', 'noPork', 'noBeef', 'noAlcohol', 'glutenFree', 'nuts', 'shellfish', 'eggDairy'] as const;
export type Dietary = (typeof DIETARY)[number];
export const DIETARY_JA: Record<Dietary, string> = {
  vegetarian: 'ベジタリアン',
  vegan: 'ヴィーガン',
  halal: 'ハラール',
  noPork: '豚肉NG',
  noBeef: '牛肉NG',
  noAlcohol: 'アルコールNG',
  glutenFree: 'グルテンフリー',
  nuts: 'ナッツアレルギー',
  shellfish: '甲殻類アレルギー',
  eggDairy: '卵・乳アレルギー',
};

// 店の対応言語
export const SHOP_LANGS = ['ja', 'en', 'zh', 'ko', 'fr', 'es'] as const;
export const SHOP_LANG_JA: Record<(typeof SHOP_LANGS)[number], string> = { ja: '日本語', en: '英語', zh: '中国語', ko: '韓国語', fr: 'フランス語', es: 'スペイン語' };

export const COURSE_STYLES = ['COURSE', 'ALACARTE', 'BOTH'] as const;
export const COURSE_STYLE_JA = { COURSE: 'コース', ALACARTE: 'アラカルト', BOTH: 'コース・アラカルト' } as const;

export const GUIDE_LANGS = ['ja', 'en', 'zh', 'ko', 'fr', 'es', 'other'] as const;
export const GUIDE_LANG_JA = { ja: '日本語', en: '英語', zh: '中国語', ko: '韓国語', fr: 'フランス語', es: 'スペイン語', other: 'その他' } as const;

// 事業者による予約キャンセルの理由
export const BIZ_CANCEL_REASONS = ['CLOSURE', 'WEATHER', 'OTHER'] as const;
export type BizCancelReason = (typeof BIZ_CANCEL_REASONS)[number];
export const BIZ_CANCEL_REASON_JA: Record<BizCancelReason, string> = { CLOSURE: '臨時休業', WEATHER: '天候', OTHER: 'その他' };

// レビューで任意に答える「あなたについて」。お店のページでは集計（グラフ）だけを出し、個々のレビューとは結びつけない
export const REVIEW_RELIGIONS = ['buddhism', 'christianity', 'islam', 'hinduism', 'judaism', 'other', 'none'] as const;
export type ReviewReligion = (typeof REVIEW_RELIGIONS)[number];
export const REVIEW_GENDERS = ['female', 'male', 'other'] as const;
export type ReviewGender = (typeof REVIEW_GENDERS)[number];
export const AGE_BANDS = ['10s', '20s', '30s', '40s', '50s', '60s', '70plus'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const TRAVEL_SCENES = ['solo', 'couple', 'honeymoon', 'family', 'friends', 'business', 'other'] as const;
export type TravelScene = (typeof TRAVEL_SCENES)[number];
/** 国・地域（ISO 3166-1 の2文字。表示名は画面で各言語に変換する）。ここにない国は OTHER */
export const REVIEW_COUNTRIES = [
  'US', 'CA', 'MX', 'BR', 'AR', 'GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL',
  'CN', 'TW', 'HK', 'KR', 'SG', 'MY', 'ID', 'TH', 'VN', 'PH', 'IN', 'AU', 'NZ', 'AE', 'SA', 'TR', 'IL', 'ZA', 'JP', 'OTHER',
] as const;
export type ReviewCountry = (typeof REVIEW_COUNTRIES)[number];
export const REVIEWER_FIELDS = ['country', 'religion', 'gender', 'ageBand', 'scene'] as const;
export type ReviewerField = (typeof REVIEWER_FIELDS)[number];

// 来店後の評価タグ【案】
export const REVIEW_TAGS = ['manyLocals', 'manyTourists', 'talkedWithOwner', 'easySolo', 'dietaryHandled'] as const;
export type ReviewTag = (typeof REVIEW_TAGS)[number];
export const REVIEW_TAG_JA: Record<ReviewTag, string> = {
  manyLocals: '地元の人が多かった',
  manyTourists: '観光客が多かった',
  talkedWithOwner: '店主と話せた',
  easySolo: '一人でも入りやすかった',
  dietaryHandled: '食事制限に対応してもらえた',
};

export const LIMITS = {
  messageMaxChars: 1000, // 翻訳APIへの過剰な入力を防ぐ
  descriptionMaxChars: 2000,
  aiInputMaxChars: 300,
  futureReservationsPerTraveler: 5, // 同時に持てる未来の予約数
  partyMax: 20,
  slotCapacityMax: 50,
  slotsMax: 12,
  photosMax: 5,
  reviewPhotosMax: 3,
  /** 「レビューした人の傾向」のグラフは、回答がこの件数以上集まった項目だけ出す（少ないと個人が推測できるため） */
  reviewerStatsMin: 3,
  photoMaxBytes: 400_000,
  bookingDaysAhead: 60,
  reportMaxChars: 500,
  dishesMax: 30,
  /** 事業者が任意で足せる店の情報の数 */
  extraInfoMax: 10,
  reviewDays: 30, // 来店から何日まで評価できるか【案】
  reminderMinutesDefault: 15, // 当日予約の来店前メール（店ごとに変えられる）
};
