// 設定：表示言語・通貨、今日の希望（予算・食事制限）、宗教上の制限・アレルギー（同意した人だけ。同意の取り下げで削除）、
// キャラクターの表示・非表示、アカウント
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ALLERGENS, BUDGET_BANDS, CURRENCIES, DIET_SUPPORT, LANG_LABELS, LANGS, RELIGIOUS } from '../../shared/constants';
import type { Prefs } from '../../shared/filters';
import { jstDateString } from '../../shared/time';
import { post } from '../api';
import { useCharacter } from '../components/Character';
import { Chip, toggle } from '../components/ui';
import { store, useApp } from '../store';

export default function Settings() {
  const { t, lang, me, setMe, currency, profile, setPrefs } = useApp();
  const nav = useNavigate();
  const [p, setP] = useState<Prefs>(profile.prefs);
  const [consent, setConsent] = useState(profile.sensitiveConsent);
  const [saved, setSaved] = useState(false);
  useCharacter({ line: t('say_settings') });

  async function save(next: Prefs, nextConsent = consent) {
    const clean: Prefs = { ...next, ...(nextConsent ? {} : { religious: [], allergens: [] }) };
    setP(clean);
    setConsent(nextConsent);
    await setPrefs({ prefs: clean, prefsDate: jstDateString(), sensitiveConsent: nextConsent });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="stack settings">
      <h1>{t('navSettings')}</h1>

      <section className="stack-s">
        <h2>{t('language')}</h2>
        <div className="seg wrap" role="group">
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? 'on' : ''} lang={l} onClick={() => nav(`/${l}/settings`, { replace: true })}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
        <label>
          {t('currency')}
          <select value={currency} onChange={(e) => void setPrefs({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="stack-s">
        <h2>{t('todayWishes')}</h2>
        <p className="small muted">{t('budgetNote')}</p>
        <div className="chips">
          {BUDGET_BANDS.map((b) => (
            <Chip key={b} on={p.budget === b} onClick={() => void save({ ...p, budget: p.budget === b ? null : b })}>
              {t(`budget_${b}`)}
            </Chip>
          ))}
        </div>
        <div className="chips">
          {DIET_SUPPORT.map((d) => (
            <Chip key={d} on={!!p.dietary?.includes(d)} onClick={() => void save({ ...p, dietary: toggle(p.dietary, d) })}>
              {t(`diet_${d}`)}
            </Chip>
          ))}
        </div>
      </section>

      <section className="stack-s">
        <h2>{t('sensitiveTitle')}</h2>
        <div className="consent-box small">
          <p>{t('sensitiveWhy')}</p>
        </div>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => void save(p, e.target.checked)} />
          {t('sensitiveAgree')}
        </label>
        {!consent && profile.sensitiveConsent === false && <p className="small muted">{t('sensitiveOffNote')}</p>}
        {consent && (
          <>
            <p className="small">{t('qReligious')}</p>
            <div className="chips">
              {RELIGIOUS.map((r) => (
                <Chip key={r} on={!!p.religious?.includes(r)} onClick={() => void save({ ...p, religious: toggle(p.religious, r) })}>
                  {t(`religious_${r}`)}
                </Chip>
              ))}
            </div>
            <p className="small">{t('qAllergens')}</p>
            <div className="chips">
              {ALLERGENS.map((a) => (
                <Chip key={a} on={!!p.allergens?.includes(a)} onClick={() => void save({ ...p, allergens: toggle(p.allergens, a) })}>
                  {t(`allergen_${a}`)}
                </Chip>
              ))}
            </div>
            <p className="small muted">{t('allergyAskShop')}</p>
          </>
        )}
      </section>
      {saved && <p className="notice notice-ok small">{t('savedOk')}</p>}

      <section className="stack-s">
        <h2>{t('charName')}</h2>
        <label className="check">
          <input type="checkbox" checked={!profile.characterHidden} onChange={(e) => void setPrefs({ characterHidden: !e.target.checked })} />
          {t('showCharacterSetting')}
        </label>
        <p className="small muted">{t('characterHiddenNote')}</p>
        <button
          className="btn btn-small"
          onClick={() => {
            store('hl.onboarding', { step: 'category', answers: {} });
            nav(`/${lang}/start`);
          }}
        >
          {t('askAgain')}
        </button>
      </section>

      <section className="stack-s">
        <h2>{t('account')}</h2>
        {me ? (
          <>
            <p className="small">
              {me.name} · {me.email}
            </p>
            <button
              className="btn btn-small"
              onClick={async () => {
                await post('/auth/logout');
                setMe(null);
                nav(`/${lang}`);
              }}
            >
              {t('logout')}
            </button>
          </>
        ) : (
          <div className="actions">
            <Link className="btn btn-small btn-primary" to={`/${lang}/signup?next=/${lang}/settings`}>
              {t('signup')}
            </Link>
            <Link className="btn btn-small" to={`/${lang}/login?next=/${lang}/settings`}>
              {t('login')}
            </Link>
          </div>
        )}
        <p className="small">
          <Link to={`/${lang}/privacy`}>{t('readPrivacy')}</Link> · <Link to={`/${lang}/terms`}>{t('readTerms')}</Link>
        </p>
      </section>
    </div>
  );
}
