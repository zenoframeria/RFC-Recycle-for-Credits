# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"ขยะแลกแต้ม" (roughly "trash for points") is a static front-end prototype for a school recycling gamification app: students scan/log recycling, earn points, level up, and compete on a class leaderboard against a school-wide energy goal. There is no backend, no build step, and no package manager — it's plain HTML/CSS/JS served directly from the filesystem.

**Note:** the *target* product model changed after this mock UI was built (see "## Product model (current)" below, further down this file) — it's now solo points + monthly collection rounds, not room-vs-room competition. The mock dashboard described in this section still reflects the old room-competition concept and hasn't been rebuilt yet; that's Phase 6. Don't take the description in this section as the current target design — read the Product model section for that.

## Running it

There is no build/dev/test command. Open the HTML files directly in a browser, or serve the directory with any static file server (e.g. `npx serve` or Python's `http.server`) if `file://` restrictions cause issues. There is no linter or test suite configured.

## Architecture

**Pages** (each is a standalone HTML entry point, no router/SPA framework):
- `login-student.html` / `login-admin.html` — role-specific login forms. Body has `data-role="student"` or `data-role="admin"`, which drives the accent color via CSS (see tokens.css) and which fake account list is checked.
- `dashboard.html` — the post-login student home screen (points ring, stats, class leaderboard, school-wide "energy" progress). There is no admin dashboard yet — admin login shows a "coming soon" message instead of navigating anywhere.

**Auth/data flow (all fake, no backend):**
- `js/data.js` holds `FAKE_ACCOUNTS` (plaintext id/password per role) and `FAKE_DASHBOARD` (the numbers rendered on the dashboard). This is the single place to edit to change demo data — treat it as a stand-in for a future API/database.
- `js/auth.js` runs on both login pages. It validates the typed id/password against `FAKE_ACCOUNTS[role]`, and on success writes `{ role, ...account }` to `localStorage['currentUser']`. Student logins redirect to `dashboard.html`; admin logins swap the login card's innerHTML for a "coming soon" message in place.
- `js/dashboard.js` (and `js/shop.js`, `js/rank.js`, `js/me.js` for the other logged-in pages) verify the session via the shared `requireStudentSession()` in `js/session-guard.js` — this checks both `currentUser` in `localStorage` **and** a live `supabase.auth.getSession()`, bouncing to `login-student.html` if either is missing/invalid. `dashboard.js` then renders every dashboard section (progress ring, stat tiles, leaderboard, energy bar) from `FAKE_DASHBOARD`. The bottom nav's Home/Shop/Rank/Me tabs are real links to `dashboard.html`/`shop.html`/`rank.html`/`me.html`; only the Scan tab still shows a "coming soon" toast (via the shared `wireScanFab()`/`showToast()` in `js/nav-common.js`), since Scan & Launch is still Phase 4.
- There is no real security: passwords are plaintext in a client-side JS file. This is explicitly called out in `data.js` and is only acceptable because this is a local prototype — do not carry this pattern into any real backend integration.

**Styling (`css/`), loaded in this cascade order on every page — `tokens.css` → `components.css` → page-specific file:**
- `tokens.css` defines the shared design tokens: the "SB" color palette as CSS custom properties, font stacks (a decorative display/script pairing plus separate Latin and Thai body fonts — pages mix English UI chrome with Thai copy throughout), and the base page/`.app-shell` background treatment. It also defines the role-based accent swap: `--accent` is blue by default and switches to red when `body[data-role="admin"]` is set — this is how admin vs. student pages get different theming without duplicating CSS.
- `components.css` holds shared, reusable pieces used across multiple pages (buttons, cards, the decorative "tape"/"stamp" scrapbook motifs, form fields).
- `dashboard.css` / `login.css` hold styles specific to their respective page(s).
- The visual design language is a "scrapbook/passport stamp" aesthetic (washi tape strips, rotated stamps, polaroid-style avatar frame) — match this style when adding new UI rather than introducing a different visual language.
- Layout is mobile-first and constrained to a `max-width: 430px` centered `.app-shell` card, matching a phone-sized viewport regardless of actual window size.

## Conventions worth following

- Keep `id`-based DOM hooks (e.g. `#ring-value`, `#war-board`) in sync between the HTML markup and the corresponding render function in the matching `js/*.js` file — rendering is done via direct `getElementById` + `innerHTML`/`textContent`, not a templating system.
- New "coming soon" placeholder features should follow the existing pattern in `dashboard.js` (`showToast(...)`) rather than introducing a new notification mechanism.
- Thai and English text are both used intentionally in the UI (English for section headings/game terms, Thai for descriptions/instructions) — preserve this bilingual pattern in new copy rather than translating everything to one language.

## Backend plan (Supabase) — Phase 2 complete, Phase 3 complete; game model redesigned before Phase 4

This project is moving from fake/local data (`data.js` + `localStorage`) to a real backend on **Supabase** (Postgres + Auth + Storage), region ap-southeast-1 (Singapore). This is a multi-phase migration — **work on one phase at a time only**, even if asked to plan ahead. Do not implement later phases early or guess ahead at schema/logic for features that haven't been scoped yet in this file.

**The full product rationale (why, not just what) lives in `rfc-roadmap.md` in the project root — read it if you need the reasoning behind any of the numbers below. This file (CLAUDE.md) has the condensed engineering spec.**

**IMPORTANT — game model changed after Phase 2 shipped, before Phase 4 was ever built:** the original room-vs-room, always-open, piece-counting model described in the old dashboard mockups is **dead**. Do not build toward it. Current model:
- **Individual, not room-based.** Each student accumulates and redeems their own points. No class leaderboard/room-war concept.
- **Monthly collection rounds**, not always-open. Roughly 1 week open per month.
- **Points are pegged to real recyclable value:** 1 point = 0.1 THB. This is the anchor that keeps the reward budget sustainable — total points ever awarded should equal the real value of waste actually collected.

**Phase order:**
1. ✅ **Supabase project setup + schema** — DONE.
2. ✅ **Wire `auth.js` to real Supabase Auth** — DONE, both roles, tested. See "Admin roster" section below — the self-signup security gap that existed here has **already been fixed and tested**, not just planned.
3. ✅ **Nav + header widgets — DONE**, both rounds. Round 3a (4-tab restyle, notification bell, report button) and Round 3b (Home/Shop/Rank/Me routed to real pages, session/localStorage bug fixed, 5-tab nav with the FAB and a "Me" tab restored) — see status notes further down. Scan button still shows "coming soon" — Scan & Launch is still Phase 4.
4. **Scan & Launch flow — scope is much bigger than originally planned.** Not just "photo + pick category" anymore. See "Submission flow" below for the real spec (weight input, 3-element photo, time-gating, points suggestion — **no auto-approve**). Do not start this phase until explicitly asked to, and re-read this section fresh when you do — it changed significantly from any earlier summary.
5. Admin console: the approve/reject feed for pending submissions (the actual review mechanism — every submission needs a human look), an audit view (compare physical bin weight at round-end to claimed totals), and a UI for admins to edit `waste_categories.point_value` (market prices change monthly).
6. Replace `FAKE_DASHBOARD` in `data.js` with real Supabase queries: individual points/history (not room ranking), Top 10 leaderboard only (not full rankings — avoids discouraging students with low points).

**Scale context:** ~2,628 students across all grade levels (only secondary/ม.1-6 students are expected to actually sign up and use the app day-to-day) + ~30 admin accounts (student council, individual logins, not shared). Free tier Supabase (500MB DB, 1GB storage, 50k MAU) comfortably covers this — the real constraint is photo storage/egress. **Any Scan & Launch implementation must compress images client-side before upload** (resize to ~800px width, ~70% quality) — this is a hard requirement, not an optimization to add later.

**Nav layout (locked, updated in Round 3b):**
- Bottom nav, 5 items: `Home | Shop | Scan (large center FAB) | Rank | Me` — the "Me" tab was re-added in Round 3b to restore left/right symmetry (2 left, FAB center, 2 right), and Scan's raised/highlighted FAB styling (dropped "for now" in Round 3a) was restored alongside it.
- Notifications stay on a header icon on the Home page (unchanged since Round 3a).
- **Profile/logout is back, as the "Me" tab** — not moved to a header icon the way the pre-Round-3a plan originally described. `me.html` is a placeholder page whose only working feature is logout (`supabase.auth.signOut()` + clear `localStorage['currentUser']` + redirect to `login-student.html`); it also displays the student's name/ID/classroom/points from `currentUser`. The avatar shown in the dashboard header is still a static image, not a clickable menu — "Me" is reached only via the bottom nav tab.
- Layout is symmetric (2 left, FAB center, 2 right) again now that Me is back — this replaces the "asymmetric, 2 left/1 right" note from Round 3a.

**Implementation note (Phase 3, Round 3a) — three deviations from the "locked" spec above, all explicitly requested for that round:**
- The Scan tab rendered as a plain equal-weight button in Round 3a, not the large center FAB. **Reverted in Round 3b** — the FAB styling is restored now that the nav is 5-symmetric again (see Nav layout above).
- Report-a-problem ended up as a **floating pill button, bottom-left of the screen** (opens a modal), not a header icon as this section originally said. This wasn't a mistake — it was explicitly requested this way for Round 3a, and is still the current implementation (untouched by Round 3b).
- **Profile/logout was cut entirely in Round 3a, not moved to a header icon.** **Reverted in Round 3b** — see the "Me" tab in Nav layout above.
- Notifications did land as a header icon (bell, with a dropdown panel), matching the spec as written. Unchanged by Round 3b.

**Points system (4 fixed waste categories, locked):**

| Category | Real price (THB/kg) | Points/kg (×10) |
|---|---|---|
| Paper (all types combined, no sub-split) | 2 | 20 |
| Clear PET plastic bottles | 15 | 150 |
| Aluminum cans | 50 | 500 |
| Mixed glass bottles | 1 | 10 |

Formula: `points = weight_kg × waste_categories.point_value`. A student can submit multiple categories in one visit — each category is weighed and photographed separately, i.e. **one `submissions` row per category per weighing**, same as the existing one-row-per-category schema already supports. No schema change needed for the multi-category case itself.

**Submission flow (Scan & Launch — the real spec for Phase 4):**
1. Home shows a banner with the current round's open dates (monthly, ~1 week).
2. Student self-weighs their sorted waste on a physical scale at one of 2 unattended collection points.
3. **One photo must show all three of:** the scale's digital readout, that day's dated sticker (admins post a new one each morning of an open round — prevents reusing an old photo), and the student's ID card (or handwritten name + student_id if no card).
4. Physically puts the waste in the bin.
5. Student types the weight shown on the scale into the app themselves (not OCR'd — trust + later end-of-round audit is the control, not real-time verification), picks the category. The system computes a *suggested* point value (`weight_kg × point_value`) to show in the admin feed, and creates the submission with `status = 'pending'`.

**No auto-approve, ever — this was tried in an earlier draft of this plan and explicitly reversed.** Every submission needs a human admin to look at the photo and approve/reject via the feed, no matter the weight. This is unchanged from the original Phase 1-2 design (`submissions` INSERT policy already requires `status = 'pending'` at insert time, and that's correct — do not add any trigger or logic that moves a row to `approved` automatically). If you see any earlier note, draft, or prompt referencing "auto-approve" or a weight "cap" that bypasses admin review, it's stale — disregard it.

**Time-gating:** submissions window is 10:00–17:00, every day during an open round, **Asia/Bangkok (UTC+7)**. This must be checked server-side (a Postgres function checking `now()`), never trusted from client-side JS — a student can freely change their device clock to fool a client-side check. Supabase stores timestamps in UTC by default; convert correctly.

**Explicitly retired — do not build these, they belonged to the old model:** piece-counting, small/medium/large bag-size tiers, an in-app daily code + OCR auto-check system. Also unresolved: whether "1 submission per category per day" is still needed as a rule now that there's a scale + ID photo + audit trail — don't assume it's required, it's an open question (see below).

**Equipment (physical, not software, but relevant context):** digital kitchen scales, 1g precision, 5kg capacity, ~150-300 THB each, 2 needed (one per collection point). Spring/hanging scales are explicitly ruled out (unreadable in photos due to needle wobble).

**Actual schema (already created in Supabase, do not re-create — just build against it):**
- `student_roster`: id (int8 pk), created_at, student_id (text, unique), name (text), class_room (text) — an allowlist imported from the school's official roster. Not a login table. Used to verify a student_id is real before letting someone sign up.
- `profiles`: id (uuid pk, FK → `auth.users.id`, cascade on delete, no default — must be set explicitly to the authenticated user's id on insert), created_at, student_id (text, nullable — only for students), name (text), role (text: 'student' | 'admin'), class_room (text, nullable — students only), points_total (int4, default 0). This is the real account table; extends Supabase Auth.
- `waste_categories`: id (int8 pk), created_at, name (text), point_value (int4).
- `submissions`: id (uuid pk, default `gen_random_uuid()`), created_at, user_id (uuid, FK → profiles.id, cascade on delete, no default), reviewed_by (uuid, FK → profiles.id, set null on delete, nullable, no default), waste_category_id (int8, FK → waste_categories.id, no action on delete), photo_url (text), status (text, default 'pending'), comment (text, nullable), points_awarded (int4, nullable), reviewed_at (timestamptz, nullable).

**RLS is already fully configured on all 4 tables** — do not disable RLS or add overly-broad policies. Key points for writing app code against it:
- A helper function `public.is_admin()` exists (`security definer`, checks `profiles.role = 'admin'` for `auth.uid()`) — use this in any new SQL/policies instead of inline subqueries on `profiles` (avoids RLS self-recursion).
- Students can only SELECT their own `profiles` row and their own `submissions` rows. Admins can SELECT/manage all of both via `is_admin()`.
- Students can INSERT their own `submissions` only with `status = 'pending'` — they cannot self-approve. Only admins can UPDATE `submissions` (approve/reject) or UPDATE `profiles` (e.g. bumping `points_total`).
- `student_roster` is admin-only in every direction — the app should never query it directly from a student-facing page except through whatever signup-verification mechanism gets built in Phase 2 (see open question below).
- `anon` (logged-out) role has zero grants on any table. Every table requires `authenticated` at minimum.

**Approve/reject concurrency rule:** admins can act on a submission independently (no shared account), but once one admin sets `status` away from `pending`, the row must no longer be actionable by anyone else — enforce this at the query/DB level (e.g. `UPDATE ... WHERE status = 'pending'`), not just in the UI, since 30 admins may be viewing the same feed at once.

- `js/supabase-client.js` — creates the Supabase client from the project's URL + publishable key, exposed as a global `supabaseClient` for `auth.js` to use. **This file already exists with real values wired in** — do not recreate it or ask for the URL/key again; just read the existing file if you need to confirm the values.

**Roster-check function (already built, use this for signup):** `public.check_roster(p_student_id text)` — a `security definer` Postgres function, granted `EXECUTE` to both `anon` and `authenticated`. Call it via `supabase.rpc('check_roster', { p_student_id: '...' })` before creating an account. Returns a single row `{ found: boolean, name: text, class_room: text }` for the one student_id passed in — it never exposes the rest of `student_roster`. Do not attempt to `select` from `student_roster` directly from client code; that table has no `anon`/general `authenticated` read access by design, and always will not for students.

**Admin roster — was a SECURITY GAP, now fixed and tested.** The admin signup flow originally had no verification at all (anyone who found `login-admin.html` could self-grant admin access). This has been **fixed and tested working** — do not treat it as still-open.

A `admin_roster` table exists (mirrors `student_roster` but tiny — the ~30 student council members, curated manually by the project owner, not from the school registrar): columns `id` (int8 pk), `created_at`, `student_id` (text, unique — same student_id these people already have in `student_roster`, since admins are students too), `name` (text), `class_room` (text). RLS is admin-only in every direction (via `is_admin()`), same pattern as `student_roster`. Populated with the current council's 30 rows.

A matching function `public.check_admin_roster(p_student_id text)` exists — same shape and security model as `check_roster`, granted `EXECUTE` to `anon` and `authenticated`. Returns `{ found: boolean, name: text }` for one student_id.

**What was fixed:** `auth.js`'s admin signup now calls `check_admin_roster(p_student_id)` before creating an admin account, same pattern as the student flow with `check_roster`. Rejects with a clear Thai error if `found` is false, and uses the returned `name` instead of accepting freeform input. The admin signup and login forms' old "Admin ID" + "Name" fields were collapsed into a single "Student ID" field (both pages relabeled for consistency). Tested: valid council student_id signs up successfully with the correct name auto-filled, a non-council student_id is rejected, login with the new admin account works.

**Considered and explicitly rejected for now:** using ห้อง+เลขที่ (class + seat number) instead of student_id as the login identifier, to reduce how much students need to remember. Decided against for the time being — sticking with student_id as originally built and already tested working. If this is revisited later, note that `student_roster` and `admin_roster` do not currently store seat number (เลขที่); it would need to be added first.

**Phase 3, Round 3a — DONE (dashboard.html, css/dashboard.css, js/dashboard.js only; no Supabase/schema changes):**
- Bottom nav restyled to the 4-tab layout (`Home | Shop | Scan | Rank`), all four visually equal weight — the old 5-icon layout (home/map/scan/rank/**me**) is gone, including the raised/highlighted center-FAB scan button styling and the "me" (profile) icon. All four tabs still just show a "coming soon" toast on click (same `showToast` pattern as before) except Home — **actual routing to real Home/Shop/Rank pages was not done this round**, that's Round 3b.
- Notification bell (header) is now functional: click toggles a dropdown panel (`#notif-panel`) styled to match the scrapbook theme, populated from a hardcoded `FAKE_NOTIFICATIONS` array in `dashboard.js` (mock data only, not from Supabase), and closes on outside click.
- New floating "แจ้งปัญหา" (report) pill button, bottom-left, opens a modal with a textarea + submit button. Submit currently just `console.log`s the message, shows a "ส่งแล้ว" toast, and closes the modal — **no Supabase table or write for reports exists yet**, this is UI-only scaffolding.
- **Browser-verified end-to-end and confirmed passing** (manual click-test done: bell panel opens/closes correctly, report modal opens/submits/shows toast/closes correctly, all 4 nav buttons equal weight, no profile icon present). Round 3a is fully closed.
- **Note:** the 4-tab layout and equal-weight Scan button described in this bullet list were superseded by Round 3b below (5 tabs, FAB restored, Me tab added) — kept here as a historical record of what actually shipped in 3a, not the current state.

**Phase 3, Round 3b — DONE, plus a nav layout change decided alongside it (dashboard.html/css/dashboard.js, new shop/rank/me.html + their js, new js/session-guard.js + js/nav-common.js; no Supabase/schema changes):**
- **Nav layout changed again, deliberately this time:** added a 5th tab "Me" back to the bottom nav to restore left/right symmetry (2 left, FAB center, 2 right): `Home | Shop | Scan (FAB) | Rank | Me`. Scan's raised/highlighted FAB styling (dropped "for now" in Round 3a) is restored now that the nav is symmetric again.
- `me.html` (+ `js/me.js`) — new placeholder page. Shows the student's name/student ID/classroom/points from `currentUser`. Its only working feature is logout: calls `supabase.auth.signOut()`, clears `localStorage['currentUser']`, redirects to `login-student.html` — this fills the gap left when profile/logout was cut entirely in Round 3a.
- `shop.html` (+ `js/shop.js`) and `rank.html` (+ `js/rank.js`) — new placeholder pages, minimal content (a `.coming-soon` message in the existing scrapbook card style), reachable via real navigation. No more "coming soon" toast for Home/Shop/Rank/Me — only Scan still shows the toast (Scan & Launch is still Phase 4). **Superseded by Round 3c below** — these are no longer bare placeholders.
- New shared `js/session-guard.js` (`requireStudentSession()`) — checks both `localStorage['currentUser']` **and** a real `supabase.auth.getSession()`, so a stale/invalid/cleared session bounces to `login-student.html` instead of rendering a broken page. Used by `dashboard.js`, `shop.js`, `rank.js`, `me.js`. This closes the "Known follow-up" session bug noted since Phase 2 (see below).
- New shared `js/nav-common.js` (`showToast()`, `wireScanFab()`) — the toast helper and the Scan-tab click handler, now shared across all four logged-in pages instead of living only inside `dashboard.js`.
- `css/dashboard.css` is now shared by all four logged-in pages (`dashboard.html`, `shop.html`, `rank.html`, `me.html`), not just the dashboard — it holds the nav/FAB/toast styles all of them use, plus a small `.me-info-row` style for the Me page's account-info rows.
- **Browser-verified end-to-end and confirmed passing** (click-tested: all 5 nav items — Home/Shop/Rank/Me navigate to real pages, Scan still shows the toast; FAB styling correct; logout works from Me; expired-session case simulated by clearing the `sb-*-auth-token` localStorage key while leaving `currentUser` in place, and it correctly bounces to `login-student.html`). Round 3b is fully closed.

**Phase 3, Round 3c — DONE (shop.html/rank.html/css/dashboard.css/js/shop.js/js/rank.js only; no Supabase/schema changes):** the bare `.coming-soon` placeholders on Shop and Rank were replaced with a full scrapbook-themed design (built from a Claude Design export, adapted to the existing token system — no new colors/fonts introduced, all values pull from `tokens.css`), then the export folder was deleted once integrated.
- **Shop** now has a real reward catalog: a certificate CTA card (แลกเกียรติบัตร, 1,800 pts), a 2-column stationery grid (6 items, 220–3,200 pts, unlimited stock), and a dashed-border "Limited Edition" section (3 items, one with a live stock bar, one SOLD OUT, one not-yet-open with a future open date) — all defined in a `SHOP_ITEMS` array in `shop.js`. The points balance shown in the header chip **is real** (`currentUser.pointsTotal`, same `profiles.points_total` source `me.html` already reads) — not mock. The catalog itself and the redeem action are still local/mock-only: there is no rewards or redemptions table in Supabase yet (that's Phase 5/6 territory), so clicking "แลกเลย" only updates in-page state (balance, redeemed/sold-out/stock-remaining labels) for the demo and resets on reload — nothing is written back to the account. This mirrors the existing "UI-only scaffolding" pattern already used for the report modal.
- **Rank** now shows a Top 10 leaderboard: a podium for #1–3 and a dashed-divider list for #4–10, with the current-user row visually highlighted (`— คุณ` tag). This is **still mock data** (a `FAKE_LEADERBOARD` array in `rank.js`, same convention as `FAKE_NOTIFICATIONS`/`FAKE_DASHBOARD`) — a real cross-student leaderboard query isn't possible yet because `profiles` RLS only lets a student SELECT their own row; opening that up safely (e.g. a `security definer` function returning just name+points for the top N, like `check_roster`) is Phase 6 work, not done here.
- Both pages keep using `requireStudentSession()` and `wireScanFab()`/`showToast()` from the shared session-guard/nav-common files, unchanged.
- New CSS added to `css/dashboard.css` only (`.balance-chip`, `.redeem-btn`, `.shop-cert`, `.stationery-grid`/`.stationery-item`, `.limited-section`/`.limited-item`, `.rank-podium`, `.rank-list`/`.rank-row`) — no new files, no changes to `components.css` or `tokens.css`.

**Open questions — waiting on the student council president, don't guess these:**
- Do points reset every round, or accumulate across rounds forever? (Affects whether Rank resets each round too.)
- What rewards/certificates are actually being offered, and what's the budget?
- Confirm the unit in the original pricing file is really THB/kg (currently assumed, not verified with the buyer).
- How often does a buyer actually come collect the waste from school? (Affects how often the redemption "Shop" can safely open without running out of real money backing it.)

**Open questions — can be decided without waiting, not yet decided:**
- Does Rank tie a real certificate to the Top 1 each round, or is it just a display?
- Report feature: start with a plain form (category + text + photo) or build an AI chatbot? Parked for now, no rush.
- Is "1 submission per category per day" still needed as a rule now that there's a scale + ID photo + end-of-round audit trail?

**Already decided, not open anymore:** a separate battery-collection box (considered earlier as a spot outside the 4 main bins) is **not** happening under the current self-weigh model — decided against, don't build it or ask about it again.

**Phase 2 status: core signup/login working (tested: real student_id signup succeeds, fake student_id is rejected, login + re-login both work).** Implementation notes to preserve in any future session:

- **Fake email convention:** Supabase Auth requires an email even though the UI only collects a student/admin ID. `auth.js` maps `id` → `{id}@student.kyt.local` (student) as a stable, never-emailed placeholder address just to satisfy Supabase Auth — this is intentional, not a bug. Keep this convention consistent if admin signup or any other auth flow is touched later.
- **`Confirm email` must stay OFF** in Supabase Dashboard → Authentication → Sign In / Providers. Since the addresses above are fake, no confirmation email can ever be delivered — if this setting is ever turned back on (e.g. by someone exploring settings), every signup will silently fail. If signup ever starts failing with a generic "สมัครสมาชิกไม่สำเร็จ" error again, check this setting first before debugging code.
- **Known follow-up — FIXED in Phase 3 Round 3b.** `dashboard.js` used to check login state by reading `localStorage['currentUser']` only, without verifying the Supabase session was still valid. Now fixed via the shared `requireStudentSession()` helper in `js/session-guard.js` (checks `supabase.auth.getSession()` too), used on every logged-in page (`dashboard.js`, `shop.js`, `rank.js`, `me.js`). Tested: clearing the `sb-*-auth-token` localStorage key while leaving `currentUser` in place correctly bounces to login.

---

This uses fake data in `data.js` (no real backend yet, migrating per the plan above), admin dashboard and the Scan tab are intentionally 'coming soon' placeholders (Shop/Rank/Me are real pages now, see Phase 3 notes above), and I'm a beginner learning as we go — explain things simply in future sessions, and don't skip ahead to code I haven't asked for yet.