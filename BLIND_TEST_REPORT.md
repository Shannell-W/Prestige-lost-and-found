# Blind Test Report (Week 8)

Team 5 (Prestige): Campus Lost & Found API

> **Before submitting:** Part 1 is complete. Parts 2–5 must describe what really happened in the blind test. Replace every `[bracket]` and delete this note. If the other team never got a working response, say so plainly: "it didn't work" is a real and useful result.

---

## Part 1: What we published

### Docs site (Part A)

- `openapi.yaml` rendered with **Swagger UI** in `docs/index.html`.
- With the server running it opens at **http://localhost:5000/docs/**. [If you publish it on GitHub Pages too, add that link.]
- All 9 operations in the contract appear, each with its request and response shape: `GET`/`POST /claims`, `PATCH`/`DELETE /claims/{claimId}`, `GET /students/{studentId}/claims`, `GET /schools/{schoolId}/item-statistics`, `GET /claims/{claimId}/fees`, `GET`/`POST /claims/{claimId}/refunds`.

### README quickstart (Part B)

| What the handout requires | Where it is in `README.md` |
|---|---|
| Overview: what the API is and who it's for | Opening section and "The partner API" |
| Auth instructions | "Authentication": no key needed yet (lecturer's instruction), and how our own `/api` login works |
| One working example per major endpoint, request and real response | "Endpoints": a `curl` command and its real response for all 9 |
| Error format reference | "Errors": the `{"error": "..."}` shape and status code table |
| How to run it locally from a clean clone | "Running it locally": server, database, website, tests |
| One copy-paste quickstart command | "Quickstart" |

### Our own clean-terminal check

- [ ] Ran the Quickstart command exactly as written, on [date]. Result: [200 and the claim / what went wrong]
- [ ] Followed "Running it locally" from a fresh clone on [whose laptop]. Result: [worked / what was missing]

---

## Part 2: The swap

| | |
|---|---|
| Team that tested our README | [team name] |
| Are they our ring partner? | [No] [If you had to pair with another available team, say so and why] |
| What we gave them | `README.md` and a way to reach our API ([tunnel link / run it locally]), nothing else |
| Date and time | [date, time] |

## Part 3: What happened when our README was tested

- **Did they get a working response?** [Yes / No]
- **Time to first working response:** [n minutes / never]
- **First request they tried:** [e.g. the Quickstart command]

| # | What they were trying to do | Where they got stuck | Why | Docs gap or something else? |
|---|---|---|---|---|
| 1 | | | | |

## Part 4: What we changed in our docs

| Problem they hit | Change we made to `README.md` |
|---|---|
| | |

Gaps we didn't have time to close: [list them, or "none"]

## Part 5: Our turn, testing their README

- **Team:** [name]
- **Did we get a working response?** [Yes / No], after [n minutes]
- **Where we got stuck:** [exact line of their README, and why]

---

## Honest summary

[One paragraph: did a stranger get a working response from our README alone, how long did it take, and what's the most important thing we fixed or still need to fix?]
