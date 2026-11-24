// GET /api/slots -> { days: { "2026-11-23": [8,10,...], ... } } open start times for the next HORIZON days (about 6 months).
const HORIZON = 183; // must match HORIZON in the booking page
// Returns no customer details, only which times are free.
const { sb, nowLocal, json } = require("./_lib");

exports.handler = async () => {
  try {
    const { day: today, hour: nowH } = nowLocal();
    const end = new Date(today + "T12:00:00Z"); end.setUTCDate(end.getUTCDate() + HORIZON);
    const last = end.toISOString().slice(0, 10);
    const [weekly, blocks, booked] = await Promise.all([
      sb("weekly_hours?select=weekday,hours"),
      sb(`blocks?select=day,hour&day=gte.${today}&day=lte.${last}`),
      sb(`bookings?select=day,hour&status=neq.cancelled&day=gte.${today}&day=lte.${last}`),
    ]);
    const hoursOf = Object.fromEntries(weekly.map(w => [w.weekday, w.hours]));
    const dayBlocked = new Set(blocks.filter(b => b.hour == null).map(b => b.day));
    const taken = new Set([...blocks.filter(b => b.hour != null), ...booked].map(b => b.day + "T" + b.hour));
    const days = {};
    for (let i = 0; i <= HORIZON; i++) {
      const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      if (dayBlocked.has(key)) { days[key] = []; continue; }
      days[key] = (hoursOf[d.getUTCDay()] || []).filter(h => !taken.has(key + "T" + h) && !(i === 0 && h - 1 <= nowH)).sort((a, b) => a - b);
    }
    return json(200, { days });
  } catch (e) { return json(500, { error: "slots_unavailable" }); }
};
