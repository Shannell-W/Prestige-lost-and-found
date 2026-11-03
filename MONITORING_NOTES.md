# Monitoring Notes (Week 12): Team 5, Prestige

## Part A: Predictions (written before we had any data)

Our endpoints (see README): `GET /claims?status=`, `POST /claims`, `PATCH /claims/{id}`, `DELETE /claims/{id}`,
`GET /students/{id}/claims`, `GET /schools/{id}/item-statistics`, `GET /claims/{id}/fees`,
`GET /claims/{id}/refunds`, `POST /claims/{id}/refunds`, plus the website's `/api/...` routes.

1. **Slowest endpoint we expect, and why:**
   `GET /schools/{schoolId}/item-statistics`. It is the only endpoint that runs two queries that each
   count across whole tables: first it checks the school exists by counting `users` AND `items` for that
   school (and `users.school` has no index, so that is a full scan of `users`), then it aggregates every
   item of the school with `COUNT`/`SUM`. The other GETs look up one claim or one student by primary key or
   a unique column. It should also get slower as the tables grow, while the others shouldn't.

2. **Endpoint we expect to produce the most errors, and why:**
   `GET /claims/{claimId}/fees`. A fee only exists once a claim has been approved, so it answers
   `404 "no fee has been charged on this claim yet"` for every pending or rejected claim, not just for
   unknown ids. Most claims are pending most of the time (in our sample data only 1 of 3 claims has a fee),
   so even correct callers will get many 404s. Runner-up: `GET /claims`, which returns `400` whenever a
   caller forgets the required `?status=`. All of these are 4xx (caller-side); we don't expect any 5xx.

## Part B: Sample log lines

Captured with `node index.js | Tee-Object -FilePath requests.log`, then one request with our key, one with a wrong key, one with no key:

```
{"time":"2026-11-03T18:48:04.088Z","method":"GET","path":"/claims","status":200,"ms":15.3,"caller":"key-455d6e","consumer":"prestige-web"}
{"time":"2026-11-03T18:48:04.130Z","method":"GET","path":"/claims","status":401,"ms":1.1,"caller":"none","consumer":null}
{"time":"2026-11-03T18:48:29.706Z","method":"GET","path":"/claims","status":401,"ms":0.5,"caller":"none","consumer":null}
```

Key not in the log: `(Select-String -SimpleMatch "<our-real-key>" requests.log).Count` printed `0`.
Note: the 200 request was `/claims?status=pending`, but the log shows only `/claims`: the query string is never logged.

## Part D: Traffic

| Run | Who                                                                                                                                        | Command                                                                 | Status codes received                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Us (prestige-web, key-455d6e)                                                                                                              | `node traffic.js http://localhost:5000 <key> 60`                        | 200: 37, 400: 4, 401: 6, 404: 13                |
| 2   | Us, more traffic                                                                                                                           | `node traffic.js http://localhost:5000 <key> 200`                       | 200: 31, 400: 5, 401: 17, 404: 10, **429: 137** |
| 3   | Partner-style traffic, **simulated by us** (Team 6 could not be reached on 3 Nov), sent through our public tunnel URL with the `team6` key | `node traffic.js https://<our-tunnel>.trycloudflare.com <team6-key> 60` | 200: 38, 400: 5, 401: 6, 404: 11                |

The `team6` key's requests are logged separately: 54 log lines with `"consumer":"team6"` (60 sent, minus the 6 the script sends with no key, which correctly show `caller: "none"`). This is simulated, not Team 6's own traffic; we will add their real run when they're available.

`/stats` after run 3 (the server was restarted first, so this covers run 3 only):

```json
{
  "startedAt": "2026-11-03T20:29:57.571Z",
  "uptimeSeconds": 655,
  "total": 66,
  "clientErrors": 27,
  "serverErrors": 0,
  "errorRatePercent": 0,
  "avgMs": 4.1,
  "routes": {
    "GET (no route)": {
      "count": 16,
      "clientErrors": 16,
      "serverErrors": 0,
      "avgMs": 2.4,
      "maxMs": 28.5
    },
    "GET /api/health": {
      "count": 1,
      "clientErrors": 0,
      "serverErrors": 0,
      "avgMs": 1.6,
      "maxMs": 1.6
    },
    "GET /schools/:schoolId/item-statistics": {
      "count": 7,
      "clientErrors": 0,
      "serverErrors": 0,
      "avgMs": 18.1,
      "maxMs": 112.5
    },
    "GET /students/:studentId/claims": {
      "count": 11,
      "clientErrors": 5,
      "serverErrors": 0,
      "avgMs": 2.4,
      "maxMs": 7.8
    },
    "GET /claims/:claimId/refunds": {
      "count": 8,
      "clientErrors": 0,
      "serverErrors": 0,
      "avgMs": 2.4,
      "maxMs": 5.4
    },
    "GET /claims": {
      "count": 16,
      "clientErrors": 5,
      "serverErrors": 0,
      "avgMs": 2.4,
      "maxMs": 11.6
    },
    "GET /claims/:claimId/fees": {
      "count": 5,
      "clientErrors": 1,
      "serverErrors": 0,
      "avgMs": 1.9,
      "maxMs": 2.6
    },
    "GET /api/items": {
      "count": 2,
      "clientErrors": 0,
      "serverErrors": 0,
      "avgMs": 3.2,
      "maxMs": 4.3
    }
  },
  "partner": { "calls": 0, "failures": 0, "staleServed": 0, "unavailable": 0 }
}
```

```

## Part E: What our data shows

1. **Predicted vs. actual**
   - Slowest: we predicted `GET /schools/{id}/item-statistics`. Run 1–2: it was mid-table (avg 3.5 ms; `GET /api/items` was slowest at 5.4 ms). Run 3: it was slowest by far, avg 18.1 ms vs 1.9–3.2 ms for every other route, with a worst case of 112.5 ms. So our prediction held in one run and not the other, and the difference comes from a single slow call (point 2), not from the endpoint being consistently slow. With only 5 items in the database, the full-table counts we expected to be costly have almost nothing to scan yet.
   - Most errors: we predicted `GET /claims/{id}/fees`. It was never the worst: run 1–2 `GET /students/{id}/claims` had the most (14 of 22 calls were 4xx), run 3 `GET /claims` and `GET /students/{id}/claims` (5 of 16 and 5 of 11). Our traffic script only asks for claim 1 (which has a fee) and claim 99999, so the "pending claims have no fee" 404s we predicted were never exercised: error counts mostly mirror the bad requests the script sends.

2. **One real pattern, with figures**
   An average can hide one slow call. In run 3, item-statistics averaged 18.1 ms over 7 calls, but 112.5 ms of its 126.7 ms total came from a single call: the other six averaged about 2.4 ms, as fast as everything else. Every route shows the same shape on a smaller scale: in run 1–2 each real route's worst call was 5–8× its average (fees 4.4 ms avg vs 23.5 ms max, `/api/items` 5.4 vs 23.4). Meanwhile rejected requests are always fast (run 1–2: 169 of 264 requests never reached a route, avg 0.6 ms), which pulls the overall average down.
3. **Why we think it happens, and what we'd check next**
   Hypothesis: the slow call is each route's _first_ call, paying one-off costs (opening a new connection in the MySQL pool, MySQL loading the tables and query plan) that later calls don't. To check: in `requests.log`, compare the `ms` of the first line for each path with the later ones; then restart the server and see if the first calls are slow again. To test our original prediction properly, we'd load a few thousand items and users and see whether item-statistics and `/api/items` (which return or scan all rows) slow down while the single-row lookups don't, and call fees for pending claims 2–4.

4. **One alert we'd want in production**
   - Number: `errorRatePercent` (5xx only) from `/stats`.
   - Threshold: above 2% for 5 minutes (today it is 0%, with 0 server errors in 264 requests).
   - When it fires: message the team on duty, who check the log for the 5xx lines (path, time, caller) and whether MySQL is up. Meanwhile users should still get a clear message rather than a crash, and the Venues page keeps serving its saved copy (Week 11).
   - Second finding: `/stats` itself got `429` right after our traffic spike, because it sits behind the same rate limit. When traffic is highest we can't read our own numbers, so in production we'd give monitoring its own key or exempt `/stats` from the rate limit.
```
