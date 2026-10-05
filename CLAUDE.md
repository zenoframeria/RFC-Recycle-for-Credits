# CLAUDE.md

Guidance for Claude Code in this repo. **Full history** (every phase/round, testing notes, tried-and-rejected designs, old decisions) is in `docs/history.md` — read the relevant section there when you need the why behind something. If the two disagree, this file wins.

The project owner is a beginner learning as we go: explain things simply (casual Thai), one step at a time, and don't build ahead of what they asked for.

## What this is

"ขยะแลกแต้ม" (trash for points) — a school recycling app. Students weigh their sorted recyclables at an unattended scale, photograph the evidence, submit it in the app, and an admin (student council) approves it for points. Points can be shown off on a Top 10 leaderboard and (later) redeemed in a Shop. Plain HTML/JS pages, no framework/router; **Supabase** is the whole backend (Postgres + Auth + Storage + Realtime, region ap-southeast-1). Hosted on Vercel.

## Product model (current)

- **Individual**, not room-vs-room. The old class-competition / energy-bar / level / piece-counting / bag-size / OCR-daily-code ideas are dead — don't build toward them.
- **Monthly collection rounds** (~1 week open per month) — planned, not built yet (no `collection_rounds` table; see "Deferred").
- **1 point = 0.1 THB** of real recyclable value; `points = round(weight_kg × point_value)`.
- **No auto-approve, ever.** Every submission gets a human admin look, whatever the weight. Never add a trigger/logic that moves a row to `approved` automatically.
- Scale: ~2,628 students (only ม.1–6 expected to use it) + ~30 admins (individual council logins). Free-tier Supabase; the real constraint is photo storage.

## Running it

- Once: `npm install`. While working: `npm run dev` (Tailwind watchers → `css/build/*.css`) + any static server; the owner uses VS Code **Go Live** (`127.0.0.1:5500`).
- Vercel runs `npm run build` on deploy (`vercel.json`). `css/build/` is generated and gitignored — never edit it.
- No linter, no test suite. Testing = the owner checks on Go Live, then the Vercel preview, then a real phone.
- `.vercelignore` keeps `*.md`, `docs/`, `sql/`, `Screenshot/`, `.claude/`, `.superpowers/` off Vercel.

## Pages and files

| Page | JS | Notes |
|---|---|---|
| `index.html` | inline | redirects by session |
| `login-student.html` / `login-admin.html` | `auth.js` | `body[data-role]` picks role + accent colour |
| `dashboard.html` (Home) | `dashboard.js` | points ring (fills toward a display-only 50,000 cap), Launch Pad, Recent Activity (pending / rejected last 7 days), notification bell, nickname edit, "แจ้งปัญหา" button → Google Form |
| `scan.html` | `scan.js` | submit: category, weight, photo, suggested points |
| `shop.html` | `shop.js` | catalog from `shop_items`; real redeem via `redeem_item()` after a confirm pop-up (final — no refund); "My Rewards" receipts (`R-0042` = `redemptions.id`); "Got an idea?" card → same Google Form with the reward topic pre-ticked |
| `rank.html` | `rank.js` | Top 10 podium + list, `#rank-own` when you're outside the top 10. Ranks by points **earned** (sum of approved submissions), so redeeming never drops rank |
| `me.html` | `me.js` | account info + logout |
| `admin-review.html` | `admin-review.js`, `admin-shop.js`, `admin-pickups.js` | tabs: Review (approve/reject), Prices, Shop (catalog CRUD), Pickups (type a receipt code → "มอบแล้ว") |

Shared JS:
- `supabase-client.js` — creates the global `supabaseClient` with the real URL + publishable key. Already wired; don't recreate it or ask for the key.
- `session-guard.js` → `requireStudentSession()`; `admin-session-guard.js` → `requireAdminSession()` (also confirms `profiles.role` from the DB). Both bounce to the matching login page.
- `nav-common.js` — `showToast()`, `compressImage()` (max 800px wide, JPEG 0.7 — a **hard requirement** before any upload), `displayName()` (nickname, else first name without Thai title), `escapeHtml()`, `countUp()`, `renderSidebarUser()`/`renderSidebarPoints()`, `wireFeedbackButtons()` (any `[data-open-feedback]` opens the feedback form).

Report / feedback = a **Google Form owned by the student council** (responses in their Google Sheet), not Supabase — no `reports` table, no photo storage. The link pre-fills student ID / name / classroom from `currentUser` via the form's `entry.*` field ids (constants in `nav-common.js`). If the council renames the reward option in the form, update `FEEDBACK_TOPIC_REWARD` or the Shop button stops pre-ticking it. The form must stay published as "Anyone with the link" with no email collection / file upload, or students get a Google sign-in wall.

## Auth

- Supabase Auth needs an email, so an ID maps to a fake address: `{id}@student.kyt.local` / `{id}@admin.kyt.local`. Never emailed. **"Confirm email" must stay OFF** in the Supabase dashboard, or every signup fails silently.
- Signup: browser calls `check_roster` / `check_admin_roster` (returns only `{ found }`) for a friendly error, then `auth.signUp`, then the RPC `create_my_profile()` — which builds the profile **on the server** from the caller's email domain + the roster. The browser can't insert into `profiles`.
- Login writes `localStorage['currentUser']` = `{ role, id, name, nickname, studentId, classroom, pointsTotal }`. Treat it as a display cache only — anyone can edit it in devtools. Security lives in RLS / SECURITY DEFINER functions.
- No in-app password reset (no real email). The council resets it in the SQL editor: `update auth.users set encrypted_password = extensions.crypt('NEW_PASSWORD', extensions.gen_salt('bf')) where email = '12345@student.kyt.local';`

## Database (already live — build against it, don't re-create)

- `student_roster`, `admin_roster` — allowlists (`student_id`, `name`, `class_room`). Admin-only via RLS; never query them from the client.
- `profiles` — `id` (= `auth.users.id`), `student_id`, `name`, `role` ('student'|'admin'), `class_room`, `points_total`, `nickname` (≤ 30 chars, DB check constraint), `notif_seen_at`, `notif_cleared_at`. Students can SELECT their own row and UPDATE **only** `nickname` (column-level grant).
- `waste_categories` — `name`, `point_value` (points per kg). Names are shown as-is from the DB; admins edit prices in the Prices tab.
- `submissions` — `user_id`, `waste_category_id`, `weight_kg`, `photo_url` (Storage path), `status` ('pending'|'approved'|'rejected'), `point_value_snapshot`, `points_awarded`, `reviewed_by`, `reviewed_at`, `comment`. Students INSERT their own rows only with `status = 'pending'` and read their own; admins read/update all. In the Realtime publication.
- `shop_items` — `name`, `section` (cert/stationery/limited), `cost`, `description`, `stock`, `stock_max`, `opens_on`, `image_path`. Everyone logged in reads; admins write. The admin form asks only for the total when adding (stock starts = total); "remaining" shows only when editing.
- `redemptions` (`sql/shop-redemption.sql`) — `user_id`, `shop_item_id`, `item_name`/`item_section`/`cost` (copied at redeem time), `status` ('pending'|'picked_up'), `picked_up_by`, `picked_up_at`. SELECT only from the browser (own rows / admins all); every write goes through the two functions below. Rules: cert + limited one per student, stationery unlimited; points + stock drop on redeem; no cancel/refund.

Functions: `is_admin()`, `is_student()` (SECURITY DEFINER role checks — use these in policies, never an inline subquery on `profiles`), `check_roster()`, `check_admin_roster()`, `create_my_profile()`, `approve_submission(id)` (locks the row, checks `pending`, awards points atomically), `redeem_item(item_id)` (locks item then profile, checks every rule, deducts + writes the receipt), `mark_redemption_picked_up(id)` (only flips `pending`), `leaderboard_top10()` / `my_rank()` (rank by sum of approved `points_awarded`, not `points_total`), `mark_notifications_seen()`, `clear_notifications()`.

Storage:
- `submissions` bucket — **private**, 5MB, jpeg/png. Path `{user_id}/{submission_id}.jpg` (id from `crypto.randomUUID()`). Upload needs a student profile; admins read via signed URLs. **Photo is deleted on approve, kept on reject** (for disputes).
- `shop-items` bucket — **public** read, admin-only write.

## Rules that bite

- **SQL is hand-run by the owner** in the Supabase SQL editor; there's no DB access from here. Put migrations in `sql/*.sql`, make them idempotent, and say clearly what must run and when.
- **New tables need an explicit `GRANT`** to `authenticated` — this project doesn't auto-grant.
- RLS picks rows, not columns: a policy like `auth.uid() = id` allows every column. Use column-level grants or a SECURITY DEFINER function for sensitive writes.
- To tighten access without touching an existing policy, add an `as restrictive` policy (it's AND-ed with the permissive ones).
- Concurrency: admin actions must be guarded in the DB (`... where status = 'pending'`), not just the UI — 30 admins share the feed.
- Render live data with `textContent`, or `escapeHtml()` before `innerHTML`.
- Order matters when code and DB change together: e.g. turn on a Supabase setting / drop a policy only **after** the code that needs it is live, or production breaks.
- Testing student + admin at once: use a normal window + an Incognito window (same-origin windows share one Supabase session). Opening `admin-review.html` as a student signs you out — that's the guard working.

## Styling

- Each page links one built bundle: `css/build/student.css` (Home/Shop/Rank/Scan/Me), `admin.css`, `login.css`, built from `css/entry-*.css`. Edit the sources in `css/`: `tokens.css` (colours, fonts, `--accent` blue → red under `body[data-role="admin"]`, reduced-motion rule), `components.css`, `dashboard.css` (all student pages), `admin.css`, `login.css`, `layout.css` (sidebar shell), `motion.css`. Cascade layers: tokens → base; legacy CSS → components; Tailwind utilities win. No Tailwind preflight.
- Look: **"real paper" scrapbook** — 3px corners, flat paper shadows, washi tape, rubber stamps, torn edges, ticket notches. Match it; don't introduce a new visual language. Many motifs were tried and rejected — check `docs/history.md` before re-adding one.
- Mobile-first: < 768px a centred phone card with the bottom nav docked; from `md` (768) a left sidebar (icon-only at md, labels from `lg` 1024); page classes `page-home/shop/rank/scan/me`; ≥ 1600px content zooms 1.18. Login pages: full-bleed from `md`, form centred at 460px.
- Copy is bilingual on purpose: English headings/game words, Thai descriptions/instructions.
- DOM hooks are plain ids (`getElementById` + `textContent`/`innerHTML`) — keep HTML ids and JS in sync.

## Workflow

- Code / HTML / CSS / JS / SQL changes: feature branch → owner tests (Go Live → Vercel preview → real phone) → owner opens the PR from the pushed-branch link (no `gh` CLI here) and merges. Never merge yourself.
- Docs-only / tiny config changes (`CLAUDE.md`, `.gitignore`): commit straight to `main`; push only when the owner says.
- Bigger features: brainstorm one question at a time with a recommendation → approve → build. The owner likes trying UI variants live in Chrome together.

## Current state and open work

**Paused — branch `ghost-lockdown`** (pushed, not tested, not merged, no SQL run). Waiting for the friend who pen-tested the site to weigh in on CAPTCHA. Contents: `sql/ghost-read-lockdown.sql` (ghost accounts can't read prices/shop/Top 10), student guard confirms `profiles.role` from the DB, Cloudflare Turnstile on both login pages (`js/auth.js` still has Cloudflare's **test** site key). CAPTCHA's main job is stopping password guessing (guessable IDs + 6-char passwords), then ghost-account spam. Recommended widget: **Managed**. Rollout: create Turnstile widget (hostnames: production domain, `localhost`, `127.0.0.1`, preview hostnames) → real site key in `auth.js` → test → merge → **then** paste the secret key into Supabase → Authentication → Bot and Abuse Protection and switch it on.

Security notes:
- Ghost accounts (direct `auth.signUp` from devtools, no profile) can still be created; they can't upload, submit, or touch admin data.
- `submissions.point_value_snapshot` is sent by the browser and trusted by `approve_submission()` — fix planned (set it on the server). Today only the admin's eyeball on suggested points catches an inflated price.
- Anyone who knows a classmate's ID can sign up as them first; fix by deleting that auth user so the real student can sign up.
- Before launch: Supabase auth rate limits are per IP (signup ~30 / 5 min) — raise them (Authentication → Rate Limits) if a class signs up together on school Wi-Fi.

Deferred on purpose — don't build unless asked:
- Time-of-day gating (10:00–17:00) and the round-dates banner — waits for `collection_rounds` to be designed. Submissions are allowed any time for now.
- Audit view (bin weight vs claimed) — the owner reconciles manually.
- Bulk approve, cleanup of old rejected photos, expiring receipts nobody picked up.
- Minimum weight 0.05 kg is enforced client-side only.

Open questions (waiting on the student council president — don't guess): do points reset each round; what rewards and budget; is the price unit really THB/kg; how often a buyer collects. Undecided: does Rank #1 earn a real certificate; is "1 submission per category per day" still needed.

Decided, not open: no battery-collection box; login stays student ID (not class + seat number); Home stays as it is — no "next reward" card, no approved-kg stat, no points-ring rework (dropped 2026-10-05).
