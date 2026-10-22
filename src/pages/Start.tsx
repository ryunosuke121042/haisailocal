// 最初の質問：キャラクター「まる」が会話しながら聞く（キャラクターを非表示にしている人には、同じ質問を通常のフォームで）。
// プロフィール（表示言語・通貨）、アカウント作成のおすすめ（スキップ可）、やりたいこと・行き先・客層（一覧の絞り込み）、
// 今日の希望（予算は並び順、食事制限は外せる絞り込み、宗教上の制限・アレルギーは同意した人にだけ聞き、合わない店を自動で除く）。
// 途中で閉じても端末に残した答えから再開できる。どこからでもスキップできる
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AREAS, type AreaCode } from '../../shared/areas';
import {
  ALLERGENS,
  BUDGET_BANDS,
  CATEGORIES,
  CURRENCIES,
  DIET_SUPPORT,
  LANG_LABELS,
  LANGS,
  RELIGIOUS,
  type Allergen,
  type BudgetBandCode,
  type CategoryCode,
  type DietSupport,
  type Religious,
} from '../../shared/constants';
import { filtersToQuery, type Filters } from '../../shared/filters';
import { jstDateString } from '../../shared/time';
import { Mascot } from '../components/Character';
import { areaName, toggle, aiServiceName } from '../components/ui';
import type { Key } from '../i18n';
import { load, store, useApp } from '../store';

const STEPS = ['lang', 'currency', 'account', 'category', 'area', 'crowd', 'budget', 'dietary', 'sensitive', 'religious', 'allergens', 'finish'] as const;
type Step = (typeof STEPS)[number];

interface Answers {
  category?: CategoryCode[];
  area?: AreaCode[];
  crowd?: 'local' | 'any';
  budget?: BudgetBandCode | 'any';
  dietary?: DietSupport[];
  consent?: boolean;
  religious?: Religious[];
  allergens?: Allergen[];
}

interface Saved {
  step: Step;
  answers: Answers;
}

const KEY = 'hl.onboarding';

/** 答えを一覧の絞り込みに置き換える（「どれでも」は条件にしない）。食事制限は外せる条件として入れておく */
export function answersToFilters(a: Answers): Filters {
  const f: Filters = {};
  if (a.category?.length) f.category = a.category;
  if (a.area?.length) f.area = a.area;
  if (a.crowd === 'local') f.crowd = ['LOCAL'];
  if (a.dietary?.length) f.dietary = a.dietary;
  return f;
}

const QUESTION: Record<Step, Key> = {
  lang: 'qLang',
  currency: 'qCurrency',
  account: 'qAccount',
  category: 'qCategory',
  area: 'qArea',
  crowd: 'qCrowd',
  budget: 'qBudget',
  dietary: 'qDietary',
  sensitive: 'qSensitive',
  religious: 'qReligious',
  allergens: 'qAllergens',
  finish: 'qFinish',
};

export function Maru({ talking }: { talking?: boolean }) {
  return (
    <span className={`maru ${talking ? 'maru-talk' : ''}`} aria-hidden>
      <Mascot size={52} />
    </span>
  );
}

export default function Start() {
  const { t, lang, me, prefs, profile, setPrefs, currency, config } = useApp();
  const nav = useNavigate();
  const [saved, setSaved] = useState<Saved>(() => load<Saved>(KEY, { step: 'lang', answers: {} }));
  const [cur, setCur] = useState(currency);
  const end = useRef<HTMLDivElement>(null);
  const { step, answers } = saved;
  const charOn = !profile.characterHidden;

  // scrollIntoView は新しいブラウザでは Promise を返すので、{ } で包んで何も返さない
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [step]);

  if (prefs.chosen && step === 'lang') return <Navigate to={`/${lang}`} replace />;

  const save = (next: Saved) => {
    setSaved(next);
    store(KEY, next);
  };
  // ログイン済みならアカウントのおすすめを、同意していなければ宗教上の制限・アレルギーを飛ばす
  const skipped = (s: Step, a: Answers) => (s === 'account' && !!me) || ((s === 'religious' || s === 'allergens') && !a.consent);
  const nextOf = (s: Step, a: Answers): Step => {
    let i = STEPS.indexOf(s) + 1;
    while (i < STEPS.length - 1 && skipped(STEPS[i], a)) i++;
    return STEPS[Math.min(i, STEPS.length - 1)];
  };
  const prevOf = (s: Step): Step => {
    let i = STEPS.indexOf(s) - 1;
    while (i > 0 && skipped(STEPS[i], answers)) i--;
    return STEPS[Math.max(i, 0)];
  };
  const go = (a: Partial<Answers> = {}) => {
    const merged = { ...answers, ...a };
    save({ step: nextOf(step, merged), answers: merged });
  };
  const setA = (a: Partial<Answers>) => save({ step, answers: { ...answers, ...a } });

  async function finish(skip = false) {
    if (skip) {
      await setPrefs({ currency: cur, chosen: true, prefsDate: jstDateString() });
    } else {
      await setPrefs({
        currency: cur,
        chosen: true,
        sensitiveConsent: !!answers.consent,
        prefsDate: jstDateString(),
        prefs: {
          budget: answers.budget && answers.budget !== 'any' ? answers.budget : null,
          dietary: answers.dietary ?? [],
          religious: answers.consent ? (answers.religious ?? []) : [],
          allergens: answers.consent ? (answers.allergens ?? []) : [],
        },
      });
    }
    store(KEY, undefined);
    const q = skip ? '' : filtersToQuery(answersToFilters(answers));
    nav(`/${lang}${q ? `?${q}` : ''}`, { replace: true });
  }

  const done = STEPS.slice(0, STEPS.indexOf(step)).filter((s) => !skipped(s, answers));
  const list = <T extends string>(xs: readonly T[] | undefined, f: (x: T) => string, none: Key) => (xs?.length ? xs.map(f).join(', ') : t(none));
  const answerText = (s: Step): string => {
    switch (s) {
      case 'lang':
        return LANG_LABELS[lang];
      case 'currency':
        return cur;
      case 'account':
        return t('later');
      case 'category':
        return list(answers.category, (c) => t(`cat_${c}`), 'aAnything');
      case 'area':
        return list(answers.area, (a) => areaName(a, lang), 'aUndecided');
      case 'crowd':
        return answers.crowd === 'local' ? t('aLocal') : t('aEither');
      case 'budget':
        return !answers.budget || answers.budget === 'any' ? t('aAnyBudget') : t(`budget_${answers.budget}`);
      case 'dietary':
        return list(answers.dietary, (d) => t(`diet_${d}`), 'aNone');
      case 'sensitive':
        return answers.consent ? t('agree') : t('dontAgree');
      case 'religious':
        return list(answers.religious, (r) => t(`religious_${r}`), 'aNone');
      case 'allergens':
        return list(answers.allergens, (a) => t(`allergen_${a}`), 'aNone');
      default:
        return '';
    }
  };

  const progress = Math.round((STEPS.indexOf(step) / (STEPS.length - 1)) * 100);
  const say = (text: string, talking = false) =>
    charOn ? (
      <div className="say-row">
        <Maru talking={talking} />
        <div className="msg msg-them">{text}</div>
      </div>
    ) : (
      <p className="q-plain">{text}</p>
    );

  return (
    <div className="start stack">
      <div className="progress" aria-hidden>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className={charOn ? 'chat-log start-log' : 'stack-s'}>
        {charOn && say(t('qHello'))}
        {done.map((s) => (
          <div key={s} className="stack-s">
            {say(t(QUESTION[s]))}
            <div className="msg msg-me">{answerText(s)}</div>
          </div>
        ))}
        {say(t(QUESTION[step]), true)}
      </div>

      <div className="start-choices">
        {step === 'lang' && (
          <div className="chips">
            {LANGS.map((l) => (
              <button
                key={l}
                className={`chip chip-toggle ${l === lang ? 'on' : ''}`}
                lang={l === 'zh' ? 'zh-Hans' : l}
                onClick={() => {
                  go();
                  if (l !== lang) nav(`/${l}/start`, { replace: true });
                }}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        )}

        {step === 'currency' && (
          <>
            <div className="chips">
              {CURRENCIES.map((c) => (
                <button key={c} className={`chip chip-toggle ${c === cur ? 'on' : ''}`} onClick={() => setCur(c)}>
                  {c}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                void setPrefs({ currency: cur });
                go();
              }}
            >
              {t('next')}
            </button>
          </>
        )}

        {step === 'account' && (
          <div className="actions">
            <Link className="btn btn-primary" to={`/${lang}/signup?next=${encodeURIComponent(`/${lang}/start`)}`} onClick={() => save({ step: nextOf('account', answers), answers })}>
              {t('signup')}
            </Link>
            <button className="btn" onClick={() => go()}>
              {t('later')}
            </button>
          </div>
        )}

        {step === 'category' && (
          <>
            <ChipSet values={CATEGORIES} selected={answers.category} label={(c) => t(`cat_${c}`)} onToggle={(c) => setA({ category: toggle(answers.category, c) })} />
            <button className="btn btn-primary" onClick={() => go()}>
              {answers.category?.length ? t('next') : t('aAnything')}
            </button>
          </>
        )}

        {step === 'area' && (
          <>
            <ChipSet values={AREAS} selected={answers.area} label={(a) => areaName(a, lang)} onToggle={(a) => setA({ area: toggle(answers.area, a) })} />
            <button className="btn btn-primary" onClick={() => go()}>
              {answers.area?.length ? t('next') : t('aUndecided')}
            </button>
          </>
        )}

        {step === 'crowd' && (
          <div className="chips">
            <button className="chip chip-toggle" onClick={() => go({ crowd: 'local' })}>
              {t('aLocal')}
            </button>
            <button className="chip chip-toggle" onClick={() => go({ crowd: 'any' })}>
              {t('aEither')}
            </button>
          </div>
        )}

        {step === 'budget' && (
          <>
            <div className="chips">
              {BUDGET_BANDS.map((b) => (
                <button key={b} className="chip chip-toggle" onClick={() => go({ budget: b })}>
                  {t(`budget_${b}`)}
                </button>
              ))}
              <button className="chip chip-toggle" onClick={() => go({ budget: 'any' })}>
                {t('aAnyBudget')}
              </button>
            </div>
            <p className="small muted">{t('budgetNote')}</p>
          </>
        )}

        {step === 'dietary' && (
          <>
            <ChipSet values={DIET_SUPPORT} selected={answers.dietary} label={(d) => t(`diet_${d}`)} onToggle={(d) => setA({ dietary: toggle(answers.dietary, d) })} />
            <button className="btn btn-primary" onClick={() => go()}>
              {answers.dietary?.length ? t('next') : t('aNone')}
            </button>
          </>
        )}

        {step === 'sensitive' && (
          <div className="stack-s">
            <div className="consent-box small">
              <p>{t('sensitiveWhy', { ai: aiServiceName(config) })}</p>
            </div>
            <div className="actions">
              <button className="btn btn-primary" onClick={() => go({ consent: true })}>
                {t('agree')}
              </button>
              <button className="btn" onClick={() => go({ consent: false, religious: [], allergens: [] })}>
                {t('dontAgree')}
              </button>
            </div>
          </div>
        )}

        {step === 'religious' && (
          <>
            <ChipSet values={RELIGIOUS} selected={answers.religious} label={(r) => t(`religious_${r}`)} onToggle={(r) => setA({ religious: toggle(answers.religious, r) })} />
            <button className="btn btn-primary" onClick={() => go()}>
              {answers.religious?.length ? t('next') : t('aNone')}
            </button>
          </>
        )}

        {step === 'allergens' && (
          <>
            <ChipSet values={ALLERGENS} selected={answers.allergens} label={(a) => t(`allergen_${a}`)} onToggle={(a) => setA({ allergens: toggle(answers.allergens, a) })} />
            <p className="small muted">{t('allergyAskShop')}</p>
            <button className="btn btn-primary" onClick={() => go()}>
              {answers.allergens?.length ? t('next') : t('aNone')}
            </button>
          </>
        )}

        {step === 'finish' && (
          <div className="actions">
            <button className="btn btn-primary btn-big" onClick={() => void finish()}>
              {t('showPlaces')}
            </button>
            <button className="btn btn-ghost" onClick={() => save({ step: 'category', answers })}>
              {t('answerAgain')}
            </button>
          </div>
        )}

        {step !== 'finish' && (
          <p className="small">
            {step !== 'lang' && (
              <button className="link small" onClick={() => save({ step: prevOf(step), answers })}>
                ← {t('back')}
              </button>
            )}{' '}
            <button className="link small muted" onClick={() => void finish(true)}>
              {t('skipQuestions')}
            </button>
          </p>
        )}
      </div>
      <div ref={end} className="start-end" />
    </div>
  );
}

function ChipSet<T extends string>({ values, selected, label, onToggle }: { values: readonly T[]; selected?: T[]; label: (v: T) => string; onToggle: (v: T) => void }) {
  return (
    <div className="chips">
      {values.map((v) => (
        <button key={v} className={`chip chip-toggle ${selected?.includes(v) ? 'on' : ''}`} aria-pressed={!!selected?.includes(v)} onClick={() => onToggle(v)}>
          {label(v)}
        </button>
      ))}
    </div>
  );
}
