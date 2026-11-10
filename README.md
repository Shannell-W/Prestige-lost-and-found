# Campus Lost & Found (Team 5: Prestige)

Campus Lost & Found helps students get back things they lost at school. A student who finds something reports it in their school's portal; the owner finds it, claims it with evidence, and the finder reviews the claims and picks the rightful owner.

This repository has three parts:

| Folder                              | What it is                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `prestige-client/`                  | The website (React + Vite), for students                                                            |
| `server/`                           | The Express + MySQL server. It serves the website's data (`/api/...`) **and** the partner API below |
| root `.md` files and `openapi.yaml` | Weekly lab documents and the API contract                                                           |

**Team:** Shannell Wanjiru (API Lead), Tony Kibe (Backend Dev), Raika Kanyiha (Integration/QA Lead), GuyTresor Gacheru (Docs/DevOps Lead)
**Ring:** we consume Team 4's Artist Platform API; Team 6 (MoneyMentor Kenya) consumes ours.

---

## The partner API (for partner teams: Team 6, Team 7)

The Prestige Lost & Found API gives claim statuses, reward amounts, fees, refunds and school statistics. The full contract is [`openapi.yaml`](./openapi.yaml), and with the server running you can browse it at **http://localhost:5000/docs/**.

### Base URL

| Who                             | Base URL                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Partner teams (from anywhere)   | **`https://papers-relay-benefits-attention.trycloudflare.com`** (live from 3 November 2026) |
| Our own team, on our own laptop | `http://localhost:5000`                                                                     |

Add the endpoint path straight after the base URL, with **no `/api`**. For example, `GET /claims`:

```
https://papers-relay-benefits-attention.trycloudflare.com/claims?status=claimed
```

The public base URL is a Cloudflare tunnel to our server, which runs on our laptop. Please note:

- It only works while our laptop, server and tunnel are running. Agree a testing time with us.
- **The link changes whenever we restart the tunnel.** We'll message you the new one, and update this table.
- Check it's up first (no key needed): `<base URL>/api/health` should return `{"message":"Prestige API is running"}`.
- `localhost` addresses only work on our own laptop. Don't use them from your app.

### Quickstart

Copy and paste, with your own key:

```
curl -i -H "X-API-Key: <your-api-key>" "https://papers-relay-benefits-attention.trycloudflare.com/claims?status=claimed"
```

Expected `200 OK`:

```json
[
  {
    "claimId": "1",
    "studentId": "SU-1001",
    "itemId": "1",
    "status": "claimed",
    "rewardAmountCents": 15000
  }
]
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

### Versions: v1 and v2

Two list endpoints have a **v2** that wraps the list in `{ "data": [...], "count": N }`:

| v1 (deprecated, sunset end of Tue 10 Nov 2026) | v2 (use this) |
|---|---|
| `GET /claims?status=...` or `GET /v1/claims?status=...` → `[ {claim}, ... ]` | `GET /v2/claims?status=...` → `{ "data": [ {claim}, ... ], "count": N }` |
| `GET /students/{studentId}/claims` or `/v1/...` → `[ {...}, ... ]` | `GET /v2/students/{studentId}/claims` → `{ "data": [ {...}, ... ], "count": N }` |

The items inside the list, the `?status=` filter, errors and the API key are the same in both. v1 responses carry `Deprecation: true`, `Sunset` and a `Link` to the v2 URL. Every other endpoint is unchanged and has no v2: call it at its usual URL (or under `/v1/`). Details and migration steps: [`DEPRECATION_NOTICE.md`](./DEPRECATION_NOTICE.md).

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

| Method | Path                                  | What it does                                     | Success |
| ------ | ------------------------------------- | ------------------------------------------------ | ------- |
| GET    | `/claims?status={status}`             | List claims with a status, with reward amounts   | 200     |
| POST   | `/claims`                             | Submit a claim on an item for a student          | 201     |
| PATCH  | `/claims/{claimId}`                   | Set a claim's status (approving picks the owner) | 200     |
| DELETE | `/claims/{claimId}`                   | Withdraw a claim                                 | 204     |
| GET    | `/students/{studentId}/claims`        | A student's claims and their status              | 200     |
| GET    | `/schools/{schoolId}/item-statistics` | A school's lost-item totals                      | 200     |
| GET    | `/claims/{claimId}/fees`              | The handling fee on an approved claim            | 200     |
| GET    | `/claims/{claimId}/refunds`           | Refunds on a claim                               | 200     |
| POST   | `/claims/{claimId}/refunds`           | Refund part of a claim's fee                     | 201     |

Every example below is a real response from the server with the sample data from `npm run seed`. Your `submittedAt`/`refundedAt` times and new IDs will differ.

#### List claims by status

```
curl -i "http://localhost:5000/claims?status=pending"
```

`200`:

```json
[
  {
    "claimId": "2",
    "studentId": "SU-1001",
    "itemId": "2",
    "status": "pending",
    "rewardAmountCents": 10000
  },
  {
    "claimId": "3",
    "studentId": "SU-1002",
    "itemId": "2",
    "status": "pending",
    "rewardAmountCents": 10000
  }
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
  {
    "claimId": "1",
    "itemId": "1",
    "status": "claimed",
    "submittedAt": "2026-10-01T06:15:00Z"
  },
  {
    "claimId": "2",
    "itemId": "2",
    "status": "pending",
    "submittedAt": "2026-10-03T07:00:00Z"
  }
]
```

A real student with no claims gives `200 []`. An unknown student gives `404 {"error":"student not found"}`.

#### School statistics

```
curl -i "http://localhost:5000/schools/Strathmore%20University/item-statistics"
```

`200`:

```json
{
  "schoolId": "Strathmore University",
  "schoolName": "Strathmore University",
  "totalItemsReported": 4,
  "totalItemsClaimed": 1,
  "totalRewardAmountPaidCents": 15000
}
```

`totalItemsClaimed` counts items returned to their owner. An unknown school gives `404 {"error":"school not found"}`.

#### Fee on a claim

```
curl -i http://localhost:5000/claims/1/fees
```

`200`:

```json
{
  "claimId": "1",
  "studentId": "SU-1001",
  "itemId": "1",
  "amountPayableCents": 10000
}
```

A fee exists only after a claim is approved: `GET /claims/2/fees` gives `404 {"error":"no fee has been charged on this claim yet"}`. An unknown claim gives `404 {"error":"claim not found"}`.

#### Refunds on a claim

```
curl -i http://localhost:5000/claims/1/refunds
```

`200`:

```json
[
  {
    "refundId": "1",
    "claimId": "1",
    "studentId": "SU-1001",
    "amountCents": 2500,
    "reason": "Item returned with a broken zip; partial refund issued.",
    "refundedAt": "2026-10-08T13:30:00Z"
  }
]
```

#### Submit a claim

```
curl -i -X POST http://localhost:5000/claims -H "Content-Type: application/json" -d "{\"studentId\":\"SU-1001\",\"itemId\":\"3\"}"
```

`201`:

```json
{
  "claimId": "4",
  "studentId": "SU-1001",
  "itemId": "3",
  "status": "pending",
  "rewardAmountCents": 0
}
```

Body: `studentId` (string, required), `itemId` (string, required), `evidence` (string, optional). Errors: `400` missing or wrong-type field; `404` unknown student or item; `409` the student found the item, it was already returned, or they already claimed it (`{"error":"You have already claimed this item"}`).

#### Approve or reject a claim

```
curl -i -X PATCH http://localhost:5000/claims/2 -H "Content-Type: application/json" -d "{\"status\":\"claimed\"}"
```

`200`:

```json
{
  "claimId": "2",
  "studentId": "SU-1001",
  "itemId": "2",
  "status": "claimed",
  "rewardAmountCents": 10000
}
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
{
  "refundId": "2",
  "claimId": "1",
  "studentId": "SU-1001",
  "amountCents": 1000,
  "reason": "Collected late because the office was closed.",
  "refundedAt": "2026-10-27T09:42:45Z"
}
```

Errors: `400` missing or invalid field, or `studentId` isn't the claimant; `404` unknown claim; `409` the claim has no fee, or the total refunded would be more than the fee.

### Errors

Every error has the same shape:

```json
{ "error": "claim not found" }
```

| Status | Meaning                                                                      |
| ------ | ---------------------------------------------------------------------------- |
| 400    | A field is missing or has the wrong type, or the body isn't valid JSON       |
| 401    | The `X-API-Key` header is missing or the key isn't valid                     |
| 404    | No claim, student, item or school with that ID, or no such path              |
| 409    | The request conflicts with the current state (see each endpoint)             |
| 429    | More than 100 requests with your key in a minute. Wait `Retry-After` seconds |
| 500    | Our bug. Tell us the time and the request you sent                           |

---

## Monitoring (Week 12)

Every request is logged as one line of JSON in the server's terminal: time, method, path (never the query string), status, time taken in milliseconds, and who called it. "Who" is a 6-character fingerprint of the API key (`key-1712ec`) plus the key's name (`team6`), never the key itself. Requests rejected with 401 or 429 are logged too, because the logger runs before the key check.

```
{"time":"2026-11-03T16:57:01.968Z","method":"GET","path":"/claims","status":200,"ms":17.3,"caller":"key-1712ec","consumer":"prestige-team"}
{"time":"2026-11-03T16:57:01.983Z","method":"GET","path":"/claims","status":401,"ms":1.7,"caller":"none","consumer":null}
```

To keep a copy in a file (PowerShell): `node index.js | Tee-Object -FilePath requests.log` (Mac/Linux: `node index.js | tee requests.log`). `*.log` is in `.gitignore`.

### GET /stats

Running totals since the server started. Needs an API key like every other route.

```
curl -s -H "X-API-Key: <your-api-key>" http://localhost:5000/stats
```

`200`:

```json
{
  "startedAt": "2026-11-03T16:56:54.999Z",
  "uptimeSeconds": 26,
  "total": 323,
  "clientErrors": 219,
  "serverErrors": 0,
  "errorRatePercent": 0,
  "avgMs": 2.6,
  "routes": {
    "GET /claims": {
      "count": 35,
      "clientErrors": 12,
      "serverErrors": 0,
      "avgMs": 3.5,
      "maxMs": 17.3
    },
    "GET /schools/:schoolId/item-statistics": {
      "count": 18,
      "clientErrors": 0,
      "serverErrors": 0,
      "avgMs": 7.4,
      "maxMs": 17.5
    },
    "GET (no route)": {
      "count": 178,
      "clientErrors": 178,
      "serverErrors": 0,
      "avgMs": 1,
      "maxMs": 5.9
    }
  },
  "partner": { "calls": 0, "failures": 0, "staleServed": 0, "unavailable": 0 }
}
```

- `clientErrors` / `serverErrors`: 4xx (usually the caller's mistake) and 5xx (ours). `errorRatePercent` counts 5xx only.
- `routes` groups by route pattern, so `/claims/1/fees` and `/claims/2/fees` share one row. `(no route)` holds requests that never reached a route: 401 and 429 rejected earlier, and 404s for unknown paths. The log lines tell them apart.
- `partner` (Week 11 stretch): calls to Team 4's venues API, failures, how often we served the saved copy instead (`staleServed`), and how often there was nothing to show (`unavailable`).
- The numbers live in memory and reset when the server restarts.

To generate traffic: `node traffic.js http://localhost:5000 <your-api-key> 60` (in `server/`).

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

**No `mysql` command on your PATH?** Run `npm run setup-db` instead of the `mysql` line. It reads `schema.sql` and your login from `server/.env` and creates the database through Node.

**Already have a database from before lost reports?** Don't drop it. Run `npm run migrate` instead: it adds the new tables (`lost_reports`, `lost_report_matches`) and columns (and all the new columns) and keeps your data. It is safe to run more than once.

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

| Email                   | School                |
| ----------------------- | --------------------- |
| amani@strathmore.test   | Strathmore University |
| wanjiku@strathmore.test | Strathmore University |
| brian@strathmore.test   | Strathmore University |
| faith@ku.test           | Kenyatta University   |

The website needs its own key: copy `prestige-client/.env.example` to `prestige-client/.env` and set `VITE_API_KEY` to the `prestige-web` key from `server/.env`. Restart `npm run dev` after changing it. To point the website at a different server (e.g. a deployed one), set `VITE_API_URL` in the same file.

### 3. Tests

```
cd server
npm test
```

The tests build their own database, `prestige_db_test`, so they never touch your real data. They cover every partner endpoint (success, validation errors, not-found, edge cases), the website's claim rules, API keys and the rate limit (`__tests__/security.test.js`), and the Team 4 venues integration (using a stand-in Team 4 server). See [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) for the security review.

---

## Lost reports and matching

A student who lost something reports it at **Report Lost Item** (`/report-lost`): what it is, category, where and when, and the reward they offer the finder.

- If similar found items already exist **in their school**, they go straight to a **Possible matches** page, best match first, each showing the finder's asking reward next to their own offer, with a "This is mine, claim it" button.
- If nothing matches yet, they are told so, and when someone later reports a similar found item they get a **notification that links to it**.
- When claiming, the owner can enter the **amount they'll pay**; the finder sees it next to their own asking reward when reviewing claims. While the claim is pending, the finder can **counter-offer**, and the owner can **accept** it or **make a new offer** (on My Claims). Approving the claim accepts the owner's current offer, and marks their lost report **RESOLVED**.
- An item someone has already claimed can **still be claimed** by others (and is still shown as a match), so a wrong claim can't block the real owner; the finder compares the proof.
- Matching forgives **small spelling mistakes** ("umbrela" finds "umbrella", "bakpack" finds "backpack").
- The sidebar shows the number of **unread notifications**; opening Notifications marks them read.
- **Browse Items** has search plus category, status, school, location and date filters, starting on the student's own school.

### Making it easy for both sides

- **Home and Dashboard** lead with two big buttons, **I lost something** and **I found something**. Logging in returns you to where you were going.
- **Alerts by email and SMS** (optional): every notification can also be emailed (Resend) and texted (Africa's Talking). Students add a phone and choose on their **Profile**. Off until the keys are set in `server/.env` (see `.env.example`).
- **Found-item form for phones**: photo (taken with the camera, shrunk in the browser before upload), what, where (with a list of common campus places), date (today by default), and where the owner collects it. Description, reward and a **check question** are folded under "More details".
- **Where to collect it**: the finder says whether it's with **campus security** or with them, plus private pickup details. Once the claim is approved, both sides see the pickup details and each other's contact under **How to hand over / collect**.
- **Check question**: a question only the owner can answer ("What's on the keychain?"). Claimants must answer it; the finder sees the answer next to the proof.
- **Demand**: right after posting, the finder sees how many students are looking for something like it.
- **"Still looking?" reminders** every 30 days while a lost report is open.
- **Plain status words** ("Waiting for owner", "Claim under review", "Returned to owner"; "Still looking", "Got it back").
- One shared sidebar on every portal page (`components/Sidebar.jsx`); Browse Items uses it when you're logged in.
- **Real statistics** on the Home page (`GET /api/statistics/summary`).

Photos are served openly at `/uploads/<random name>` (an `<img>` can't send an API key), like the docs. Only real JPEG/PNG/WebP files up to 3 MB are accepted, from logged-in students.

Website routes (all need a login): `POST /api/lost-reports`, `GET /api/lost-reports`, `GET /api/lost-reports/:id`, `GET /api/lost-reports/:id/matches`, `PATCH /api/lost-reports/:id` (`{"status":"CLOSED"|"OPEN"}`). `GET /api/items` also accepts `category`, `location`, `dateFrom`, `dateTo`. `POST /api/claims` accepts an optional `offeredAmount` (KSh). Price: `PATCH /api/claims/:id/offer` and `POST /api/claims/:id/accept-counter` (claimant), `PATCH /api/claims/:id/counter` (finder), each with `{"amount": 250}` where needed. Notifications: `GET /api/notifications/unread-count`, `POST /api/notifications/read-all`, `PATCH /api/notifications/:id/read`. Settings: `PATCH /api/profile` (`phone`, `alertsEmail`, `alertsSms`). Pickup: `GET /api/claims/:id/handover`. Photos: `POST /api/uploads`. `POST /api/items` also takes `handover` (`FINDER`/`SECURITY`), `handoverNote`, `checkQuestion` and returns `lookingCount`; `POST /api/claims` takes `checkAnswer`; `POST /api/auth/register` takes an optional `phone`. The partner API is unchanged.

## Our upstream partner (Week 10)

The **Partner Venues** page (`/venues`) shows venues from **Team 4**. Team 4 told us to use their deployed server, `https://artist-api-server.onrender.com` (`GET /api/venues`, no key needed).

**Event dates:** the Venues page also shows when shows were held (or will be) at each venue, so a student who lost something at a concert can match the date. Team 4 has no events endpoint, so we use their **bookings** (`GET /api/bookings`: an artist at a venue on a date, with status Pending, Accepted, Rejected or Completed) and artist names (`GET /api/artists`). Our server combines them at `GET /api/partner-events`, leaving out rejected bookings and bookings with no date, and keeps the same 20-minute saved copy as the venues.

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
server/routes/lostReports.js  lost reports: report a lost item, see matches, close it
server/matching.js         how lost reports are matched with found items (scoring rules at the top)
server/migrate.js          `npm run migrate`: updates an existing database
server/routes/offers.js    agreeing a price on a claim (offer, counter-offer, accept)
server/routes/notifications.js  unread count, mark as read
server/routes/account.js   alert settings, pickup details after approval, Home statistics
server/routes/uploads.js   photo uploads
server/alerts.js           email/SMS alerts;  server/notify.js  creates every notification
server/reminders.js        "still looking?" reminders
server/claimRules.js       claim rules shared by both
server/db.js               MySQL connection
server/schema.sql          tables;  server/seed.js  sample data
server/__tests__/          Jest + Supertest tests;  server/test/  test setup
prestige-client/src/       React pages, components and styles
docs/index.html            browsable API docs (Swagger UI)
```
