// 事業者がチャットで返信するときの定型文。タップで入力欄に入る。
// 旅行者の最新の質問（日本語訳と原文）に合う話題の返信を先に出す。
// 話題は旅行者側の「よくある質問」（辞書の chatQuick）とそろえている。

export interface ReplyTopic {
  /** 旅行者の質問にこれらの語が含まれたら、この話題の返信を先に出す */
  words: string[];
  replies: string[];
}

export const REPLY_TOPICS: ReplyTopic[] = [
  {
    words: ['予約なし', '予約', 'reservation', 'walk-in', 'walk in', '预约', '예약', 'réservation', 'reserva'],
    replies: ['予約なしでもご来店いただけます。', '混み合うことがあるため、アプリからのご予約をおすすめします。'],
  },
  {
    words: ['子ども', '子供', 'お子', 'こども', 'child', 'kid', '孩子', '아이', 'enfant', 'niño'],
    replies: ['お子様連れでも大歓迎です。', '申し訳ありませんが、お子様のご参加は小学生以上とさせていただいています。'],
  },
  {
    words: ['ベジ', '菜食', 'ヴィーガン', 'ビーガン', 'アレルギー', 'vegetarian', 'vegan', 'allerg', '素食', '过敏', '채식', '알레르기', 'végé', 'vegetar', 'alerg'],
    replies: [
      'ベジタリアン向けにご用意できます。ご予約時にお知らせください。',
      'アレルギーのある食材を教えていただければ、できる範囲で対応します。',
      '申し訳ありませんが、食事内容の変更には対応できません。',
    ],
  },
  {
    words: ['カード', 'クレジット', '現金', '支払', 'card', 'cash', 'pay', '刷卡', '信用卡', '现金', '카드', '현금', 'carte', 'tarjeta', 'efectivo'],
    replies: ['クレジットカードがご利用いただけます。', '現金のみのお支払いとなります。'],
  },
  {
    words: ['英語', '言葉', 'english', 'language', '英语', '영어', 'anglais', 'inglés'],
    replies: ['簡単な英語でしたら対応できます。', '英語は話せませんが、翻訳アプリを使ってご案内します。'],
  },
  {
    words: ['駐車', 'パーキング', 'parking', 'car', '停车', '주차', 'parking', 'aparcamiento'],
    replies: ['駐車場があります（無料）。', '駐車場はありません。近くのコインパーキングをご利用ください。'],
  },
  {
    words: ['荷物', 'スーツケース', 'luggage', 'baggage', 'suitcase', '行李', '짐', 'bagage', 'equipaje'],
    replies: ['大きなお荷物もお預かりできます。', '申し訳ありませんが、お荷物のお預かりはできません。駅のコインロッカーをご利用ください。'],
  },
  {
    words: ['写真', '撮影', 'photo', 'picture', '拍照', '사진', 'photo', 'foto'],
    replies: ['写真撮影は自由です。', 'ほかのお客様が写らないようにしていただければ、撮影していただけます。'],
  },
  {
    words: ['行き方', '駅', 'アクセス', '道', 'station', 'get there', 'direction', '车站', '怎么去', '역', 'gare', 'estación'],
    replies: ['最寄り駅から徒歩でお越しいただけます。お店の地図のボタンから道順をご確認ください。', '駅まで迎えに行くことができます。到着時刻を教えてください。'],
  },
  {
    words: ['遅れ', '遅刻', '遅く', 'late', 'delay', '迟到', '晚', '늦', 'retard', 'tarde'],
    replies: ['遅れても大丈夫です。お気をつけてお越しください。', '少しの遅れなら大丈夫です。30分以上遅れる場合はご連絡ください。'],
  },
];

/** どの質問にも使える返信 */
export const COMMON_REPLIES = [
  'お問い合わせありがとうございます。',
  'はい、大丈夫です。',
  '申し訳ありませんが、対応できません。',
  '確認して、あとでご連絡します。',
  'ご来店をお待ちしております。',
];

/** 旅行者の最新の質問に合う返信を先に、そのあとに共通の返信を並べる */
export function suggestReplies(lastQuestion: string): { suggested: string[]; common: string[] } {
  const q = lastQuestion.toLowerCase();
  const suggested = q ? REPLY_TOPICS.filter((topic) => topic.words.some((w) => q.includes(w.toLowerCase()))).flatMap((topic) => topic.replies) : [];
  return { suggested, common: COMMON_REPLIES };
}
