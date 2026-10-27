// The one place the server's address is set.
// Locally it's http://localhost:5000. When the server is deployed (e.g. on Render), set
// VITE_API_URL in prestige-client/.env to the deployed address instead. No page changes needed.
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

// Every request to our API needs an API key (Week 11 security). The website's own key is set in
// prestige-client/.env as VITE_API_KEY. Note: anything in a VITE_ variable ends up in the browser,
// so this key is visible to anyone who opens the site's code. That's why the website has its own key,
// separate from our partners' keys, and why logins (JWT) still protect each student's data.
const API_KEY = import.meta.env.VITE_API_KEY || "";

// fetch() with our API key added. Use exactly like fetch().
export function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), "X-API-Key": API_KEY },
  });
}
