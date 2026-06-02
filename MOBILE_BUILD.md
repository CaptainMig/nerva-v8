# NERVA Mobile — Build & Submission Guide

## Quick start (local dev server)

```bash
npm run serve          # serves www/ at http://localhost:3000
```
Open that URL on your phone's browser (same wifi) to preview before building.

---

## Build workflow

```bash
# 1. Edit source files at root (nerva-mobile-app.jsx, etc.)
# 2. Assemble www/ and sync to native projects:
npm run sync           # copies files + runs cap sync for both platforms

# Platform-specific sync:
npm run sync:ios
npm run sync:android
```

---

## Android

### Prerequisites
- Android Studio (any recent version)
- JDK 17+

### Build APK / AAB

```bash
npm run open:android   # opens the project in Android Studio
```

In Android Studio:
- **Debug APK**: Build → Build Bundle(s)/APK(s) → Build APK(s)
- **Release AAB** (for Play Store): Build → Generate Signed Bundle/APK → Android App Bundle
  - Create a keystore if you don't have one (Android Studio guides you)
  - Store the keystore file and passwords securely — you need them for every update

The AAB appears at:
`android/app/build/outputs/bundle/release/app-release.aab`

### Data-safety declaration (Play Console)
When filling out the Play Console data-safety form:
- **Data collected**: None (local-only default)
- **Data shared**: None (sync OFF by default; add "anonymous usage data" if/when SYNC_ENABLED flips)
- **Security practices**: Data encrypted in transit ✓, You can request deletion ✓

---

## iOS

> **iOS builds require a Mac with Xcode.** This cannot be done from this environment.

### Prerequisites (on Mac)
- macOS 13+, Xcode 15+
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer account ($99/year)

### First-time setup (Mac only)

```bash
# On your Mac, inside the repo:
npm run sync:ios
cd ios/App && pod install
npm run open:ios       # opens ios/App/App.xcworkspace in Xcode
```

In Xcode:
1. Select the **App** target → Signing & Capabilities
2. Set **Team** to your Apple Developer account
3. Set **Bundle Identifier** to `com.starpoint.nerva`

### Build for TestFlight / App Store

1. Select scheme **App** → destination **Any iOS Device**
2. Product → Archive
3. Window → Organizer → Distribute App → App Store Connect

### Privacy manifest
`ios/App/App/PrivacyInfo.xcprivacy` is already in place.
Add it to the Xcode target:
- In Xcode: File → Add Files → select `PrivacyInfo.xcprivacy` → ensure **Target: App** is checked

### App Store review notes
- NERVA's safety guardrail (AI classification in `/api/parse`) satisfies Apple's health-app review guidelines — flagged content routes to crisis resources, not the scoring engine.
- The disclaimer screen satisfies the "apps that are not medical devices" guidance.
- PAYWALL_ENABLED=false: no in-app purchases are active; no StoreKit entitlement is needed for v1.

---

## Environment variables

Set these in Vercel (for the /api/parse endpoint):

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

The mobile app calls `/api/parse` at runtime; the key never reaches the client.

---

## Flipping PAYWALL_ENABLED

1. Install: `npm install @revenuecat/purchases-capacitor`
2. In `nerva-mobile-app.jsx`: set `PAYWALL_ENABLED = true`
3. Wire `isPremium()` to `window.Purchases.getCustomerInfo()`
4. Add RevenueCat product IDs to `capacitor.config.json` plugins section
5. iOS: add `Purchases.configure({ apiKey: 'appl_...' })` in `AppDelegate.swift`
6. Android: same in `MainActivity.java`

---

## Wiring cloud sync

1. `npm install @supabase/supabase-js`
2. Edit `nerva-sync-stub.js` — replace stub with real Supabase call (instructions in-file)
3. Set `SYNC_ENABLED = true` in `nerva-sync-stub.js`
4. Deploy a `decision_logs` table in Supabase (columns: id, verdict, E, S, R, Sp, St, timestamp)
5. Users must grant consent via the in-app banner before any data is sent
