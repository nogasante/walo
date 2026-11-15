/* Back up my fields: optional sign-in with a one-time email code. Walɔ works without it. */
import { farms } from "../store.js";
import { CFG } from "../data.js";
import { icon, btn, note } from "../ui.js";
import { esc, dayMonth } from "../util.js";
import { sb, sendCode, checkCode, signOut, syncNow, takeLinkError, currentUser, hasSession, lastSync, isBusy, onSyncChange } from "../sync.js";

let S = { step: "email", email: "", err: "", wait: false, ready: false };
export const title = () => "Sign in or back up";
onSyncChange(() => { if (location.hash.startsWith("#/backup")) document.dispatchEvent(new Event("walo-refresh")); });
const head = (ic, tone, t, sub) => `<article class="answer ${tone}"><div class="a-top"><span class="a-ic">${icon(ic)}</span></div><h1 class="a-title">${t}</h1><p class="a-sub">${sub}</p></article>`;
export function render() {
  const le = takeLinkError(); if (le) S.err = le;
  const u = currentUser(), n = farms().filter((f) => !f.demo).length, b = CFG().backup;
  if (!S.ready && hasSession()) return `<div class="stack">${head("cloud-upload", "info", "Checking your backup…", "One moment.")}</div>`;
  const err = S.err ? `<p class="alert">${icon("triangle-alert")}<span>${esc(S.err)}</span></p>` : "";
  if (u) {
    const last = lastSync();
    return `<div class="stack">
      ${head(isBusy() ? "cloud-upload" : "cloud-check", "good", isBusy() ? "Backing up…" : "Your fields are backed up", n ? `${n === 1 ? "Your field and its photos are" : `Your ${n} fields and their photos are`} saved with ${esc(u.email || "your account")}. Sign in with this email on a new phone to get them back.` : `Signed in as ${esc(u.email || "you")}. Add a field and it is saved here too.`)}
      ${err}
      ${last ? note(`Last backup: ${dayMonth(new Date(last))}, ${new Date(last).toTimeString().slice(0, 5)}.`, "clock") : ""}
      ${btn("Back up now", { ic: "refresh-cw", attrs: `id="bk-now" data-net ${isBusy() ? "disabled" : ""}` })}
      ${btn("Sign out", { kind: "secondary", ic: "log-out", attrs: 'id="bk-out"' })}
      ${note("Signing out keeps your fields on this phone.")}
    </div>`;
  }
  if (S.step === "code") {
    return `<div class="stack">
      ${head("mail", "wait", "Open the email we sent", `We sent a sign-in link to <b>${esc(S.email)}</b>. Tap it on this phone and you are signed in. If the email also shows a ${b.code_min}-number code, you can type it below instead.`)}
      ${err}
      <form class="card stack" id="bk-code-form" novalidate>
        <label class="field">Code from the email<input id="bk-code" class="code-in" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" minlength="${b.code_min}" maxlength="${b.code_max}" required></label>
        ${btn(S.wait ? "Checking…" : "Sign in with the code", { ic: "circle-check", type: "submit", attrs: S.wait ? "disabled data-net" : "data-net" })}
      </form>
      <div class="row2">${btn("Send a new link", { kind: "secondary", attrs: 'id="bk-resend" data-net' })}${btn("Use another email", { kind: "secondary", attrs: 'id="bk-back"' })}</div>
    </div>`;
  }
  return `<div class="stack">
    ${head("cloud-upload", "info", "Sign in or back up", "Used Walɔ before? Sign in with the same email and your fields come back. New here? Add your email so your fields come back if you change or lose this phone.")}
    ${err}
    <form class="card stack" id="bk-email-form" novalidate>
      <label class="field">Your email<input id="bk-email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="${esc(S.email)}" required></label>
      ${btn(S.wait ? "Sending…" : "Email me a sign-in link", { ic: "mail", type: "submit", attrs: S.wait ? "disabled data-net" : "data-net" })}
    </form>
    ${note("No password. We only use your email to sign you in and keep your fields. You can use Walɔ without this.")}
  </div>`;
}
export function mount(root, a, b, rerender) {
  if (!S.ready) sb().then(() => { S.ready = true; rerender(); }).catch(() => { S.ready = true; S.err = "No internet. Backup needs the internet; your fields are safe on this phone."; rerender(); });
  const go = async (fn) => { S.wait = true; S.err = ""; rerender(); try { await fn(); } catch (e) { S.err = e.message; } S.wait = false; rerender(); };
  const ef = root.querySelector("#bk-email-form");
  if (ef) ef.addEventListener("submit", (e) => { e.preventDefault(); const v = root.querySelector("#bk-email").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { S.err = "Check the email. It should look like name@example.com."; rerender(); return; }
    S.email = v; go(async () => { await sendCode(v); S.step = "code"; }); });
  const cf = root.querySelector("#bk-code-form");
  if (cf) { const inp = root.querySelector("#bk-code"); inp.focus({ preventScroll: true });
    cf.addEventListener("submit", (e) => { e.preventDefault(); const v = inp.value.replace(/\D/g, "");
      if (v.length < CFG().backup.code_min) { S.err = "Type all the numbers from the email."; rerender(); return; }
      go(async () => { await checkCode(S.email, v); S.step = "email"; }); }); }
  const rs = root.querySelector("#bk-resend"); if (rs) rs.addEventListener("click", () => go(() => sendCode(S.email)));
  const bk = root.querySelector("#bk-back"); if (bk) bk.addEventListener("click", () => { S.step = "email"; S.err = ""; rerender(); });
  const nw = root.querySelector("#bk-now"); if (nw) nw.addEventListener("click", () => go(() => syncNow()));
  const out = root.querySelector("#bk-out"); if (out) out.addEventListener("click", () => { if (confirm("Sign out? Your fields stay on this phone.")) go(() => signOut()); });
}
