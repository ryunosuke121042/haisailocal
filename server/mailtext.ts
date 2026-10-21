// 旅行者へのメール・アプリ内通知の文面（表示言語）。事業者へは日本語で送る（notify.ts）
import type { Lang } from '../shared/constants.js';

export type TravelerMail = 'bookingConfirmed' | 'travelerCanceled' | 'shopCanceled' | 'newMessage' | 'passwordReset' | 'reminderDayBefore' | 'reminderSameDay' | 'reviewRequest';

export interface MailVars {
  shop?: string;
  when?: string; // 「2026-10-20 10:00 (JST)」
  party?: number;
  address?: string;
  pay?: string; // 「¥13,000（現金のみ）」
  deadline?: string;
  reason?: string;
  fee?: string;
  minutes?: number;
  url: string;
}

type Tpl = (v: MailVars) => [string, string];

const T: Record<Lang, Record<TravelerMail, Tpl>> = {
  en: {
    bookingConfirmed: (v) => [
      `Booking confirmed: ${v.shop}`,
      `Your booking is confirmed.\n\nPlace: ${v.shop}\nDate & time: ${v.when}\nPeople: ${v.party}\nAddress: ${v.address}\nPay at the place: ${v.pay}\nFree cancellation until: ${v.deadline}\n\nYour card is not charged now. Map, first-timer guide and chat:\n${v.url}`,
    ],
    travelerCanceled: (v) => [
      `Booking cancelled: ${v.shop}`,
      `You cancelled your booking at ${v.shop} on ${v.when}.${v.fee ? `\nThis was after the free cancellation deadline. Cancellation fee under the shop's policy: ${v.fee}. We will contact you before any charge.` : ''}\n${v.url}`,
    ],
    shopCanceled: (v) => [`Cancelled by the shop: ${v.shop}`, `We're sorry. ${v.shop} had to cancel your booking on ${v.when}.\nReason: ${v.reason}\nNo cancellation fee applies. Similar places nearby:\n${v.url}`],
    newMessage: (v) => [`New message from ${v.shop}`, `${v.shop} sent you a message. Read it in your language:\n${v.url}`],
    passwordReset: (v) => ['Reset your password', `Open this link within 1 hour to set a new password:\n${v.url}`],
    reminderDayBefore: (v) => [`Tomorrow: ${v.shop}`, `Reminder: you have a booking at ${v.shop} on ${v.when}.\nIf you can't make it, please cancel from here:\n${v.url}`],
    reminderSameDay: (v) => [`Starting soon: ${v.shop}`, `Your booking at ${v.shop} starts at ${v.when} (in about ${v.minutes} minutes).\nOpen the map:\n${v.url}`],
    reviewRequest: (v) => [`How was ${v.shop}?`, `Thanks for visiting ${v.shop}. Rate your visit with a few taps (you can skip):\n${v.url}`],
  },
  zh: {
    bookingConfirmed: (v) => [
      `预约已确认：${v.shop}`,
      `您的预约已确认。\n\n店铺：${v.shop}\n日期时间：${v.when}\n人数：${v.party}\n地址：${v.address}\n到店支付：${v.pay}\n免费取消截止：${v.deadline}\n\n现在不会从您的银行卡扣款。地图、初次指南与聊天：\n${v.url}`,
    ],
    travelerCanceled: (v) => [`预约已取消：${v.shop}`, `您已取消${v.shop}（${v.when}）的预约。${v.fee ? `\n本次取消已超过免费取消期限。按店铺规定的取消费：${v.fee}。如需收费，我们会事先联系您。` : ''}\n${v.url}`],
    shopCanceled: (v) => [`店家取消了预约：${v.shop}`, `非常抱歉，${v.shop}取消了您${v.when}的预约。\n原因：${v.reason}\n不收取取消费。附近类似的店：\n${v.url}`],
    newMessage: (v) => [`${v.shop}发来新消息`, `${v.shop}给您发了消息，可用您的语言阅读：\n${v.url}`],
    passwordReset: (v) => ['重设密码', `请在1小时内打开此链接设置新密码：\n${v.url}`],
    reminderDayBefore: (v) => [`明天：${v.shop}`, `提醒：您在${v.shop}有预约（${v.when}）。\n如果无法前往，请在这里取消：\n${v.url}`],
    reminderSameDay: (v) => [`即将开始：${v.shop}`, `您在${v.shop}的预约将于${v.when}开始（约${v.minutes}分钟后）。\n打开地图：\n${v.url}`],
    reviewRequest: (v) => [`${v.shop}怎么样？`, `感谢您光临${v.shop}。点几下即可评价（可跳过）：\n${v.url}`],
  },
  ko: {
    bookingConfirmed: (v) => [
      `예약 확정: ${v.shop}`,
      `예약이 확정되었습니다.\n\n가게: ${v.shop}\n일시: ${v.when}\n인원: ${v.party}\n주소: ${v.address}\n현장 결제: ${v.pay}\n무료 취소 기한: ${v.deadline}\n\n지금 카드로 청구되지 않습니다. 지도, 첫 방문 가이드, 채팅:\n${v.url}`,
    ],
    travelerCanceled: (v) => [`예약 취소: ${v.shop}`, `${v.shop}(${v.when}) 예약을 취소했습니다.${v.fee ? `\n무료 취소 기한 이후의 취소입니다. 가게 규정에 따른 취소 수수료: ${v.fee}. 청구 전에 연락드립니다.` : ''}\n${v.url}`],
    shopCanceled: (v) => [`가게 사정으로 취소: ${v.shop}`, `죄송합니다. ${v.shop}에서 ${v.when} 예약을 취소했습니다.\n사유: ${v.reason}\n취소 수수료는 없습니다. 근처 비슷한 곳:\n${v.url}`],
    newMessage: (v) => [`${v.shop}의 새 메시지`, `${v.shop}에서 메시지가 왔습니다. 내 언어로 읽기:\n${v.url}`],
    passwordReset: (v) => ['비밀번호 재설정', `1시간 이내에 이 링크를 열어 새 비밀번호를 설정하세요:\n${v.url}`],
    reminderDayBefore: (v) => [`내일: ${v.shop}`, `알림: ${v.shop} 예약(${v.when})이 있습니다.\n갈 수 없다면 여기에서 취소해 주세요:\n${v.url}`],
    reminderSameDay: (v) => [`곧 시작: ${v.shop}`, `${v.shop} 예약이 ${v.when}에 시작됩니다(약 ${v.minutes}분 후).\n지도 열기:\n${v.url}`],
    reviewRequest: (v) => [`${v.shop}는 어떠셨나요?`, `${v.shop}에 방문해 주셔서 감사합니다. 몇 번의 탭으로 평가해 주세요(건너뛰기 가능):\n${v.url}`],
  },
  fr: {
    bookingConfirmed: (v) => [
      `Réservation confirmée : ${v.shop}`,
      `Votre réservation est confirmée.\n\nLieu : ${v.shop}\nDate et heure : ${v.when}\nPersonnes : ${v.party}\nAdresse : ${v.address}\nÀ payer sur place : ${v.pay}\nAnnulation gratuite jusqu'au : ${v.deadline}\n\nVotre carte n'est pas débitée. Carte, guide et messagerie :\n${v.url}`,
    ],
    travelerCanceled: (v) => [`Réservation annulée : ${v.shop}`, `Vous avez annulé votre réservation chez ${v.shop} le ${v.when}.${v.fee ? `\nAnnulation après la date limite gratuite. Frais selon l'établissement : ${v.fee}. Nous vous contacterons avant tout débit.` : ''}\n${v.url}`],
    shopCanceled: (v) => [`Annulée par l'établissement : ${v.shop}`, `Nous sommes désolés. ${v.shop} a dû annuler votre réservation du ${v.when}.\nMotif : ${v.reason}\nAucuns frais d'annulation. Lieux similaires à proximité :\n${v.url}`],
    newMessage: (v) => [`Nouveau message de ${v.shop}`, `${v.shop} vous a envoyé un message. À lire dans votre langue :\n${v.url}`],
    passwordReset: (v) => ['Réinitialiser le mot de passe', `Ouvrez ce lien dans l'heure pour définir un nouveau mot de passe :\n${v.url}`],
    reminderDayBefore: (v) => [`Demain : ${v.shop}`, `Rappel : réservation chez ${v.shop} le ${v.when}.\nSi vous ne pouvez pas venir, annulez ici :\n${v.url}`],
    reminderSameDay: (v) => [`Bientôt : ${v.shop}`, `Votre réservation chez ${v.shop} commence à ${v.when} (dans environ ${v.minutes} minutes).\nOuvrir la carte :\n${v.url}`],
    reviewRequest: (v) => [`Comment était ${v.shop} ?`, `Merci de votre visite chez ${v.shop}. Notez-la en quelques touches (facultatif) :\n${v.url}`],
  },
  es: {
    bookingConfirmed: (v) => [
      `Reserva confirmada: ${v.shop}`,
      `Tu reserva está confirmada.\n\nLugar: ${v.shop}\nFecha y hora: ${v.when}\nPersonas: ${v.party}\nDirección: ${v.address}\nPago en el lugar: ${v.pay}\nCancelación gratuita hasta: ${v.deadline}\n\nNo se cobra nada en tu tarjeta ahora. Mapa, guía y chat:\n${v.url}`,
    ],
    travelerCanceled: (v) => [`Reserva cancelada: ${v.shop}`, `Cancelaste tu reserva en ${v.shop} el ${v.when}.${v.fee ? `\nFue después del plazo de cancelación gratuita. Cargo según el local: ${v.fee}. Te contactaremos antes de cualquier cobro.` : ''}\n${v.url}`],
    shopCanceled: (v) => [`Cancelada por el local: ${v.shop}`, `Lo sentimos. ${v.shop} tuvo que cancelar tu reserva del ${v.when}.\nMotivo: ${v.reason}\nSin cargo de cancelación. Lugares similares cerca:\n${v.url}`],
    newMessage: (v) => [`Nuevo mensaje de ${v.shop}`, `${v.shop} te envió un mensaje. Léelo en tu idioma:\n${v.url}`],
    passwordReset: (v) => ['Restablecer contraseña', `Abre este enlace en menos de 1 hora para crear una nueva contraseña:\n${v.url}`],
    reminderDayBefore: (v) => [`Mañana: ${v.shop}`, `Recordatorio: tienes una reserva en ${v.shop} el ${v.when}.\nSi no puedes ir, cancela aquí:\n${v.url}`],
    reminderSameDay: (v) => [`Empieza pronto: ${v.shop}`, `Tu reserva en ${v.shop} empieza a las ${v.when} (en unos ${v.minutes} minutos).\nAbrir el mapa:\n${v.url}`],
    reviewRequest: (v) => [`¿Qué tal ${v.shop}?`, `Gracias por visitar ${v.shop}. Valora tu visita con unos toques (opcional):\n${v.url}`],
  },
  ja: {
    bookingConfirmed: (v) => [
      `予約確定：${v.shop}`,
      `予約が確定しました。\n\nお店：${v.shop}\n日時：${v.when}\n人数：${v.party}名\n住所：${v.address}\n現地で払う金額：${v.pay}\n無料キャンセルの期限：${v.deadline}\n\nカードへの請求はありません。地図・はじめてガイド・チャット：\n${v.url}`,
    ],
    travelerCanceled: (v) => [`予約をキャンセルしました：${v.shop}`, `${v.shop}（${v.when}）の予約をキャンセルしました。${v.fee ? `\n無料キャンセルの期限後のため、お店の規定によるキャンセル料は ${v.fee} です。請求する場合は事前にご連絡します。` : ''}\n${v.url}`],
    shopCanceled: (v) => [`お店の都合によるキャンセル：${v.shop}`, `申し訳ありません。${v.shop}が${v.when}の予約をキャンセルしました。\n理由：${v.reason}\nキャンセル料はかかりません。近くの似たお店：\n${v.url}`],
    newMessage: (v) => [`${v.shop}から新しいメッセージ`, `${v.shop}からメッセージが届きました：\n${v.url}`],
    passwordReset: (v) => ['パスワードの再設定', `1時間以内にこのリンクを開いて、新しいパスワードを設定してください：\n${v.url}`],
    reminderDayBefore: (v) => [`明日の予定：${v.shop}`, `${v.shop}（${v.when}）の予約があります。\n行けなくなった場合は、こちらからキャンセルしてください：\n${v.url}`],
    reminderSameDay: (v) => [`まもなく：${v.shop}`, `${v.shop}の予約は${v.when}からです（あと約${v.minutes}分）。\n地図を開く：\n${v.url}`],
    reviewRequest: (v) => [`${v.shop}はどうでしたか？`, `${v.shop}へのご来店ありがとうございました。タップで評価できます（スキップ可）：\n${v.url}`],
  },
};

export function travelerMail(lang: Lang, kind: TravelerMail, v: MailVars): { subject: string; body: string } {
  const [subject, body] = (T[lang] ?? T.en)[kind](v);
  return { subject, body };
}

/** 事業者キャンセルの理由（旅行者へ翻訳して伝える定型文） */
export const BIZ_REASON_TEXT: Record<'CLOSURE' | 'WEATHER' | 'OTHER', Record<Lang, string>> = {
  CLOSURE: { en: 'The shop is unexpectedly closed that day.', zh: '店铺当天临时停业。', ko: '가게가 그날 임시 휴업합니다.', fr: "L'établissement est exceptionnellement fermé ce jour-là.", es: 'El local cierra de forma imprevista ese día.', ja: '臨時休業のため' },
  WEATHER: { en: 'Because of the weather.', zh: '由于天气原因。', ko: '날씨 때문입니다.', fr: 'En raison de la météo.', es: 'Por el tiempo.', ja: '天候のため' },
  OTHER: { en: 'For other reasons.', zh: '其他原因。', ko: '기타 사유입니다.', fr: 'Pour d’autres raisons.', es: 'Por otros motivos.', ja: 'その他の理由のため' },
};

export const PAY_TEXT: Record<'CASH_ONLY' | 'CARD_OK', Record<Lang, string>> = {
  CASH_ONLY: { en: 'cash only', zh: '仅限现金', ko: '현금만', fr: 'espèces uniquement', es: 'solo efectivo', ja: '現金のみ' },
  CARD_OK: { en: 'cash or card', zh: '现金或银行卡', ko: '현금 또는 카드', fr: 'espèces ou carte', es: 'efectivo o tarjeta', ja: '現金・カード可' },
};
