# Versioning Notes (Week 13): Team 5, Prestige

## Part A: The change we shipped (to Team 6)

1. **The change:** our two list endpoints, `GET /claims?status=` and `GET /students/{studentId}/claims`, return `{ "data": [...], "count": N }` in v2 instead of a bare list.
2. **Why it's worth a break:** a bare list can't grow. `GET /claims?status=claimed` returns every claim with that status, and it gets longer every week. Wrapping it now lets us add paging later (`next`, `limit`) as new fields, which is not a breaking change, so Team 6 only has to migrate once.
3. **Our prediction of what breaks on Team 6's side:** wherever their app treats our response as a list. For example, a line like `claims.map(c => c.rewardAmountCents)` or `claims.length` on the body of `GET /claims?status=claimed`, which feeds the reward amounts into their savings goals (needs statement 1). On v2, `claims` is an object, so `.map` throws "is not a function" and `.length` is `undefined`. [Confirm the exact file and line with Team 6, and write it here.]

## Part B and C: How we built it, and proof v1 didn't change

- `server/routes/contract.js` is v1. Its handlers are unchanged; the two list routes only gained the `old` middleware (`server/deprecate.js`), which adds `Deprecation`, `Sunset` and `Link` headers.
- `server/routes/contractV2.js` is v2: the same queries and the same `claimToApi` mapping, with one `wrap()` function that makes `{ data, count }`.
- `server/index.js` mounts `/v2`, then `/v1`, then `/` (old URLs), all **after** the API key check and the rate limit.
- `server/monitoring.js` logs `req.baseUrl + req.path`, so `/claims`, `/v1/claims` and `/v2/claims` are told apart.
- **Diff:** `v1_before.json` vs `v1_after.json`: "FC: no differences encountered"
- **Tests:** `server/__tests__/versions.test.js` (12 tests): v1's exact fields, `/claims` = `/v1/claims`, v1 errors unchanged, v2 shape and filter, v2 needs a key, headers on v1 only. [paste: x passed]

## Part E: Receiving Team 4's change

- **Status on 10 November:** Team 4 hasn't sent a deprecation notice or shipped a v2 yet. Their server's last change (10 Nov) added an Artisans route; `/api/venues` is unchanged. We asked them on [date].
- **Ready for it:** the shape of Team 4's response now lives only in `server/partner.js` (`versions.v1`), chosen by `PARTNER_VERSION` in `.env`. When their notice arrives we add `versions.v2`, test it in `__tests__/partner.test.js`, and switch `PARTNER_VERSION=v2`.
- **How it felt to receive it:** [one or two sentences, once it arrives]
- **Evidence:** [`"stale": false` on our venues response, and Team 4's /stats or log showing our calls on their v2]

## Part F: Who still uses v1?

From our `/stats` on [date]: `GET /claims` [n] calls, `GET /v1/claims` [n], `GET /v2/claims` [n]. Caller labels on the v1 rows: [key-xxxxxx = team6? prestige-web?]. Could we switch v1 off today? [yes / no, and why]

## Reflection (150–250 words, in our own words)

[Answer these in your own words. Specific beats generic.]

1. What was it like to receive a breaking change on short notice? How did you find out, and what did you do first?
2. What did your partner's notice do well, and what was missing?
3. Read your own notice again as Team 6. What would you change?
4. As the API owner next time, what is one thing you would do differently?
