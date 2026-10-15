# MedOra

**A medication app for older adults and the family members who help them.**

MedOra keeps one shared routine for a patient, their caregivers and their care team. You can see what to take today, get reminders that actually ring, scan a pill-bottle label instead of typing it, and let a caregiver follow along live. The patient decides exactly what each person can see.

![MedOra screens: Home, Medicines, Medicine detail, Scan and Care Team](docs/screenshots/cover.png)

> All people and medicines in the sample data are fictional. MedOra is a student project, not a medical device, and it does not give medical advice.

## What works

| | |
|---|---|
| **Today’s medicines** | Doses grouped by morning, afternoon and evening. Tick one off or skip it with a reason. Due, missed and skipped doses are shown clearly. |
| **Real reminders** | Phone notifications at each dose time with **Taken**, **Snooze 10 min** and **Skip** buttons, plus a “Did you take it?” follow-up 30 minutes later. They work even when the app is closed. |
| **Label scanning** | Photograph a pharmacy label. MedOra reads the text and fills in the name, strength, dose, schedule, food rule, prescriber and quantity. You check everything before it saves. |
| **Safety checks** | New medicines are checked against your allergies, for example amoxicillin against a penicillin allergy. A pill countdown warns you a week before a refill is due. |
| **Change history** | Every change to a medicine records who made it and when. Dose and instructions are flagged as prescriber-only changes. |
| **Caregiver sharing** | Create a care circle and send a 6-letter invite code. A caregiver joins on their own phone and sees today’s doses live. With permission, they can mark a dose or send a reminder. |
| **Export** | A PDF medication summary (medicines, 30-day history, allergies, contacts) shared through the phone’s share menu. |
| **Accessibility** | Larger text, a simplified one-card home screen, and read-aloud in English, Spanish and Chinese. |
| **Sample mode** | “Explore with sample information” loads Margaret Wilson’s routine, so the app can be demoed without real data. |

## How it’s built

- **Stack:** [Expo](https://expo.dev) SDK 57, React Native, TypeScript and Expo Router.
- **Local first:** medicines, doses and the profile are stored on the phone with Zustand and AsyncStorage. The app works fully offline. Shared changes wait in an outbox and sync when the phone is back online.
- **Reminders:** `expo-notifications` daily triggers with an action category (Taken / Snooze / Skip). Follow-ups are scheduled on a rolling two-day window, kept under iOS’s 64-notification limit.
- **Scanning:** `expo-image-picker` captures the photo, `expo-image-manipulator` resizes it, and the [OCR.space](https://ocr.space/ocrapi) API reads the text. A rule-based parser ([`src/lib/parseLabel.ts`](src/lib/parseLabel.ts)) turns that text into fields and has its own tests.
- **Sharing:** [Supabase](https://supabase.com) Postgres with row-level security, so caregivers only read and write what the patient allows. A `join_circle` function handles invite codes, and realtime subscriptions push live updates. The schema is in [`supabase/schema.sql`](supabase/schema.sql).
- **Export and speech:** `expo-print` and `expo-sharing` make the PDF; `expo-speech` reads aloud.

```
src/app/         screens (Expo Router): tabs, medicine detail, forms, sharing
src/components/  shared UI in the team’s design system
src/lib/         store, schedule math, reminders, scanning, sync, PDF, speech
supabase/        database schema and security rules
scripts/         parser and allergy-check tests
```

## Try it

See **[SETUP.md](SETUP.md)**. In short: install Node.js and run `npm install` and `npx expo start`, then scan the QR code with the **Expo Go** app on your phone.

Checks: `npm run typecheck` · `npm run lint` · `npm run test:parser`

## Background

MedOra started as our team project in CE596 at Purdue University. Over the semester we took it through a full product development process before building anything:

1. **Opportunity space**: finding where medication management fails for older adults and their families.
2. **Purpose-context mapping**: understanding when, where and why people take, track and share medicines.
3. **Demand estimate**: sizing how many people face this problem.
4. **Ecosystem and competitive analysis**: mapping patients, caregivers, providers and pharmacies, and studying Medisafe, Dosecast and the CVS Pharmacy app.
5. **Performance map**: deciding where MedOra must be the best (care coordination, accessibility and understanding, data privacy) and where good enough is enough (reminders, health monitoring).
6. **Solution prototype**: a clickable prototype in Figma Make, presented in class.

This repository is the next step: a working app built from that research and prototype.

**Team:** Sriya, Kai, Sneha, Oulaiphone

### Contributions

All four team members contributed to the research stages and the clickable prototype. My contributions:

- **Research and analysis:** co-developed the opportunity space, purpose-context map, demand estimate, and ecosystem and competitive analysis.
- **Performance map:** [led] the comparison of MedOra with Medisafe, Dosecast and the CVS Pharmacy app across six hiring criteria, and set the design targets that guided the app: where MedOra must lead (care coordination, accessibility, data privacy) and where good enough is enough.
- **Presentation:** presented the product roadmap in the solution prototype review.
- **Software:** turned the prototype into a working mobile app (Expo, React Native, Supabase) with AI-assisted coding (Claude). I defined the scope and requirements from our research: reliable reminders, verified label scanning, and caregiver sharing under patient control.

## Limitations and next steps

- **Caregiver alerts when the app is closed:** a caregiver sees missed doses live in their app, but a push alert to their phone needs a server job and an installed build.
- **Scanning privacy:** label photos are sent to OCR.space. On-device text recognition would keep them on the phone.
- **Allergy check depth:** it matches names and drug families. It is not a full interaction database.
- **Refills:** refill requests to a pharmacy are not connected.
