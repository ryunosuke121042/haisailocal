// 店舗登録（日本語で入力し、英語と簡体字に自動翻訳）。保存すると即公開。必須項目が空なら下書き
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AREA_LABELS, AREAS } from '../../shared/areas';
import type { Slot } from '../../shared/booking';
import {
  ALLERGEN_JA,
  ALLERGENS,
  CATEGORIES,
  CATEGORY_JA,
  COURSE_STYLE_JA,
  COURSE_STYLES,
  CROWD_JA,
  CROWDS,
  CUTOFF_JA,
  CUTOFFS,
  DIET_SUPPORT,
  DIET_SUPPORT_JA,
  FREE_CANCEL_JA,
  FREE_CANCELS,
  GUIDE_LANG_JA,
  GUIDE_LANGS,
  LIMITS,
  OWNER_DISTANCES,
  OWNER_JA,
  PAYMENT_JA,
  PAYMENT_METHODS,
  REGULARS,
  REGULARS_JA,
  SHOP_LANG_JA,
  SHOP_LANGS,
  YEARS,
  YEARS_JA,
} from '../../shared/constants';
import { ApiError, get, post, put } from '../api';
import { resizeToDataUrl } from '../lib/image';
import { STATUS_JA, useBiz } from './BizApp';
import { lazyWithReload } from '../lib/lazyReload';

const MapView = lazyWithReload(() => import('../components/MapView').then((m) => ({ default: m.MapView })));

interface Form {
  id: string;
  status: keyof typeof STATUS_JA;
  missing: string[];
  category: (typeof CATEGORIES)[number] | null;
  nameJa: string;
  area: string;
  address: string;
  descriptionJa: string;
  photos: string[];
  appealJa: string;
  dressJa: string;
  lat: number | null;
  lng: number | null;
  languages: string[];
  soloWelcome: boolean;
  halalCertified: boolean;
  allergenFreeShop: string[];
  adjustLess: boolean;
  adjustRemove: boolean;
  dishes: { nameJa: string; allergens: string[] }[];
  extraInfo: { labelJa: string; valueJa: string }[];
  regulars: (typeof REGULARS)[number] | null;
  guidebook: boolean | null;
  ownerDistance: (typeof OWNER_DISTANCES)[number] | null;
  priceJpy: number | null;
  durationMin: number | null;
  paymentMethod: (typeof PAYMENT_METHODS)[number] | null;
  crowd: (typeof CROWDS)[number] | null;
  yearsBand: (typeof YEARS)[number] | null;
  stationJa: string;
  stationMinutes: number | null;
  itemsToBringJa: string;
  minParticipants: number;
  dietSupport: string[];
  courseStyle: (typeof COURSE_STYLES)[number] | null;
  meetingPointJa: string;
  itineraryJa: string;
  guideLanguages: string[];
  slots: Slot[];
  closedWeekdays: number[];
  cutoff: (typeof CUTOFFS)[number];
  freeCancel: (typeof FREE_CANCELS)[number];
  lateFeeJpy: number | null;
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// サーバーの入力チェックで弾かれた項目の名前
const FIELD_JA: Record<string, string> = {
  nameJa: '店名',
  address: '住所',
  descriptionJa: '説明文',
  photos: '写真',
  priceJpy: '料金（0〜1,000,000円）',
  durationMin: '所要時間（5〜1440分）',
  stationJa: '最寄りの主要駅',
  stationMinutes: '駅からの所要時間（0〜300分）',
  itemsToBringJa: '持ち物',
  minParticipants: `最少催行人数（1〜${LIMITS.partyMax}名）`,
  meetingPointJa: '集合場所',
  itineraryJa: '行程',
  slots: `時間枠（上限人数は1〜${LIMITS.slotCapacityMax}名）`,
  lateFeeJpy: 'キャンセル料（1〜1,000,000円）',
  appealJa: 'アピールポイント',
  dressJa: '服装の目安',
  lat: '地図の位置',
  lng: '地図の位置',
  dishes: '料理（料理名は60文字まで）',
  extraInfo: 'その他の情報（項目名は30文字、内容は300文字まで）',
};

function saveErrorText(e: unknown) {
  if (e instanceof ApiError && e.status === 413) return '写真が大きすぎます。枚数を減らしてください。';
  if (e instanceof ApiError && e.code === 'validation' && Array.isArray(e.detail)) {
    const names = [...new Set((e.detail as { path: string }[]).map((d) => FIELD_JA[d.path.split('.')[0]] ?? d.path))];
    return `保存できませんでした。次の項目を確認してください：${names.join('、')}`;
  }
  return '保存できませんでした。通信状態を確認して、もう一度お試しください。';
}

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Math.round(Number(v)));
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label>
      <span>
        {label}
        {required && <span className="warn small"> 必須</span>}
      </span>
      {children}
      {hint && <span className="small muted">{hint}</span>}
    </label>
  );
}

function Radios<T extends string>({ value, options, labels, onChange }: { value: T | null; options: readonly T[]; labels: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" className={`chip chip-toggle ${value === o ? 'on' : ''}`} aria-pressed={value === o} onClick={() => onChange(o)}>
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || lo));

/** 保存する内容（入力途中で空にした数値は、ここで範囲に収める） */
function bodyOf(f: Form) {
  const { id: _id, status: _s, missing: _m, ...body } = f;
  return {
    ...body,
    minParticipants: clamp(f.minParticipants, 1, LIMITS.partyMax),
    slots: f.slots.map((x) => ({ ...x, capacity: clamp(x.capacity, 1, LIMITS.slotCapacityMax) })),
    lateFeeJpy: f.lateFeeJpy == null ? null : clamp(f.lateFeeJpy, 1, 1_000_000),
  };
}

function Checks<T extends string>({ values, selected, labels, onChange }: { values: readonly T[]; selected: string[]; labels: Record<T, string>; onChange: (v: T[]) => void }) {
  return (
    <div className="chips">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className={`chip chip-toggle ${selected.includes(v) ? 'on' : ''}`}
          aria-pressed={selected.includes(v)}
          onClick={() => onChange((selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]) as T[])}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

export function BizListing() {
  const { id } = useParams();
  const { reload } = useBiz();
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [newTime, setNewTime] = useState('10:00');
  const [newCap, setNewCap] = useState('6');
  const [geo, setGeo] = useState<{ lat: number; lng: number; label: string }[] | null>(null);

  useEffect(() => {
    get<Form>(`/biz/listings/${id}`)
      .then(setF)
      .catch(() => setMsg({ kind: 'error', text: '読み込めませんでした。' }));
  }, [id]);

  if (!f) return msg ? <p className="notice notice-error">{msg.text}</p> : <div className="spinner" />;
  const set = (p: Partial<Form>) => setF((prev) => (prev ? { ...prev, ...p } : prev));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await put<Form>(`/biz/listings/${id}`, bodyOf(f!));
      setF(r);
      await reload();
      if (r.status === 'PUBLISHED') setMsg({ kind: 'ok', text: '保存して公開しました。英語と中国語（簡体字）の表示は自動で翻訳されます。' });
      else if (r.status === 'DRAFT') setMsg({ kind: 'warn', text: `下書きとして保存しました。公開には次の項目が必要です：${r.missing.join('、')}` });
      else setMsg({ kind: 'ok', text: `保存しました（${STATUS_JA[r.status]}）。` });
    } catch (e) {
      setMsg({ kind: 'error', text: saveErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function changeVisibility(action: 'publish' | 'hide') {
    setBusy(true);
    setMsg(null);
    try {
      // 公開する前に、画面上の変更も保存する
      if (action === 'publish') {
        await put<Form>(`/biz/listings/${id}`, bodyOf(f!));
      }
      const r = await post<Form>(`/biz/listings/${id}/${action}`);
      setF(r);
      await reload();
      setMsg({ kind: 'ok', text: action === 'publish' ? '公開しました。' : '非公開にしました。旅行者の一覧に表示されません（確定済みの予約はそのままです）。' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'incomplete') setMsg({ kind: 'warn', text: `公開に必要な項目：${(e.detail as { missing: string[] }).missing.join('、')}` });
      else setMsg({ kind: 'error', text: saveErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File) {
    // 端末側で縮小してから送る
    const url = await resizeToDataUrl(file);
    if (!url) {
      setMsg({ kind: 'error', text: 'この写真は読み込めませんでした。JPEG か PNG の写真を選んでください（iPhone の場合は「カメラ」設定の「互換性優先」で撮影した写真）。' });
      return;
    }
    set({ photos: [...f!.photos, url].slice(0, LIMITS.photosMax) });
  }

  async function findAddress() {
    const r = await get<{ results: { lat: number; lng: number; label: string }[] }>(`/biz/geocode?q=${encodeURIComponent(f!.address)}`).catch(() => ({ results: [] }));
    setGeo(r.results);
    if (r.results[0]) set({ lat: r.results[0].lat, lng: r.results[0].lng });
  }

  function addSlot() {
    const cap = num(newCap);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime) || !cap || cap < 1) return;
    if (f!.slots.some((s) => s.time === newTime)) return;
    set({ slots: [...f!.slots, { time: newTime, capacity: Math.min(cap, LIMITS.slotCapacityMax) }].sort((a, b) => a.time.localeCompare(b.time)) });
  }

  return (
    <form
      className="biz-form stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="small">
        <Link to="/biz">← ホーム</Link>
      </p>
      <h1>店舗の登録・編集</h1>
      <p className="row gap-s">
        <span className={`status status-${f.status}`}>{STATUS_JA[f.status]}</span>
        {f.status === 'PUBLISHED' && (
          <a href={`/ja/shop/${f.id}`} target="_blank" rel="noopener" className="small">
            旅行者の見え方を確認
          </a>
        )}
      </p>
      <p className="small muted">日本語だけで入力してください。旅行者には英語と中国語（簡体字）に自動で翻訳して表示します。必須項目が空のままでも下書きとして保存できます。</p>

      <fieldset className="stack-s">
        <legend>基本情報</legend>
        <Field label="店名" required>
          <input maxLength={80} value={f.nameJa} onChange={(e) => set({ nameJa: e.target.value })} />
        </Field>
        <Field label="カテゴリ" required>
          <Radios value={f.category} options={CATEGORIES} labels={CATEGORY_JA} onChange={(category) => set({ category })} />
        </Field>
        <Field label="エリア" required>
          <select value={f.area} onChange={(e) => set({ area: e.target.value })}>
            <option value="">選んでください</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_LABELS[a].ja}
              </option>
            ))}
          </select>
        </Field>
        <Field label="住所" required hint="旅行者が地図アプリで開けるよう、番地まで入れてください。">
          <input maxLength={200} value={f.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <div className="stack-s">
          <div className="row gap-s">
            <button type="button" className="btn btn-small" disabled={!f.address.trim()} onClick={() => void findAddress()}>
              住所から地図に表示
            </button>
            {f.lat != null && <span className="small muted">ピンをドラッグして、正しい場所に合わせてください</span>}
          </div>
          {geo && geo.length === 0 && <p className="small warn">見つかりませんでした。地図のピンを手で合わせてください。</p>}
          {geo && geo.length > 1 && (
            <select onChange={(e) => set({ lat: geo[Number(e.target.value)].lat, lng: geo[Number(e.target.value)].lng })} aria-label="候補">
              {geo.map((g, i) => (
                <option key={i} value={i}>
                  {g.label}
                </option>
              ))}
            </select>
          )}
          {(f.lat != null || geo) && (
            <Suspense fallback={null}>
              <MapView
                pins={[{ id: 'pin', lat: f.lat ?? 34.8844, lng: f.lng ?? 135.7997, label: f.nameJa || '店舗' }]}
                draggable
                onDrag={(lat, lng) => set({ lat, lng })}
                height={240}
              />
            </Suspense>
          )}
          <span className="small muted">{f.category === 'TOUR' ? 'ツアーは集合場所にピンを合わせてください。' : ''}旅行者の地図とGoogleマップへのリンクに使います。</span>
        </div>
        <Field label="説明文" required hint="どんな体験・お店か、どんな人が営んでいるかを書いてください。">
          <textarea rows={6} maxLength={LIMITS.descriptionMaxChars} value={f.descriptionJa} onChange={(e) => set({ descriptionJa: e.target.value })} />
        </Field>
        <Field label={`写真（1〜${LIMITS.photosMax}枚）`} required>
          <div className="photo-row">
            {f.photos.map((p, i) => (
              <span key={i} className="photo-thumb">
                <img src={p} alt="" />
                <button type="button" onClick={() => set({ photos: f.photos.filter((_, k) => k !== i) })} aria-label="削除">
                  ✕
                </button>
              </span>
            ))}
          </div>
          {f.photos.length < LIMITS.photosMax && (
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void addPhoto(e.target.files[0]).finally(() => (e.target.value = ''))} />
          )}
        </Field>
        <div className="row gap-s">
          <Field label="料金（1人・円）" required>
            <input type="number" inputMode="numeric" min={0} value={f.priceJpy ?? ''} onChange={(e) => set({ priceJpy: num(e.target.value) })} />
          </Field>
          <Field label="所要時間（分）" required>
            <input type="number" inputMode="numeric" min={5} value={f.durationMin ?? ''} onChange={(e) => set({ durationMin: num(e.target.value) })} />
          </Field>
        </div>
        <Field label="支払い方法" required>
          <Radios value={f.paymentMethod} options={PAYMENT_METHODS} labels={PAYMENT_JA} onChange={(paymentMethod) => set({ paymentMethod })} />
        </Field>
        <Field label="アピールポイント" hint="例：家族だけで営んでいます／豚肉を使っていません（ハラルを選んだ旅行者に「参考」として表示します）">
          <textarea rows={3} maxLength={500} value={f.appealJa} onChange={(e) => set({ appealJa: e.target.value })} />
        </Field>
        <Field label="服装の目安">
          <input maxLength={200} placeholder="例：汚れてもよい服と歩きやすい靴" value={f.dressJa} onChange={(e) => set({ dressJa: e.target.value })} />
        </Field>
        <Field label="対応できる言語">
          <Checks values={SHOP_LANGS} selected={f.languages} labels={SHOP_LANG_JA} onChange={(languages) => set({ languages })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={f.soloWelcome} onChange={(e) => set({ soloWelcome: e.target.checked })} />
          一人客歓迎
        </label>
        <div className="stack-s">
          <span>その他の情報（任意）</span>
          <p className="small muted">
            旅行者に伝えたいことを自由に追加できます（例：Wi-Fi／あり、喫煙／全席禁煙、トイレ／洋式あり）。旅行者の言語に翻訳して、お店の情報欄に表示します。まるも質問に答えるときに使います。項目名と内容の両方を入れた行だけ保存されます。
          </p>
          {f.extraInfo.map((x, i) => (
            <div key={i} className="row gap-s extra-row">
              <input
                className="extra-label"
                maxLength={30}
                placeholder="項目名（例：Wi-Fi）"
                aria-label="項目名"
                value={x.labelJa}
                onChange={(e) => set({ extraInfo: f.extraInfo.map((y, k) => (k === i ? { ...y, labelJa: e.target.value } : y)) })}
              />
              <input
                className="grow"
                maxLength={300}
                placeholder="内容（例：あり。パスワードは店内に掲示）"
                aria-label="内容"
                value={x.valueJa}
                onChange={(e) => set({ extraInfo: f.extraInfo.map((y, k) => (k === i ? { ...y, valueJa: e.target.value } : y)) })}
              />
              <button type="button" className="link small" onClick={() => set({ extraInfo: f.extraInfo.filter((_, k) => k !== i) })}>
                削除
              </button>
            </div>
          ))}
          {f.extraInfo.length < LIMITS.extraInfoMax && (
            <button type="button" className="btn btn-small" onClick={() => set({ extraInfo: [...f.extraInfo, { labelJa: '', valueJa: '' }] })}>
              ＋ 項目を追加
            </button>
          )}
        </div>
      </fieldset>

      <fieldset className="stack-s">
        <legend>地元らしさの情報</legend>
        <p className="small muted">点数は付けません。事実として旅行者に表示し、旅行者が判断します。</p>
        <Field label="客層" required>
          <Radios value={f.crowd} options={CROWDS} labels={CROWD_JA} onChange={(crowd) => set({ crowd })} />
        </Field>
        <Field label="常連客">
          <Radios value={f.regulars} options={REGULARS} labels={REGULARS_JA} onChange={(regulars) => set({ regulars })} />
        </Field>
        <Field label="ガイドブック・ツアー会社への掲載">
          <Radios
            value={f.guidebook == null ? null : f.guidebook ? 'yes' : 'no'}
            options={['no', 'yes'] as const}
            labels={{ no: 'なし', yes: 'あり' }}
            onChange={(v) => set({ guidebook: v === 'yes' })}
          />
        </Field>
        <Field label="営業年数" required>
          <Radios value={f.yearsBand} options={YEARS} labels={YEARS_JA} onChange={(yearsBand) => set({ yearsBand })} />
        </Field>
        <Field label="店主・作り手との距離">
          <Radios value={f.ownerDistance} options={OWNER_DISTANCES} labels={OWNER_JA} onChange={(ownerDistance) => set({ ownerDistance })} />
        </Field>
        <div className="row gap-s">
          <Field label="最寄りの主要駅" required>
            <input maxLength={60} placeholder="例：JR宇治駅" value={f.stationJa} onChange={(e) => set({ stationJa: e.target.value })} />
          </Field>
          <Field label="駅からの所要時間（分）" required>
            <input type="number" inputMode="numeric" min={0} value={f.stationMinutes ?? ''} onChange={(e) => set({ stationMinutes: num(e.target.value) })} />
          </Field>
        </div>
      </fieldset>

      {f.category && (
        <fieldset className="stack-s">
          <legend>{CATEGORY_JA[f.category]}の項目</legend>
          {f.category === 'EXPERIENCE' && (
            <>
              <Field label="持ち物">
                <input maxLength={300} placeholder="例：汚れてもよい服" value={f.itemsToBringJa} onChange={(e) => set({ itemsToBringJa: e.target.value })} />
              </Field>
              <Field label="最少催行人数">
                <input type="number" inputMode="numeric" min={1} max={LIMITS.partyMax} value={f.minParticipants || ''} onChange={(e) => set({ minParticipants: num(e.target.value) ?? 0 })} />
              </Field>
            </>
          )}
          {f.category === 'RESTAURANT' && (
            <>
              <Field label="コース／アラカルト" required>
                <Radios value={f.courseStyle} options={COURSE_STYLES} labels={COURSE_STYLE_JA} onChange={(courseStyle) => set({ courseStyle })} />
              </Field>
            </>
          )}
          {f.category === 'TOUR' && (
            <>
              <Field label="集合場所" required>
                <input maxLength={200} value={f.meetingPointJa} onChange={(e) => set({ meetingPointJa: e.target.value })} />
              </Field>
              <Field label="行程">
                <textarea rows={4} maxLength={1000} value={f.itineraryJa} onChange={(e) => set({ itineraryJa: e.target.value })} />
              </Field>
              <Field label="ガイドの言語" required>
                <div className="chips">
                  {GUIDE_LANGS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`chip chip-toggle ${f.guideLanguages.includes(g) ? 'on' : ''}`}
                      aria-pressed={f.guideLanguages.includes(g)}
                      onClick={() => set({ guideLanguages: toggle(f.guideLanguages, g) })}
                    >
                      {GUIDE_LANG_JA[g]}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}
        </fieldset>
      )}

      <fieldset className="stack-s">
        <legend>食べ物の情報</legend>
        <p className="small muted">旅行者には「お店の自己申告」と添えて表示します。アレルギー表示の誤りはお店の責任になります。変更があったらすぐに更新してください。</p>
        <label className="check">
          <input type="checkbox" checked={f.halalCertified} onChange={(e) => set({ halalCertified: e.target.checked })} />
          ハラル認証を受けている（認証を受けた店だけにハラルマークを表示します）
        </label>
        <Field label="対応できる食事制限">
          <Checks values={DIET_SUPPORT} selected={f.dietSupport} labels={DIET_SUPPORT_JA} onChange={(dietSupport) => set({ dietSupport })} />
        </Field>
        <Field label="材料の調整">
          <span className="row gap-s">
            <label className="check">
              <input type="checkbox" checked={f.adjustLess} onChange={(e) => set({ adjustLess: e.target.checked })} />
              少なめにできる
            </label>
            <label className="check">
              <input type="checkbox" checked={f.adjustRemove} onChange={(e) => set({ adjustRemove: e.target.checked })} />
              抜きにできる
            </label>
          </span>
        </Field>
        <Field label="お店全体で使っていないアレルギー物質">
          <Checks values={ALLERGENS} selected={f.allergenFreeShop} labels={ALLERGEN_JA} onChange={(allergenFreeShop) => set({ allergenFreeShop })} />
        </Field>
        <div className="stack-s">
          <span>料理ごとのアレルギー物質</span>
          {f.dishes.map((d, i) => (
            <div key={i} className="dish stack-s">
              <div className="row gap-s">
                <input className="grow" maxLength={60} placeholder="料理名" value={d.nameJa} onChange={(e) => set({ dishes: f.dishes.map((x, k) => (k === i ? { ...x, nameJa: e.target.value } : x)) })} />
                <button type="button" className="link small" onClick={() => set({ dishes: f.dishes.filter((_, k) => k !== i) })}>
                  削除
                </button>
              </div>
              <Checks values={ALLERGENS} selected={d.allergens} labels={ALLERGEN_JA} onChange={(allergens) => set({ dishes: f.dishes.map((x, k) => (k === i ? { ...x, allergens } : x)) })} />
            </div>
          ))}
          {f.dishes.length < LIMITS.dishesMax && (
            <button type="button" className="btn btn-small" onClick={() => set({ dishes: [...f.dishes, { nameJa: '', allergens: [] }] })}>
              ＋ 料理を追加
            </button>
          )}
        </div>
      </fieldset>

      <fieldset className="stack-s">
        <legend>予約の設定</legend>
        <p className="small muted">時間枠の上限人数までは、旅行者の予約がその場で確定します（承認は不要）。時間枠を1つも登録しない場合、予約は受け付けず、チャットでの問い合わせのみになります。</p>
        <div>
          <span>時間枠（開始時刻と上限人数）</span>
          <ul className="list">
            {f.slots.map((s, i) => (
              <li key={s.time} className="row gap-s">
                <strong>{s.time}</strong>
                <span className="grow">
                  上限
                  <input
                    type="number"
                    inputMode="numeric"
                    className="input-short"
                    min={1}
                    max={LIMITS.slotCapacityMax}
                    value={s.capacity || ''}
                    onChange={(e) => set({ slots: f.slots.map((x, k) => (k === i ? { ...x, capacity: num(e.target.value) ?? 0 } : x)) })}
                  />
                  名
                </span>
                <button type="button" className="link small" onClick={() => set({ slots: f.slots.filter((_, k) => k !== i) })}>
                  削除
                </button>
              </li>
            ))}
          </ul>
          {f.slots.length < LIMITS.slotsMax && (
            <div className="row gap-s">
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label="開始時刻" />
              <input type="number" inputMode="numeric" className="input-short" min={1} value={newCap} onChange={(e) => setNewCap(e.target.value)} aria-label="上限人数" />
              <span>名</span>
              <button type="button" className="btn btn-small" onClick={addSlot}>
                枠を追加
              </button>
            </div>
          )}
        </div>
        <Field label="定休日（曜日）">
          <div className="chips">
            {WEEK.map((w, i) => (
              <button
                key={i}
                type="button"
                className={`chip chip-toggle ${f.closedWeekdays.includes(i) ? 'on' : ''}`}
                aria-pressed={f.closedWeekdays.includes(i)}
                onClick={() => set({ closedWeekdays: toggle(f.closedWeekdays, i) })}
              >
                {w}
              </button>
            ))}
          </div>
        </Field>
        <Field label="受付締切">
          <Radios value={f.cutoff} options={CUTOFFS} labels={CUTOFF_JA} onChange={(cutoff) => set({ cutoff })} />
        </Field>
        <Field label="無料キャンセルの期限">
          <Radios value={f.freeCancel} options={FREE_CANCELS} labels={FREE_CANCEL_JA} onChange={(freeCancel) => set({ freeCancel })} />
        </Field>
        <Field label="期限後のキャンセル料" hint="自動では請求しません。「来店なし」や期限後のキャンセルの記録をもとに、運営が判断して旅行者の登録カードに請求します。">
          <div className="chips">
            <button type="button" className={`chip chip-toggle ${f.lateFeeJpy == null ? 'on' : ''}`} onClick={() => set({ lateFeeJpy: null })}>
              なし
            </button>
            <button type="button" className={`chip chip-toggle ${f.lateFeeJpy != null ? 'on' : ''}`} onClick={() => set({ lateFeeJpy: f.lateFeeJpy ?? (f.priceJpy || 1000) })}>
              あり
            </button>
          </div>
          {f.lateFeeJpy != null && (
            <span className="row gap-s">
              1人あたり
              <input type="number" inputMode="numeric" className="input-short" min={1} value={f.lateFeeJpy || ''} onChange={(e) => set({ lateFeeJpy: num(e.target.value) ?? 0 })} />円
            </span>
          )}
        </Field>
        <Link to={`/biz/listing/${f.id}/closed`} className="small">
          臨時休業など、受付を止める日を設定する →
        </Link>
      </fieldset>

      {msg && <p className={`notice notice-${msg.kind === 'ok' ? 'ok' : msg.kind === 'warn' ? 'warn' : 'error'}`}>{msg.text}</p>}
      <div className="sticky-cta">
        <button className="btn btn-primary btn-big" disabled={busy}>
          {f.status === 'HIDDEN' ? '保存（非公開のまま）' : '保存して公開'}
        </button>
      </div>
      <div className="actions">
        {f.status === 'PUBLISHED' && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void changeVisibility('hide')}>
            非公開にする
          </button>
        )}
        {f.status === 'HIDDEN' && (
          <button type="button" className="btn" disabled={busy} onClick={() => void changeVisibility('publish')}>
            公開する
          </button>
        )}
      </div>
    </form>
  );
}
