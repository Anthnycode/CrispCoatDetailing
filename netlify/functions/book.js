// POST /api/book  -> saves the booking, then texts the customer and the shop.
const { sb, sms, e164, nowLocal, hourLabel, dayLabel, json } = require("./_lib");

const clip = (v, n) => String(v ?? "").trim().slice(0, n);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad_json" }); }
  if (b.website) return json(200, { ok: true, ref: "CC-OK" }); // honeypot field: bots fill it, people don't

  const day = clip(b.date, 10), hour = parseInt(b.hour, 10);
  const name = clip(b.name, 80), phone = clip(b.phone, 30), address = clip(b.address, 160);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(hour >= 0 && hour < 24)) return json(400, { error: "bad_time" });
  if (name.length < 2 || !e164(phone) || address.length < 5) return json(400, { error: "missing_details" });
  if (b.agreed !== true) return json(400, { error: "terms_not_accepted" });

  try {
    // Is the time still offered?
    const { day: today, hour: nowH } = nowLocal();
    if (day < today || (day === today && hour - 1 <= nowH)) return json(409, { error: "taken" });
    const wd = new Date(day + "T12:00:00Z").getUTCDay();
    const [[weekly], blocks] = await Promise.all([
      sb(`weekly_hours?select=hours&weekday=eq.${wd}`),
      sb(`blocks?select=hour&day=eq.${day}`),
    ]);
    if (!weekly || !weekly.hours.includes(hour) || blocks.some(x => x.hour == null || x.hour === hour)) return json(409, { error: "taken" });

    const ref = "CC-" + Date.now().toString(36).slice(-5).toUpperCase();
    const quoted = Number.isFinite(+b.price) && b.price !== null && b.price !== "" ? Math.round(+b.price) : null;
    const row = {
      ref, day, hour, name, phone, address,
      service: clip(b.service, 120) || "Detail", size: clip(b.size, 20), quoted,
      email: clip(b.email, 120) || null, town: clip(b.town, 60), vehicle: clip(b.vehicle, 80) || null, notes: clip(b.notes, 600) || null,
      terms_version: clip(b.terms_version, 20) || null, terms_accepted_at: new Date().toISOString(),
    };
    try { await sb("bookings", { method: "POST", body: JSON.stringify(row) }); }
    catch (e) { if (e.status === 409 || /duplicate|unique/i.test(e.message)) return json(409, { error: "taken" }); throw e; }

    const when = `${dayLabel(day)} at ${hourLabel(hour)}`, price = quoted == null ? "quote after a quick look" : "$" + quoted;
    const toCustomer = `Crisp Coat: you're booked! ${row.service}, ${when} at ${address}. Price: ${price}. Ref ${ref}. We'll text to confirm. Reply here with any questions.`;
    const toShop = `New booking ${ref}: ${name} ${phone}\n${row.service}${row.vehicle ? " · " + row.vehicle : ""}\n${when}\n${address}${row.town ? ", " + row.town : ""}\n${price}${row.notes ? "\nNotes: " + row.notes : ""}`;
    const owners = (process.env.OWNER_PHONES || "").split(",").map(s => s.trim()).filter(Boolean);
    const sent = await Promise.all([sms(phone, toCustomer), ...owners.map(p => sms(p, toShop))]);
    return json(200, { ok: true, ref, texted: sent[0].ok });
  } catch (e) { return json(500, { error: "server" }); }
};
