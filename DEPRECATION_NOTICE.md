# Deprecation notice: Prestige Claims API v1 (two list endpoints)

To: Team 6 (MoneyMentor Kenya), Njeri    From: Raika Kanyiha, Team 5 (Prestige)    Date: 10 November 2026

## Summary

v1 of `GET /claims` and `GET /students/{studentId}/claims` is deprecated. v2 is live now. v1 of these two endpoints will stop working on **Monday 16 November 2026**. Please move before then.

## What is changing

- The list is wrapped: `[ ... ]` becomes `{ "data": [ ... ], "count": N }`
- New URLs: `/v2/claims` and `/v2/students/{studentId}/claims`
- Nothing else changes: the fields inside each claim, the `?status=` filter, error responses, your API key and the rate limit all stay the same
- No other endpoint changes: fees, refunds, school statistics, `POST /claims`, `PATCH` and `DELETE` keep their current URLs and shapes

## Why

A bare list can't grow. Wrapping it in `{ data, count }` lets us add paging later (for example a `next` link) as new fields, without another breaking change.

## Before and after

v1 `GET /claims?status=claimed`

```json
[ { "claimId": "1", "studentId": "SU-1001", "itemId": "1", "status": "claimed", "rewardAmountCents": 15000 } ]
```

v2 `GET /v2/claims?status=claimed`

```json
{ "data": [ { "claimId": "1", "studentId": "SU-1001", "itemId": "1", "status": "claimed", "rewardAmountCents": 15000 } ],
  "count": 1 }
```

v1 `GET /students/SU-1001/claims`

```json
[ { "claimId": "1", "itemId": "1", "status": "claimed", "submittedAt": "2026-10-01T06:15:00Z" } ]
```

v2 `GET /v2/students/SU-1001/claims`

```json
{ "data": [ { "claimId": "1", "itemId": "1", "status": "claimed", "submittedAt": "2026-10-01T06:15:00Z" } ],
  "count": 1 }
```

A student with no claims gives `{ "data": [], "count": 0 }`.

## How to migrate

1. Call `/v2/claims?status=...` instead of `/claims?status=...`, and `/v2/students/{id}/claims` instead of `/students/{id}/claims`. Same key, same filter.
2. Read the list from `body.data` instead of from the body itself (for example `body.data.map(...)` where you had `body.map(...)`).
3. If you used the list's length, `body.count` gives it directly.
4. Test it, then tell us, so we can see your calls to `/v2/...` in our logs.

You can check you're still on v1: v1 responses now carry these headers.

```
Deprecation: true
Sunset: Mon, 16 Nov 2026 00:00:00 GMT
Link: </v2/claims>; rel="successor-version"
```

## Timeline

- **10 November 2026:** v2 is live. v1 still works, and now sends Deprecation headers.
- **16 November 2026:** v1 of these two endpoints stops working. (In this course we'll keep v1 running until after Demo Day so nobody's demo breaks, but please plan for the 16th.)

## Questions

Message Raika on WhatsApp any time. I'll reply within a few hours.
