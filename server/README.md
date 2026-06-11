# Stage-1 Memory Server — scaffold

Implements **Stage 1 only** of `_brief/memory-architecture-v1.md` to the contract in
`_brief/memory-event-schema-v1.1.md`. The existing site's `js/memory.js` points at this
server by setting `Memory.config({ apiBase })` — **no data-shape change**.

> Scaffold status: the contract logic (chain, dedupe, supersede, finalization CAS, validation,
> crypto-shred, retention, migration) is implemented. Provider-specific calls (Postgres, S3/R2,
> KMS, Google verify) are wired through thin adapters in `src/store.js` with clear `TODO`s —
> fill them once the three accounts (`ACCOUNTS.md`) exist. It runs locally with an in-memory
> fallback so the acceptance tests pass before any account is connected.

## Build / run

```bash
cd server
cp .env.example .env        # then paste your account values (see ACCOUNTS.md)
npm install
npm run gen-master-key      # prints the 3 Shamir keeper-pieces ONCE — distribute them
npm start                   # serves the 5 endpoints on PORT (default 3000)
```

## The five endpoints (Stage 1)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth` | Google verify + phone capture (no OTP) → `user_id` |
| POST | `/turns` | raw turn → Holding Buffer |
| POST | `/events` | append essence event(s); dedupe + chain |
| GET | `/memory/:user_id` | rehydrate |
| POST | `/erase` | crypto-shred + tombstone |

## Switch-on checklist (Stage 1 is DONE when all pass)

```bash
npm test                    # runs _brief/stage1-acceptance-battery.json: P1–P7, B1–B4
npm run migrate -- --dry    # of.runtime.v1 upload, count-match (dry run first)
```

- [ ] P1–P7 parity tests pass (idempotency, uniqueness, dedupe, supersede, reconciliation, rehydrate, provenance)
- [ ] B1–B4 backend-only tests pass (chain integrity, crypto-shred, finalization CAS, 30-day deletion)
- [ ] `migrate` count-match is green and emits a report
- [ ] `memory-lab.html` works against this server via `Memory.config({ apiBase })` unchanged
- [ ] nothing outside the Stage-1 fence was built (no `/retrieve`, no corpus, no Studio server)

## Out of scope (do not build)
`/retrieve`, corpus embedding, the grounding gate (Stage 3); identity merge (Stage 2);
Studio server, agent versioning, learning loop (Stage 4). See `_brief/memory-handoff-stage1.md` §2.
