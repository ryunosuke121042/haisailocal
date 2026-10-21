import { useCharacter } from '../components/Character';
import { legalFor, type LegalSection } from '../i18n/legal';
import { useApp } from '../store';

function Doc({ title, sections }: { title: string; sections: LegalSection[] }) {
  const { lang } = useApp();
  const doc = legalFor(lang);
  useCharacter({});
  return (
    <article className="legal">
      <h1>{title}</h1>
      <p className="notice small">{doc.draftNote}</p>
      {sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

export function Privacy() {
  const { t, lang } = useApp();
  return <Doc title={t('privacyTitle')} sections={legalFor(lang).privacy} />;
}

export function Terms() {
  const { t, lang } = useApp();
  return <Doc title={t('termsTitle')} sections={legalFor(lang).terms} />;
}
