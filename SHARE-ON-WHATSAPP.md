# Sharing Hath Bolo on WhatsApp

There are two things to share:

| Friend's phone | What they get | How |
|---|---|---|
| Android | The real app (`hath-bolo.apk`) | Forward the APK file on WhatsApp, or send the web link which has a download button |
| iPhone | The game from a link, added to the home screen like an app | Send the web link |

The web link also turns on **online multiplayer** (room codes).

---

## Part 1: Put the game online (free, about 10 minutes, no coding)

You need a free GitHub account and a free Render account.

1. Unzip **hath-bolo-web-upload.zip** on your computer.
2. Go to https://github.com/new, name the repository `hath-bolo`, choose **Public** or **Private**, and click **Create repository**.
3. On the new page click **uploading an existing file**. Open the unzipped folder, select **everything inside it** (`www`, `server`, `render.yaml`) and drag it into the browser. Click **Commit changes**.
4. Go to https://dashboard.render.com, sign in with GitHub, then **New → Blueprint**. Pick the `hath-bolo` repository and click **Apply**.
5. After 2 to 3 minutes Render shows your address, for example `https://hath-bolo.onrender.com`. Open it on your phone to check.

That address is your **WhatsApp link**. Anyone who opens it can play straight away.

- iPhone: Safari → **Share** → **Add to Home Screen**.
- Android: Chrome → **⋮** → **Install app**.

The home screen also has a **Dosto ko bhejo** (Send to friends) button that sends this link on WhatsApp.

> The free Render plan sleeps after 15 minutes with nobody playing. The first person to open it after that waits about a minute.

## Part 2: The Android app (APK)

The APK must know your web address (from Part 1) so that multiplayer works inside the app.

1. In the full project, open `www/js/config.js` and set:
   ```js
   window.HB_CONFIG = { serverUrl: 'https://hath-bolo.onrender.com' };
   ```
2. Build the APK one of these ways:
   - **Android Studio:** `npm install`, `npx cap sync android`, `npx cap open android`, then **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
   - **GitHub, no Android Studio:** upload the full project to a GitHub repository. The included workflow (`.github/workflows/build-apk.yml`) builds the APK automatically. Open the **Actions** tab, then the latest run, then download **hath-bolo-apk** under *Artifacts*.
3. Share it:
   - **On WhatsApp:** attach it as a **Document** and pick `hath-bolo.apk`.
   - **From your web link:** in the GitHub repository from Part 1, upload the APK into the `server/downloads/` folder as `hath-bolo.apk`. Render updates itself, and the web page's **Phone pe install karo** button then shows a **Download Android app** button.

**What your friends do:** tap the APK, then tap **Install**. If the phone says *"For your security, your phone is not allowed to install unknown apps"*, tap **Settings**, turn on **Allow from this source**, go back and tap **Install**. Play Protect may warn about an unknown developer; tap **Install anyway**.

## Later: Play Store and App Store

To publish in the stores, which removes the "unknown apps" step and gives a proper iPhone app:

- **Google Play:** one-time USD 25 developer account. Build a signed *App Bundle* in Android Studio.
- **Apple App Store / TestFlight:** USD 99 per year developer account and a Mac with Xcode. See README.md, step 3.
