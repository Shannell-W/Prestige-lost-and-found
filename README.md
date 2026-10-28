# Campus Lost & Found (Team 5: Prestige)

Campus Lost & Found helps students get back things they lost at school. A student who finds something reports it in their school's portal; the owner finds it, claims it with evidence, and the finder reviews the claims and picks the rightful owner.

This repository has three parts:

| Folder | What it is |
|---|---|
| `prestige-client/` | The website (React + Vite), for students |
| `server/` | The Express + MySQL server. It serves the website's data (`/api/...`) **and** the partner API below |
| root `.md` files and `openapi.yaml` | Weekly lab documents and the API contract |

**Team:** Shannell Wanjiru (API Lead), Tony Kibe (Backend Dev), Raika Kanyiha (Integration/QA Lead), GuyTresor Gacheru (Docs/DevOps Lead)
**Ring:** we consume Team 4's Artist Platform API; Team 6 (MoneyMentor Kenya) consumes ours.

---

## The partner API (for partner teams: Team 6, Team 7)

The Prestige Lost & Found API gives claim statuses, reward amounts, fees, refunds and school statistics. The full contract is [`openapi.yaml`](./openapi.yaml), and with the server running you can browse it at **http://localhost:5000/docs/**.

### Base URL

| Who | Base URL |
|---|---|
| Partner teams (from anywhere) | **`https://kenneth-resist-boxed-occurrence.trycloudflare.com`** (live from 28 October 2026) |
| Our own team, on our own laptop | `http://localhost:5000` |

Add the endpoint path straight after the base URL, with **no `/api`**. For example, `GET /claims`:

```
https://kenneth-resist-boxed-occurrence.trycloudflare.com/claims?status=claimed
```

The public base URL is a Cloudflare tunnel to our server, which runs on our laptop. Please note:
- It only works while our laptop, server and tunnel are running. Agree a testing time with us.
- **The link changes whenever we restart the tunnel.** We'll message you the new one, and update this table.
- Check it's up first (no key needed): `<base URL>/api/health` should return `{"message":"Prestige API is running"}`.
- `localhost` addresses only work on our own laptop. Don't use them from your app.

### Quickstart

Copy and paste, with your own key:

```
curl -i -H "X-API-Key: <your-api-key>" "https://kenneth-resist-boxed-occurrence.trycloudflare.com/claims?status=claimed"
```

Expected `200 OK`:

```json
[{"claimId":"1","studentId":"SU-1001","itemId":"1","status":"claimed","rewardAmountCents":15000}]
```

On Windows PowerShell, type `curl.exe` instead of `curl`. Pasting the address into a browser won't work, because a browser can't send the `X-API-Key` header: use curl, Postman, or your code.

`GET /claims` needs `status` (`pending`, `claimed` or `rejected`); without it you get `400`.

### Authentication

**Every request needs an API key** in the `X-API-Key` header. Each consumer team has its own key; we send it to you privately (direct message). Never put your key in your code, your repo, or a group chat: keep it in your `.env`.

```
X-API-Key: <your-api-key>
```

No key, or a wrong key, gets `401` and nothing else happens:

```
HTTP/1.1 401 Unauthorized
{"error": "Missing or invalid API key"}
```

The only open routes are `GET /api/health` (to check we're up) and the docs (`/docs/`, `/openapi.yaml`), which contain no data.

### Rate limit

Each key may make **100 requests per minute**. Request 101 gets `429` with a `Retry-After` header (seconds to wait) and the same number in the body:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
{"error": "Too many requests", "retryAfter": 42}
```

Every response also has `RateLimit-Limit` and `RateLimit-Remaining` headers, so you can slow down before you hit the limit. If you call us from a page, save our answer for a minute rather than calling on every page load.

### Our website's routes

Our own website's routes (`/api/...`) are separate. They also need the website's API key, and actions like claiming an item also need a login token (`Authorization: Bearer <token>` from `POST /api/auth/login`). Partners don't need those routes.

### Conventions

- **`studentId`** is the student's own school ID, e.g. `"SU-1001"`.
- **`claimId`** and **`itemId`** are numbers sent as strings, e.g. `"1"`.
- **`schoolId`** is the school's name, URL-encoded: `Strathmore%20University`.
- **Money** is whole cents: `15000` means KSh 150.00.
- **Times** are ISO 8601 in UTC, e.g. `"2026-10-01T06:15:00Z"`.
- **Claim status** is `pending` (waiting for the finder), `claimed` (approved; the item went back to this student), or `rejected`.

### Endpoints

| Method | Path | What it does | Success |
|---|---|---|---|
| GET | `/claims?status={status}` | List claims with a status, with reward amounts | 200 |
| POST | `/claims` | Submit a claim on an item for a student | 201 |
| PATCH | `/claims/{claimId}` | Set a claim's status (approving picks the owner) | 200 |
| DELETE | `/claims/{claimId}` | Withdraw a claim | 204 |
| GET | `/students/{studentId}/claims` | A student's claims and their status | 200 |
| GET | `/schools/{schoolId}/item-statistics` | A school's lost-item totals | 200 |
| GET | `/claims/{claimId}/fees` | The handling fee on an approved claim | 200 |
| GET | `/claims/{claimId}/refunds` | Refunds on a claim | 200 |
| POST | `/claims/{claimId}/refunds` | Refund part of a claim's fee | 201 |

Every example below is a real response from the server with the sample data from `npm run seed`. Your `submittedAt`/`refundedAt` times and new IDs will differ.

#### List claims by status
```
curl -i "http://localhost:5000/claims?status=pending"
```
`200`:
```json
[
  {"claimId":"2","studentId":"SU-1001","itemId":"2","status":"pending","rewardAmountCents":10000},
  {"claimId":"3","studentId":"SU-1002","itemId":"2","status":"pending","rewardAmountCents":10000}
]
```
No claims with that status gives `200 []`. A missing or unknown status gives `400 {"error":"status query parameter is required"}`.

#### A student's claims
```
curl -i http://localhost:5000/students/SU-1001/claims
```
`200`:
```json
[
  {"claimId":"1","itemId":"1","status":"claimed","submittedAt":"2026-10-01T06:15:00Z"},
  {"claimId":"2","itemId":"2","status":"pending","submittedAt":"2026-10-03T07:00:00Z"}
]
```
A real student with no claims gives `200 []`. An unknown student gives `404 {"error":"student not found"}`.

#### School statistics
```
curl -i "http://localhost:5000/schools/Strathmore%20University/item-statistics"
```
`200`:
```json
{"schoolId":"Strathmore University","schoolName":"Strathmore University","totalItemsReported":4,"totalItemsClaimed":1,"totalRewardAmountPaidCents":15000}
```
`totalItemsClaimed` counts items returned to their owner. An unknown school gives `404 {"error":"school not found"}`.

#### Fee on a claim
```
curl -i http://localhost:5000/claims/1/fees
```
`200`:
```json
{"claimId":"1","studentId":"SU-1001","itemId":"1","amountPayableCents":10000}
```
A fee exists only after a claim is approved: `GET /claims/2/fees` gives `404 {"error":"no fee has been charged on this claim yet"}`. An unknown claim gives `404 {"error":"claim not found"}`.

#### Refunds on a claim
```
curl -i http://localhost:5000/claims/1/refunds
```
`200`:
```json
[{"refundId":"1","claimId":"1","studentId":"SU-1001","amountCents":2500,"reason":"Item returned with a broken zip; partial refund issued.","refundedAt":"2026-10-08T13:30:00Z"}]
```

#### Submit a claim
```
curl -i -X POST http://localhost:5000/claims -H "Content-Type: application/json" -d "{\"studentId\":\"SU-1001\",\"itemId\":\"3\"}"
```
`201`:
```json
{"claimId":"4","studentId":"SU-1001","itemId":"3","status":"pending","rewardAmountCents":0}
```
Body: `studentId` (string, required), `itemId` (string, required), `evidence` (string, optional). Errors: `400` missing or wrong-type field; `404` unknown student or item; `409` the student found the item, it was already returned, or they already claimed it (`{"error":"You have already claimed this item"}`).

#### Approve or reject a claim
```
curl -i -X PATCH http://localhost:5000/claims/2 -H "Content-Type: application/json" -d "{\"status\":\"claimed\"}"
```
`200`:
```json
{"claimId":"2","studentId":"SU-1001","itemId":"2","status":"claimed","rewardAmountCents":10000}
```
Approving makes this student the owner: the other pending claim on the item becomes `rejected`, the item is marked returned, and a fee is recorded. Sending the same status twice changes nothing. Errors: `400` invalid status; `404` unknown claim; `409` another claim on the item is already approved.

#### Withdraw a claim
```
curl -i -X DELETE http://localhost:5000/claims/4
```
`204` with no body. `404 {"error":"claim not found"}` if it doesn't exist.

#### Refund part of a fee
```
curl -i -X POST http://localhost:5000/claims/1/refunds -H "Content-Type: application/json" -d "{\"studentId\":\"SU-1001\",\"amountCents\":1000,\"reason\":\"Collected late because the office was closed.\"}"
```
`201`:
```json
{"refundId":"2","claimId":"1","studentId":"SU-1001","amountCents":1000,"reason":"Collected late because the office was closed.","refundedAt":"2026-10-27T09:42:45Z"}
```
Errors: `400` missing or invalid field, or `studentId` isn't the claimant; `404` unknown claim; `409` the claim has no fee, or the total refunded would be more than the fee.

### Errors

Every error has the same shape:

```json
{"error": "claim not found"}
```

| Status | Meaning |
|---|---|
| 400 | A field is missing or has the wrong type, or the body isn't valid JSON |
| 401 | The `X-API-Key` header is missing or the key isn't valid |
| 404 | No claim, student, item or school with that ID, or no such path |
| 409 | The request conflicts with the current state (see each endpoint) |
| 429 | More than 100 requests with your key in a minute. Wait `Retry-After` seconds |
| 500 | Our bug. Tell us the time and the request you sent |

---

## Running it locally

You need **Node.js 18+**, **MySQL 8** (or MariaDB), and **Git**.

```
git clone https://github.com/Shannell-W/Prestige-lost-and-found.git
cd Prestige-lost-and-found
```

### 1. The server

```
cd server
npm install
```

Copy `server/.env.example` to `server/.env` and set `DB_PASSWORD` to your MySQL password.
(PowerShell: `copy .env.example .env`)

Then set `API_KEYS`: one key per consumer, as `name:key`. Make each key with:

```
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Create the database and tables, then load sample data:

```
mysql -u root -p < schema.sql
npm run seed
```

In PowerShell, `<` doesn't work. Use `Get-Content schema.sql | mysql -u root -p` instead, or paste the contents of `schema.sql` into the MySQL Command Line Client.

Start it:

```
npm start
```

It prints `Server running on http://localhost:5000` and `API keys loaded: 3 (team6, prestige-web, prestige-team)` (names only, never the keys). Check it with http://localhost:5000/api/health.

### 2. The website

In a second terminal:

```
cd prestige-client
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). Sample logins, all with password `password123`:

| Email | School |
|---|---|
| amani@strathmore.test | Strathmore University |
| wanjiku@strathmore.test | Strathmore University |
| brian@strathmore.test | Strathmore University |
| faith@ku.test | Kenyatta University |

The website needs its own key: copy `prestige-client/.env.example` to `prestige-client/.env` and set `VITE_API_KEY` to the `prestige-web` key from `server/.env`. Restart `npm run dev` after changing it. To point the website at a different server (e.g. a deployed one), set `VITE_API_URL` in the same file.

### 3. Tests

```
cd server
npm test
```

The tests build their own database, `prestige_db_test`, so they never touch your real data. They cover every partner endpoint (success, validation errors, not-found, edge cases), the website's claim rules, API keys and the rate limit (`__tests__/security.test.js`), and the Team 4 venues integration (using a stand-in Team 4 server). See [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) for the security review.

---

## Our upstream partner (Week 10)

The **Partner Venues** page (`/venues`) shows venues from **Team 4**. Team 4 told us to use their deployed server, `https://artist-api-server.onrender.com` (`GET /api/venues`, no key needed).

- Our server calls Team 4; the page only ever calls our own `/api/partner-venues`.
- Our server remembers Team 4's last answer for 20 minutes (`PARTNER_CACHE_MINUTES`). Render's free plan sleeps when idle, so this keeps the page fast and working while their server wakes up.
- If Team 4 is down, slow (20-second limit) or changes their response, the page shows the last saved venues with a note saying how old they are, or "Partner data is unavailable right now" if nothing is saved yet. Our own pages keep working.
- Team 4's contract (`openapi.yaml` in [EMT-MOSES/Team-4--Artist-platform](https://github.com/EMT-MOSES/Team-4--Artist-platform)) describes a different server, with an `x-api-key` and venues shaped `id, name, capacity`. Our code accepts that shape too, and sends a key if `PARTNER_API_KEY` is set, so switching only needs a change to `.env`.

Settings in `server/.env`:

```
PARTNER_URL=https://artist-api-server.onrender.com
PARTNER_API_KEY=
```

See [`INTEGRATION_LOG.md`](./INTEGRATION_LOG.md) for what happened during integration.

## Project layout

```
server/index.js            website routes (/api/...) and error handling
server/routes/partnerVenues.js  venues from Team 4 (Week 10)
server/routes/contract.js  the partner API (openapi.yaml)
server/claimRules.js       claim rules shared by both
server/db.js               MySQL connection
server/schema.sql          tables;  server/seed.js  sample data
server/__tests__/          Jest + Supertest tests;  server/test/  test setup
prestige-client/src/       React pages, components and styles
docs/index.html            browsable API docs (Swagger UI)
```
