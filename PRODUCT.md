# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students (primary):** ม.1–6 at one school (~2,628 on the roster). They use their own phone, standing at the unattended scale right after weighing their sorted recyclables, usually during a break and in a hurry. The job at the scale: pick a category, enter the weight, take the evidence photo, submit. Checking points, the Shop, and the Top 10 happens later, with more time.
- **Admins (student council, ~30 individual logins):** review the shared submission feed (approve / reject), edit prices per category, manage the Shop catalog, and hand over rewards by typing a receipt code. Several admins work the same feed at once.

## Product Purpose

"ขยะแลกแต้ม" (trash for points) turns sorting recyclables at school into points a student can spend. A student weighs and photographs their recyclables, submits them, and a council admin approves them for points. Points buy real rewards in the Shop and also count toward a Top 10 leaderboard.

Success: students come back every collection round because the rewards are worth it, and every point awarded matches real recyclables that a human checked.

## Positioning

Points are backed by real value and real review: 1 point = 0.1 THB of recyclable value, `points = round(weight_kg × point_value)`, and every submission is approved by a person on the student council. It is the school's own system, run by the student council, not a generic eco-app.

## Operating Context

- Unattended scale at school; students photograph the reading and the sorted trash as evidence.
- Monthly collection rounds, about one week open per month (planned, not built; submissions are allowed any time for now).
- Rewards are collected in person: a student shows a receipt code (e.g. `R-0042`) and an admin marks it handed over.
- Problem reports and reward ideas go to a Google Form owned by the student council, not into the app.
- Login is student ID + password (no school email exists). There is no in-app password reset; the council resets passwords by hand.

## Capabilities and Constraints

- Pages: Home (points, recent activity, notifications, a how-to guide), Scan (submit), Shop (redeem, My Tickets), Rank (Top 10 + own rank), Me (account); Admin: Review, Prices, Shop, Pickups.
- **Individual, not room-vs-room.** Class competition, energy bars, levels, piece counting, bag sizes, and OCR daily codes are dropped. Don't build toward them.
- **No auto-approve, ever**, whatever the weight.
- Rank counts points **earned** (sum of approved submissions), so spending points in the Shop never lowers rank.
- Redeeming is final: no cancel, no refund. Certificate and limited items are one per student; stationery is unlimited.
- Free-tier Supabase backend. Photo storage is the real limit, so every photo is compressed before upload (max 800px wide, JPEG 0.7).
- Plain HTML/JS pages, no framework, hosted on Vercel.
- **Undecided (waiting on the student council president; don't guess or promise):** whether points reset each round; which rewards and what budget; whether the price unit is really THB/kg; how often a buyer collects; whether Rank #1 earns a real certificate; whether "1 submission per category per day" is still needed. The points ring's 50,000 goal is for display only, with no real cap.

## Brand Commitments

- Name: "ขยะแลกแต้ม" (trash for points).
- Bilingual on purpose: English for headings and game words, Thai for descriptions and instructions.
- Friendly, casual student-to-student voice in Thai (e.g. "มอบ…ให้แล้วน้า ><").
- The established visual identity lives in the code and CLAUDE.md "Styling"; it is not restated here.

## Evidence on Hand

- Real data lives in the live Supabase database (roster, categories and prices, Shop items). Nothing has been launched to all students yet.
- No logo files, photos, testimonials, or usage statistics are in the repo. Don't make up student quotes, participation numbers, amounts recycled, or reward promises.

## Product Principles

1. **Rewards are the reason to come back.** The Shop is the main pull; rank is the bonus. Future screens should make "what can my points get me" easy to see.
2. **Fast at the scale.** Submitting must work one-handed on a phone, in a hurry, during a break.
3. **Every point is real.** A human checks every submission, and points stand for real recyclable value. Nothing should hint at shortcuts, automatic approval, or promises the council hasn't made.
4. **Built for the council to run.** About 30 admins share one feed. Admin tools favour clarity and protection against two people acting on the same item.
5. **Fair and individual.** Each student earns for themselves; spending never costs them their rank.

## Accessibility & Inclusion

No special needs known (owner confirmed 2026-11-06: no specific old-phone, slow-network, or low-vision requirement). Follow normal good practice: readable Thai text, comfortable tap targets for use at the scale, and respect for reduced-motion settings (already in the tokens).
