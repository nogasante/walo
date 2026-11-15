/* About: what the data is, what Walɔ cannot do yet, AI use, and credits. Short on purpose. */
import { D, CFG, crops, crop, country, isTree } from "../data.js";
import { mainCrop, mainIsAuto, place } from "../store.js";
import { openMainCropPicker } from "./pickers.js";
import { link, icon } from "../ui.js";
import { esc } from "../util.js";

const dayText = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`; /* 2026-10-30 -> 30/10/2026 */
const newestExchange = () => Object.values(D.exchange.crops).flatMap((c) => Object.values(c.mk).map((x) => x.d)).sort().pop();
export const title = () => "About Walɔ";
export function render() {
  const cur = place(), ag = (cur && D.agro.places[cur.id]) || D.agro.places[CFG().default_place], rs = D.rules.sources, cs = D.crops.sources, ph = D.credits.images;
  const gh = (country() || {}).id === "GH";
  const refs = (o) => Object.values(o).map((x) => `<li>${esc(x.title)}${x.url ? ` ${link(x.url, x.url.replace(/^https?:\/\//, "").split("/")[0])}` : ""}</li>`).join("");
  return `<div class="stack about">
    <p class="lead">Walɔ helps you decide what to plant, where and when, using NASA data for your place.</p>
    <a class="helpbtn" href="#/help/about" data-net><span class="tile-ic talk">${icon("headset")}</span><span class="fo-t"><b>Get help</b><small>Ask Walɔ by talking or typing</small></span>${icon("chevron-right")}</a>
    <h2 class="h2">${icon("satellite")}Where the data comes from</h2>
    <ul class="plain">
      <li><b>NASA POWER</b>: daily rain, temperature, humidity, wind, sunshine and root-zone soil wetness, ${ag.years.join("-")}, for every town (and for your phone's location). ${link("https://power.larc.nasa.gov/", "power.larc.nasa.gov")}</li>
      <li><b>NASA MODIS</b> greenness (NDVI, MOD13Q1), read through ${link(D.ndvi.url, "Microsoft Planetary Computer")}.</li>
      <li><b>Rotation order</b>: no composite score and no weights. Walɔ checks whether the rain can carry a crop, counts what the crop leaves in the soil, and states whether it breaks a pest cycle. The usual price pattern is shown on each card and never counted in that order.</li>
      <li><b>NASA POWER, two halves</b>: the same daily record compared over 1991-2014 and 2015-2025, and a least-squares trend over all 35 years, for when the rains start, the season rain and days above 35 °C (<code>data/shift.json</code>).</li>
      <li><b>Soil</b>: the usual soil for your FAO agro-ecological zone, with the district notes behind it. It is a zone-level description, not a test of your field; you can change it on the rotation screen.</li>
      <li><b>Ground and erosion</b>: slope from a 3×3 elevation sample around each town (Copernicus DEM via ${link("https://open-meteo.com/en/docs/elevation-api", "Open-Meteo's elevation API")}, not SRTM: SRTM needs a NASA Earthdata login Walɔ does not hold), cover from MODIS NDVI, rain from NASA POWER. They are combined into a low / medium / high screening to compare towns, never a RUSLE calculation or a soil test (<code>data/soilhealth.json</code>, built by <code>scripts/build_soilhealth.py</code>).</li>
      <li><b>${esc(CFG().forecast.label)}</b>: rain forecast for the next 10 days.</li>
      <li><b>Prices</b>: ${gh ? `${link(D.market.source.url, "WFP Ghana food prices (HDX)")}, ${D.market.markets.length} markets to July 2023, for the usual season; ${link(D.prices.source.url, "MoFA SRID commodity prices")}, per kilogram, newest ${dayText(D.prices.covered[1])} in ${Object.keys(D.prices.markets).length} markets, and SRID has published no newer public file; ${link(D.exchange.source.url, "Ghana Commodity Exchange")} traded prices, newest ${dayText(newestExchange())} at ${Object.keys(D.exchange.markets).length} warehouses.` : `${link("https://hapi.humdata.org/docs", "WFP market prices via OCHA's HDX HAPI")}, per kilogram, converted from the unit each market sells in.`}</li>
      <li><b>Crops</b>: FAO crop calendar for ${esc((country() || {}).name || "the country")}'s zones, FAO EcoCrop, FAO-56, and local research (sources below).</li>
      <li>${link(CFG().geocode.credit_url, CFG().geocode.credit)}. Map: ${gh ? "Natural Earth" : "geoBoundaries (RCMRD)"}.</li>
    </ul>
    <h2 class="h2">${icon("info")}What Walɔ cannot do yet</h2>
    <ul class="plain">
      <li>NASA weather covers about 50 km, not your exact field.</li>
      <li>Where a crop has a planting calendar for the zone, Walɔ judges it on that season's rain and temperature. A crop with no calendar for the zone is judged on the whole year's rainfall, which is coarser.</li>
      <li>Planting advice uses the usual weather and a 10-day forecast. It is not a promise.</li>
      <li>Price patterns stop in July 2023. They show the usual season, not this year's price: ask at the market before you sell.</li>
      <li>Walɔ is in English for now. Twi is planned; it needs checking by a Twi speaker first.</li>
      <li>Listen uses your phone's own English voice.</li>
      <li>Tree crops (${crops().filter(isTree).map((c) => esc(c.name.toLowerCase())).join(", ")}) are not followed as fields.</li>
    </ul>
    <h2 class="h2">${icon("sprout")}My main crop</h2>
    <p class="mainrow"><span>${mainCrop() ? `${esc(crop(mainCrop()).name)}${mainIsAuto() ? " (from your fields)" : ""}` : "Not set yet"}</span><button type="button" class="linkbtn" id="about-main">Change</button></p>
    <h2 class="h2">${icon("cloud-upload")}Your fields</h2>
    <p>Your fields and photos stay on this phone. If you want them to come back on a new phone, use <a href="#/backup">Back up my fields</a>: you sign in with a code sent to your email, and only you can see your fields (Supabase, row-level security).</p>
    <h2 class="h2">${icon("sparkles")}AI use</h2>
    <p>Plant Doctor sends your photo or your words and recent NASA weather to Google Gemini on our server. Its answers are marked "AI answer" and can be wrong. Get help is also an AI (Google Gemini) that answers questions about Walɔ and your farm; it is marked "AI answer", and a person from the team can take over when a help line is set. The idea and design are the team's; an AI assistant helped write the code and process the data. ${link("AI_USE.md", "Full AI-use note")}</p>
    <details class="details"><summary>Methods and sources${icon("chevron-down")}</summary>
      <h3>Methods</h3><ol class="refs" data-notw>${refs(rs)}</ol>
      <h3>Crop facts</h3><ol class="refs" data-notw>${refs(cs)}</ol>
      <h3>Photos (Wikimedia Commons)</h3><ul class="refs" data-notw>${ph.map((x) => `<li>${esc(x.title)} by ${esc(x.author)} · ${link(x.license_url, x.license)} · ${link(x.source_url, "source")}</li>`).join("")}</ul>
      <h3>Font and icons</h3><ul class="refs" data-notw><li>Plus Jakarta Sans, SIL OFL 1.1 (${link("licenses/PlusJakartaSans-OFL.txt", "licence")})</li><li>Lucide icons, ISC (${link("licenses/Lucide-ISC.txt", "licence")})</li><li>supabase-js, MIT (${link("licenses/supabase-js-MIT.txt", "licence")}), for the optional backup</li></ul>
    </details>
    <p class="foot">Team Simply Zero · Kumasi · NASA Space Apps Challenge 2026</p>
  </div>`;
}
export function mount(root) {
  root.querySelector("#about-main").addEventListener("click", (e) => openMainCropPicker(e.currentTarget));
}
