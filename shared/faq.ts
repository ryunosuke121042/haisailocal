import type { Lang } from './constants.js';

// 「よくある質問」の初期セット（要確認事項）。全体的な質問は一般的な傾向として答える
export const FAQ_IDS = ['tip', 'cash', 'solo', 'late', 'shoes', 'otoshi'] as const;
export type FaqId = (typeof FAQ_IDS)[number];

export const FAQ: Record<FaqId, Record<Lang, { q: string; a: string }>> = {
  tip: {
    en: { q: 'Do I need to tip?', a: 'Most places in Japan do not expect a tip. Paying the listed price is enough.' },
    zh: { q: '需要给小费吗？', a: '日本的大多数店铺不需要小费，按标价付款即可。' },
    ko: { q: '팁이 필요한가요?', a: '일본의 대부분의 가게에서는 팁이 필요 없습니다. 표시된 금액만 내면 됩니다.' },
    fr: { q: 'Faut-il laisser un pourboire ?', a: "Dans la plupart des établissements au Japon, le pourboire n'est pas attendu. Le prix affiché suffit." },
    es: { q: '¿Hay que dejar propina?', a: 'En la mayoría de los lugares de Japón no se espera propina. Basta con pagar el precio indicado.' },
    ja: { q: 'チップは必要？', a: '日本のほとんどのお店では、チップは必要ありません。表示の料金を払えば大丈夫です。' },
  },
  cash: {
    en: { q: 'Is it cash only?', a: 'Small local places are often cash only. Each shop page shows whether cards are accepted, so bring some yen just in case.' },
    zh: { q: '只能付现金吗？', a: '小型本地店铺常常只收现金。每家店的页面都会显示能否刷卡，建议备些日元。' },
    ko: { q: '현금만 되나요?', a: '작은 동네 가게는 현금만 받는 경우가 많습니다. 가게 페이지에서 카드 가능 여부를 확인하고 엔화를 조금 준비하세요.' },
    fr: { q: 'Seulement en espèces ?', a: "Les petits établissements n'acceptent souvent que les espèces. Chaque fiche indique si la carte est acceptée ; prévoyez quelques yens." },
    es: { q: '¿Solo efectivo?', a: 'Los locales pequeños a menudo solo aceptan efectivo. Cada ficha indica si se acepta tarjeta; lleva algunos yenes por si acaso.' },
    ja: { q: '現金だけ？', a: '小さな地元のお店は現金のみのことがよくあります。各店のページにカードが使えるかを載せているので、念のため円を用意しておくと安心です。' },
  },
  solo: {
    en: { q: 'Can I go alone?', a: 'Many places welcome solo guests. Use the "Solo welcome" filter to find them.' },
    zh: { q: '一个人可以去吗？', a: '很多店欢迎一人前往。使用“欢迎一人”筛选即可找到。' },
    ko: { q: '혼자 가도 되나요?', a: '혼자 오는 손님을 환영하는 가게가 많습니다. "1인 환영" 필터로 찾아보세요.' },
    fr: { q: 'Puis-je y aller seul ?', a: 'Beaucoup de lieux accueillent les clients seuls. Utilisez le filtre « Seul bienvenu ».' },
    es: { q: '¿Puedo ir solo?', a: 'Muchos lugares reciben bien a quien va solo. Usa el filtro «Bienvenido solo».' },
    ja: { q: '一人でも入れる？', a: '一人客を歓迎するお店はたくさんあります。「一人客歓迎」で絞り込めます。' },
  },
  late: {
    en: { q: 'What if I am late?', a: 'Message the shop in the chat as early as you can. If you do not show up, the shop can record a no-show, and its cancellation fee (shown on the booking) may apply.' },
    zh: { q: '迟到了怎么办？', a: '请尽早在聊天中告诉店家。如果未到店，店家可以记录为“未到店”，并可能按预约上显示的取消费收费。' },
    ko: { q: '늦으면 어떻게 하나요?', a: '가능한 한 빨리 채팅으로 가게에 알려 주세요. 오지 않으면 가게가 노쇼로 기록할 수 있고, 예약에 표시된 취소 수수료가 적용될 수 있습니다.' },
    fr: { q: 'Et si je suis en retard ?', a: "Prévenez l'établissement au plus vite dans la messagerie. En cas d'absence, il peut l'enregistrer et ses frais d'annulation (indiqués sur la réservation) peuvent s'appliquer." },
    es: { q: '¿Y si llego tarde?', a: 'Avisa al local por el chat lo antes posible. Si no te presentas, puede registrarlo y aplicar su cargo de cancelación (indicado en la reserva).' },
    ja: { q: '遅れそうなときは？', a: 'できるだけ早くチャットでお店に知らせてください。来店しなかった場合はお店が「来店なし」を記録でき、予約に表示されたキャンセル料がかかることがあります。' },
  },

  shoes: {
    en: { q: 'Do I take off my shoes?', a: 'Usually yes on tatami floors (zashiki). Follow the staff or look for a step where shoes are left.' },
    zh: { q: '需要脱鞋吗？', a: '榻榻米座位通常需要脱鞋。请跟随店员指引，或留意放鞋的台阶。' },
    ko: { q: '신발을 벗어야 하나요?', a: '다다미 자리에서는 보통 신발을 벗습니다. 직원의 안내를 따르거나 신발을 두는 단을 확인하세요.' },
    fr: { q: 'Faut-il enlever ses chaussures ?', a: "En général oui sur les tatamis. Suivez le personnel ou repérez la marche où l'on laisse les chaussures." },
    es: { q: '¿Me quito los zapatos?', a: 'Normalmente sí en suelos de tatami. Sigue al personal o busca el escalón donde se dejan los zapatos.' },
    ja: { q: '靴は脱ぐ？', a: '座敷（畳の席）では、ふつう靴を脱ぎます。お店の人の案内に従うか、靴を置く段差を目印にしてください。' },
  },
  otoshi: {
    en: { q: 'What is the small dish I did not order?', a: 'At izakaya, a small starter called otoshi is often served with a table charge (usually a few hundred yen). It is normal, not a mistake.' },
    zh: { q: '没点的小菜是什么？', a: '居酒屋常会端上一小碟叫“お通し”的小菜，并收取座位费（通常几百日元）。这是惯例，不是上错菜。' },
    ko: { q: '주문하지 않은 작은 요리는 뭔가요?', a: '이자카야에서는 오토시라는 기본 안주가 자릿세(보통 몇백 엔)와 함께 나옵니다. 실수가 아니라 관례입니다.' },
    fr: { q: "Quel est ce petit plat que je n'ai pas commandé ?", a: "Dans les izakaya, une petite entrée (otoshi) est souvent servie avec un couvert de quelques centaines de yens. C'est l'usage." },
    es: { q: '¿Qué es el platito que no pedí?', a: 'En los izakaya suelen servir un pequeño entrante (otoshi) con un cargo por mesa de unos cientos de yenes. Es lo normal.' },
    ja: { q: '頼んでいない小皿は？', a: '居酒屋では「お通し」という小皿が出て、席料（数百円ほど）がかかることがよくあります。間違いではなく、習慣です。' },
  },
};
