/* Online or not: the phone's own flag, plus a failed call to our server or another site (a phone can say "online" with no real internet).
   Calls served from Walo's offline copy do not count. Changes re-draw the screen so "Needs internet" tags and the Offline chip stay true. */
let down = false;
export const online = () => navigator.onLine && !down;
const counts = (u) => { try { const x = new URL(typeof u === "string" ? u : u.url, location.href); return x.origin !== location.origin || x.pathname.startsWith("/api/"); } catch { return false; } };
function changed() { document.body.classList.toggle("offline", !online()); document.dispatchEvent(new Event("walo-refresh")); }
function set(v) { if (down !== v) { down = v; changed(); } }
const raw = window.fetch.bind(window);
window.fetch = async (input, init) => {
  try { const r = await raw(input, init); if (down && counts(input)) set(false); return r; }
  catch (e) { if (e && e.name !== "AbortError" && counts(input)) set(true); throw e; }
};
addEventListener("online", () => { down = false; changed(); });
addEventListener("offline", changed);
document.body.classList.toggle("offline", !online());
