# Crisp Coat: hosted site with real booking, texts and staff login

Everything here is built and tested against stand-ins (Nov 22, 2026). Going live needs the accounts below.

## What's in here
| Path | What it does |
|---|---|
| `site/index.html` | The public site. Booking reads open times from `/api/slots` and books with `/api/book`. Made from `../index.html` by `make_hosted.py`. |
| `site/staff.html` | Staff login (email + password) and dashboard: Appointments, Leads, Income (weeks/months, by service), Availability (weekly hours, days off, blocked times). Open it at `/staff`. |
| `site/config.js` | Supabase URL + public anon key for the staff page (fill in at go-live). |
| `netlify/functions/book.js` | Checks the time is still open, saves the booking, texts the customer and the shop. |
| `netlify/functions/slots.js` | Open start times for the next 21 days. Never returns customer details. |
| `supabase/schema.sql` | Tables, one-booking-per-time rule, and the staff-only security rules. |

## Who can see what
- Customers never log in. They can only ask for open times and send a booking.
- Only emails listed in the `staff` table can open the dashboard. A login that isn't on the list is signed straight back out.
- Public sign-up is turned OFF in Supabase, so nobody can make their own account. Staff accounts are added by the owner.

## Go-live checklist
1. **GitHub**: create an empty repo (e.g. `crisp-coat-site`) and attach it to this Claude project. Claude pushes this folder plus the site's videos and images.
2. **Supabase** (free): new project. In SQL editor run `supabase/schema.sql`.
   - Authentication > Providers > Email: turn OFF "Allow new users to sign up".
   - Authentication > Users > Add user, for each staff member (email + password).
   - Table `staff`: add a row per staff email (role `owner` for Anthny).
   - Settings > API: copy the Project URL, the `anon` key (goes in `site/config.js`, it is public by design) and the `service_role` key (secret, goes in Netlify only).
3. **Twilio**: buy a local number. Register it for US business texting (A2P 10DLC, sole proprietor or standard brand; about $20 one time, approval takes days to a couple of weeks). Copy Account SID, Auth Token and the number.
4. **Netlify** (free): import the GitHub repo. Site settings > Environment variables:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` (the Twilio number, like +19515550000)
   - `OWNER_PHONES` (the phone(s) that get a text for every booking, comma separated)
   - `TZ_NAME` = `America/Los_Angeles`
5. **Domain**: point the domain at Netlify (Domain settings). HTTPS is automatic.
6. **Test** one booking with your own phone, check both texts arrive and it shows in `/staff`, then cancel it there.

Never paste the `service_role` key or Twilio token into the site files or a chat message: they go only in Netlify's environment variables.

## Rebuilding the public page after site edits
`python3 make_hosted.py ../index.html site/index.html`, then copy `../spin`, `../frames`, `../img` next to it (see `assemble.sh`).
