# Partner Test Results (Week 7)

Team 5 (Prestige): Campus Lost & Found API

> **Before submitting:** Part 1 describes our own tests and is complete. Parts 2–4 record the exchange with Team 4 and must contain what really happened. Replace every `[bracket]` and delete this note. "All of their tests passed" is a real and valid result.

---

## Part 1: Our own automated tests

**Tools:** Jest + Supertest. **Run with:** `cd server` then `npm test`.
The tests build their own database (`prestige_db_test`) from `server/schema.sql` and reset it to the sample data from `server/seed.js` before each test, so they never touch real data.

| Test file | What it covers | Tests |
|---|---|---|
| `__tests__/claims.test.js` | `GET`/`POST /claims`, `PATCH`/`DELETE /claims/{claimId}`, fees, refunds | 36 |
| `__tests__/students.test.js` | `GET /students/{studentId}/claims`, and `/api/students` never showing emails | 4 |
| `__tests__/schools.test.js` | `GET /schools/{schoolId}/item-statistics` | 3 |
| `__tests__/items.test.js` | Our website's item routes (`/api/items`) | 6 |
| `__tests__/website-claims.test.js` | Our website's claim rules (`/api/claims`) and JSON 404s | 12 |
| `__tests__/partner-venues.test.js` | Venues from Team 4: both of their server shapes, key header when set, 20-minute saved copy, 429/401/down/slow/renamed-field handling | 10 |
| **Total** | | **71** |

Result on [date], on [whose laptop], against MySQL: [71 passed, 0 failed]

### Every contract endpoint is covered four ways

| Endpoint | Happy path | Validation (400) | Not found (404) | Edge case |
|---|---|---|---|---|
| `GET /claims` | Exact claim for `status=claimed` | Missing status; invalid status | n/a (a filter, not an ID) | A status with no claims gives `200 []` |
| `POST /claims` | 201 pending, item becomes CLAIMED, then read back | Missing/wrong-type fields; invalid JSON; nothing written on failure | Unknown student; unknown item | 409 for own item, returned item, duplicate claim |
| `PATCH /claims/{claimId}` | Approve: rival rejected, item RETURNED, fee created | Missing/invalid status, checked before the ID | Unknown and malformed IDs | Same PATCH twice gives the same result; second approval gives 409; rejecting the only claim puts the item back to FOUND |
| `DELETE /claims/{claimId}` | 204, claim gone | n/a | Deleting twice | Deleting the approved claim frees the item |
| `GET /students/{studentId}/claims` | Exact list, oldest first, exact fields | n/a | Unknown student | Real student with no claims gives `200 []` |
| `GET /schools/{schoolId}/item-statistics` | Exact live totals | n/a | Unknown school | School with nothing returned gives zeros as numbers |
| `GET /claims/{claimId}/fees` | Exact fee | n/a | Unknown and malformed IDs | Claim with no fee yet gives a specific 404 |
| `GET /claims/{claimId}/refunds` | Exact refund list | n/a | Unknown claim | Claim with no refunds gives `200 []` |
| `POST /claims/{claimId}/refunds` | 201, then read back | 5 cases (missing fields, string/decimal/zero amount) plus wrong student; nothing written on failure | Unknown claim | Refunding exactly what's left is allowed; one cent more gives 409; no fee gives 409 |

### Our assertions would catch broken code

The helpers in `server/test/helpers.js` check that each response has **exactly** the contract's field names and types, with no extra fields. A test that only checked the status code could pass on broken code. We checked this by breaking the code on purpose:

| Deliberate break | Tests that failed |
|---|---|
| Removed the line that marks an item CLAIMED when it's claimed (the original bug) | 2 |
| Renamed `rewardAmountCents` to `reward_amount` in `server/routes/contract.js` | 3 |
| Put `email` back into `/api/students` | 1 |

[Re-run one of these yourself, record what you see, then put the code back.]

---

## Part 2: The exchange

| | |
|---|---|
| Ring partner | Team 4: the Artist Platform API ([repo](https://github.com/EMT-MOSES/Team-4--Artist-platform)) |
| Their contract | `openapi.yaml` on their `main` branch, "Artist Platform API" version 1.0.0. They have **no contract deviations file**, although the contract changed since Week 4 (their `elvis` branch still has the old version without `/api`, keys, or the artisans/bookings/students endpoints) |
| Their API | The contract describes a server that needs an `x-api-key` header and allows 3 requests per hour. On 27 Oct Team 4 told us to use `https://artist-api-server.onrender.com` instead, which is their app backend: no key, and different venue fields. Checks 1–11 below are against the contract; record which server you ran them against |
| We sent them | `openapi.yaml` version [2.0.0], **not** our test files, on [date] via [channel] |
| Their tests ran against | Our running server at [URL, e.g. the Cloudflare tunnel link], on [date] |
| Our tests ran against | Team 4's server at [address they gave us], on [date] |
| Our tests for their API | [file where they live] |

## Part 3: What Team 4's tests found in our API

[Total: x tests, y passed, z failed]

| # | Their test | Expected (their reading of our contract) | What our API returned | Classification | What we did |
|---|---|---|---|---|---|
| 1 | | | | Real bug / Contract ambiguity / Misunderstanding | |

If every test passed: "All [x] of Team 4's tests passed against our running API."

## Part 4: What our tests found in Team 4's API

Checks taken from Team 4's `openapi.yaml`. **Their limit is 3 successful requests per endpoint per hour**, so spread these out, or ask Team 4 to restart their server between runs. Fill in "What happened" from the real run.

| # | Our test | Expected (from their contract) | What happened | Classification | What they did |
|---|---|---|---|---|---|
| 1 | `GET /api/venues` with our key | `200`, each venue has `id` (string), `name` (string), `capacity` (integer) | | | |
| 2 | `GET /api/events` with our key | `200`, each event has `id`, `name`, `venueId`, `startsAt` (date-time) | | | |
| 3 | `GET /api/schedules` with our key | `200`, each has `id`, `artistName`, `eventId`, `startsAt` | | | |
| 4 | `GET /api/contacts` with our key | `200`, each has `venueId`, `name`, `email` | | | |
| 5 | `GET /api/venues` with **no** key | `401` with `{"error": ...}` | | | |
| 6 | `GET /api/venues` with a **wrong** key | `401` | | | |
| 7 | A 4th successful call to one endpoint within an hour | `429` with `{"error": ...}` | | | |
| 8 | `POST /api/lost-items` with `{"itemName":"Black umbrella","eventId":"event-1"}` | `201` with `id`, `itemName`, `eventName`, `venueName`, `priority`, `createdAt` | | | |
| 9 | `POST /api/lost-items` with no `itemName` | `400` (their contract documents it, with no body shape) | | | |
| 10 | `POST /api/lost-items` with an unknown `eventId` | `400` "Invalid report data or unknown event" | | | |
| 11 | `GET /api/users/<someone-else>/lost-items` | `403` | | | |
| 12 | Response schemas list no `required` fields (except Artisan) | Can any field be missing? | | Contract ambiguity | |
| 13 | No `404` documented anywhere, e.g. `GET /api/nothing` | What does an unknown path return? | | Contract ambiguity | |

---

---

## How we classified failures

- **Real bug:** the API doesn't do what its own contract says. Fix the code.
- **Contract ambiguity:** the contract allowed two reasonable readings. Clarify the contract and add a row to `CONTRACT_DEVIATIONS.md`.
- **Misunderstanding:** the test expected something the contract never promised. Explain it to the other team.
