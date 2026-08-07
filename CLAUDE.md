# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"ขยะแลกแต้ม" (roughly "trash for points") is a static front-end prototype for a school recycling gamification app: students scan/log recycling, earn points, level up, and compete on a class leaderboard against a school-wide energy goal. There is no backend, no build step, and no package manager — it's plain HTML/CSS/JS served directly from the filesystem.

## Running it

There is no build/dev/test command. Open the HTML files directly in a browser, or serve the directory with any static file server (e.g. `npx serve` or Python's `http.server`) if `file://` restrictions cause issues. There is no linter or test suite configured.

## Architecture

**Pages** (each is a standalone HTML entry point, no router/SPA framework):
- `login-student.html` / `login-admin.html` — role-specific login forms. Body has `data-role="student"` or `data-role="admin"`, which drives the accent color via CSS (see tokens.css) and which fake account list is checked.
- `dashboard.html` — the post-login student home screen (points ring, stats, class leaderboard, school-wide "energy" progress). There is no admin dashboard yet — admin login shows a "coming soon" message instead of navigating anywhere.

**Auth/data flow (all fake, no backend):**
- `js/data.js` holds `FAKE_ACCOUNTS` (plaintext id/password per role) and `FAKE_DASHBOARD` (the numbers rendered on the dashboard). This is the single place to edit to change demo data — treat it as a stand-in for a future API/database.
- `js/auth.js` runs on both login pages. It validates the typed id/password against `FAKE_ACCOUNTS[role]`, and on success writes `{ role, ...account }` to `localStorage['currentUser']`. Student logins redirect to `dashboard.html`; admin logins swap the login card's innerHTML for a "coming soon" message in place.
- `js/dashboard.js` reads `currentUser` from `localStorage` on load and bounces back to `login-student.html` if it's missing or not a student. It then renders every dashboard section (progress ring, stat tiles, leaderboard, energy bar) from `FAKE_DASHBOARD`, and wires up bottom-nav/scan-button click handlers that currently just show a "coming soon" toast — none of the other tabs (map/rank/me/scan) are implemented.
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

this uses fake data in data.js (no real backend yet), admin dashboard and non-home nav tabs are intentionally 'coming soon' placeholders, and I'm a beginner learning as we go — explain things simply in future sessions.