# Run MedOra on your phone

This takes about 15 minutes the first time. Steps 1–2 get the app running. Steps 3–4 are optional extras.

## What you need

- A Mac or PC with **Node.js 20 or newer**. Get the LTS installer from [nodejs.org](https://nodejs.org).
- An iPhone or Android phone with **Expo Go** installed from the App Store or Google Play.
- A free **Expo account** from [expo.dev/signup](https://expo.dev/signup). Expo Go asks you to sign in before it opens projects.
- The computer and the phone on the **same Wi-Fi**. If you can't, see "Different networks" below.

MedOra uses **Expo SDK 57**. The Expo Go app from the store must support SDK 57. Expo Go shows its supported SDK under Settings.

## Step 1: Start the app

Open Terminal in the `medora-app` folder and run:

```bash
npm install
npx expo login        # use your Expo account
npx expo start
```

A QR code appears. Scan it with the iPhone **Camera** app (on Android, scan it from inside **Expo Go**). MedOra opens in Expo Go.

**Try this first:**

1. Tap **Explore with sample information** to load Margaret’s fictional routine.
2. Tap the bell (top right). Turn on **Medicine reminders** and allow notifications.
3. Tap **Send me a test reminder**, then lock your phone. A real reminder arrives in 5 seconds with **Taken / Snooze / Skip**. Press and hold it to see the buttons.
4. Go to **Scan**, tap **Sample**, and save the medicine it reads.
5. Go to **Profile** and try **Larger text** and **Simplified home**.

To use your own medicines instead, go to **Profile → Leave the sample → Set up my medicines**.

**Different networks** (for example, school Wi-Fi that blocks devices from seeing each other): run `npx expo start --tunnel` instead.

## Step 2 (optional): Better label scanning

Scanning works out of the box with OCR.space’s public demo key. That key is shared and rate-limited, so for reliable scanning:

1. Get a free API key at [ocr.space/ocrapi](https://ocr.space/ocrapi). It is emailed to you.
2. Copy `.env.example` to a new file named `.env` and paste the key after `EXPO_PUBLIC_OCR_SPACE_KEY=`.
3. Restart with `npx expo start -c`. The `-c` clears the cache so the key is picked up.

Tips for a good scan: lay the label flat, use good light, and fill the frame with the printed text.

## Step 3 (optional): Caregiver sharing with Supabase

This lets a caregiver see your doses live on their own phone.

1. Create a free project at [supabase.com](https://supabase.com). Any name and region works. Save the database password somewhere.
2. Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. It should say *Success*.
3. Open **Authentication → Sign In / Providers → Email** and turn **off** “Confirm email”. Accounts then work right away for the demo. If you leave it on, people tap a link in their email before signing in.
4. Open **Project Settings → API Keys** (or **API**). Copy the **Project URL** and the **publishable** key (older projects call it the **anon public** key) into `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
   ```
   Never put the `service_role` or secret key in the app.
5. Restart with `npx expo start -c`.

**Try it with two phones:**

- **Patient phone:** set up your own medicines (not the sample). Go to **Care Team → Sign in to start sharing**, create an account, then tap **Create my care circle** and **Send** the 6-letter code.
- **Caregiver phone:** open the same QR code in Expo Go. Go to **Care Team → Join**, create an account, and enter the code.
- **Patient phone:** tap the caregiver in **Care Team** and turn on **Mark doses as taken**.
- **Caregiver phone:** open the patient, tap **Mark taken** on a dose, and watch it appear on the patient’s phone.

## Step 4 (optional): Install it as its own app

Expo Go is for trying the app. To get a MedOra icon on your home screen:

- **Android:** run `npx eas-cli@latest build -p android --profile preview`. When it finishes you get a link to an `.apk` you can install. The free Expo plan includes a monthly number of builds.
- **iPhone:** installing outside Expo Go needs an Apple Developer account ($99/year) for TestFlight or ad hoc builds. See [docs.expo.dev/build/setup](https://docs.expo.dev/build/setup/).

## Checks

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint
npm run test:parser   # label reader and allergy check tests
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Expo Go says the project uses an SDK it doesn’t support | Update Expo Go. If the store version has moved to a newer SDK (for example 58), upgrade the project: `npx expo install expo@latest` then `npx expo install --fix`. |
| Expo Go asks you to log in | Sign in with your Expo account in Expo Go and run `npx expo login` on the computer. |
| No reminders | iPhone: **Settings → Expo Go → Notifications** must be allowed (in Expo Go, MedOra’s notifications show under Expo Go’s name). Make sure the phone isn’t in a Focus mode that silences them. |
| “Text reader returned 403” or scans stop working | The shared demo OCR key hit its limit. Add your own key (step 2). |
| “Sharing is not set up yet” | `.env` is missing the Supabase values, or the app wasn’t restarted with `-c`. |
| “No care circle matches that code” | Check the 6 letters. Codes never use 0, O, 1 or I. |
| Changes to `.env` don’t show up | Stop the server and run `npx expo start -c`. |

## Project map

```
src/app/(tabs)/       Home, Medicines, Scan, Care Team, Profile
src/app/med/[id].tsx  medicine detail: take, skip, history, side effects, read aloud
src/app/med-form.tsx  add/edit form (also used after a scan)
src/app/*.tsx         reminders, export, history, safety, account, join, caregiver view
src/lib/store.ts      all app data (saved on the phone)
src/lib/notifications.ts  reminder scheduling and Taken/Snooze/Skip handling
src/lib/parseLabel.ts     turns label text into medicine fields
src/lib/sync.ts       care circle sharing (Supabase)
supabase/schema.sql   database tables and security rules
```
