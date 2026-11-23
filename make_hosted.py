# Turns the Claude-artifact version of the site (crisp-coat/index.html) into the hosted version:
# booking talks to /api/slots and /api/book (Netlify functions) instead of the artifact db.
# Usage: python3 make_hosted.py ../index.html site/index.html
import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src).read()

def R(a, b):
    global s
    assert s.count(a) == 1, a[:80]
    s = s.replace(a, b)

# 1) send(): POST to the booking function
i = s.index('  let saved = false, heldSlot = null;\n  if (db) {')
j = s.index('  state.ref = ref; state.saved = saved; renderBooking();')
s = s[:i] + '''  let saved = false;
  try {
    const r = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      date: state.date, hour: state.hour, service: serviceLabel(), size: state.size, price: total(), name: state.name, phone: state.phone,
      email: state.email, address: state.address, town: state.town, vehicle: state.vehicle, notes: state.notes, agreed: !!state.agree, terms_version: "2026-11-23", website: state.website || "" }) });
    const res = await r.json().catch(() => ({}));
    if (r.status === 409) {
      taken.add(slot); state.hour = null; state.step = 1; renderBooking(); loadSlots();
      $("#pane").insertAdjacentHTML("afterbegin", '<p class="err">Someone just took that time. Pick another one.</p>'); return;
    }
    if (r.ok && res.ref) { saved = true; state.ref = res.ref; state.saved = true; renderBooking(); $("#book").scrollIntoView({ block: "start", behavior: "smooth" }); return; }
  } catch (e) { saved = false; }
''' + s[j:]
R("const ref = \"CC-\" + Date.now().toString(36).slice(-5).toUpperCase();\n", "const ref = \"CC-\" + Date.now().toString(36).slice(-5).toUpperCase();\n")

# 2) startup: open times from /api/slots; no artifact db or owner inbox
i = s.index('renderPackages(); renderBooking();\n(async () => {')
j = s.index('})();', i) + len('})();')
s = s[:i] + '''renderPackages(); renderBooking();
async function loadSlots() {
  try {
    const { days } = await (await fetch("/api/slots", { cache: "no-store" })).json();
    const t = new Set();
    Object.entries(days).forEach(([k, open]) => SLOTS.forEach(h => { if (!open.includes(h)) t.add(k + "T" + h); }));
    const now = new Date();
    for (let i = 0; i < 21; i++) { const k = dkey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)); if (!(k in days)) SLOTS.forEach(h => t.add(k + "T" + h)); }
    taken = t; if (!state.ref && state.step === 1) renderBooking();
  } catch (e) {}
}
loadSlots(); setInterval(() => { if (!document.hidden) loadSlots(); }, 60000);''' + s[j:]

# 3) confirmation copy now that both phones get a text
R("Christopher will text <span class=\"num\">${esc(state.phone)}</span> to confirm.", "We just texted <span class=\"num\">${esc(state.phone)}</span> the details. Christopher will text to confirm.")
R("This preview couldn't save your request by itself.", "We couldn't save your request just now.")
# 4) staff link in the footer area replaces the in-page owner inbox
R('<div id="owner" hidden style="margin-top:56px">', '<div id="owner" hidden style="display:none">')
R('<a class="staff-link" href="#staff">Staff</a>', '<a class="staff-link" href="/staff" rel="nofollow">Staff</a>')
# the in-page staff view runs on the Claude artifact db; the hosted site uses /staff instead
R('<section class="stf" id="staff" hidden', '<section class="stf" id="staff" hidden style="display:none"')
open(out, "w").write(s)
print("ok", len(s))
