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

## The partner API (for Team 6)

The Prestige Lost & Found API gives claim statuses, reward amounts, fees, refunds and school statistics. The full contract is [`openapi.yaml`](./openapi.yaml), and with the server running you can browse it at **http://localhost:5000/docs/**.

### Quickstart

With the server running (see [Running it locally](#running-it-locally)), copy and paste:

```
curl -i "http://localhost:5000/claims?status=claimed"
```

Expected `200 OK`:

```json
[{"claimId":"1","studentId":"SU-1001","itemId":"1","status":"claimed","rewardAmountCents":15000}]
```

On Windows PowerShell, type `curl.exe` instead of `curl`. Or paste the address into a browser.

### Authentication

The partner API (every path below, with **no** `/api` prefix) **needs no key or login**. Our lecturer told us to skip API keys for now; we'll add an `X-API-Key` header later and update this section and the contract.

Our own website's routes (`/api/...`) are separate. Actions like claiming an item need a login token (`Authorization: Bearer <token>` from `POST /api/auth/login`). Partners don't need those routes.

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
| 404 | No claim, student, item or school with that ID, or no such path |
| 409 | The request conflicts with the current state (see each endpoint) |
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

It prints `Server running on http://localhost:5000`. Check it with http://localhost:5000/api/health.

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

To point the website at a different server (e.g. a deployed one), set `VITE_API_URL` in `prestige-client/.env` (see `prestige-client/.env.example`).

### 3. Tests

```
cd server
npm test
```

The tests build their own database, `prestige_db_test`, so they never touch your real data. They cover every partner endpoint (success, validation errors, not-found, edge cases), the website's claim rules, and the Team 4 venues integration (using a stand-in Team 4 server).

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
