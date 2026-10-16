# Fynence — Architecture

**Status:** Draft arsitektur awal. Detail InsForge SDK, auth, storage, dan authorization harus diverifikasi terhadap dokumentasi resmi sebelum implementasi.

## 1. Prinsip arsitektur

- **Journal-first:** transaksi dan analytics inti tidak bergantung pada provider eksternal.
- **Server-authoritative:** validasi, authorization, secrets, dan mutasi sensitif berada di server.
- **Provider adapters:** sumber pasar/berita/kalender/AI dapat diganti tanpa mengubah domain logic.
- **Traceable data:** setiap data eksternal/hasil turunan membawa sumber, timestamp, klasifikasi, dan status.
- **No fabricated values:** kekurangan data menghasilkan unavailable/insufficient-data, bukan angka sintetis.
- **Free-tier aware:** cache, pagination, bounded retries, no always-on worker, dan no automatic paid fallback.
- **Manual trades only:** tidak ada adapter MT5, broker sync, atau order execution.

## 2. Konteks sistem

```text
Browser (Next.js UI)
   └─ Next.js server boundary (Server Components, Server Actions/Route Handlers)
        ├─ Auth/session adapter ── InsForge Auth (API/SDK to verify)
        ├─ Application services ── PostgreSQL (InsForge)
        ├─ Storage adapter ─────── InsForge Storage (private trade attachments)
        ├─ Market-data adapters ── verified optional providers
        ├─ News/calendar adapters ─ verified optional sources
        └─ AI adapter ──────────── optional model; rule-based fallback
```

Diagram ini menunjukkan batas logis, bukan kontrak endpoint. Cocokkan API dan package dengan versi resmi yang dipilih.

## 3. Lapisan aplikasi

1. **Presentation:** route/layout, forms, tables, charts, state, accessible interaction.
2. **Application services:** use case seperti CreateTrade, CloseTrade, ListTrades, BuildAnalytics, GetMacroOverview.
3. **Domain:** entitas, aturan status, money/decimal calculations, validation, indicator formulas, analysis semantics.
4. **Repositories:** akses `profiles`, `trading_accounts`, `trades`, reports, dan data pasar; semua query privat menerima identity terverifikasi.
5. **Provider adapters:** normalisasi response eksternal, timeout, rate-limit handling, cache, provenance.
6. **Infrastructure:** InsForge/PostgreSQL, auth/session, storage, logging, environment variables.

UI tidak menghitung P&L dengan formula tersendiri dan tidak mengakses API key provider secara langsung.

## 4. Struktur direktori yang disarankan

```text
src/
  app/                     # routes, layouts, loading/error states
  components/              # design-system and feature UI
  features/
    journal/               # forms, list, detail, validation
    analytics/             # views over domain calculations
    macro-desk/
    deep-dive/
    reports/
    calendar/
    news/
    psychology/
    community/
  domain/
    trades/                # trade types, invariants, money calculations
    analytics/
    market/                # normalized OHLC, indicators, provenance
  server/
    auth/
    services/
    repositories/
    providers/
    storage/
  lib/                     # shared pure utilities
  styles/
  types/
  tests/
insforge/                  # verified config/migrations if project convention allows
```

Adapt to the existing repository after audit; do not force a rewrite to match this layout.

## 5. Data model (logical)

All private rows need a trusted owner identity (typically `user_id` from the verified auth session), created/updated timestamps, and authorization appropriate to the actual InsForge setup. Prefer UUID primary keys; money/prices use PostgreSQL `numeric`/decimal-safe values, not binary floating point.

| Entity | Important fields / purpose |
|---|---|
| `profiles` | auth user reference, display preferences, timezone, theme. |
| `trading_accounts` | owner, name, optional broker label, account type, base currency, manually entered initial balance, notes. Never imply broker connection. |
| `trades` | owner, account, symbol, direction, status, open/close timestamps, entry/exit, size, stop/target, fees, setup/timeframe, exit reason, notes. Open trades may omit exit values. |
| `trade_plans` | trade reference, planned entry/stop/target, risk amount/percent, plan metadata. |
| `trade_reflections` | trade reference, setup grade, execution quality, plan adherence, recorded emotion, reflection notes. |
| `trade_attachments` | owner, trade, private storage key, MIME type, size, timestamps. |
| `watchlists` | owner, symbols, optional ordering/preferences. |
| `market_bars` | normalized instrument/timeframe OHLCV, provider, source timestamp, retrieval timestamp, data class, license/retention metadata where relevant. Store only if permitted. |
| `market_snapshots` | optional normalized derived/market state with input provenance and evaluation time. |
| `news_items` | provider/source URL, headline/metadata, published/retrieved times, related symbols, content license/retention state. Avoid article body unless explicitly permitted. |
| `economic_events` | provider/source, event/time/currency/impact, actual/forecast/previous if licensed, timezone/source timestamps. |
| `reports` | owner, type, period, generated time, status, provenance, content. |
| `psychology_insights` | owner, period, rules/model version, evidence references, generated time, output class. |
| `community_channels/messages/reactions` | public/community data with distinct authorization, moderation, pagination, and rate limits. Defer until core release. |

Indexes should cover foreign keys and common filters (owner + date/status/account/symbol). Add uniqueness constraints only after domain behavior is confirmed. Define cascade/delete and retention behavior explicitly before migrations.

## 6. Trade and calculation invariants

- Trade owner must match the authenticated user; account must be owned by that user.
- Direction is Long or Short; status is Open or Closed.
- Open trades may lack exit timestamp, exit price, and realized P&L.
- Closed-trade completeness rules must be explicit; do not silently infer missing values.
- Centralize fees, breakeven, currency-conversion, rounding, and `profit_factor` denominator-zero behavior.
- Exclude open trades from realized performance; if unrealized values are later added, label separately and require a verified quote source.
- Do not calculate instrument P&L from price delta unless contract multiplier/lot semantics are known and documented. Permit explicit manually recorded realized P&L with provenance where the model allows.

## 7. Authentication and authorization

- Use InsForge auth only after verifying the supported SDK/session flow.
- Protect private routes, but do not rely on UI route guards alone.
- Every read/write must be scoped by a verified user identity on the server and/or enforced database policies as supported.
- Verify row-level policy capability and exact syntax with current InsForge docs; until confirmed, treat the policy implementation as a release blocker, not an assumed feature.
- Add integration tests with two users for trades, accounts, reports, and attachments.
- Never trust client-supplied `user_id`, account ownership, or privilege fields.

## 8. APIs, mutations, and error behavior

Use Server Actions or Route Handlers according to the existing project conventions, with schemas validated on the server. Return typed application errors; avoid exposing raw provider errors, secrets, or private records. Mutations should report success only after a confirmed database result. Use pagination for lists; avoid fetching full trade history on each route navigation.

External requests: request timeout, bounded concurrency, bounded retries with backoff, deduplication, cache only when provider terms permit, and respect 429/usage errors. No background polling loop without an approved schedule and verified cost/availability.

## 9. Provider and provenance contract

Normalize market data into an internal provider-independent shape. Include `provider`, `source_timestamp`, `retrieved_at`, `timeframe`, `data_class` (`live`, `delayed`, `historical`, `manual`, `derived`, `ai_interpretation` as applicable), and a status/freshness indicator. A chart/analysis must carry the same source context as its underlying bars. Never label cached historical data as live.

Market, news, economic calendar, FX reference rates, and AI are optional adapters. Provider selection and commercial display/storage rights remain pending in `DATA_SOURCES.md`.

## 10. Privacy, storage, and operations

- Store provider credentials only in server environment; never commit them or expose in client bundle/logs.
- Attachments are optional, size/type constrained, private by default, and ownership-checked on reads/deletes.
- No public file URL for private trade screenshots unless access design explicitly guarantees authorization.
- Use migrations; review changes and test rollback/recovery strategy.
- Minimize logging of journal contents and personal data.
- Monitor DB, storage, bandwidth, function calls, provider quota, staleness, and errors.
- Backend unavailable means no claim that trade was saved. Offline write support is not assumed.

## 11. Testing and release gates

Unit tests: trade-state validation, monetary arithmetic, fees, Long/Short, breakeven, missing data, analytics denominators, indicators. Integration tests: auth, repository scoping, migrations, storage access, provider normalization. E2E: signup/login, create account, add/edit/close/delete trade, journal filters, analytics, two-user isolation.

Before enabling a provider, verify its current API, instrument coverage, quota, source timestamp, data rights, retention, and fallback. Before public/commercial launch, recheck the deployment-plan eligibility; Vercel Hobby in the source discussion is noted as personal/non-commercial.
