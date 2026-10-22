import type { Slot, SlotState, DayState } from '../shared/booking';
import type { Prefs } from '../shared/filters';
import type { SearchHit } from '../shared/search';

export interface TText {
  text: string;
  original: string;
  machine: boolean;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  role: 'TRAVELER' | 'BUSINESS' | 'ADMIN';
  businessId: string | null;
  lang: string;
  currency: string;
  cardRegistered: boolean;
  sensitiveConsentAt: string | null;
  prefs: Prefs | null;
  prefsDate: string | null;
  characterHidden: boolean;
}

export interface Config {
  translator: 'claude' | 'gemini' | 'mymemory' | 'none';
  ai: boolean;
  /** 使っている AI（試す順） */
  aiProviders?: ('claude' | 'gemini')[];
  email: 'resend' | 'outbox';
  pushPublicKey: string | null;
  demo: boolean;
}

export type CategoryCode = 'EXPERIENCE' | 'RESTAURANT' | 'TOUR';

export interface LocalInfo {
  crowd: 'LOCAL' | 'MIXED' | 'TOURIST' | null;
  regulars: 'REGULARS' | 'NEWCOMERS' | null;
  guidebook: boolean | null;
  yearsBand: 'UNDER_10' | 'FROM_10_TO_30' | 'OVER_30' | null;
  ownerDistance: 'OWNER' | 'STAFF' | null;
}

export interface Rating {
  avg: number | null;
  count: number;
}

export interface Card {
  id: string;
  category: CategoryCode | null;
  name: TText;
  appeal: TText;
  area: string;
  lat: number | null;
  lng: number | null;
  photo: string | null;
  priceJpy: number | null;
  paymentMethod: 'CASH_ONLY' | 'CARD_OK' | null;
  local: LocalInfo;
  station: TText;
  stationMinutes: number | null;
  languages: string[];
  soloWelcome: boolean;
  halalCertified: boolean;
  dietSupport: string[];
  adjustLess: boolean;
  adjustRemove: boolean;
  rating: Rating;
  avgReplyMinutes: number | null;
  bookable: boolean;
  hit: SearchHit | null;
  /** 日付を選んでいればその日の空き枠、選んでいなければ一番早い空き枠（時間枠のない店は null） */
  openSlots: { date: string; time: string; remaining: number }[] | null;
  /** 選んだ日（なければ今日）から7日間のおおよその空き具合（時間枠のない店は null） */
  week: { date: string; level: 'open' | 'few' | 'full' | 'closed' }[] | null;
}

export interface Detail {
  id: string;
  category: CategoryCode | null;
  name: TText;
  nameJa: string;
  description: TText;
  appeal: TText;
  dress: TText;
  /** 事業者が任意で足した情報 */
  extraInfo: { label: TText; value: TText }[];
  area: string;
  address: string;
  lat: number | null;
  lng: number | null;
  photos: string[];
  priceJpy: number | null;
  durationMin: number | null;
  paymentMethod: 'CASH_ONLY' | 'CARD_OK' | null;
  languages: string[];
  soloWelcome: boolean;
  local: LocalInfo;
  station: TText;
  stationMinutes: number | null;
  rating: Rating;
  reviewTags: Record<string, number>;
  avgReplyMinutes: number | null;
  food: {
    halalCertified: boolean;
    porkFreeMention: boolean;
    dietSupport: string[];
    allergenFreeShop: string[];
    dishes: { name: TText; allergens: string[] }[];
    adjustLess: boolean;
    adjustRemove: boolean;
  };
  capacityMax: number | null;
  slots: Slot[];
  closedWeekdays: number[];
  cutoff: 'SAME_DAY' | 'DAY_BEFORE' | 'TWO_DAYS_BEFORE';
  freeCancel: 'SAME_DAY' | 'DAY_BEFORE' | 'THREE_DAYS_BEFORE';
  lateFeeJpy: number | null;
  itemsToBring: TText;
  minParticipants: number;
  courseStyle: 'COURSE' | 'ALACARTE' | 'BOTH' | null;
  meetingPoint: TText;
  itinerary: TText;
  guideLanguages: string[];
  bookable: boolean;
  saved: boolean;
}

export interface DayAvail {
  date: string;
  state: DayState;
  slots: SlotState[];
}

export type ReservationStatus = 'CONFIRMED' | 'VISITED' | 'NO_SHOW' | 'CANCELED_BY_TRAVELER' | 'CANCELED_BY_BUSINESS';

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  original: string;
  machine: boolean;
  /** 添付した写真（なければ null） */
  photo: string | null;
  at: string;
}
