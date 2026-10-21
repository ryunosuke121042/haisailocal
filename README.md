# haisailocal（ローカル体験予約アプリ MVP）

仕様書：[docs/01_spec.md](docs/01_spec.md) を土台に、[docs/02_mvp_spec.md](docs/02_mvp_spec.md) の次の決定を採用しています。

| 論点 | 採用 |
| --- | --- |
| 予約の確定 | 02：時間枠の上限人数内なら即時確定（承認制・〇△✕はなし） |
| 空き状況 | 02：時間枠と上限人数、定休日、受付停止日、受付締切 |
| 事業者の掲載 | 02：誰でも登録でき、保存すると即公開（報告を受けて運営が非公開にする） |
| 通知 | プッシュ通知を推進（事業者画面で強く勧めるが必須にはしない）＋メール＋アプリ内通知 |
| キャンセルポリシー | 02：無料キャンセルの期限（当日／前日／3日前まで）と、期限後の定額キャンセル料 |
| キャラクター | 01：全画面に登場、AIで希望を絞り込み条件に、質疑応答、よくある質問、非表示（HIDE） |

それ以外は 01 のとおりです：5言語（＋日本語）、最初の質問（宗教上の制限・アレルギーは同意した人だけ。合わない店を自動で除く）、
お店の目安情報5項目（＋主要駅からの所要時間）、食べ物の情報（ハラル認証・料理ごとのアレルギー・材料の調整）、
評価順のおすすめと理由、一覧と地図・現在地、保存リスト、来店後の評価、平均返信時間、代替案、前日リマインド・当日の来店前メール、
はじめてガイド・日本語カード、翻訳の用語集と「翻訳がおかしい」報告、運営の管理画面。01 の「電話対応のお店」（店の承認で確定）は即時確定と合わないため、「チャットで問い合わせるお店」（時間枠なし）として扱います。

| 画面 | URL |
| --- | --- |
| トップ | `/`（旅行者か事業者かを選んでログイン） |
| 旅行者 | `/{言語}`（en / zh / ko / fr / es / ja）。閲覧はログイン不要 |
| 事業者（日本語） | `/biz` |
| 運営（日本語） | `/admin` |

## 開発

```bash
npm install
vercel env pull .env.local   # Neon の接続情報など
npm run db:push              # スキーマを DB に反映
npm run db:seed              # デモデータ（やり直しは npm run db:seed -- --reset）
npm run dev                  # http://localhost:5173 （/api も同じサーバーで動く）
npm test                     # 予約枠・締切・キャンセル期限・絞り込み・おすすめのテスト
```

デモ用アカウント（パスワードはすべて `localtrip-demo`）：旅行者 `traveler@example.com`、事業者 `biz@example.com` ほか、運営 `admin@example.com`

## 環境変数

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `haisailocal_DATABASE_URL` / `haisailocal_DATABASE_URL_UNPOOLED` | ○ | Neon |
| `APP_URL` | 本番 | メール内リンクの起点 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | ○ | 事業者へのプッシュ通知 |
| `CRON_SECRET` | ○ | `/api/cron`（1日1回、送れていないメールを送る） |
| `ANTHROPIC_API_KEY` | 任意 | Claude によるAI翻訳とキャラクターのAI（有料）。AIのキーがどれもなければ、翻訳は無料の MyMemory、キャラクターはルールベース |
| `MYMEMORY_EMAIL` | 任意 | MyMemory に登録したメールアドレス。1日の無料上限が増える |
| `TRANSLATOR` | 任意 | `none` で翻訳を止める（原文表示） |
| `ANTHROPIC_MODEL` | 任意 | 既定 `claude-opus-5-5` |
| `GEMINI_API_KEY` | 任意 | Google Gemini によるAI翻訳とキャラクターのAI（Google AI Studio で発行。無料枠あり）。Claude と両方あるときは、片方が失敗したらもう片方で答える |
| `GEMINI_MODEL` | 任意 | 既定 `gemini-3.5-flash-lite`（無料枠で速い。`gemini-3.8-flash` は無料枠で応答が返らないことがあった） |
| `AI_PRIMARY` | 任意 | `gemini` で Gemini を先に使う（既定は Claude が先） |
| `RESEND_API_KEY` / `EMAIL_FROM` | 任意 | メール送信（送信予約にも対応）。なければ送信箱（運営画面「送信メール」）に記録するだけ |

## 無料で動かすデモ構成

キーを何も設定しなくても、すべて無料で動きます。

- 翻訳：MyMemory（無料・キー不要。1日あたりの上限があり、超えた分は原文表示になる）。デモ店舗の訳は6言語ぶんシードに入っている
- キャラクター：キーワードで希望を絞り込み条件にし、よくある質問と店の情報から答える
- メール：送らずに記録だけ。中身は運営画面（`/admin`）の「送信メール」で見られる（パスワード再設定のリンクも）
- 地図：OpenFreeMap、為替：ExchangeRate-API、プッシュ通知：Web Push、ホスティング・DB：Vercel Hobby・Neon の無料プラン

デモ店舗の訳だけを足すとき（データは消さない）：`npm run db:seed -- --translations`

## 構成

- `shared/` 共有：`booking.ts`（予約できる枠・締切・キャンセル期限）、`search.ts`（絞り込みとおすすめ）、`filters.ts`、`constants.ts`、`areas.ts`、`faq.ts`
- `server/` API：`routes/traveler.ts`・`business.ts`・`admin.ts`・`auth.ts`、`listings.ts`、`ai.ts`（翻訳・希望→条件・質疑応答）、`translate.ts`（用語集つき）、`notify.ts`（アプリ内・プッシュ・メール、リマインドの送信予約）、`email.ts`、`push.ts`、`fx.ts`
- `src/` 画面：`pages/`（旅行者）、`biz/`（事業者）、`admin/`（運営）、`components/Character.tsx`（まる）、`i18n/`（6言語と規約）

## 仮に決めたこと

- 「来店済み」は来店時刻を過ぎた確定済みの予約。評価は来店から30日以内、1予約1件
- 前日リマインドは前日18時、当日の予約は来店前メール（店ごと、既定15分前）、評価のお願いは来店時刻＋所要時間のあと
- 旅行者は来店時刻までキャンセル可。期限後のキャンセルと「来店なし」は記録し、請求は運営が判断（MVPでは決済しない）
- 予算は最初の質問では並び順にだけ使う（絞り込みの「予算」は除外に使う）
- カード登録・決済代行は未定のため画面はダミー
- エリアは選択式（関西）、主要駅は自由入力、為替は ExchangeRate-API を1日1回

旧版（承認型予約）のコードは `.backup-full-spec-20261013/src.tgz` に退避しています。
