import { fr } from '../i18n/fr'
import styles from './ExtractionDossierPanel.module.css'
import type { Interpretation } from './interpretation'

function formatMontant(n: number | null): string {
  return n === null ? '—' : `${n.toLocaleString('fr-FR')} €`
}

function StatutBadge({ statut }: { statut: string }) {
  const confirmed = statut === 'confirmé'
  return (
    <span className={confirmed ? styles.statutConfirme : styles.statutAVerifier}>
      {confirmed ? fr.runs.dossierExtraction.statutConfirme : fr.runs.dossierExtraction.statutAVerifier}
    </span>
  )
}

// Renders the dossier a courtage-extraction run parked on confirm_extraction actually
// carries — state["interpretation"], the de-tokenised structured extraction (see
// interpretation.ts) — as a real reviewable comparison, not a text blob.
export function ExtractionDossierPanel({ interpretation }: { interpretation: Interpretation }) {
  const t = fr.runs.dossierExtraction

  return (
    <div className={styles.panel}>
      {interpretation.revenus.length > 0 && (
        <section>
          <h4 className={styles.sectionLabel}>{t.revenus}</h4>
          <ul className={styles.lines}>
            {interpretation.revenus.map((r, i) => (
              <li key={i} className={styles.line}>
                <div className={styles.lineMain}>
                  <b>{r.source}</b>
                  <span>{t.perMonth(formatMontant(r.montant_mensuel))}</span>
                </div>
                <div className={styles.lineMeta}>
                  <StatutBadge statut={r.statut} />
                  <span className={styles.source}>{t.source(r.document_source)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {interpretation.credits_en_cours.length > 0 && (
        <section>
          <h4 className={styles.sectionLabel}>{t.credits}</h4>
          <ul className={styles.lines}>
            {interpretation.credits_en_cours.map((c, i) => (
              <li key={i} className={styles.line}>
                <div className={styles.lineMain}>
                  <b>{c.etablissement}</b>
                  <span>{t.perMonth(formatMontant(c.mensualite))}</span>
                </div>
                <div className={styles.lineMeta}>
                  <StatutBadge statut={c.statut} />
                  <span className={styles.source}>
                    {t.capitalRestantDu(formatMontant(c.capital_restant_du))}
                  </span>
                  <span className={styles.source}>{t.source(c.document_source)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {interpretation.incidents.length > 0 && (
        <section>
          <h4 className={styles.sectionLabel}>{t.incidents}</h4>
          <ul className={styles.lines}>
            {interpretation.incidents.map((inc, i) => (
              <li key={i} className={styles.line}>
                <div className={styles.lineMain}>
                  <b>{inc.type}</b>
                  <span>{formatMontant(inc.montant)}</span>
                </div>
                <div className={styles.lineMeta}>
                  <span className={styles.source}>{inc.date}</span>
                  <span className={styles.source}>{t.source(inc.document_source)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {interpretation.reste_a_vivre && (
        <section>
          <h4 className={styles.sectionLabel}>{t.resteAVivre}</h4>
          <div className={styles.line}>
            <div className={styles.lineMain}>
              <b>{formatMontant(interpretation.reste_a_vivre.montant)}</b>
            </div>
            <div className={styles.lineMeta}>
              <StatutBadge statut={interpretation.reste_a_vivre.statut} />
              <span className={styles.source}>{interpretation.reste_a_vivre.methode_calcul}</span>
            </div>
          </div>
        </section>
      )}

      {interpretation.pieces_manquantes.length > 0 && (
        <section>
          <h4 className={styles.sectionLabel}>{t.piecesManquantes}</h4>
          <ul className={styles.piecesList}>
            {interpretation.pieces_manquantes.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
