Questions about the `openapi.yaml` received from our upstream partner (Artist Platform API).

1. None of the endpoints (`/events`, `/venues`, `/schedules`, `/contacts`) define their referenced
   schemas — `Event`, `Venue`, `Schedule`, and `Contact` are all `$ref`'d but there's no
   `components:` section anywhere in the file. What are the actual field names, types, and example
   values for each?

2. `POST /lost-items` requires a `LostItemReport` body, but that schema is also undefined. Since we
   need to submit reports to this endpoint, what fields are required, and what does the `201`
   response actually return?

3. None of the five endpoints document a `400` or `404` — only the success case. What should we
   expect if a request is malformed, or a resource doesn't exist?


## Follow-up: Team 4's current contract (27 October)

Their `openapi.yaml` on `main` (Artist Platform API 1.0.0) now defines the schemas we asked about above. Reading it as we built against it raised new questions:

4. **What changed since Week 4, and why?** The paths gained an `/api` prefix, an API key became required, and new endpoints appeared (`/api/artisans`, `/api/bookings`, `/api/students`, `/api/users/{userId}/bookings/summary`), but the version is still 1.0.0 and there's no contract deviations file. We only found out by reading their code.
5. **`x-api-key` and the 3-per-hour limit:** the contract allows 3 successful requests per key, per endpoint, per hour. A page that loads venues on every visit hits that almost immediately. Is that intended, and should consumers cache? (We now cache for 20 minutes.)
6. **Which fields are guaranteed?** Apart from `Artisan`, no schema lists `required` fields, and no `400`/`404` response body is defined. For `GET /api/venues`, can `name` or `capacity` ever be missing or null?

7. **Which server is the contract for?** On 27 Oct you sent us `https://artist-api-server.onrender.com/api/venues`. That server returns `venueName`, `location` and `supportedGenres` and needs no key, while your `openapi.yaml` says `/api/venues` returns `id`, `name`, `capacity` and needs `x-api-key`. Should your contract be updated to match the Render server, or should we use the server your contract describes?

| Question | Their answer | Contract updated? |
|---|---|---|
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |
