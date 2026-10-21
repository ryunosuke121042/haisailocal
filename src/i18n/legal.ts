// プライバシーポリシーと利用規約（要約）。専門家の確認前のたたき台（仕様書「利用規約の方針」「個人情報の扱い」）
import type { Lang } from '../../shared/constants';

export interface LegalSection {
  h: string;
  p: string[];
}
export interface LegalDoc {
  draftNote: string;
  privacy: LegalSection[];
  terms: LegalSection[];
}

const en: LegalDoc = {
  draftNote: 'Draft before expert review. Content may change.',
  privacy: [
    {
      h: 'What we collect',
      p: [
        'Email address, password (stored as a hash), your name (shown to places you book with), display language and currency, today’s wishes such as budget and dietary needs, bookings, messages with places, ratings, saved places and notifications.',
        'Religious dietary rules and allergies are collected only if you agree on a separate screen. Religious information is “special care-required personal information” under Japan’s Act on the Protection of Personal Information; we handle allergies the same way because they concern your health.',
        'Reviews: you can add photos to a review. Photos are shown publicly on the place’s page (do not include other people’s faces). You may also answer “About you” (country/region, religion, gender, age group, trip type) — this is optional and saved only if you agree. These answers are shown only as combined charts on the place’s page, only when at least 3 people have answered, and are never shown with your review or name.',
        'Your location is used only when you tap “Near me”, to sort places by distance. It is not stored.',
        'A card must be registered to book, but nothing is charged at booking. During this trial the card screen is a demo: card details are not sent or stored.',
      ],
    },
    {
      h: 'Why we use it',
      p: [
        'To show places that suit you and hide places that do not (religious rules and allergies are used only for this), to send your bookings and messages to places, to notify you in the app and by email (booking confirmations, reminders the day before or before a same-day visit, rating requests and messages), and to improve translation quality and handle booking problems.',
      ],
    },
    {
      h: 'External services (including outside Japan)',
      p: [
        'We send only the text that is needed. Your name and email address are never sent to the AI service.',
        'Anthropic, PBC (United States): AI translation of listings and messages, and Maru’s AI features. Maru turns your wishes into search filters and answers questions only while it is shown. While Maru is hidden, nothing is sent to the AI service.',
        'Google LLC (United States) — Gemini: used together with, or instead of, Anthropic for the same AI translation and Maru’s AI features. Only the text needed for the task is sent; never your name or email address.',
        'Translated S.r.l. (Italy, EU) — MyMemory: free machine translation used in this demo when AI translation is not set up. Only the text to translate is sent. The EU applies the GDPR, and Japan recognizes the EU as having an equivalent level of personal data protection.',
        'Resend (United States): email delivery. It receives your email address and the content of the email. Vercel Inc. (United States) and Neon (United States): hosting and database.',
        'Maps: when a map is shown, your browser loads map tiles (OpenFreeMap, using OpenStreetMap data), and the tile server sees your IP address.',
        'The United States has no single comprehensive federal privacy law; protection depends on sector-specific laws and state laws such as the California Consumer Privacy Act. Measures taken: a commercial plan for the AI service that does not use submitted data for training, encryption in transit, and providers’ published retention and security programs. We refer to the information on foreign systems published by Japan’s Personal Information Protection Commission.',
      ],
    },
    {
      h: 'How long we keep it',
      p: ['Translation logs and AI interaction logs are deleted after a set period (draft: one year after the visit date). Account data is kept until you delete your account.'],
    },
    {
      h: 'Your choices',
      p: ['You can withdraw consent for religious rules and allergies in Settings at any time; your answers are then deleted. You can hide Maru in Settings to stop sending text to the AI service. For account deletion or questions, contact support@example.com.'],
    },
  ],
  terms: [
    {
      h: 'The service and listings',
      p: [
        'This app helps travelers find small local experiences, restaurants and tours in Kansai, Japan, chat with places in their own language using AI translation, and book them.',
        'Places are small local businesses that register themselves. A listing is published as soon as the place saves it, without prior review. Information about a place (such as its customers, regulars, guidebook listings, years in business, who serves you, distance from the main station and food information) is self-reported by the place.',
        'You can report a listing. We check reports and may unpublish listings.',
      ],
    },
    {
      h: 'Bookings and payment',
      p: [
        'Each place sets time slots and a maximum number of people per slot. Your booking is confirmed immediately if the chosen slot has room.',
        'You pay the place directly on site in Japanese yen, by cash or card as shown for each place. A card must be registered to book, but nothing is charged at booking. During this trial the card screen is a demo and card details are not sent or stored.',
      ],
    },
    {
      h: 'Cancellation',
      p: [
        'Each place sets a free-cancellation deadline (until the start time, until the day before, or until 3 days before) and may set a fixed late-cancellation fee per person. These are shown before you book.',
        'You can cancel in the app until the start time. Cancelling after the deadline or not showing up is recorded, and the late-cancellation fee shown before booking may apply. Fees are not charged automatically: we decide whether to charge your registered card and will contact you before any charge.',
        'A place may cancel a confirmed booking, for example because of a sudden closure or the weather. In that case no fee applies, and you are notified of the reason, translated into your language.',
      ],
    },
    {
      h: 'Allergy and food information',
      p: [
        'Allergy and food information is registered by each place. The halal mark is shown only for certified places. We try to check this information, but we cannot guarantee that it is accurate; each place is responsible for the accuracy of what it registers. If you have a serious allergy, always confirm directly with the place before booking and when you arrive.',
        'Except in cases of our intentional misconduct or gross negligence, our liability for damages is limited to the fees we received for the booking concerned. No fees are charged during this trial.',
      ],
    },
    {
      h: 'Ratings',
      p: [
        'Only travelers who booked in the app and visited can rate, once per booking, using stars (1–5) and preset tags. Free-text comments are not available. Business accounts cannot rate.',
        'Places must not ask for high ratings or offer rewards for ratings. We may hide ratings we judge to be false or inappropriate. Requests to remove a rating can be sent to support@example.com; we review them.',
      ],
    },
    {
      h: 'Messages',
      p: ['Do not send harassing or inappropriate messages. A place can block a traveler; a blocked traveler cannot message or book that place.'],
    },
  ],
};

const ja: LegalDoc = {
  draftNote: '専門家の確認前のたたき台です。内容は変わることがあります。',
  privacy: [
    {
      h: '取得する情報',
      p: [
        'メールアドレス、パスワード（ハッシュ化して保存）、お名前（予約したお店に表示されます）、表示言語と通貨、今日の希望（予算・食事の条件など）、予約、お店とのメッセージ、評価、保存したお店、お知らせ。',
        '宗教上の食事の決まりとアレルギーは、別の画面で同意いただいた場合にだけ取得します。宗教上の情報は個人情報保護法の要配慮個人情報にあたります。アレルギーも健康に関わる情報のため、同じ扱いにします。',
        'レビュー：レビューには写真を付けられます。写真はお店のページで公開されます（ほかの人の顔が写らないようにしてください）。また、任意で「あなたについて」（国・地域、宗教、性別、年代、利用シーン）に答えられます。答えるかどうかは自由で、同意した場合だけ保存します。回答はお店のページで、3件以上集まった項目だけをグラフに集計して表示し、あなたのレビューや名前と結びつけて表示することはありません。',
        '位置情報は「現在地の近く」を押したときに、距離順に並べるためだけに使い、保存しません。',
        '予約にはカードの登録が必要ですが、予約時には何も請求されません。お試し期間中、カード登録画面はダミーで、カード情報は送信・保存されません。',
      ],
    },
    {
      h: '利用目的',
      p: ['あなたに合うお店を表示し、合わないお店を除くため（宗教上の決まり・アレルギーはこの目的にだけ使います）、予約とメッセージをお店に届けるため、アプリ内のお知らせとメールで連絡するため（予約確定、前日・当日来店前のリマインダー、評価のお願い、メッセージ）、翻訳精度の改善と予約トラブルへの対応のため。'],
    },
    {
      h: '外部サービスへの送信（外国にある第三者への提供を含む）',
      p: [
        '送るのは必要な文章だけです。お名前やメールアドレスをAIサービスへ送ることはありません。',
        'Anthropic, PBC（米国）：掲載内容とメッセージのAI翻訳、まるのAI機能。まるは、表示している間だけ、あなたの希望を検索条件に置き換えたり質問に答えたりします。まるを非表示にしている間は、AIサービスへは何も送りません。',
        'Google LLC（米国）— Gemini：Anthropic と同じAI翻訳とまるのAI機能に、併用または代わりに使います。送るのは処理に必要な文章だけで、名前やメールアドレスは送りません。',
        'Translated S.r.l.（イタリア・EU）— MyMemory：このデモでAI翻訳を設定していないときに使う無料の機械翻訳。送るのは翻訳する文章だけです。EUにはGDPRがあり、日本はEUを個人情報の保護について同等の水準にあると認めています。',
        'Resend（米国）：メールの配信。メールアドレスとメールの内容を受け取ります。Vercel Inc.（米国）とNeon（米国）：ホスティングとデータベース。',
        '地図：地図を表示すると、ブラウザが地図タイル（OpenFreeMap、OpenStreetMapのデータ）を読み込み、タイルサーバーにIPアドレスが伝わります。',
        '米国には包括的な連邦の個人情報保護法がなく、分野別の法律やカリフォルニア州消費者プライバシー法などの州法で保護されます。講じている措置：送信データを学習に使わないAIサービスの商用プラン、通信の暗号化、提供先が公開している保存期間とセキュリティ体制。外国の制度については、個人情報保護委員会が公表している情報を参考にしています。',
      ],
    },
    { h: '保存期間', p: ['翻訳ログとAIとのやりとりのログは、保存期間（案：来店日から1年）を過ぎたら削除します。アカウント情報は、アカウントを削除するまで保存します。'] },
    {
      h: 'あなたが選べること',
      p: ['宗教上の決まり・アレルギーの同意は、設定からいつでも取り下げられ、回答は削除されます。設定でまるを非表示にすると、AIサービスへの送信を止められます。アカウントの削除やお問い合わせは support@example.com まで。'],
    },
  ],
  terms: [
    {
      h: 'サービスと掲載情報',
      p: [
        'このアプリは、旅行者が関西の小さな地元の体験・飲食店・ツアーを探し、AI翻訳で自分の言語のままお店とやりとりし、予約できるサービスです。',
        'お店は、地元の小さな事業者が自分で登録します。掲載は、事業者が保存した時点で公開され、事前の審査はありません。お店の情報（客層、常連、ガイドブック掲載、営業年数、対応する人、主要駅からの距離、食事の情報など）は、お店の自己申告です。',
        '旅行者は掲載を通報できます。運営は通報を確認し、掲載を非公開にすることがあります。',
      ],
    },
    {
      h: '予約と支払い',
      p: [
        'お店ごとに時間枠と1枠あたりの最大人数が設定されています。選んだ時間枠に空きがあれば、予約はその場で確定します。',
        '代金は現地で、日本円でお店に直接お支払いください（現金かカードかは、お店ごとの表示に従います）。予約にはカードの登録が必要ですが、予約時には何も請求されません。お試し期間中、カード登録画面はダミーで、カード情報は送信・保存されません。',
      ],
    },
    {
      h: 'キャンセル',
      p: [
        'お店ごとに無料キャンセルの期限（開始時刻まで／前日まで／3日前まで）と、必要に応じて1人あたりの定額の期限後キャンセル料が設定されており、予約前に表示します。',
        'アプリからのキャンセルは開始時刻までできます。期限を過ぎたキャンセルや来店なしは記録され、予約前に表示したキャンセル料がかかることがあります。自動では請求しません。登録カードに請求するかどうかは運営が判断し、請求する前に必ずご連絡します。',
        'お店が確定済みの予約を取り消すことがあります（急な休業や天候など）。その場合キャンセル料はかからず、理由を翻訳してお知らせします。',
      ],
    },
    {
      h: 'アレルギー・食事の情報',
      p: [
        'アレルギーや食事に関する情報は、各お店が登録したものです。ハラールの表示は認証を受けたお店にだけ付きます。当社は確認に努めますが、正確性を保証するものではなく、登録内容の正確性はお店が責任を負います。重いアレルギーをお持ちの方は、予約前と来店時に、必ずお店へ直接ご確認ください。',
        '当社の損害賠償責任は、当社の故意または重大な過失による場合を除き、当該予約に関して当社が受け取った手数料の額を上限とします。お試し期間中、手数料はいただいていません。',
      ],
    },
    {
      h: '評価',
      p: [
        '評価できるのは、アプリで予約して来店した旅行者だけで、1回の予約につき1件です。評価は星（1〜5）と用意されたタグだけで行い、自由記述のコメントはありません。事業者アカウントは評価できません。',
        'お店は、高い評価を求めたり、評価の見返りに特典を出したりしてはいけません。当社は、虚偽または不適切と判断した評価を非表示にすることがあります。評価の削除の申出は support@example.com で受け付け、確認します。',
      ],
    },
    { h: 'メッセージ', p: ['嫌がらせや不適切なメッセージを送らないでください。お店は旅行者をブロックでき、ブロックされた旅行者はそのお店にメッセージを送ったり予約したりできなくなります。'] },
  ],
};

const zh: LegalDoc = {
  draftNote: '本文为专家审核前的草案，内容可能会有变更。',
  privacy: [
    {
      h: '我们收集的信息',
      p: [
        '电子邮件地址、密码（以哈希形式保存）、您的姓名（会显示给您预订的地点）、显示语言和货币、今天的需求（如预算和饮食需求）、预订、与地点之间的消息、评价、收藏的地点以及通知。',
        '宗教饮食规定和过敏信息仅在您于单独页面上同意后才会收集。根据日本《个人信息保护法》，宗教信息属于“需特别注意的个人信息”；由于过敏信息涉及您的健康，我们也以相同方式处理。',
        '评价：评价可以附上照片，照片会在店铺页面公开（请勿拍到他人的脸）。你也可以自愿填写“关于你”（国家/地区、宗教、性别、年龄段、出行类型），仅在你同意时保存。这些回答只会在店铺页面以汇总图表显示，且仅显示回答数达到3条及以上的项目，绝不会与你的评价或姓名一起显示。',
        '仅在您点击“我附近”时使用您的位置信息，用于按距离排序，且不会保存。',
        '预订时需要登记银行卡，但预订时不会扣款。本试运行期间，银行卡页面仅为演示：卡信息不会被发送或保存。',
      ],
    },
    {
      h: '使用目的',
      p: [
        '为您显示适合您的地点并隐藏不适合的地点（宗教规定和过敏信息仅用于此目的）、向地点发送您的预订和消息、通过应用内通知和电子邮件联系您（预订确认、前一天或当天到访前的提醒、评价邀请以及消息），以及改进翻译质量和处理预订问题。',
      ],
    },
    {
      h: '外部服务（包括日本境外）',
      p: [
        '我们只发送必要的文本，绝不会将您的姓名或电子邮件地址发送给AI服务。',
        'Anthropic, PBC（美国）：地点信息和消息的AI翻译，以及Maru（まる）的AI功能。Maru仅在显示期间将您的需求转换为搜索条件并回答问题。在Maru隐藏期间，不会向AI服务发送任何内容。',
        'Google LLC（美国）— Gemini：与 Anthropic 一同或代替其用于相同的AI翻译和Maru（まる）的AI功能。仅发送处理所需的文本，不会发送您的姓名或电子邮件地址。',
        'Translated S.r.l.（意大利，欧盟）— MyMemory：本演示在未设置AI翻译时使用的免费机器翻译，仅发送需要翻译的文本。欧盟适用GDPR，日本认定欧盟的个人信息保护水平与日本同等。',
        'Resend（美国）：电子邮件发送，会接收您的电子邮件地址和邮件内容。Vercel Inc.（美国）和Neon（美国）：托管和数据库。',
        '地图：显示地图时，您的浏览器会加载地图图块（OpenFreeMap，使用OpenStreetMap数据），图块服务器会看到您的IP地址。',
        '美国没有统一的综合性联邦隐私法；保护依赖于各行业法律以及《加利福尼亚州消费者隐私法》等州法律。所采取的措施：不将提交的数据用于训练的AI服务商业方案、传输加密，以及服务提供方公开的数据保存期限和安全体系。关于外国制度，我们参考日本个人信息保护委员会公布的信息。',
      ],
    },
    {
      h: '保存期限',
      p: ['翻译日志和AI交互日志将在规定期限（草案：到访日期起一年）届满后删除。账户数据将保存至您删除账户为止。'],
    },
    {
      h: '您的选择',
      p: ['您可以随时在“设置”中撤回对宗教规定和过敏信息的同意，届时您的回答将被删除。您可以在“设置”中隐藏Maru，以停止向AI服务发送文本。如需删除账户或有任何疑问，请联系 support@example.com。'],
    },
  ],
  terms: [
    {
      h: '服务与地点信息',
      p: [
        '本应用帮助旅客寻找日本关西地区的小型当地体验、餐厅和导览活动，借助AI翻译用自己的语言与地点沟通并进行预订。',
        '地点由当地小型商家自行登记。商家保存后，地点信息即刻公开，不经事先审核。有关地点的信息（如客群、常客、旅游指南收录情况、营业年数、由谁接待、与主要车站的距离以及饮食信息）均由地点自行申报。',
        '您可以举报地点信息。我们会核查举报，并可能将地点信息下架。',
      ],
    },
    {
      h: '预订与付款',
      p: [
        '每个地点会设置时段以及每个时段的最多人数。如果所选时段尚有空位，预订会立即确定。',
        '请在现场以日元直接向地点付款，可使用现金或银行卡，以各地点的显示为准。预订时需要登记银行卡，但预订时不会扣款。本试运行期间，银行卡页面仅为演示，卡信息不会被发送或保存。',
      ],
    },
    {
      h: '取消',
      p: [
        '每个地点会设置免费取消期限（开始时间前／前一天前／3天前），并可设置每人固定的逾期取消费用。这些内容会在预订前显示。',
        '您可以在开始时间前通过应用取消。超过期限取消或未到店将被记录，并可能收取预订前所显示的逾期取消费用。费用不会自动扣取：由我们决定是否从您登记的银行卡扣款，并会在扣款前与您联系。',
        '地点可能会取消已确定的预订（例如临时停业或天气原因）。在这种情况下不收取任何费用，我们会将翻译后的取消原因通知您。',
      ],
    },
    {
      h: '过敏和饮食信息',
      p: [
        '过敏和饮食信息由各地点登记。清真标志仅显示于已获认证的地点。我们会尽力核查，但不能保证信息准确；地点对其登记内容的准确性负责。如果您有严重过敏，请务必在预订前和到店时直接向地点确认。',
        '除因我们的故意或重大过失所致的情况外，我们的损害赔偿责任以我们就相关预订所收取的手续费金额为上限。本试运行期间不收取任何手续费。',
      ],
    },
    {
      h: '评价',
      p: [
        '只有通过本应用预订并已到访的旅客才能评价，每次预订限评价一次，评价仅使用星级（1–5）和预设标签，不提供自由文本评论。商家账户不能评价。',
        '地点不得要求高评价，也不得为评价提供奖励。对于我们判断为虚假或不当的评价，我们可能予以隐藏。删除评价的请求可发送至 support@example.com，我们会进行审核。',
      ],
    },
    {
      h: '消息',
      p: ['请勿发送骚扰或不当的消息。地点可以屏蔽旅客；被屏蔽的旅客无法向该地点发送消息或进行预订。'],
    },
  ],
};

const ko: LegalDoc = {
  draftNote: '전문가 검토 전의 초안입니다. 내용은 변경될 수 있습니다.',
  privacy: [
    {
      h: '수집하는 정보',
      p: [
        '이메일 주소, 비밀번호(해시로 저장), 이름(예약한 장소에 표시됨), 표시 언어와 통화, 오늘의 희망 사항(예산, 식사 조건 등), 예약, 장소와의 메시지, 평가, 저장한 장소, 알림.',
        '종교상 식사 규정과 알레르기는 별도 화면에서 동의하신 경우에만 수집합니다. 종교 정보는 일본 「개인정보 보호에 관한 법률」상 ‘요배려 개인정보’(특별한 배려가 필요한 개인정보)에 해당하며, 알레르기도 건강과 관련된 정보이므로 동일하게 취급합니다.',
        '후기: 후기에 사진을 첨부할 수 있으며, 사진은 가게 페이지에 공개됩니다(다른 사람의 얼굴이 찍히지 않도록 해 주세요). 또한 선택적으로 "나에 대해"(국가/지역, 종교, 성별, 연령대, 여행 유형)에 답할 수 있으며, 동의한 경우에만 저장합니다. 답변은 가게 페이지에서 답변이 3건 이상 모인 항목만 합산 그래프로 표시하며, 회원님의 후기나 이름과 연결해서 표시하지 않습니다.',
        '위치 정보는 ‘내 주변’을 누를 때에만 거리순 정렬을 위해 사용하며, 저장하지 않습니다.',
        '예약하려면 카드를 등록해야 하지만, 예약 시에는 아무것도 청구되지 않습니다. 이번 시범 운영 기간에는 카드 화면이 데모이며, 카드 정보는 전송되거나 저장되지 않습니다.',
      ],
    },
    {
      h: '이용 목적',
      p: [
        '회원님께 맞는 장소를 표시하고 맞지 않는 장소를 제외하기 위해(종교상 규정과 알레르기는 이 목적으로만 사용합니다), 예약과 메시지를 장소에 전달하기 위해, 앱 내 알림과 이메일로 안내하기 위해(예약 확정, 전날 또는 당일 방문 전 리마인더, 평가 요청, 메시지), 그리고 번역 품질 개선과 예약 문제 처리를 위해 이용합니다.',
      ],
    },
    {
      h: '외부 서비스(일본 국외 포함)',
      p: [
        '필요한 문장만 전송하며, 이름이나 이메일 주소는 AI 서비스로 절대 전송하지 않습니다.',
        'Anthropic, PBC(미국): 게재 정보와 메시지의 AI 번역, 마루(まる)의 AI 기능. 마루는 표시되어 있는 동안에만 회원님의 희망 사항을 검색 조건으로 바꾸고 질문에 답합니다. 마루를 숨긴 동안에는 AI 서비스로 아무것도 전송하지 않습니다.',
        'Google LLC(미국) — Gemini: Anthropic과 함께 또는 대신하여 같은 AI 번역과 마루(まる)의 AI 기능에 사용합니다. 처리에 필요한 텍스트만 전송하며, 이름이나 이메일 주소는 전송하지 않습니다.',
        'Translated S.r.l.(이탈리아, EU) — MyMemory: 이 데모에서 AI 번역이 설정되지 않았을 때 사용하는 무료 기계 번역. 번역할 텍스트만 전송합니다. EU에는 GDPR이 적용되며, 일본은 EU의 개인정보 보호 수준을 일본과 동등하다고 인정하고 있습니다.',
        'Resend(미국): 이메일 발송. 이메일 주소와 이메일 내용을 받습니다. Vercel Inc.(미국)와 Neon(미국): 호스팅 및 데이터베이스.',
        '지도: 지도가 표시되면 브라우저가 지도 타일(OpenFreeMap, OpenStreetMap 데이터)을 불러오며, 타일 서버는 회원님의 IP 주소를 알 수 있습니다.',
        '미국에는 단일한 포괄적 연방 개인정보 보호법이 없으며, 분야별 법률과 캘리포니아 소비자 프라이버시법(California Consumer Privacy Act) 등의 주법으로 보호됩니다. 보호 조치: 전송된 데이터를 학습에 사용하지 않는 AI 서비스 상용 플랜, 통신 암호화, 제공처가 공개한 보존 기간 및 보안 체계. 외국 제도에 관해서는 일본 개인정보보호위원회가 공표한 정보를 참고하고 있습니다.',
      ],
    },
    {
      h: '보존 기간',
      p: ['번역 로그와 AI 상호작용 로그는 정해진 기간(안: 방문일로부터 1년)이 지나면 삭제합니다. 계정 정보는 계정을 삭제할 때까지 보존합니다.'],
    },
    {
      h: '회원님이 선택할 수 있는 사항',
      p: ['종교상 규정과 알레르기에 대한 동의는 설정에서 언제든지 철회할 수 있으며, 이 경우 답변은 삭제됩니다. 설정에서 마루를 숨기면 AI 서비스로의 문장 전송을 중지할 수 있습니다. 계정 삭제나 문의는 support@example.com 으로 연락해 주세요.'],
    },
  ],
  terms: [
    {
      h: '서비스와 게재 정보',
      p: [
        '이 앱은 여행자가 일본 간사이 지역의 작은 현지 체험, 음식점, 투어를 찾고, AI 번역으로 자신의 언어로 장소와 대화하며 예약할 수 있는 서비스입니다.',
        '장소는 지역의 소규모 사업자가 직접 등록합니다. 게재 정보는 사업자가 저장하는 즉시 공개되며, 사전 심사는 없습니다. 장소에 관한 정보(손님층, 단골, 가이드북 게재 여부, 영업 연수, 응대하는 사람, 주요 역에서의 거리, 음식 정보 등)는 장소의 자기 신고입니다.',
        '게재 정보를 신고할 수 있습니다. 운영자는 신고를 확인하고 게재를 비공개로 할 수 있습니다.',
      ],
    },
    {
      h: '예약과 결제',
      p: [
        '각 장소는 시간대와 시간대별 최대 인원을 설정합니다. 선택한 시간대에 자리가 있으면 예약은 즉시 확정됩니다.',
        '대금은 현장에서 일본 엔화로 장소에 직접 지불해 주세요(현금 또는 카드는 장소별 표시에 따릅니다). 예약하려면 카드를 등록해야 하지만, 예약 시에는 아무것도 청구되지 않습니다. 이번 시범 운영 기간에는 카드 화면이 데모이며, 카드 정보는 전송되거나 저장되지 않습니다.',
      ],
    },
    {
      h: '취소',
      p: [
        '각 장소는 무료 취소 기한(시작 시간까지 / 전날까지 / 3일 전까지)을 정하고, 필요에 따라 1인당 정액의 기한 후 취소 수수료를 설정합니다. 이 내용은 예약 전에 표시됩니다.',
        '앱에서는 시작 시간까지 취소할 수 있습니다. 기한이 지난 취소나 노쇼는 기록되며, 예약 전에 표시된 취소 수수료가 부과될 수 있습니다. 수수료는 자동으로 청구되지 않습니다. 등록된 카드에 청구할지는 운영자가 판단하며, 청구 전에 반드시 연락드립니다.',
        '장소가 확정된 예약을 취소할 수 있습니다(갑작스러운 휴업, 날씨 등). 이 경우 수수료는 없으며, 번역된 사유와 함께 알려 드립니다.',
      ],
    },
    {
      h: '알레르기 및 음식 정보',
      p: [
        '알레르기 및 음식 정보는 각 장소가 등록한 것입니다. 할랄 표시는 인증을 받은 장소에만 표시됩니다. 당사는 확인하도록 노력하지만 정확성을 보증하지는 않으며, 등록 내용의 정확성은 장소가 책임집니다. 심한 알레르기가 있는 경우 예약 전과 방문 시에 반드시 장소에 직접 확인해 주세요.',
        '당사의 고의 또는 중대한 과실에 의한 경우를 제외하고, 당사의 손해배상 책임은 해당 예약과 관련하여 당사가 받은 수수료 금액을 한도로 합니다. 시범 운영 기간에는 수수료를 받지 않습니다.',
      ],
    },
    {
      h: '평가',
      p: [
        '앱에서 예약하고 방문한 여행자만 예약 1건당 1회 평가할 수 있으며, 별점(1~5)과 미리 준비된 태그로만 평가합니다. 자유 기술 코멘트는 없습니다. 사업자 계정은 평가할 수 없습니다.',
        '장소는 높은 평가를 요구하거나 평가의 대가로 혜택을 제공해서는 안 됩니다. 당사는 허위 또는 부적절하다고 판단한 평가를 숨길 수 있습니다. 평가 삭제 요청은 support@example.com 으로 보내 주시면 검토합니다.',
      ],
    },
    {
      h: '메시지',
      p: ['괴롭힘이나 부적절한 메시지를 보내지 마세요. 장소는 여행자를 차단할 수 있으며, 차단된 여행자는 해당 장소에 메시지를 보내거나 예약할 수 없습니다.'],
    },
  ],
};

const fr: LegalDoc = {
  draftNote: 'Projet avant examen par un expert. Le contenu peut changer.',
  privacy: [
    {
      h: 'Ce que nous collectons',
      p: [
        'Adresse e-mail, mot de passe (stocké sous forme de hachage), votre nom (affiché aux lieux où vous réservez), langue d’affichage et devise, vos souhaits du jour comme le budget et les besoins alimentaires, réservations, messages échangés avec les lieux, évaluations, lieux enregistrés et notifications.',
        'Les règles alimentaires religieuses et les allergies ne sont collectées que si vous donnez votre accord sur un écran distinct. Les informations religieuses constituent des « informations personnelles nécessitant une attention particulière » au sens de la loi japonaise sur la protection des informations personnelles (Act on the Protection of Personal Information) ; nous traitons les allergies de la même manière, car elles concernent votre santé.',
        'Avis : vous pouvez joindre des photos à un avis. Elles sont publiées sur la page de l’établissement (évitez le visage d’autres personnes). Vous pouvez aussi répondre à « À propos de vous » (pays/région, religion, genre, tranche d’âge, type de voyage) : c’est facultatif et enregistré uniquement avec votre accord. Ces réponses ne sont affichées que sous forme de graphiques combinés, seulement à partir de 3 réponses, et jamais avec votre avis ou votre nom.',
        'Votre position n’est utilisée que lorsque vous touchez « Autour de moi », pour trier les lieux par distance. Elle n’est pas enregistrée.',
        'Une carte doit être enregistrée pour réserver, mais rien n’est débité lors de la réservation. Pendant cette phase d’essai, l’écran de carte est une démonstration : les données de carte ne sont ni envoyées ni enregistrées.',
      ],
    },
    {
      h: 'Pourquoi nous les utilisons',
      p: [
        'Pour afficher les lieux qui vous conviennent et masquer ceux qui ne vous conviennent pas (les règles religieuses et les allergies ne sont utilisées qu’à cette fin), pour transmettre vos réservations et vos messages aux lieux, pour vous informer par notification dans l’application et par e-mail (confirmations de réservation, rappels la veille ou avant une visite le jour même, demandes d’évaluation et messages), ainsi que pour améliorer la qualité des traductions et traiter les problèmes de réservation.',
      ],
    },
    {
      h: 'Services externes (y compris hors du Japon)',
      p: [
        'Nous n’envoyons que le texte nécessaire. Votre nom et votre adresse e-mail ne sont jamais envoyés au service d’IA.',
        'Anthropic, PBC (États-Unis) : traduction par IA des fiches et des messages, et fonctions d’IA de Maru. Maru transforme vos souhaits en filtres de recherche et répond à vos questions uniquement lorsqu’il est affiché. Tant que Maru est masqué, rien n’est envoyé au service d’IA.',
        'Google LLC (États-Unis) — Gemini : utilisé avec Anthropic, ou à sa place, pour la même traduction par IA et les fonctions d’IA de Maru. Seul le texte nécessaire est envoyé, jamais votre nom ni votre adresse e-mail.',
        "Translated S.r.l. (Italie, UE) — MyMemory : traduction automatique gratuite utilisée dans cette démo lorsque la traduction par IA n’est pas configurée. Seul le texte à traduire est envoyé. L’UE applique le RGPD, et le Japon reconnaît à l’UE un niveau de protection des données personnelles équivalent.",
        'Resend (États-Unis) : envoi des e-mails. Il reçoit votre adresse e-mail et le contenu de l’e-mail. Vercel Inc. (États-Unis) et Neon (États-Unis) : hébergement et base de données.',
        'Cartes : lorsqu’une carte est affichée, votre navigateur charge des tuiles de carte (OpenFreeMap, données OpenStreetMap), et le serveur de tuiles voit votre adresse IP.',
        'Les États-Unis n’ont pas de loi fédérale unique et globale sur la protection de la vie privée ; la protection repose sur des lois sectorielles et des lois des États, comme le California Consumer Privacy Act. Mesures prises : une offre commerciale du service d’IA qui n’utilise pas les données soumises pour l’entraînement, le chiffrement des données en transit, et les durées de conservation et dispositifs de sécurité publiés par les prestataires. Pour les systèmes étrangers, nous nous référons aux informations publiées par la Commission japonaise de protection des informations personnelles (Personal Information Protection Commission).',
      ],
    },
    {
      h: 'Durée de conservation',
      p: ['Les journaux de traduction et les journaux d’interaction avec l’IA sont supprimés après une durée déterminée (projet : un an après la date de la visite). Les données de compte sont conservées jusqu’à la suppression de votre compte.'],
    },
    {
      h: 'Vos choix',
      p: ['Vous pouvez à tout moment retirer votre consentement concernant les règles religieuses et les allergies dans les Paramètres ; vos réponses sont alors supprimées. Vous pouvez masquer Maru dans les Paramètres pour cesser l’envoi de texte au service d’IA. Pour supprimer votre compte ou pour toute question : support@example.com'],
    },
  ],
  terms: [
    {
      h: 'Le service et les fiches',
      p: [
        'Cette application aide les voyageurs à trouver de petites expériences locales, des restaurants et des visites dans le Kansai, au Japon, à échanger avec les lieux dans leur propre langue grâce à la traduction par IA, et à réserver.',
        'Les lieux sont de petites entreprises locales qui s’inscrivent elles-mêmes. Une fiche est publiée dès que le lieu l’enregistre, sans examen préalable. Les informations sur un lieu (par exemple sa clientèle, ses habitués, sa présence dans des guides, ses années d’activité, la personne qui vous accueille, la distance depuis la gare principale et les informations alimentaires) sont déclarées par le lieu lui-même.',
        'Vous pouvez signaler une fiche. Nous examinons les signalements et pouvons retirer des fiches de la publication.',
      ],
    },
    {
      h: 'Réservations et paiement',
      p: [
        'Chaque lieu définit des créneaux horaires et un nombre maximal de personnes par créneau. Votre réservation est confirmée immédiatement s’il reste de la place sur le créneau choisi.',
        'Vous payez le lieu directement sur place, en yens japonais, en espèces ou par carte selon ce qui est indiqué pour chaque lieu. Une carte doit être enregistrée pour réserver, mais rien n’est débité lors de la réservation. Pendant cette phase d’essai, l’écran de carte est une démonstration et les données de carte ne sont ni envoyées ni enregistrées.',
      ],
    },
    {
      h: 'Annulation',
      p: [
        'Chaque lieu fixe un délai d’annulation gratuite (jusqu’à l’heure de début, jusqu’à la veille ou jusqu’à 3 jours avant) et peut fixer des frais forfaitaires d’annulation tardive par personne. Ces conditions sont affichées avant la réservation.',
        'Vous pouvez annuler dans l’application jusqu’à l’heure de début. Une annulation après le délai ou une absence est enregistrée, et les frais d’annulation tardive affichés avant la réservation peuvent s’appliquer. Aucun débit n’est automatique : nous décidons s’il y a lieu de débiter votre carte enregistrée et nous vous contactons avant tout débit.',
        'Un lieu peut annuler une réservation confirmée, par exemple en cas de fermeture soudaine ou à cause de la météo. Dans ce cas, aucuns frais ne s’appliquent et vous êtes informé du motif, traduit dans votre langue.',
      ],
    },
    {
      h: 'Informations sur les allergies et les aliments',
      p: [
        'Les informations sur les allergies et les aliments sont enregistrées par chaque lieu. Le label halal n’est affiché que pour les lieux certifiés. Nous nous efforçons de vérifier ces informations, mais nous ne pouvons pas en garantir l’exactitude ; chaque lieu est responsable de l’exactitude de ce qu’il enregistre. Si vous souffrez d’une allergie grave, confirmez toujours directement auprès du lieu avant de réserver et à votre arrivée.',
        'Sauf en cas de faute intentionnelle ou de négligence grave de notre part, notre responsabilité au titre des dommages est limitée au montant des frais que nous avons perçus pour la réservation concernée. Aucuns frais ne sont perçus pendant cette phase d’essai.',
      ],
    },
    {
      h: 'Évaluations',
      p: [
        'Seuls les voyageurs ayant réservé via l’application et effectué leur visite peuvent évaluer, une fois par réservation, avec des étoiles (1 à 5) et des étiquettes prédéfinies. Les commentaires libres ne sont pas proposés. Les comptes professionnels ne peuvent pas évaluer.',
        'Les lieux ne doivent pas demander de bonnes évaluations ni offrir de récompenses en échange d’une évaluation. Nous pouvons masquer les évaluations que nous jugeons fausses ou inappropriées. Les demandes de retrait d’une évaluation peuvent être envoyées à support@example.com ; nous les examinons.',
      ],
    },
    {
      h: 'Messages',
      p: ['N’envoyez pas de messages harcelants ou inappropriés. Un lieu peut bloquer un voyageur ; un voyageur bloqué ne peut plus envoyer de messages à ce lieu ni y réserver.'],
    },
  ],
};

const es: LegalDoc = {
  draftNote: 'Borrador previo a la revisión de un experto. El contenido puede cambiar.',
  privacy: [
    {
      h: 'Qué recopilamos',
      p: [
        'Dirección de correo electrónico, contraseña (almacenada como hash), su nombre (visible para los lugares en los que reserva), idioma de visualización y moneda, sus deseos del día como el presupuesto y las necesidades alimentarias, reservas, mensajes con los lugares, valoraciones, lugares guardados y notificaciones.',
        'Las normas alimentarias religiosas y las alergias solo se recopilan si usted lo acepta en una pantalla aparte. La información religiosa es «información personal que requiere especial consideración» según la Ley de Protección de la Información Personal de Japón (Act on the Protection of Personal Information); tratamos las alergias de la misma manera porque afectan a su salud.',
        'Reseñas: puedes añadir fotos a una reseña. Las fotos se publican en la página del local (evita que salgan caras de otras personas). También puedes responder «Sobre ti» (país/región, religión, género, franja de edad, tipo de viaje): es opcional y solo se guarda si das tu consentimiento. Estas respuestas solo se muestran como gráficos combinados en la página del local, solo cuando hay al menos 3 respuestas, y nunca junto a tu reseña o tu nombre.',
        'Su ubicación solo se usa cuando pulsa «Cerca de mí», para ordenar los lugares por distancia. No se guarda.',
        'Para reservar es necesario registrar una tarjeta, pero no se cobra nada al reservar. Durante esta fase de prueba, la pantalla de tarjeta es una demostración: los datos de la tarjeta no se envían ni se guardan.',
      ],
    },
    {
      h: 'Para qué lo usamos',
      p: [
        'Para mostrarle los lugares adecuados para usted y ocultar los que no lo son (las normas religiosas y las alergias se usan solo para esto), para enviar sus reservas y mensajes a los lugares, para avisarle mediante notificaciones en la aplicación y por correo electrónico (confirmaciones de reserva, recordatorios el día anterior o antes de una visita el mismo día, solicitudes de valoración y mensajes), y para mejorar la calidad de la traducción y gestionar problemas con las reservas.',
      ],
    },
    {
      h: 'Servicios externos (incluso fuera de Japón)',
      p: [
        'Solo enviamos el texto necesario. Su nombre y su dirección de correo electrónico nunca se envían al servicio de IA.',
        'Anthropic, PBC (Estados Unidos): traducción por IA de las fichas y los mensajes, y funciones de IA de Maru. Maru convierte sus deseos en filtros de búsqueda y responde preguntas solo mientras está visible. Mientras Maru está oculto, no se envía nada al servicio de IA.',
        'Google LLC (Estados Unidos) — Gemini: se usa junto con Anthropic, o en su lugar, para la misma traducción por IA y las funciones de IA de Maru. Solo se envía el texto necesario, nunca tu nombre ni tu correo electrónico.',
        'Translated S.r.l. (Italia, UE) — MyMemory: traducción automática gratuita que se usa en esta demo cuando la traducción por IA no está configurada. Solo se envía el texto que se va a traducir. La UE aplica el RGPD, y Japón reconoce que la UE ofrece un nivel equivalente de protección de datos personales.',
        'Resend (Estados Unidos): envío de correos electrónicos. Recibe su dirección de correo electrónico y el contenido del correo. Vercel Inc. (Estados Unidos) y Neon (Estados Unidos): alojamiento y base de datos.',
        'Mapas: cuando se muestra un mapa, su navegador carga teselas de mapa (OpenFreeMap, con datos de OpenStreetMap), y el servidor de teselas ve su dirección IP.',
        'Estados Unidos no tiene una única ley federal integral de privacidad; la protección depende de leyes sectoriales y de leyes estatales como la California Consumer Privacy Act (Ley de Privacidad del Consumidor de California). Medidas adoptadas: un plan comercial del servicio de IA que no utiliza los datos enviados para entrenamiento, cifrado en tránsito, y los periodos de conservación y programas de seguridad publicados por los proveedores. Sobre los sistemas extranjeros, nos remitimos a la información publicada por la Comisión de Protección de la Información Personal de Japón (Personal Information Protection Commission).',
      ],
    },
    {
      h: 'Cuánto tiempo lo conservamos',
      p: ['Los registros de traducción y los registros de interacción con la IA se eliminan tras un periodo determinado (borrador: un año después de la fecha de la visita). Los datos de la cuenta se conservan hasta que usted elimine su cuenta.'],
    },
    {
      h: 'Sus opciones',
      p: ['Puede retirar en cualquier momento su consentimiento sobre normas religiosas y alergias en Ajustes; sus respuestas se eliminarán entonces. Puede ocultar a Maru en Ajustes para dejar de enviar texto al servicio de IA. Para eliminar su cuenta o hacer consultas: support@example.com'],
    },
  ],
  terms: [
    {
      h: 'El servicio y las fichas',
      p: [
        'Esta aplicación ayuda a los viajeros a encontrar pequeñas experiencias locales, restaurantes y tours en Kansai (Japón), a comunicarse con los lugares en su propio idioma mediante traducción por IA y a reservar.',
        'Los lugares son pequeños negocios locales que se registran por sí mismos. Una ficha se publica en cuanto el lugar la guarda, sin revisión previa. La información sobre un lugar (como su clientela, sus clientes habituales, su presencia en guías, sus años de actividad, quién le atiende, la distancia desde la estación principal y la información sobre comida) la declara el propio lugar.',
        'Puede denunciar una ficha. Revisamos las denuncias y podemos retirar fichas de la publicación.',
      ],
    },
    {
      h: 'Reservas y pago',
      p: [
        'Cada lugar establece franjas horarias y un número máximo de personas por franja. Su reserva se confirma de inmediato si la franja elegida tiene plazas.',
        'Usted paga directamente al lugar in situ, en yenes japoneses, en efectivo o con tarjeta según se indique para cada lugar. Para reservar es necesario registrar una tarjeta, pero no se cobra nada al reservar. Durante esta fase de prueba, la pantalla de tarjeta es una demostración y los datos de la tarjeta no se envían ni se guardan.',
      ],
    },
    {
      h: 'Cancelación',
      p: [
        'Cada lugar fija un plazo de cancelación gratuita (hasta la hora de inicio, hasta el día anterior o hasta 3 días antes) y puede fijar una tarifa fija por persona por cancelación tardía. Estas condiciones se muestran antes de reservar.',
        'Puede cancelar en la aplicación hasta la hora de inicio. Las cancelaciones fuera de plazo y las ausencias quedan registradas, y puede aplicarse la tarifa por cancelación tardía mostrada antes de reservar. Los cargos no son automáticos: nosotros decidimos si se cobra a la tarjeta registrada y le contactaremos antes de cualquier cargo.',
        'Un lugar puede cancelar una reserva confirmada, por ejemplo por un cierre repentino o por el tiempo. En ese caso no se aplica ninguna tarifa y se le notifica el motivo, traducido a su idioma.',
      ],
    },
    {
      h: 'Información sobre alergias y alimentos',
      p: [
        'La información sobre alergias y alimentos la registra cada lugar. El distintivo halal solo se muestra en lugares certificados. Procuramos comprobar esta información, pero no podemos garantizar su exactitud; cada lugar es responsable de la exactitud de lo que registra. Si tiene una alergia grave, confírmelo siempre directamente con el lugar antes de reservar y al llegar.',
        'Salvo en casos de dolo o negligencia grave por nuestra parte, nuestra responsabilidad por daños se limita al importe de las comisiones que hayamos recibido por la reserva en cuestión. Durante esta fase de prueba no se cobra ninguna comisión.',
      ],
    },
    {
      h: 'Valoraciones',
      p: [
        'Solo pueden valorar los viajeros que hayan reservado en la aplicación y realizado la visita, una vez por reserva, con estrellas (1 a 5) y etiquetas predefinidas. No hay comentarios de texto libre. Las cuentas de negocio no pueden valorar.',
        'Los lugares no deben pedir valoraciones altas ni ofrecer recompensas a cambio de valoraciones. Podemos ocultar las valoraciones que consideremos falsas o inapropiadas. Las solicitudes de retirada de una valoración pueden enviarse a support@example.com; las revisamos.',
      ],
    },
    {
      h: 'Mensajes',
      p: ['No envíe mensajes acosadores o inapropiados. Un lugar puede bloquear a un viajero; un viajero bloqueado no puede enviar mensajes a ese lugar ni reservar en él.'],
    },
  ],
};

export const LEGAL: Partial<Record<Lang, LegalDoc>> = { en, ja, zh, ko, fr, es };
export function legalFor(lang: Lang): LegalDoc {
  return LEGAL[lang] ?? en;
}
