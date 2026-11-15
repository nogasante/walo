/* Optional backup: the farmer signs in with an email code; their fields and photos are copied to Walɔ's
   Supabase project and come back on a new phone. Walɔ works the same without it (local-first).
   Rules: push on change, pull on sign-in and on open, newest copy of a field wins (its "updated" time).
   Only the publishable key is used; row-level security keeps every row and photo to its owner. */
import { CFG } from "./data.js";
import { allFarmsRaw, replaceFarms, removedFarms, clearRemoved, ensureUid, getPhotoBlob, putPhotoBlob, subscribe, mainCropRaw, putMainCropRaw } from "./store.js";

const AUTH_KEY = "walo.auth", PUSHED_KEY = "walo.sync.pushed", LAST_KEY = "walo.sync.last";
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } };
let client = null, loading = null, user = null, busy = false, timer = null;
const listeners = new Set();
export const onSyncChange = (fn) => listeners.add(fn);
const tell = () => listeners.forEach((fn) => fn());
export const hasSession = () => !!localStorage.getItem(AUTH_KEY);
export const currentUser = () => user;
export const lastSync = () => jget(LAST_KEY, null);

/* supabase-js (lib/supabase.js, MIT) loads only when backup is used */
function loadLib() {
  if (window.supabase) return Promise.resolve();
  return loading || (loading = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "lib/supabase.js"; s.onload = res; s.onerror = () => { loading = null; rej(new Error("offline")); }; document.head.appendChild(s); }));
}
let making = null;
export function sb() { // one client per page, even if called twice at once
  return making || (making = makeClient().catch((e) => { making = null; throw e; }));
}
async function makeClient() {
  await loadLib();
  const b = CFG().backup;
  client = window.supabase.createClient(b.url, b.key, { auth: { storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  client.auth.onAuthStateChange((ev, session) => {
    const was = user && user.id; user = session ? session.user : null;
    if (user && user.id !== was) setTimeout(() => syncNow().catch(() => {}), 0);
    tell();
  });
  const { data } = await client.auth.getSession(); user = data.session ? data.session.user : null;
  tell();
  return client;
}

/* ---------- sign in with a one-time email code ---------- */
export async function sendCode(email) {
  const c = await sb();
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
  if (error) throw plain(error);
}
export async function checkCode(email, token) {
  const c = await sb();
  const { data, error } = await c.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw plain(error);
  user = data.user; watch(); tell();
  await syncNow();
}
export async function signOut() {
  const c = await sb(); await c.auth.signOut();
  user = null; localStorage.removeItem(PUSHED_KEY); localStorage.removeItem(LAST_KEY); tell(); // fields stay on this phone
}
function plain(e) {
  const m = (e && e.message) || "", s = e && e.status;
  if (/rate|too many|security purposes/i.test(m) || s === 429) return new Error("Too many sign-in emails just now. Wait a minute, then try again.");
  if (/expired|invalid|otp/i.test(m)) return new Error("That did not work. It may have expired: ask for a new link.");
  if (/fetch|network|offline/i.test(m)) return new Error("No internet. Try again when you are online.");
  if (/not authorized|sending|smtp/i.test(m)) return new Error("Walɔ could not send the email right now. Try again in a few minutes.");
  return new Error("Something went wrong. Try again.");
}

/* ---------- sync ---------- */
const photoPath = (uid, f, k) => `${uid}/${f.uid}/${k}.jpg`;
export async function syncNow() {
  if (busy) return; const c = await sb(); if (!user) return;
  busy = true; tell();
  try {
    const b = CFG().backup, uid = user.id;
    let list = allFarmsRaw(), changed = false;
    list.forEach((f) => { if (!f.demo && ensureUid(f)) changed = true; });
    // 1) pull: the newest copy of each field wins
    const { data: rows, error } = await c.from(b.table).select("id,data,deleted,updated_at");
    if (error) throw error;
    const byUid = new Map(list.filter((f) => f.uid).map((f) => [f.uid, f]));
    const sid = b.settings_id, mine = mainCropRaw(), srow = rows.find((r) => r.id === sid);
    if (srow && srow.data && srow.data.main && Date.parse((mine && mine.updated) || 0) < Date.parse(srow.updated_at)) putMainCropRaw({ ...srow.data.main, updated: srow.updated_at });
    for (const r of rows) {
      if (r.id === sid) continue; // the settings row (main crop), not a field
      const local = byUid.get(r.id), rt = Date.parse(r.updated_at);
      if (r.deleted) { if (local && Date.parse(local.updated || 0) <= rt) { list = list.filter((f) => f !== local); changed = true; } continue; }
      if (!local || Date.parse(local.updated || 0) < rt) {
        const f = { ...r.data, uid: r.id, updated: r.updated_at };
        for (const ph of f.photos || []) if (ph.cloud && /^idb:/.test(ph.src || "") && !(await getPhotoBlob(ph.src.slice(4)))) {
          const { data: blob } = await c.storage.from(b.bucket).download(ph.cloud); if (blob) await putPhotoBlob(ph.src.slice(4), blob);
        }
        list = local ? list.map((x) => (x === local ? f : x)) : [f, ...list]; changed = true;
      }
    }
    if (changed) replaceFarms(list);
    // 2) push: fields changed here since the last push, with their photos
    const pushed = jget(PUSHED_KEY, {}), remote = new Map(rows.map((r) => [r.id, Date.parse(r.updated_at)]));
    for (const f of list.filter((x) => !x.demo && x.uid)) {
      const t = Date.parse(f.updated || 0);
      if (pushed[f.uid] === f.updated && remote.has(f.uid)) continue;
      if (remote.has(f.uid) && remote.get(f.uid) >= t) { pushed[f.uid] = f.updated; continue; }
      let photosChanged = false;
      for (const ph of f.photos || []) if (/^idb:/.test(ph.src || "") && !ph.cloud) {
        const blob = await getPhotoBlob(ph.src.slice(4)); if (!blob) continue;
        const path = photoPath(uid, f, ph.src.slice(4));
        const { error: ue } = await c.storage.from(b.bucket).upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (!ue) { ph.cloud = path; photosChanged = true; }
      }
      const data = { ...f }; delete data.uid; delete data.updated;
      const { error: pe } = await c.from(b.table).upsert({ id: f.uid, user_id: uid, data, deleted: false, updated_at: f.updated }, { onConflict: "user_id,id" });
      if (pe) throw pe;
      pushed[f.uid] = f.updated;
      if (photosChanged) { const all = allFarmsRaw(), me = all.find((x) => x.uid === f.uid); if (me) { me.photos = f.photos; replaceFarms(all); } }
    }
    // settings: the main crop choice, newest wins
    const m = mainCropRaw();
    if (m && m.updated && (!srow || Date.parse(srow.updated_at) < Date.parse(m.updated))) {
      const { error: se } = await c.from(b.table).upsert({ id: sid, user_id: uid, data: { kind: "settings", main: { crop: m.crop } }, deleted: false, updated_at: m.updated }, { onConflict: "user_id,id" });
      if (se) throw se;
    }
    const gone = removedFarms();
    if (gone.length) {
      for (const g of gone) {
        await c.from(b.table).upsert({ id: g.uid, user_id: uid, data: {}, deleted: true, updated_at: g.at }, { onConflict: "user_id,id" });
        const { data: files } = await c.storage.from(b.bucket).list(`${uid}/${g.uid}`);
        if (files && files.length) await c.storage.from(b.bucket).remove(files.map((x) => `${uid}/${g.uid}/${x.name}`));
      }
      clearRemoved(gone.map((g) => g.uid));
    }
    jset(PUSHED_KEY, pushed); jset(LAST_KEY, new Date().toISOString());
  } finally { busy = false; tell(); }
}
export const isBusy = () => busy;

/* start: only if this phone has signed in before (otherwise nothing loads and nothing is sent) */
let linkErr = "";
export const takeLinkError = () => { const e = linkErr; linkErr = ""; return e; };
/* A sign-in email can come back three ways: the older link puts its tokens in the hash (#access_token=…),
   the newer one brings ?code=…, and a failed one carries error/error_description. All of them have to be
   handed to the client, or a farmer who taps her link lands on Home with nothing happening. */
const LINK = /access_token=|refresh_token=|error_description=|\berror=|\bcode=|token_hash=/;
export function startSync() {
  const url = location.search + location.hash;
  const fromLink = LINK.test(url);
  if (fromLink && /error(_description)?=/.test(url)) linkErr = "That link did not work or is too old. Ask for a new one.";
  if (!hasSession() && !fromLink) return;
  sb().then(async () => {
    if (fromLink) {
      await new Promise((r) => setTimeout(r, 0)); // let detectSessionInUrl finish reading the URL
      if (user) { document.dispatchEvent(new Event("walo-refresh")); location.hash = "#/backup"; }
      else if (!linkErr) linkErr = "That link did not work or is too old. Ask for a new one.";
    }
    if (user) syncNow().catch(() => {});
  }).catch(() => {});
  watch();
}
let watching = false;
function watch() { // push a little after any change while signed in
  if (watching) return; watching = true;
  subscribe(() => { if (!user) return; clearTimeout(timer); timer = setTimeout(() => syncNow().catch(() => {}), CFG().backup.push_delay_ms); });
}
