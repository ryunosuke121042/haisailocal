// デモ用の初期データ。`npm run db:seed`（やり直すときは `npm run db:seed -- --reset`）
import { randomBytes } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { freeCancelUntil, weekdayOf } from '../shared/booking.js';
import { addDays, jstDateString, jstToDate } from '../shared/time.js';
import { cacheKey } from '../server/translate.js';
import { MORE } from './seed-translations.js';

const prisma = new PrismaClient();
// デモ用アカウントのパスワードはコードに書かない。SEED_PASSWORD がなければ、実行のたびにランダムに作り、最後に1回だけ画面に出す
const PASSWORD =
  process.env.SEED_PASSWORD ||
  (() => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let s = '';
    for (const x of randomBytes(20)) s += a[x % a.length];
    return s.match(/.{5}/g)!.join('-');
  })();

type Tr = { en: string; zh: string };
const manual: { ja: string; tr: Tr }[] = [];
/** 翻訳サービスが未設定でもデモできるよう、英語・中国語の訳を翻訳キャッシュに入れる */
function t(ja: string, tr: Tr) {
  manual.push({ ja, tr });
  return ja;
}

/** 写真の代わりの絵（SVG）。実際の登録では事業者が撮った写真を使う */
function picture(emoji: string, from: string, to: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="800" height="500" fill="url(#g)"/><text x="400" y="300" font-size="180" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

interface Seed {
  email: string;
  business: string;
  listing: Omit<Prisma.ListingUncheckedCreateInput, 'businessId'>;
  dishes?: { nameJa: string; allergens: string[] }[];
  /** 来店後の評価（星とタグ）。過去の予約として入れる */
  reviews?: { stars: number; tags: string[] }[];
  daysAgo: number; // 公開日（新着順のため）
}

const SEEDS: Seed[] = [
  {
    email: 'biz@example.com',
    business: '森田茶園',
    daysAgo: 1,
    listing: {
      status: 'PUBLISHED',
      category: 'EXPERIENCE',
      nameJa: t('森田茶園 茶摘みと抹茶づくり体験', { en: 'Morita Tea Farm: tea picking and matcha making', zh: '森田茶园 采茶与抹茶制作体验' }),
      descriptionJa: t(
        '宇治で三代続く小さな茶農家です。茶畑で茶摘みをしたあと、石臼で抹茶をひき、自分でたてて季節の和菓子といただきます。家族だけで営んでいます。英語は少しだけですが、身ぶりで楽しく伝えます。',
        {
          en: 'A small family tea farm in Uji, now in its third generation. After picking tea leaves in the field, you grind matcha with a stone mill, whisk it yourself and enjoy it with a seasonal Japanese sweet. Run only by our family. We speak a little English and are happy to show you with gestures.',
          zh: '在宇治传承三代的小型茶农。在茶园采茶后，用石磨磨制抹茶，亲手点茶，并搭配时令和果子品尝。只有家人经营。英语只会一点点，但会用手势开心地交流。',
        },
      ),
      area: 'uji',
      address: '京都府宇治市白川',
      lat: 34.8745,
      lng: 135.8163,
      appealJa: t('家族だけで営んでいます。英語は少しだけですが、身ぶりで楽しく伝えます。', {
        en: 'Run only by our family. We speak a little English and are happy to show you with gestures.',
        zh: '只有家人经营。英语只会一点点，但会用手势开心地交流。',
      }),
      dressJa: t('汚れてもよい服と歩きやすい靴', { en: 'Clothes you don’t mind getting dirty and comfortable shoes', zh: '可以弄脏的衣服和好走的鞋' }),
      languages: ['ja', 'en'],
      soloWelcome: true,
      dietSupport: ['vegetarian', 'noPork', 'noBeef', 'noAlcohol'],
      allergenFreeShop: ['shrimp', 'crab', 'walnut', 'buckwheat', 'peanut', 'milk'],
      adjustLess: true,
      regulars: 'NEWCOMERS',
      guidebook: false,
      ownerDistance: 'OWNER',
      photos: [picture('🍵', '#7fb069', '#2f5d3a'), picture('🌿', '#a7c957', '#386641')],
      priceJpy: 6500,
      durationMin: 120,
      paymentMethod: 'CASH_ONLY',
      crowd: 'MIXED',
      yearsBand: 'OVER_30',
      stationJa: t('JR宇治駅', { en: 'JR Uji Station', zh: 'JR宇治站' }),
      stationMinutes: 15,
      itemsToBringJa: t('汚れてもよい服、帽子', { en: 'Clothes you don’t mind getting dirty, and a hat', zh: '可以弄脏的衣服、帽子' }),
      minParticipants: 1,
      slots: [
        { time: '10:00', capacity: 6 },
        { time: '14:00', capacity: 6 },
      ],
      closedWeekdays: [3],
      cutoff: 'DAY_BEFORE',
      freeCancel: 'THREE_DAYS_BEFORE',
      lateFeeJpy: 3000,
    },
    dishes: [
      { nameJa: t('季節の和菓子', { en: 'Seasonal Japanese sweet', zh: '时令和果子' }), allergens: ['wheat', 'soy', 'egg'] },
      { nameJa: t('抹茶', { en: 'Matcha', zh: '抹茶' }), allergens: [] },
    ],
    reviews: [{ stars: 5, tags: ['talkedWithOwner', 'easySolo'] }, { stars: 4, tags: ['manyTourists'] }],
  },
  {
    email: 'torikichi@example.com',
    business: 'とり吉',
    daysAgo: 3,
    listing: {
      status: 'PUBLISHED',
      category: 'RESTAURANT',
      nameJa: t('焼き鳥 とり吉', { en: 'Yakitori Torikichi', zh: '烤鸡串 鸟吉' }),
      descriptionJa: t(
        '河原町の路地裏にある、地元の会社員でにぎわう焼き鳥の居酒屋です。大将が炭火で一本ずつ焼きます。常連さんが多いですが、はじめての方も大歓迎です。',
        {
          en: 'A yakitori izakaya in a back alley of Kawaramachi, busy with local office workers. The owner grills each skewer over charcoal. Many regulars, but first-timers are very welcome.',
          zh: '位于河原町小巷里的烤鸡串居酒屋，挤满了当地上班族。老板用炭火一串一串地烤。常客很多，但也非常欢迎第一次来的客人。',
        },
      ),
      area: 'kyoto_center',
      address: '京都府京都市中京区河原町通',
      lat: 35.0049,
      lng: 135.7691,
      appealJa: t('常連さんが多いですが、はじめての方も大歓迎です。ねぎ抜きなどもお気軽にどうぞ。', {
        en: 'Many regulars, but first-timers are very welcome. Feel free to ask for no green onion and so on.',
        zh: '常客很多，但也非常欢迎第一次来的客人。不要葱等要求请随时提出。',
      }),
      languages: ['ja'],
      soloWelcome: true,
      allergenFreeShop: ['walnut', 'buckwheat', 'peanut'],
      adjustLess: true,
      adjustRemove: true,
      regulars: 'REGULARS',
      guidebook: false,
      ownerDistance: 'OWNER',
      photos: [picture('🍢', '#f4a259', '#8c2f39'), picture('🏮', '#e76f51', '#3d0c11')],
      priceJpy: 4500,
      durationMin: 120,
      paymentMethod: 'CARD_OK',
      crowd: 'LOCAL',
      yearsBand: 'FROM_10_TO_30',
      stationJa: t('阪急京都河原町駅', { en: 'Hankyu Kyoto-Kawaramachi Station', zh: '阪急京都河原町站' }),
      stationMinutes: 4,
      dietSupport: ['noBeef'],
      courseStyle: 'BOTH',
      slots: [
        { time: '17:30', capacity: 4 },
        { time: '19:00', capacity: 4 },
        { time: '20:30', capacity: 4 },
      ],
      closedWeekdays: [0],
      cutoff: 'SAME_DAY',
      freeCancel: 'DAY_BEFORE',
      lateFeeJpy: null,
    },
    dishes: [
      { nameJa: t('もも塩', { en: 'Chicken thigh with salt', zh: '盐烤鸡腿肉' }), allergens: [] },
      { nameJa: t('つくね', { en: 'Chicken meatball', zh: '鸡肉丸' }), allergens: ['egg', 'wheat', 'soy'] },
      { nameJa: t('だし巻き', { en: 'Rolled dashi omelette', zh: '高汤玉子烧' }), allergens: ['egg', 'soy'] },
    ],
    reviews: [{ stars: 5, tags: ['manyLocals', 'talkedWithOwner'] }, { stars: 5, tags: ['manyLocals', 'easySolo'] }, { stars: 4, tags: ['manyLocals'] }],
  },
  {
    email: 'fushimi@example.com',
    business: '伏見さんぽ',
    daysAgo: 6,
    listing: {
      status: 'PUBLISHED',
      category: 'TOUR',
      nameJa: t('酒蔵の町・伏見を歩く朝さんぽ', { en: 'Morning walk through Fushimi, the sake brewery town', zh: '漫步酒藏之町伏见的晨间散步' }),
      descriptionJa: t('生まれも育ちも伏見のガイドが、観光バスが来ない路地や井戸、町の銭湯の前などを案内します。最後に地元の酒蔵の売店に寄ります（試飲は任意）。', {
        en: 'A guide born and raised in Fushimi shows you back alleys, wells and the neighborhood bathhouse where tour buses never go. We finish at a local sake brewery shop (tasting optional).',
        zh: '土生土长的伏见向导，带您走访旅游大巴不会去的小巷、水井和街区澡堂。最后去当地酒藏的小卖部（试饮自愿）。',
      }),
      area: 'kyoto_outer',
      address: '京都府京都市伏見区',
      lat: 34.9318,
      lng: 135.7612,
      dressJa: t('歩きやすい靴', { en: 'Comfortable walking shoes', zh: '好走的鞋' }),
      languages: ['ja', 'en'],
      soloWelcome: true,
      regulars: 'NEWCOMERS',
      guidebook: false,
      ownerDistance: 'OWNER',
      photos: [picture('🍶', '#90e0ef', '#023e8a')],
      priceJpy: 3500,
      durationMin: 90,
      paymentMethod: 'CASH_ONLY',
      crowd: 'MIXED',
      yearsBand: 'UNDER_10',
      stationJa: t('京阪中書島駅', { en: 'Keihan Chushojima Station', zh: '京阪中书岛站' }),
      stationMinutes: 0,
      meetingPointJa: t('京阪中書島駅の改札前', { en: 'In front of the ticket gate at Keihan Chushojima Station', zh: '京阪中书岛站检票口前' }),
      itineraryJa: t('駅 → 運河沿いの道 → 井戸 → 銭湯 → 酒蔵の売店', {
        en: 'Station → canal path → old well → public bathhouse → sake brewery shop',
        zh: '车站 → 运河沿岸小路 → 水井 → 澡堂 → 酒藏小卖部',
      }),
      guideLanguages: ['ja', 'en'],
      slots: [{ time: '09:00', capacity: 8 }],
      closedWeekdays: [],
      cutoff: 'DAY_BEFORE',
      freeCancel: 'DAY_BEFORE',
      lateFeeJpy: 1500,
    },
  },
  {
    email: 'najm@example.com',
    business: '喫茶ナジム',
    daysAgo: 10,
    listing: {
      status: 'PUBLISHED',
      category: 'RESTAURANT',
      nameJa: t('喫茶ナジム', { en: 'Kissa Najm (coffee shop)', zh: '纳吉姆咖啡馆' }),
      descriptionJa: t('大阪・中崎町の古い長屋で営む小さな喫茶店です。予約は受けていないので、来る前に何でもチャットで聞いてください。', {
        en: 'A small coffee shop in an old row house in Nakazakicho, Osaka. We do not take bookings, so ask us anything in chat before you come.',
        zh: '位于大阪中崎町老长屋里的小咖啡馆。不接受预约，来之前有任何问题都可以在聊天中问我们。',
      }),
      area: 'osaka',
      address: '大阪府大阪市北区中崎',
      lat: 34.7068,
      lng: 135.5056,
      appealJa: t('豚肉を使っていません。アルコールも出していません。', {
        en: 'We do not use pork. We do not serve alcohol either.',
        zh: '本店不使用猪肉，也不提供酒精饮品。',
      }),
      porkFreeMention: true,
      languages: ['ja', 'en', 'ko'],
      soloWelcome: true,
      regulars: 'REGULARS',
      guidebook: false,
      ownerDistance: 'OWNER',
      photos: [picture('☕', '#ddb892', '#7f5539')],
      priceJpy: 1200,
      durationMin: 60,
      paymentMethod: 'CASH_ONLY',
      crowd: 'LOCAL',
      yearsBand: 'UNDER_10',
      stationJa: t('大阪メトロ中崎町駅', { en: 'Osaka Metro Nakazakicho Station', zh: '大阪地铁中崎町站' }),
      stationMinutes: 3,
      dietSupport: ['vegetarian', 'noPork', 'noAlcohol'],
      courseStyle: 'ALACARTE',
      // 時間枠なし → 予約は受け付けず、チャットのみ
      slots: [],
      closedWeekdays: [1, 2],
      cutoff: 'SAME_DAY',
      freeCancel: 'SAME_DAY',
      lateFeeJpy: null,
    },
  },
];

async function reset() {
  // 開発用：全データを消す
  await prisma.$transaction([
    prisma.review.deleteMany(),
    prisma.savedListing.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.pushSubscription.deleteMany(),
    prisma.translationReport.deleteMany(),
    prisma.aiLog.deleteMany(),
    prisma.dish.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.closedDate.deleteMany(),
    prisma.listingReport.deleteMany(),
    prisma.block.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.business.deleteMany(),
    prisma.translation.deleteMany(),
    prisma.emailOutbox.deleteMany(),
  ]);
}

/** デモ店舗の訳を翻訳キャッシュに入れる（すでにある訳はそのまま） */
async function insertTranslations() {
  const { count } = await prisma.translation.createMany({
    data: manual.flatMap(({ ja, tr }) =>
      (['en', 'zh', 'ko', 'fr', 'es'] as const).flatMap((to) => {
        const text = to === 'en' || to === 'zh' ? tr[to] : MORE[ja]?.[to];
        return text ? [{ key: cacheKey(ja, 'ja', to), source: ja, sourceLang: 'ja', targetLang: to, text, provider: 'manual' }] : [];
      }),
    ),
    skipDuplicates: true,
  });
  return count;
}

async function main() {
  // 訳だけを足す（データは消さない）：npm run db:seed -- --translations
  if (process.argv.includes('--translations')) {
    console.log(`訳を追加しました：${await insertTranslations()}件`);
    return;
  }
  if (process.argv.includes('--reset')) await reset();
  if (await prisma.user.findUnique({ where: { email: 'traveler@example.com' } })) {
    console.log('すでにシード済みです（やり直すときは npm run db:seed -- --reset）');
    return;
  }
  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.create({ data: { email: 'admin@example.com', name: '運営', passwordHash: hash, role: 'ADMIN', lang: 'ja', currency: 'JPY', privacyConsentAt: new Date() } });
  const traveler = await prisma.user.create({
    data: {
      email: 'traveler@example.com',
      name: 'Lee Wei Ming',
      passwordHash: hash,
      lang: 'en',
      currency: 'SGD',
      privacyConsentAt: new Date(),
      cardRegisteredAt: new Date(),
      prefs: { budget: 'FROM_5000_TO_10000', dietary: [], religious: [], allergens: [] },
      prefsDate: jstDateString(),
    },
  });

  const today = jstDateString();
  for (const s of SEEDS) {
    const biz = await prisma.business.create({ data: { name: s.business } });
    await prisma.user.create({
      data: { email: s.email, name: s.business, passwordHash: hash, role: 'BUSINESS', businessId: biz.id, lang: 'ja', currency: 'JPY', privacyConsentAt: new Date() },
    });
    const listing = await prisma.listing.create({
      data: {
        ...s.listing,
        businessId: biz.id,
        publishedAt: new Date(Date.now() - s.daysAgo * 86_400_000),
        dishes: s.dishes ? { create: s.dishes } : undefined,
      },
    });
    // 来店済みの予約と評価（アプリで予約して来店した旅行者だけが評価できる）
    for (const [i, r] of (s.reviews ?? []).entries()) {
      const date = addDays(today, -10 - i * 3);
      const time = (s.listing.slots as { time: string }[])[0]?.time ?? '18:00';
      const res = await prisma.reservation.create({
        data: {
          travelerId: traveler.id,
          listingId: listing.id,
          date,
          time,
          visitAt: jstToDate(date, time),
          partySize: 2,
          payJpy: (s.listing.priceJpy ?? 0) * 2,
          freeCancel: s.listing.freeCancel ?? 'DAY_BEFORE',
          lateFeeJpy: s.listing.lateFeeJpy ?? null,
          cancelDeadlineAt: freeCancelUntil(s.listing.freeCancel ?? 'DAY_BEFORE', date, time),
          policyAgreedAt: new Date(),
          createdAt: jstToDate(addDays(date, -3), '09:00'),
        },
      });
      await prisma.review.create({ data: { reservationId: res.id, listingId: listing.id, stars: r.stars, tags: r.tags } });
    }
    // 茶農家：臨時休業の受付停止日と、旅行者の予約・チャットを1件ずつ
    if (s.email === 'biz@example.com') {
      await prisma.closedDate.create({ data: { listingId: listing.id, date: addDays(today, 9) } });
      // 定休日（水曜）を避けた5日後以降の日
      let date = addDays(today, 5);
      while (weekdayOf(date) === 3) date = addDays(date, 1);
      await prisma.reservation.create({
        data: {
          travelerId: traveler.id,
          listingId: listing.id,
          date,
          time: '10:00',
          visitAt: jstToDate(date, '10:00'),
          partySize: 2,
          dietary: ['vegetarian'],
          message: 'It is our first time in Japan. Looking forward to it!',
          messageLang: 'en',
          messageJa: '日本は初めてです。楽しみにしています！',
          payJpy: 13000,
          freeCancel: 'THREE_DAYS_BEFORE',
          lateFeeJpy: 3000,
          cancelDeadlineAt: freeCancelUntil('THREE_DAYS_BEFORE', date, '10:00'),
          policyAgreedAt: new Date(),
        },
      });
      const conv = await prisma.conversation.create({ data: { travelerId: traveler.id, listingId: listing.id } });
      await prisma.message.createMany({
        data: [
          {
            conversationId: conv.id,
            senderRole: 'TRAVELER',
            body: 'Hello! Is it OK to come with sneakers?',
            lang: 'en',
            translated: 'こんにちは！スニーカーで行っても大丈夫ですか？',
            translatedLang: 'ja',
            createdAt: new Date(Date.now() - 26 * 3_600_000),
            readAt: new Date(Date.now() - 25 * 3_600_000),
          },
          {
            conversationId: conv.id,
            senderRole: 'BUSINESS',
            body: t('はい、スニーカーで大丈夫です。畑は少しぬかるむことがあります。', {
              en: 'Yes, sneakers are fine. The field can be a little muddy.',
              zh: '可以，穿运动鞋没问题。茶园有时会有点泥泞。',
            }),
            lang: 'ja',
            translated: 'Yes, sneakers are fine. The field can be a little muddy.',
            translatedLang: 'en',
            createdAt: new Date(Date.now() - 24 * 3_600_000),
          },
        ],
      });
    }
  }

  // 必須項目が足りない下書きの例（一覧には出ない）
  const draftBiz = await prisma.business.create({ data: { name: '下書き工房' } });
  await prisma.user.create({
    data: { email: 'draft@example.com', name: '下書き工房', passwordHash: hash, role: 'BUSINESS', businessId: draftBiz.id, lang: 'ja', currency: 'JPY', privacyConsentAt: new Date() },
  });
  await prisma.listing.create({ data: { businessId: draftBiz.id, status: 'DRAFT', nameJa: '竹細工体験（準備中）', category: 'EXPERIENCE', area: 'kyoto_outer' } });

  await insertTranslations();

  console.log(`シード完了：公開中の店舗${SEEDS.length}件＋下書き1件`);
  console.log(`デモ用アカウント（パスワードはすべて「${PASSWORD}」。この表示は1回だけなので控えてください）`);
  console.log('  旅行者：traveler@example.com   事業者：biz@example.com（宇治の茶農家）、torikichi@example.com ほか   運営：admin@example.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
