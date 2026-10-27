# Contract Deviations

## Week 5 — Read Endpoints (GETs)

### 1. Route prefix mismatch
`openapi.yaml` defines paths with no prefix (e.g. `/claims`), but the rest of
this codebase uses an `/api` prefix for every other route (e.g. `/api/items`).
The five new contract endpoints built this week were implemented at their
exact literal paths from the contract (no `/api` prefix), to avoid colliding
with existing same-named routes that serve a different purpose
(`/api/claims` already exists and returns the logged-in student's own claims).

**Update:** Week 6's write endpoints (`POST /claims`, `PATCH /claims/{claimId}`,
etc.) were also built with no `/api` prefix, matching the contract exactly.
This confirms the team is converging on matching the contract's literal paths
rather than keeping the older `/api` prefix — no further discussion needed.

### 2. "claimed" status is ambiguous
The contract's `GET /claims?status=claimed` endpoint has a TODO in the yaml
itself: "confirm other status values with team (pending? resolved?)".
We interpreted "claimed" as claims with `status = 'APPROVED'` (i.e. the item
was successfully returned to its owner), not `PENDING` (submitted but
unreviewed).

**Needs team confirmation** that this interpretation is correct.

### 3. schoolId is actually a school name string
The contract's `GET /schools/{schoolId}/item-statistics` implies schools have
a distinct ID. This schema has no such ID — `users.school` and `items.school`
store the school's name as free text (e.g. "Riara University"). We treat the
`{schoolId}` path parameter as that name string directly.

**Needs team discussion:** should schools get a real numeric/UUID ID in a
future migration, or is the name-as-ID approach acceptable long-term?

### 4. Fees and refunds are not implemented (GET side)
`GET /claims/{claimId}/fees` and `GET /claims/{claimId}/refunds` are in the
contract, but no "fee" or "refund" concept exists anywhere in the current
database schema — no columns, no tables. Rather than inventing fake data to
match the contract's response shape, both endpoints currently:
- Return `404` if the claim itself doesn't exist
- Return `501 Not Implemented` with an honest error message if the claim
  exists but no fee/refund data can be provided

**Needs team decision:** design and build real `fees`/`refunds` tables, or
remove these two endpoints from the contract if the feature isn't planned.

### Everything else
All other GET endpoints already existing in `index.js` prior to this week
were left as-is (`/api/items`, `/api/students`, etc.) — they are not part of
the current `openapi.yaml` contract, so nothing was checked or changed there.

## Week 6 — Write Endpoints (Claims)

No deviations. The write endpoints (`POST /claims`, `PATCH /claims/{claimId}`,
`DELETE /claims/{claimId}`, `POST /claims/{claimId}/refunds`) were implemented
exactly as defined in `openapi.yaml`. All validation rules, status codes, and
response shapes match the contract as specified.

Testing confirmed:

- Valid requests return the documented success status codes (201/200/204).
- Missing/invalid fields return 400 with a clear error message.
- Operations on nonexistent claims return 404.