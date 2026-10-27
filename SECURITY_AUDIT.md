# Security Audit

Team 5 (Prestige): Campus Lost & Found API
Lab: API Security (keys, rate limits, data exposure)
Reviewed by: Raika Kanyiha (Integration/QA Lead)
Date: 27–28 October 2026

We read every response our API can return, success and error, as an attacker would. For each check below we wrote down what we looked at and what we found, including "nothing wrong" where that was true. Every fix is covered by a test in `server/__tests__/security.test.js`.

## Summary

| | |
|---|---|
| Authentication | Every route needs a valid `X-API-Key` header, except `GET /api/health` and the docs. No key or a wrong key gets `401` and the route never runs |
| Keys | One per consumer (`team6`, `prestige-web` for our website, `prestige-team` for our own testing), stored in `server/.env` (`API_KEYS`), never in code or git |
| Rate limit | 100 requests per minute per key; request 101 gets `429` with `Retry-After` and a JSON body |
| Problems found | 2 fixed in code; 4 accepted on purpose and explained below |
| Tests | 17 new tests; whole suite 88 passed, 0 failed (`npm test`, 27 October 2026) |

## Part A: Our consumers and their keys

| Consumer | Key name in `API_KEYS` | How they got it |
|---|---|---|
| Team 6 (MoneyMentor Kenya), our downstream ring partner | `team6` | Sent by direct message to [Njeri], [27 October 2026]. Not in the class channel or the repo |
| Our website (React app) | `prestige-web` | In `prestige-client/.env` as `VITE_API_KEY` |
| Our team, for testing with curl/Postman | `prestige-team` | Each of us keeps it in our own `server/.env` |

Each key is 48 random hex characters, made with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`. Because each consumer has its own key, our logs say which consumer hit the limit, and we can replace Team 6's key without breaking our website.

**Open routes, and why:**
- `GET /api/health`: returns only "Prestige API is running". Lets a partner check we're up before they have a key, and returns no data.
- `/docs/` and `/openapi.yaml`: our published contract. A new consumer needs it to learn how to authenticate. It contains no data and no keys.

## Part B: Proof that keys are enforced

Run against our server on 28 October 2026 (PowerShell, with `curl.exe`). Our testing key was kept in a variable (`$k`) so it never appeared on screen. Screenshot: `part-b-keys.png`

```
curl -i "http://localhost:5000/claims?status=claimed"                                # 401
curl -i -H "X-API-Key: wrong" "http://localhost:5000/claims?status=claimed"         # 401
curl -i -H "X-API-Key: <our-testing-key>" "http://localhost:5000/claims?status=claimed"  # 200
```

| Request | Expected | What we got |
|---|---|---|
| No key | `401 {"error":"Missing or invalid API key"}` | `HTTP/1.1 401 Unauthorized`, `{"error":"Missing or invalid API key"}` |
| Wrong key | `401` | `HTTP/1.1 401 Unauthorized`, `{"error":"Missing or invalid API key"}` |
| Real key | `200` with the claims list | `HTTP/1.1 200 OK`, the list of claimed claims (claim 1, student SU-1001) |

The key is checked **before the request body is read**, so a caller without a key learns nothing, not even whether their JSON was valid (tested).

## Part C: Rate limit

**Threshold: 100 requests per minute, per key.**

Why 100: one page of Team 6's app makes a handful of calls to us (a student's claims, their fees and refunds), so even a busy user stays well under 100 a minute, with room for retries. A buggy loop makes thousands of calls a minute and gets stopped within the first second of the next 100. Counting per key means one consumer's loop can't lock out another consumer (tested).

**Demonstration** with the limit lowered to 3 (`RATE_LIMIT_MAX=3` in `server/.env`, server restarted):

```
PS> 1..5 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code} " -H "X-API-Key: $k" "http://localhost:5000/api/items" }
200 200 200 429 429
```

Screenshot: `part-c-rate-limit.png`

The 429 response carries a `Retry-After` header and a JSON body:

```
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 3
RateLimit-Remaining: 0
Retry-After: 47
Content-Type: application/json; charset=utf-8

{"error":"Too many requests","retryAfter":47}
```

Screenshot: `part-c-429.png`

Then we set `RATE_LIMIT_MAX` back to 100.

**Known limits of our limiter:** the counts live in the server's memory, so they reset when the server restarts, and they wouldn't be shared between several copies of the server. A production system would keep them in a shared store such as Redis.

## Part D: Self-audit

### 1. Sensitive fields

| What we looked at | What we found | Action |
|---|---|---|
| `POST /api/auth/login` response | Returns id, name, student ID, school, email and a token. No password hash | Nothing wrong (tested) |
| `GET /api/profile` | Explicit list of columns; no password hash | Nothing wrong (tested) |
| `GET /api/students`, `GET /api/students/:studentId` | Emails were removed in an earlier fix. Still returns every student's name and school ID | **Accepted:** Team 6 needs student IDs to call our contract endpoints. Now only reachable with a key. We'll ask Team 6 whether they use it, and remove it if not |
| `GET /api/items`, `GET /api/items/:id` | Returns whole rows (`SELECT *`). We checked every column in `schema.sql`: title, description, category, location, date, status, finder's internal ID, school, reward, image. Nothing secret | Nothing wrong. Noted that building the response from a field list would be safer if a sensitive column is ever added |
| Partner contract endpoints (`/claims`, fees, refunds, statistics) | Responses are built from an explicit field list; tests check for **exactly** the contract's fields, with no extras | Nothing wrong (tested since Week 7) |
| Login token (JWT) | The token's payload contains the student's own email. A JWT can be decoded by whoever holds it, but only the student themselves gets their token | Nothing wrong |

### 2. Other people's data

| What we looked at | What we found | Action |
|---|---|---|
| `GET /api/claims/:id` | **Problem 1:** any logged-in student could read **any** claim, including someone else's evidence, just by changing the ID in the URL | **Fixed:** only the student who made the claim, or the finder of the item, can read it; anyone else gets `403` (tested) |
| `GET /api/claims`, `/api/my-items`, `/api/notifications`, `/api/profile` | Filtered by the logged-in student's ID from their token, not from the URL | Nothing wrong |
| `GET /api/items/:id/claims`, `PATCH /api/claims/:id` | Only the item's finder; others get `403` | Nothing wrong (tested) |
| Partner contract endpoints | Any key holder can read every student's claims and refunds, and `POST /claims` and refunds take a `studentId` in the body | **Accepted by design:** the contract is a service-to-service API, and Team 6's app needs all students' data. The API key is what protects it now, which is why each key is sent privately and kept out of repos |

### 3. Error messages

| What we looked at | What we found | Action |
|---|---|---|
| Server errors (500) | The error handler returns `{"error":"Internal server error"}`; details only go to our server log | Nothing wrong (tested: no SQL, table names or file paths in responses) |
| Bad JSON | `{"error":"Request body is not valid JSON"}`, no parser details | Nothing wrong |
| Login failures | Same message whether the email, school or password is wrong | Nothing wrong |
| Registration | "Email or student ID already exists" tells a caller that an account exists | **Accepted:** low risk for a campus app, and the user needs to know why registration failed. Now only reachable with a key and rate limited |
| Bad login token | **Problem 2:** returned `403`. A bad or expired token means "we don't know who you are", which is `401` | **Fixed:** now `401` (tested). `403` is kept for "we know who you are, but you're not allowed" |

### 4. Write endpoints (extra fields)

| What we looked at | What we found | Action |
|---|---|---|
| `POST /api/auth/register` | Only reads name, student ID, school, email and passwords; the ID is set by the database | Nothing wrong (tested: sending `id` and `isAdmin` changes nothing) |
| `POST /api/items` | The finder and school come from the login token, and status is always `FOUND`, whatever the body says | Nothing wrong |
| `POST /api/claims`, `PATCH /api/claims/:id` | Only `itemId` + `evidence`, and `status` limited to `APPROVED`/`REJECTED` | Nothing wrong |
| Contract writes | Every field is checked for type before anything is written; tests confirm nothing is written on a failed request | Nothing wrong (tested since Week 7) |

### 5. Keys in the wrong place

| What we looked at | What we found | Action |
|---|---|---|
| Git history | `git log --all -- '*.env'` shows `.env` was never committed. We also searched the history for long key-like values: none | Nothing wrong |
| `.gitignore` | `.env` is ignored in the root, `server/` and `prestige-client/` (checked with `git check-ignore`) | Nothing wrong |
| Server logs | On startup we print how many keys loaded and their **names**, never the keys. Rate-limit warnings name the consumer, not the key. The Team 4 integration logs only the status code | Nothing wrong |
| README, `openapi.yaml`, `.env.example` | Only placeholders like `<your-api-key>` | Nothing wrong |
| Our website's key | **Limitation:** anything in a `VITE_` variable is built into the website, so anyone who opens the site's code in their browser can see the `prestige-web` key | **Accepted, with limits:** it's a separate key from Team 6's, so we can replace it without affecting them; it's rate limited; and students' own data still needs a login. The real fix is for the website to log in to our server instead of carrying a key, which is beyond this lab |
| `JWT_SECRET` | If it isn't set, the server falls back to a development secret and prints a warning | Noted: it must be set in `.env` on any server other than our laptops |

## Remaining risks

- Failed key attempts aren't rate limited (the limiter counts per valid key). Guessing a 48-character random key isn't practical, but a limit on failed attempts per IP address would be the next step.
- All visitors to our website share the `prestige-web` key, so its 100-a-minute limit is shared too. Fine for a class demo; a real deployment would need per-user limits.
- The rate limit resets when the server restarts.
