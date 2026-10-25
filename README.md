# ♻️ RFC: Recycle for Credits

**🌐 Live site:** [recycle-for-credits.vercel.app](https://recycle-for-credits.vercel.app)

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

### What is it?

A recycling app for our school. Students sort their recyclables, weigh them on an unattended scale, take a photo as proof and submit it in the app. A student council admin checks every submission. Approved submissions earn points, which students can spend in the reward Shop or use to climb the Top 10 leaderboard.

**Why:** to get students recycling more, and to make it fun and fair without needing someone to watch the scale all day.

### How it works

```
Sort trash → Weigh it → Photo + submit → Council reviews → Get points → Redeem rewards / climb the ranks
```

- **1 point = 0.1 THB** of real recyclable value
- Points = weight (kg) × the price per kg for that type of trash

### Features

**For students**
- 📸 **Scan:** submit a trash type, weight and photo (the photo is compressed before upload)
- 🏠 **Home:** points ring, recent activity, and notifications when a submission is approved or rejected
- 🛍️ **Shop:** redeem certificates, stationery and limited items, then get a ticket code (e.g. `R-0042`) to pick the reward up
- 🏆 **Rank:** Top 10 leaderboard, ranked by points *earned*, so spending points never drops your rank
- 🐞 **Report a problem:** opens the council's Google Form with your details already filled in

**For admins (student council)**
- ✅ **Review:** approve or reject each submission after checking the photo
- 💰 **Prices:** set the price per kg for each trash type
- 🏷️ **Shop:** manage the reward catalog and stock
- 📦 **Pickups:** type a ticket code to mark a reward as handed over

**Fair and secure**
- A human reviews every submission. Nothing is approved automatically.
- Only IDs on the school roster can sign up
- CAPTCHA (Cloudflare Turnstile) on login and sign-up
- Points, prices and rewards are handled on the server (Postgres Row Level Security + database functions), so editing values in the browser does nothing
- Many admins can review at once without approving the same submission twice

### Tech stack

| Part | Tool |
|---|---|
| Frontend | Plain HTML + JavaScript (no framework) |
| Styling | Tailwind CSS + hand-written CSS ("paper scrapbook" look) |
| Backend | [Supabase](https://supabase.com): Postgres, Auth, Storage, Realtime |
| Bot protection | Cloudflare Turnstile |
| Hosting | [Vercel](https://vercel.com) |
| Icons / Fonts | Lucide · Poppins + Prompt |

### Project structure

```
*.html        Pages: login, Home, Scan, Shop, Rank, Me, admin
js/           One script per page + shared helpers
css/          Design sources (built by Tailwind into css/build/)
sql/          Database setup scripts (run in the Supabase SQL editor)
docs/         Project history and design decisions
```

### Run locally

```bash
npm install
npm run dev     # watches and builds the CSS
```

Then open the folder with any static server (e.g. VS Code **Live Server**).

---

## ภาษาไทย

### คืออะไร?

แอปรีไซเคิลของโรงเรียน นักเรียนแยกขยะรีไซเคิล ชั่งน้ำหนักที่ตาชั่งของโรงเรียน ถ่ายรูปเป็นหลักฐาน แล้วส่งผ่านแอป จากนั้นสภานักเรียนจะตรวจทุกรายการ รายการที่ผ่านจะได้แต้ม เอาไปแลกของรางวัลใน Shop หรือแข่งขึ้นอันดับ Top 10 ได้

**ทำไปเพื่ออะไร:** ให้นักเรียนรีไซเคิลมากขึ้น โดยทำให้สนุกและยุติธรรม และไม่ต้องมีคนเฝ้าตาชั่งตลอดวัน

### ใช้งานยังไง

```
แยกขยะ → ชั่งน้ำหนัก → ถ่ายรูป + ส่ง → สภาตรวจ → ได้แต้ม → แลกของ / ขึ้นอันดับ
```

- **1 แต้ม = 0.1 บาท** ตามมูลค่าจริงของขยะรีไซเคิล
- แต้ม = น้ำหนัก (กก.) × ราคาต่อกิโลของขยะประเภทนั้น

### ฟีเจอร์

**สำหรับนักเรียน**
- 📸 **Scan:** ส่งประเภทขยะ น้ำหนัก และรูปถ่าย (จะย่อรูปให้ก่อนอัปโหลด)
- 🏠 **Home:** วงแหวนแต้ม กิจกรรมล่าสุด และแจ้งเตือนเมื่อรายการผ่านหรือไม่ผ่าน
- 🛍️ **Shop:** แลกเกียรติบัตร เครื่องเขียน และของลิมิเต็ด แล้วได้รหัสตั๋ว (เช่น `R-0042`) ไว้ไปรับของ
- 🏆 **Rank:** อันดับ Top 10 จัดจากแต้มที่*หามาได้* แลกของแล้วอันดับก็ไม่ตก
- 🐞 **แจ้งปัญหา:** เปิด Google Form ของสภา และกรอกข้อมูลนักเรียนไว้ให้แล้ว

**สำหรับแอดมิน (สภานักเรียน)**
- ✅ **Review:** ดูรูปแล้วกดอนุมัติหรือปฏิเสธทีละรายการ
- 💰 **Prices:** ตั้งราคาต่อกิโลของขยะแต่ละประเภท
- 🏷️ **Shop:** จัดการรายการของรางวัลและสต็อก
- 📦 **Pickups:** พิมพ์รหัสตั๋วเพื่อบันทึกว่ามอบของแล้ว

**ความยุติธรรมและปลอดภัย**
- คนจริงตรวจทุกรายการ ไม่มีการอนุมัติอัตโนมัติ
- สมัครได้เฉพาะรหัสที่อยู่ในรายชื่อนักเรียนของโรงเรียน
- มี CAPTCHA (Cloudflare Turnstile) ตอนเข้าสู่ระบบและสมัคร
- แต้ม ราคา และการแลกของ คำนวณที่เซิร์ฟเวอร์ทั้งหมด (Row Level Security + function ในฐานข้อมูล) แก้ค่าในเบราว์เซอร์ก็ไม่มีผล
- แอดมินหลายคนตรวจพร้อมกันได้ โดยไม่อนุมัติรายการเดียวกันซ้ำ

### เทคโนโลยีที่ใช้

| ส่วน | เครื่องมือ |
|---|---|
| หน้าเว็บ | HTML + JavaScript ธรรมดา (ไม่ใช้เฟรมเวิร์ก) |
| ดีไซน์ | Tailwind CSS + CSS ที่เขียนเอง (สไตล์สมุดสแครปบุ๊ก) |
| หลังบ้าน | [Supabase](https://supabase.com): ฐานข้อมูล Postgres, ระบบล็อกอิน, ที่เก็บรูป, Realtime |
| กันบอท | Cloudflare Turnstile |
| โฮสต์เว็บ | [Vercel](https://vercel.com) |
| ไอคอน / ฟอนต์ | Lucide · Poppins + Prompt |

### โครงสร้างโปรเจกต์

```
*.html        หน้าเว็บ: ล็อกอิน, Home, Scan, Shop, Rank, Me, แอดมิน
js/           โค้ดของแต่ละหน้า + ตัวช่วยที่ใช้ร่วมกัน
css/          ไฟล์ดีไซน์ต้นฉบับ (Tailwind รวมเป็น css/build/)
sql/          สคริปต์ตั้งค่าฐานข้อมูล (รันใน SQL editor ของ Supabase)
docs/         ประวัติโปรเจกต์และเหตุผลของการตัดสินใจ
```

### รันบนเครื่องตัวเอง

```bash
npm install
npm run dev     # คอยสร้างไฟล์ CSS ให้อัตโนมัติ
```

จากนั้นเปิดโฟลเดอร์ด้วย static server ตัวไหนก็ได้ (เช่น **Live Server** ใน VS Code)

---

© All rights reserved. The code is public to read, but not licensed for reuse.
สงวนลิขสิทธิ์ เปิดให้อ่านโค้ดได้ แต่ไม่อนุญาตให้นำไปใช้ต่อ
