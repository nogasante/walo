/* About: what the data is, what Walo cannot do yet, AI use, and credits. Short on purpose. */
import { D, CFG, crops, crop, isTree } from "../data.js";
import { mainCrop, mainIsAuto } from "../store.js";
import { openMainCropPicker } from "./pickers.js";
import { link, icon } from "../ui.js";
import { esc } from "../util.js";

export const title = () => "About Walo";
export function render() {
  const ag = D.agro.places[CFG().default_place], rs = D.rules.sources, cs = D.crops.sources, ph = D.credits.images;
  const refs = (o) => Object.values(o).map((x) => `<li>${esc(x.title)}${x.url ? ` ${link(x.url, x.url.replace(/^https?:\/\//, "").split("/")[0])}` : ""}</li>`).join("");
  return `<div class="stack about">
    <p class="lead">Walo helps you decide what to plant, where and when, using NASA data for your place.</p>
    <a class="helpbtn" href="#/help/about" data-net><span class="tile-ic talk">${icon("headset")}</span><span class="fo-t"><b>Get help</b><small>Ask Walo by talking or typing</small></span>${icon("chevron-right")}</a>
    <h2 class="h2">${icon("satellite")}Where the data comes from</h2>
    <ul class="plain">
      <li><b>NASA POWER</b>: daily rain, temperature, humidity, wind and sunshine, ${ag.years.join("–")}, for every town (and for your phone's location). ${link("https://power.larc.nasa.gov/", "power.larc.nasa.gov")}</li>
      <li><b>NASA MODIS</b> greenness (NDVI, MOD13Q1), read through ${link(D.ndvi.url, "Microsoft Planetary Computer")}.</li>
      <li><b>${esc(CFG().forecast.label)}</b>: rain forecast for the next 10 days.</li>
      <li><b>Prices</b>: ${link(D.market.source.url, "WFP Ghana food prices (HDX)")}, ${D.market.markets.length} markets to July 2023; ${link(D.market.srid_source.url, "MoFA SRID")} 2025.</li>
      <li><b>Crops</b>: FAO crop calendar for Ghana's zones, FAO EcoCrop, FAO-56, and Ghana research (sources below).</li>
      <li>${link(CFG().geocode.credit_url, CFG().geocode.credit)}. Map: Natural Earth.</li>
    </ul>
    <h2 class="h2">${icon("info")}What Walo cannot do yet</h2>
    <ul class="plain">
      <li>NASA weather covers about 50 km, not your exact field.</li>
      <li>Planting advice uses the usual weather and a 10-day forecast. It is not a promise.</li>
      <li>Price patterns end in 2023. Today's price may differ.</li>
      <li>Twi words and the Twi voice are made by a machine (GhanaNLP Khaya). They can be wrong, and a Twi speaker has not checked them yet.</li>
      <li>In English, Listen uses your phone's own voice.</li>
      <li>Tree crops (${crops().filter(isTree).map((c) => esc(c.name.toLowerCase())).join(", ")}) are not followed as fields.</li>
    </ul>
    <h2 class="h2">${icon("sprout")}My main crop</h2>
    <p class="mainrow"><span>${mainCrop() ? `${esc(crop(mainCrop()).name)}${mainIsAuto() ? " (from your fields)" : ""}` : "Not set yet"}</span><button type="button" class="linkbtn" id="about-main">Change</button></p>
    <h2 class="h2">${icon("cloud-upload")}Your fields</h2>
    <p>Your fields and photos stay on this phone. If you want them to come back on a new phone, use <a href="#/backup">Back up my fields</a>: you sign in with a code sent to your email, and only you can see your fields (Supabase, row-level security).</p>
    <h2 class="h2">${icon("languages")}Twi</h2>
    <p>Tap <b data-notw>EN / Twi</b> at the top. Walo's words, answers and the Listen voice then come in Twi from ${link("https://ghananlp.org/", "GhanaNLP Khaya")}, through our server. In Plant Doctor you can talk in Twi: your voice is sent once to be written down and is not kept. This is machine translation: a Twi speaker still needs to check it.</p>
    <h2 class="h2">${icon("sparkles")}AI use</h2>
    <p>Plant Doctor sends your photo or your words and recent NASA weather to Google Gemini on our server. Its answers are marked "AI answer" and can be wrong. Twi is machine translation and a machine voice by GhanaNLP Khaya, not checked by a Twi speaker yet. Get help is also an AI (Google Gemini) that answers questions about Walo and your farm; it is marked "AI answer", and a person from the team can take over when a help line is set. The idea and design are the team's; an AI assistant helped write the code and process the data. ${link("AI_USE.md", "Full AI-use note")}</p>
    <details class="details"><summary>Methods and sources${icon("chevron-down")}</summary>
      <h3>Methods</h3><ol class="refs" data-notw>${refs(rs)}</ol>
      <h3>Crop facts</h3><ol class="refs" data-notw>${refs(cs)}</ol>
      <h3>Photos (Wikimedia Commons)</h3><ul class="refs" data-notw>${ph.map((x) => `<li>${esc(x.title)} by ${esc(x.author)} · ${link(x.license_url, x.license)} · ${link(x.source_url, "source")}</li>`).join("")}</ul>
      <h3>Font and icons</h3><ul class="refs" data-notw><li>Plus Jakarta Sans, SIL OFL 1.1 (${link("licenses/PlusJakartaSans-OFL.txt", "licence")})</li><li>Lucide icons, ISC (${link("licenses/Lucide-ISC.txt", "licence")})</li><li>supabase-js, MIT (${link("licenses/supabase-js-MIT.txt", "licence")}), for the optional backup</li></ul>
      <h3>Twi</h3><ul class="refs" data-notw><li>Translation, Twi voice and Twi listening: ${link("https://ghananlp.org/", "GhanaNLP")} Khaya AI API (${link("https://developer.khaya.ai/", "developer.khaya.ai")}). Fixed labels translated once by Khaya (data/i18n-tw.json); needs a Twi speaker's check.</li></ul>
    </details>
    <p class="foot">Team Simply Zero · Kumasi · NASA Space Apps Challenge 2026</p>
  </div>`;
}
export function mount(root) {
  root.querySelector("#about-main").addEventListener("click", (e) => openMainCropPicker(e.currentTarget));
}
