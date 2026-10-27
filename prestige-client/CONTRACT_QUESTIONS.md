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
