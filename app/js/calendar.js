/* The season as a calendar file. A phone's own calendar rings offline, with no server and no data,
   which is the only reminder a static app can honestly promise. Dates come from the field's own
   stage fractions (GDD), so they move with the season the farmer actually had. */
const pad = (n) => String(n).padStart(2, "0");
const dstr = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const nextDay = (d) => new Date(d.getTime() + 864e5);
const ics = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/[;,]/g, (m) => "\\" + m).replace(/\r?\n/g, "\\n");

export function seasonIcs(f, pr) {
  const c = pr.c, start = pr.start, harvest = pr.harvest, span = Math.max(1, harvest - start), ev = [];
  (c.stages || []).forEach((s) => {
    if (!(s.at > 0 && s.at < 1)) return; // "Sow" is already behind her; harvest is added below
    ev.push({ d: new Date(start.getTime() + Math.round(s.at * span)), title: `${c.name}: ${s.name}`, desc: s.action || "" });
  });
  ev.push({ d: harvest, title: `${c.name}: harvest`, desc: "Harvest about now. Check the price before you sell." });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const body = ev.map((e, i) => [
    "BEGIN:VEVENT",
    `UID:walo-${f.uid || f.id}-${i}@walo`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dstr(e.d)}`,
    `DTEND;VALUE=DATE:${dstr(nextDay(e.d))}`,
    `SUMMARY:${ics(e.title)}`,
    `DESCRIPTION:${ics(e.desc)}`,
    "BEGIN:VALARM", "TRIGGER:-PT12H", "ACTION:DISPLAY", `DESCRIPTION:${ics(e.title)}`, "END:VALARM",
    "END:VEVENT",
  ].join("\r\n")).join("\r\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Walɔ//Season//EN", "CALSCALE:GREGORIAN", body, "END:VCALENDAR", ""].join("\r\n");
}

export function downloadSeason(f, pr) {
  const blob = new Blob([seasonIcs(f, pr)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = `walo-${(f.name || pr.c.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
