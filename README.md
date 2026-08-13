# Npontu Hotel Reservation & Event Management — Web App (v1)

First increment: a shared login page, and two role-based dashboards
(**Front Desk** and **Manager**) built on the Phase 4-6 schema and Phase 6
programming layer, wired up for what the Phase 6 GRANT statements say each
role can see and do.

## How it's put together

```
backend/    Flask REST API only — no HTML rendering, just JSON
frontend/   Plain HTML/CSS/JS — talks to the API purely over fetch()
```

**The frontend doesn't know Flask exists.** Every page loads `js/api.js`,
which is the *only* file that knows the API's base URL. It calls
`fetch()` with `credentials: 'include'` so the session cookie rides along.
If the backend ever moves to a different host, or gets rewritten in
something other than Flask, nothing in `frontend/` changes except one line
in `api.js` (`API_BASE`) — that's what "independent of the backend" means
here.

**Same login page, different data.** `index.html` posts to
`/api/auth/login`. The server decides the role (it's a property of the
account, not something the user picks) and the frontend just redirects to
`frontdesk.html` or `manager.html` based on what the server returned. Each
of those pages calls `/api/auth/me` on load and bounces back to the login
page if the session's role doesn't match.

**Permissions are enforced twice.** Once in Flask (`@role_required`
decorators, e.g. only a Manager can hit `/api/staff`), and again for real
at the database layer: once someone logs in, every query for that session
runs through the *actual* `hotel_front_desk` or `hotel_manager` MySQL user
from Phase 6 — not a shared app account. So if the Flask code ever mis-checks a
permission, the Phase 6 GRANTs are still the backstop. This felt like
the right way to build toward Phase 7 (security roles).

## One thing added beyond the graded schema

The Phase 4-6 tables have no username/password anywhere, and no
"Manager" role at all (only the `hotel_manager` *DB* role). To have a
working login screen, `backend/sql/03_app_auth.sql` adds one small table,
`APP_USER`, mapping a login to Front Desk/Manager and (for front desk
users) to their `StaffID`. It's kept separate from the graded schema on
purpose — see the comments in that file.

## Setup

1. **Point it at your existing database.** You already have
   `HotelReservationSystem` populated from Phases 4-6 — you don't need to
   re-run `01_schema.sql`/seed data unless you're starting fresh (if you
   are, run `01_schema.sql`, then `05_seed_sample_data.sql` for a handful
   of test rows).

2. **Add the programming layer objects this app calls**, if you don't
   already have them exactly as named here:
   ```
   mysql -u root -p HotelReservationSystem < backend/sql/02_views_procs_triggers.sql
   ```

3. **Add the app's login table**:
   ```
   mysql -u root -p HotelReservationSystem < backend/sql/03_app_auth.sql
   ```

4. **Create the three MySQL users** (edit the passwords first!):
   ```
   mysql -u root -p < backend/sql/04_roles_and_grants.sql
   ```

5. **Backend setup**:
   ```
   cd backend
   pip install -r requirements.txt
   cp .env.example .env        # then fill in real DB passwords
   python seed_users.py        # creates the two demo logins
   python app.py                # http://localhost:5000
   ```
   `app.py` also serves `frontend/` at `/` for convenience during
   development, so opening `http://localhost:5000` gets you straight to
   the login page.

## Demo logins (change immediately — see `seed_users.py`)

| Username    | Password       | Role        |
|-------------|----------------|-------------|
| `frontdesk` | `frontdesk123` | Front Desk  |
| `manager`   | `manager123`   | Manager     |

## What each role can do here

**Front Desk** (matches the Phase 6 `hotel_front_desk` grants): view
rooms and toggle status, register/update customers, create and check out
reservations, read-only conference halls/restaurants/events.

**Manager** (matches `hotel_manager`'s `ALL PRIVILEGES`): everything above
plus full room editing, staff management, hall/restaurant/event creation,
invoice updates, restaurant orders, and the four Phase 6 analytics reports
(room inventory, front desk workload, hall utilisation, outstanding
invoices).

## Known gaps for the next increment

- No Housekeeping login view yet (Phase 1 named it as a role; this pass
  covers Front Desk + Manager per your request).
- Password reset / account management UI isn't built — accounts are
  seeded via `seed_users.py` for now.
- The 14-entity Data Dictionary redesign isn't reflected here — this app
  is built against the implemented 11-table schema, consistent with how
  that divergence was flagged in the Phase 6 slides.
