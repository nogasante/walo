/* Small shared helpers: escaping, numbers, dates, distance. No app data here. */
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DAY = 864e5;

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmt = (n, d = 0) => (n == null || !isFinite(n) ? "-" : Number(n).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));

export const today0 = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromIso = (s) => new Date(s + "T00:00:00");
export const dayMonth = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
export const weekday = (d) => d.toLocaleDateString("en-GB", { weekday: "long" });
/* "early / mid / late November": everyday words for a date that is only an estimate */
export const roughDate = (d) => `${d.getDate() <= 10 ? "early" : d.getDate() <= 20 ? "mid" : "late"} ${MONTHS_LONG[d.getMonth()]}`;
export const doyOfDate = (d) => Math.min(364, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / DAY));
export const doyText = (doy) => dayMonth(new Date(2025, 0, 1 + (((doy % 365) + 365) % 365)));

export function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/* contiguous month groups, e.g. [3,4,7,8,9] -> [[3,4],[7,8,9]] */
export function runs(months) {
  const out = [];
  months.forEach((m) => { const last = out[out.length - 1]; if (last && m === last[last.length - 1] + 1) last.push(m); else out.push([m]); });
  return out;
}
export const monthSpan = (r) => (r.length === 1 ? MONTHS_LONG[r[0] - 1] : `${MONTHS_LONG[r[0] - 1]} to ${MONTHS_LONG[r[r.length - 1] - 1]}`);
