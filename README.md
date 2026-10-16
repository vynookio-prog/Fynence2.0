# Fynence

Next.js + TypeScript trading journal and market intelligence workspace. Product specifications remain in [`Prompt/`](./Prompt/); application source lives in `src/` at repository root.

## Development

```bash
npm install
cp .env.example .env.local # fill in InsForge URL and anon key
npm run dev
```

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Current release slice: InsForge auth, private shell, manual trade entry, decimal-safe analytics, trading accounts, and explicit unavailable states for unapproved external data sources. Trade results are manually recorded; no price/contract multiplier is inferred.
