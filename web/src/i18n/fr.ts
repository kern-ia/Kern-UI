/**
 * Brand-resolved copy. Every component still does `import { fr } from '../i18n/fr'` and
 * reads `fr.xxx.yyy` exactly as before — this file used to hold the dictionary itself and
 * now just picks which one, so none of the ~24 importing files needed to change.
 *
 * Selection matches the CSS brand tokens (web/src/styles/brand-*.css): a build-time
 * VITE_BRAND env var, not a runtime switch. See README.md, "Theming — one codebase,
 * several client brands".
 */
import { kern } from './kern'
import { avel } from './avel'

export const fr = import.meta.env.VITE_BRAND === 'avel' ? avel : kern
