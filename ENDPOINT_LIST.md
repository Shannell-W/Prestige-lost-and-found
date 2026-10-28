# ENDPOINT_LIST.md

## Downstream API Endpoints (Team 5 Provides to Team 6)

| Method | Path | Purpose | Maps to Need |
|--------|------|---------|--------------|
| GET | `/claims?status=claimed` | Return claimed items with their reward amounts | Team 6 needs to read claimed item reward amounts from Team 5 in order to auto-populate extra income into user savings goals and budget calculators. |
| GET | `/students/{studentId}/claims` | Return a student's claims with current status | Team 6 needs to read user claim statuses from Team 5 in order to track financial recovery progress on lost personal property. |
| GET | `/schools/{schoolId}/item-statistics` | Return aggregate lost-item statistics for a school | Team 6 needs to read school portal lost item statistics from Team 5 in order to display campus financial impact data to students. |
| GET | `/claims/{claimId}/fees` | Return fee details (claim ID, student ID, item ID, amount payable) for a claim | Finance application needs the claim ID, student ID, item ID, and amount payable for claim/recovery fees. |
| GET | `/claims/{claimId}/refunds` | Return refund details (claim, student, amount, reason) for a claim, supporting one or more refund events (e.g. partial refunds) | Finance application needs information about the claim, student, amount, and reason for the refund. |
| POST | `/claims` | Submit a new claim by a student on a found item | No Week 2 need (see note below) |
| PATCH | `/claims/{claimId}` | Set a claim's status (pending, claimed, rejected) | No Week 2 need (see note below) |
| DELETE | `/claims/{claimId}` | Withdraw a claim | No Week 2 need (see note below) |
| POST | `/claims/{claimId}/refunds` | Refund part or all of a claim's fee, with a reason | Finance application needs information about the claim, student, amount, and reason for the refund. |

Totals: 9 endpoints, 4 of them writes (POST, PATCH, DELETE, POST).

## Design notes

- `/claims?status=claimed` uses a query parameter because status filters the claims collection; it doesn't identify one claim.
- Fees and refunds are nested under a claim because they only exist in the context of that claim.
- `item-statistics` is a noun (the statistics of a school), not an action like `/getStats`.
- `PATCH` sets an absolute status, so sending the same request twice gives the same result.

## Flagged for our instructor

Week 3 asks that every endpoint trace back to a Week 2 need, and that we flag rather than invent if needs are read-only.

1. **The write endpoints** (`POST /claims`, `PATCH` and `DELETE /claims/{claimId}`) don't map to any need in `API_NEEDS.md`: Team 6 told us they only read our data. They are in our contract from Week 4 to meet the write-endpoint requirement, and we built them in Weeks 5–6.
2. **Fees and refunds** (`/claims/{claimId}/fees`, `/refunds`) map to finance needs Team 6 raised, but those needs aren't written in `API_NEEDS.md` yet. [Add them there as needs 5 and 6 in the required format, using what Team 6 actually told you.]

## Peer review (Week 3, Parts C–D)

[Fill in from your actual peer review. Every comment should be either fixed or answered.]

Reviewed by: [team name, not our ring partner]

| # | Reviewer's comment | What we did |
|---|---|---|
| 1 | | [Fixed: what changed] or [Kept because: one-line reason] |
