# Integration Log - Week 10

**Our app:** Prestige (Campus Lost & Found) - React frontend, Express API, MySQL
**Upstream partner (we consume):** Team 4. They told us on 27 October to use `https://artist-api-server.onrender.com` (their app backend, [repo](https://github.com/mu-indie/Team_4_Artist_Server)). Their contract describes a different server; see bug 8.
**Downstream partner (consumes us):** fetched our JSON through a public Cloudflare tunnel link
**Integration feature:** Partner Venues page (`/venues`). Our Express server calls the partner's `GET /api/venues`, and our React page displays the result. The browser never calls the partner directly.
**API key:** Not used this week. The lecturer told us to skip the key step for now.
**Update (27 October):** Team 4 confirmed the Render address and that no key is needed for it. Our server now remembers their last answer for 20 minutes, so the page keeps working while Render wakes up or if Team 4 is down.

## First call (Part B)

| Field | Result |
|---|---|
| Request | `GET https://artist-api-server.onrender.com/api/venues` (opened in a browser, no key) |
| Status | 200 with a JSON array |
| Fields seen | `id`, `userId`, `venueName`, `location`, `capacity`, `supportedGenres`, `description`, `createdAt`, `updatedAt` |
| Contract match | Our route uses `venueName`, `location`, `capacity`, `supportedGenres`. No mismatches found, so no field-name bugs on the upstream side. |
| Surprise | The first call returned 1 venue (Royal Arena). Later calls returned 4 venues, so the partner's data is live and was changed while we worked. |

## Bugs and surprises

| # | What broke (symptom) | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 1 | Opening the API URL showed an empty cream page instead of JSON | Opened the React app's port (5173/5174), which has no page for `/api/items`, instead of the backend on port 5000 | Used `http://localhost:5000/api/items` | Mine (wrong URL, no code change) |
| 2 | Downstream partner said our API was not public | Our server ran on `localhost`, which only our own laptop can reach | Exposed port 5000 with a Cloudflare quick tunnel and sent them the public link. They then confirmed they could see our JSON | Environment, fixed by us |
| 3 | First tunnel attempt: link created but unreachable. Logs showed `Failed to dial a quic connection` and the pre-checks reported FAIL | The Wi-Fi network blocked outbound port 7844, which the tunnel needs | Switched to a different network and restarted the tunnel. Pre-checks passed and the tunnel registered | Network, fixed by us |
| 4 | Browser showed "This site can't be reached" (`DNS_PROBE_FINISHED_NXDOMAIN`) on our tunnel link | Quick tunnel links change every time the tunnel restarts, and we opened the old link | Used the new link, resent it to our partner, and kept the tunnel running without restarts during testing | Mine, fixed by us |
| 5 | `cloudflared` was "not recognized" in the terminal right after installing | The terminal was opened before the install finished, so it did not see the new program | Closed all terminals and opened a fresh one | Tooling, fixed by us |
| 6 | Found while reviewing our server for Part E: `/api/items/claimed` would return "Item not found" | It was defined after `/api/items/:id`, so Express treated the word "claimed" as an item ID | Moved `/api/items/claimed` above `/api/items/:id` | Mine, fixed by me (found in review, not reported by the partner) |
| 7 | Server logged the partner error twice for one page load | React development mode runs the data fetch twice on purpose | No fix needed. Real traffic to the partner is half of what dev mode shows | Neither, expected behavior |
| 8 | The venues we receive don't match Team 4's contract: their `openapi.yaml` says a venue is `id`, `name`, `capacity` and needs an `x-api-key`, but the address Team 4 gave us returns `venueName`, `location`, `supportedGenres` and needs no key | Team 4 has two servers: their app backend on Render (repo `mu-indie/Team_4_Artist_Server`, no `openapi.yaml`) and a separate contracted API (repo `EMT-MOSES/Team-4--Artist-platform`) that isn't deployed. We asked them which to use; on 27 Oct they sent the Render address | Kept the Render address. Our code now accepts both shapes (`venueName` or `name`), sends a key only if one is set, and keeps a 20-minute saved copy (`server/routes/partnerVenues.js`, tested in `__tests__/partner-venues.test.js`). Raised the contract mismatch with Team 4 (see `CONTRACT_QUESTIONS.md`) | Contract mismatch on Team 4's side; we adapted our code |
| 9 | [First real call to Team 4's API: result, date, time] | | | |

## Tests run on purpose

| Test | What we did | Result |
|---|---|---|
| Through our server | `GET /api/partner-venues` | 200, 4 venues, only the four fields our page needs |
| Shape check | Server checks the response is an array with a `venueName` field | Added. If the partner renames a field, we log it and show a friendly message instead of blank rows |

## Part D - partner down

| Test | What we did | What happened |
|---|---|---|
| Wrong partner URL | Changed `PARTNER_URL` in `.env` to a wrong address and restarted the server | Page showed "Partner data is unavailable right now. Please try again later." with no crash or blank page. Server terminal logged `partner returned 404` (the host answered, but had no such path) |
| Address that cannot exist | Changed `PARTNER_URL` to an address that cannot be resolved and restarted the server | Same friendly message on the page. Server terminal logged `partner call failed: ENOTFOUND`, so the log tells us the hostname is wrong, not that the partner is down |
| Our own routes while partner is down | Opened `/api/health` during the failure | Still returned "Prestige API is running" |
| Recovery | Restored the real `PARTNER_URL` and restarted the server | Venues table loaded again with no code changes |

## Part E - being a good provider

| Who called | What they hit | Result | Fixed? |
|---|---|---|---|
| Downstream partner | Our public API through the tunnel link | They could see our JSON once the link was reachable. The only problem they had was reaching us at all (bug 2, 3 and 4 above) | Yes |

While preparing for Part E we also reviewed our own routes against our contract and found bug 6, which we fixed before it affected anyone.

## Collaboration notes

- We sent our downstream partner our public tunnel link and re-sent it when the link changed.
- Our downstream partner confirmed they could read our JSON.
- Our upstream partner's API was reachable and matched what we expected. The data changed between our first and later calls, which confirmed it is live.
- Agreed not to restart the tunnel while our partner was testing, so the link stayed stable.

## Checks to record against the address Team 4 confirmed

| Test | What we did | What happened |
|---|---|---|
| First call | `curl.exe -i https://artist-api-server.onrender.com/api/venues` | |
| Through our server | Opened our Venues page | |
| Saved copy | Reloaded the Venues page several times within 20 minutes; our server log shows one call to Team 4 | |
| Partner down | Set `PARTNER_URL` to a wrong address and restarted our server (or Team 4's server was asleep) | |
| Recovery | Restored `PARTNER_URL`; fresh data loads with no code change | |
