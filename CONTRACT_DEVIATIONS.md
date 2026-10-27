# Contract Deviations

Changes to `openapi.yaml` since the version we handed Team 6 in Week 4 (1.0.0), and why.
The current contract is **2.0.0**. Every path and every field name from 1.0.0 still exists, so code written against 1.0.0 keeps working; the points marked **Behaviour change** are the ones Team 6 should check.

## Correction (27 October)

An earlier version of this file said the Week 5 GET endpoints and Week 6 write endpoints were implemented. They weren't in the repository: `server/index.js` only had our website's `/api/...` routes, so none of the contract paths answered. They have now been built in `server/routes/contract.js` and are covered by automated tests (`server/__tests__/`). The decisions below are the ones the implementation follows.

## Decisions carried over from Weeks 5–6

### 1. No `/api` prefix
The contract's paths have no prefix (`/claims`), but our website's routes use `/api` (`/api/claims` returns the logged-in student's own claims). The contract routes use the contract's exact paths, so the two never collide.

### 2. `claimed` means an approved claim
The 1.0.0 contract had a TODO on the status values. Our database uses `PENDING`, `APPROVED`, `REJECTED`; the contract uses `pending`, `claimed`, `rejected`, where **`claimed` = `APPROVED`**: the item was returned to that student.

### 3. `schoolId` is the school's name
Schools have no separate ID in our database; `users.school` and `items.school` store the name (e.g. "Strathmore University"). `{schoolId}` is that name, URL-encoded: `/schools/Strathmore%20University/item-statistics`.
**Still open for the team:** give schools a real ID in a future version, or keep names as IDs.

### 4. Fees and refunds now exist
Our database had no fees or refunds, so these endpoints couldn't return real data. We added two tables (`fees`, `refunds` in `server/schema.sql`):
- A **handling fee** is recorded when a claim is approved. The amount is `CLAIM_FEE_CENTS` in `server/.env`, currently **10000 (KSh 100.00)**. **Team decision:** confirm this amount.
- **Refunds** are partial or full refunds of that fee; their total can never exceed it.

## Changes in 2.0.0

| # | Endpoint | What changed | Why |
|---|---|---|---|
| 1 | `GET /claims` | `status` enum widened from `[claimed]` to `[pending, claimed, rejected]` | Resolves the TODO; the database has all three, and `PATCH` already accepted all three |
| 2 | `GET /claims` | **Behaviour change:** missing or unknown `status` returns `400` | The contract always marked `status` as required |
| 3 | `POST /claims` | Success response now has a schema (the created claim); optional `evidence` field added; `404` (unknown student or item) and `409` (student found the item, item already returned, duplicate claim) added | 1.0.0 only said "Claim created." and didn't cover these cases |
| 4 | `PATCH /claims/{claimId}` | Response schema added; `409` when another claim on the item is already approved, or the claim has refunds | An item can only have one owner. Approving rejects the other pending claims and records the fee |
| 5 | `DELETE /claims/{claimId}` | Also deletes the claim's fee and refunds; the item becomes available again if this was the approved claim | 1.0.0 didn't say what happened to related data |
| 6 | `GET /students/{studentId}/claims` | `studentId` is the school student ID (e.g. `SU-1001`). **Behaviour change:** a real student with no claims returns `200 []`; `404` only for an unknown student | Callers can tell "no claims yet" from "wrong ID" |
| 7 | `GET /schools/{schoolId}/item-statistics` | `schoolName` now required; `totalItemsClaimed` documented as items returned to their owner | It's always returned; "claimed" needed one meaning |
| 8 | `GET /claims/{claimId}/fees` | `404` can also mean "no fee has been charged on this claim yet" | Fees only exist after approval |
| 9 | `GET /claims/{claimId}/refunds` | `refundedAt` now required | Every refund has one |
| 10 | `POST /claims/{claimId}/refunds` | `amountCents` must be ≥ 1; `studentId` must be the claimant; `409` if the claim has no fee or the refund exceeds what's left of it; `201` returns the refund | 1.0.0 allowed zero, negative and oversized refunds |
| 11 | All | Every error now uses `{"error": "..."}`, documented as a shared schema; unknown paths return JSON `404` | 1.0.0 only documented some errors |

## Told Team 6

- [ ] Sent `openapi.yaml` 2.0.0 and this file on [date] via [channel]
- [ ] Team 6 confirmed the two behaviour changes (#2, #6) don't break their code
