// Shared helpers for the booking functions. Secrets come from Netlify env vars:
// SUPABASE_URL, SUPABASE_SERVICE_KEY, TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, OWNER_PHONES, TZ_NAME
const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const TZ = process.env.TZ_NAME || "America/Los_Angeles";

async function sb(path, opts = {}) {
  const r = await fetch(SB + "/rest/v1/" + path, {
    ...opts,
    headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) { const e = new Error(text || r.statusText); e.status = r.status; throw e; }
  return text ? JSON.parse(text) : null;
}

function e164(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return null;
}

async function sms(to, body) {
  const num = e164(to); if (!num) return { ok: false, error: "bad number" };
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN || !process.env.TWILIO_FROM) return { ok: false, error: "texting_off" }; // texts switch on once Twilio keys are added
  const auth = Buffer.from(process.env.TWILIO_SID + ":" + process.env.TWILIO_TOKEN).toString("base64");
  const r = await fetch(`${process.env.TWILIO_API || "https://api.twilio.com"}/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: num, From: process.env.TWILIO_FROM, Body: body }),
  });
  return { ok: r.ok, status: r.status };
}

// Today's date (YYYY-MM-DD) and hour in the shop's time zone
function nowLocal() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24 };
}
const hourLabel = h => (h % 12 || 12) + (h < 12 ? " AM" : " PM");
const dayLabel = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const json = (status, data) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(data) });

module.exports = { sb, sms, e164, nowLocal, hourLabel, dayLabel, json };
