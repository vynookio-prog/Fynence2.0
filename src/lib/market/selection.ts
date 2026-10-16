/**
 * Types shared between the market view (server) and the picker (client).
 *
 * These live apart from `view.ts` on purpose. `view.ts` reaches the InsForge
 * admin client, which holds a key that bypasses RLS. A client component that
 * imports a type from there pulls that module into the browser's module graph.
 * Only the type is erased at build time, so nothing secret ships — but the
 * dependency edge exists, and one careless value import would turn it into a
 * real leak. Keeping the shared shapes here removes the edge entirely.
 */

/** How many instruments a user may select. Enforced in the database too. */
export const MAX_INSTRUMENTS = 5

/** One instrument a user has chosen to see. */
export type SelectedInstrument = {
  provider: string
  symbol: string
  position: number
}

/** An instrument the catalogue may offer: proven reachable, nothing else. */
export type CatalogueEntry = {
  provider: string
  symbol: string
  instrumentType: string
  exchange: string | null
  currency: string | null
}
