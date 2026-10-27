// The one place the server's address is set.
// Locally it's http://localhost:5000. When the server is deployed (e.g. on Render), set
// VITE_API_URL in prestige-client/.env to the deployed address instead. No page changes needed.
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
