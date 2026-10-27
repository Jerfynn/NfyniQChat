# NfyniQ Chat — Android app

The Android app is the NfyniQ phone UI packaged as a real app (Capacitor). It connects to any PC
running **NfyniQ Chat 2.2+** on the same Wi-Fi; that PC relays the phone into every chat.

## Option A — build in the cloud (no Android Studio needed)

1. Create a new GitHub repository and upload everything in this folder (including `.github/`).
2. Open the repo's **Actions** tab → **Build NfyniQ Chat APK** → **Run workflow** (it also runs on every push to `main`).
3. When it finishes (~5 min), open the run and download **NfyniQ-Chat-Android** → `NfyniQ-Chat-2.2.0.apk`.
4. Copy the APK to the phone, tap it, and allow "Install unknown apps" for your file manager when Android asks.

## Option B — build on your PC

1. Install Android Studio (it brings the Android SDK + Java 17) and Node.js 20.
2. In this folder: `npm install` then `npm run sync`.
3. `npx cap open android` → in Android Studio: **Build → Build App Bundle(s)/APK(s) → Build APK(s)**.
   Or from a terminal: `cd android && gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`.

## First launch

1. Enter the PC address shown in NfyniQ Chat on the computer (phone icon in the left bar), e.g. `192.168.1.20`.
2. **This is my phone:** type the 6-digit code shown on the PC under *Link my phone* — you are signed in as yourself with all your chats.
   **I'm new:** pick a name to join as a separate person (for someone without a PC).

Voice messages work in the Android app (it asks for microphone permission the first time).

## Updating the phone UI

The UI lives in `web/` (copied from the desktop project's `mobile/` folder). After editing, run `npm run sync` and rebuild.

## iPhone

No build needed: on the iPhone, scan the QR code in NfyniQ Chat on the PC, then in Safari tap
Share → **Add to Home Screen**. A native iPhone build needs a Mac with Xcode and an Apple Developer
account ($99/year) to install on other people's phones: `npx cap add ios`, then in `ios/App/App/Info.plist`
add `NSAppTransportSecurity → NSAllowsLocalNetworking = YES` and an `NSLocalNetworkUsageDescription`.
