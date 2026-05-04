# ScholarOS — The Intelligence of Achievement

Nigeria's first AI-powered Academic Operating System. A desktop-style exam preparation platform covering every major Nigerian qualification — JAMB, WAEC, NECO, ICAN, Bar Exams, PTDF scholarships, and more.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS v4 |
| Backend | Node.js + Express |
| Database | Firebase Firestore |
| Payments | Paystack |
| SMS | Termii |
| Email | Nodemailer (Gmail / SMTP) |
| AI Tutor | Google Gemini 2.0 Flash |
| Push Notifications | Web Push (VAPID) |
| Question Data | ALOC Past Questions API |
| Hosting | Railway (recommended) |

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in every variable in `.env`. See the table below.

### 3. Run in development

```bash
npm run dev
```

Open `http://localhost:3000`.

Use the admin test account to skip payment during development:
- Set `ENABLE_ADMIN_BYPASS=true` in your `.env`
- Username: `admin` | PIN: `000000`

---

## Environment Variables

| Variable | Where to get it | Required |
|---|---|---|
| `VITE_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) | Yes |
| `PAYSTACK_SECRET_KEY` | [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developers) | Yes |
| `TERMII_API_KEY` | [Termii](https://termii.com) | Yes (SMS) |
| `EMAIL_USER` | Your Gmail address | Yes (email) |
| `EMAIL_PASS` | Gmail App Password | Yes (email) |
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | Yes |
| `ALOC_API_TOKEN` | [ALOC](https://questions.aloc.com.ng) | Yes (seeder) |
| `VAPID_PUBLIC_KEY` | Run: `npx web-push generate-vapid-keys` | Yes (push) |
| `VAPID_PRIVATE_KEY` | Same command as above | Yes (push) |
| `CRON_SECRET` | Any long random string | Yes (push broadcast) |
| `ENABLE_ADMIN_BYPASS` | Set to `true` in dev only. **Never in production.** | Dev only |

---

## Seeding the Question Database

ScholarOS uses the ALOC API to populate Firebase with past questions.

```bash
# Seed JAMB only (fastest, start here to test)
npm run seed:jamb

# Seed WAEC
npm run seed:waec

# Seed everything
npm run seed:all
```

The seeder is resumable — it skips exam/subject/year combinations already in the database.

**Expected volumes after full seed:**
- JAMB: ~15,000 questions (2000–present)
- WAEC: ~12,000 questions (2005–present)
- NECO: ~8,000 questions (2005–present)

---

## Firestore Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore in **Native mode**
3. Copy your config into `firebase-applet-config.json`
4. Deploy the security rules:

```bash
firebase deploy --only firestore:rules
```

---

## Deploy to Railway

1. Push your project to a GitHub repository
2. Go to [railway.app](https://railway.app) and connect the repo
3. Set **Build Command**: `npm run build`
4. Set **Start Command**: `npm start`
5. Add all environment variables in Railway's Variables tab
6. Railway assigns a live URL automatically

---

## Push Notifications (Daily Reminders)

Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

Set up a Railway cron job to call daily:

```
POST https://your-domain.up.railway.app/api/push/broadcast-daily
Header: x-cron-secret: YOUR_CRON_SECRET
```

---

## Project Structure

```
├── src/
│   ├── App.tsx          # Entire frontend (4,000+ lines)
│   └── index.css        # Design system + CSS variables
├── scripts/
│   └── seed-questions.ts # Question database seeder
├── public/
│   ├── sw.js            # Service Worker (push + offline)
│   └── manifest.json    # PWA manifest
├── server.ts            # Express backend (API + Vite dev)
├── firestore.rules      # Firestore security rules
└── .env.example         # All required environment variables
```

---

## Architecture Notes

- **Authentication**: JWT tokens (7-day expiry). Issued at login, stored in `sessionStorage`, automatically attached to all API requests via Axios interceptors.
- **Payments**: Paystack Standard checkout. Backend verifies webhook HMAC signatures before activating accounts.
- **PIN Security**: All PINs are bcrypt-hashed before storage. Plain text PINs are never stored anywhere.
- **Free Tier**: Users with no purchased modules see 5 questions per subject before hitting the upgrade prompt.
- **Exam Auto-Save**: In-progress exams save to `localStorage` every 15 seconds. Progress is restored on remount.
- **Question Images**: Served directly from ALOC CDN. Rendered with zoom-on-tap in the exam interface.

---

## License

Private. All rights reserved. © 2026 ScholarOS Nigeria.
