# FairXI — Post-v1.3 Manual Checklist (Native Store Submission)

Everything below has to happen on your side — this container doesn't have
Xcode, doesn't have a Google/Apple account, and can't hold signing keys.

## ANDROID (Google Play)

### Prerequisites (one-time)
1. Install **Android Studio** on your Mac/Linux/Windows machine.
2. Pay the **$25 one-time Google Play Console** developer fee at
   https://play.google.com/console/signup.
3. Create your first **Play Console app** (Name: FairXI, Default language: English,
   App or game: App, Free or paid: Free).

### Local build
```bash
cd /path/to/fairxi/frontend
yarn build                # produces build/ that Capacitor bundles
npx cap copy android      # sync the fresh build into android/
npx cap open android      # opens Android Studio
```
In Android Studio: **Build → Generate Signed App Bundle** → create a keystore
(store the .jks somewhere safe forever — losing it means you cannot update
the app on Play). Choose **Android App Bundle** (`.aab`), not `.apk`.

### Play Console upload
1. In Play Console → your app → **Testing → Internal testing** → Create release.
2. Upload the `.aab`.
3. Fill in the App content section (privacy policy URL, ads declaration = No,
   content rating questionnaire — answers in `/app/store_submission.md`).
4. Add store listing (title, short/full description, screenshots — copy from
   `/app/store_submission.md`, capture screenshots as per the list).
5. Roll out to Internal → test on your own device via the Play link.
6. When happy: **Production → Create release** → same `.aab` (or a new build).

## iOS (Apple App Store)

### Prerequisites (one-time, MAC ONLY)
1. Mac with **Xcode 15+** and **CocoaPods** (`sudo gem install cocoapods` or `brew install cocoapods`).
2. Pay the **$99/year Apple Developer Program** fee at https://developer.apple.com/programs/.
3. In App Store Connect, create the app record (Bundle ID: `com.vorneaux.fairxi`,
   Name: FairXI, Primary Language: English).

### Local build (Mac)
```bash
cd /path/to/fairxi/frontend
yarn build
npx cap copy ios
cd ios/App && pod install && cd ../..
npx cap open ios          # opens Xcode
```
In Xcode: **Product → Archive** → **Distribute App → App Store Connect → Upload**.
Xcode handles signing via your developer account.

### App Store Connect upload
1. In App Store Connect → your app → **TestFlight** → Internal testing → invite yourself.
2. Test on device via TestFlight app.
3. Fill in App Privacy questionnaire (answers in `/app/store_submission.md`).
4. Fill in App Information / Screenshots / Description (from `/app/store_submission.md`).
5. Submit for review → Apple typically responds in 24-48 hours.

## What v1.3 already prepared for you (no work needed)
- ✅ `/app/frontend/capacitor.config.json` — appId `com.vorneaux.fairxi`, appName `FairXI`, webDir `build`
- ✅ `/app/frontend/android/` — full Android Studio project, ready to open
- ✅ `/app/frontend/ios/` — full Xcode project structure (needs `pod install` on your Mac)
- ✅ `@capacitor/share` wired into `recap.js` — native share on device, Web Share on browser
- ✅ Service worker registration skips on native (`Capacitor.isNativePlatform()`)
- ✅ Install prompt provider no-ops on native (already installed)
- ✅ Public `/privacy` URL at https://fairxi.vorneaux.com/privacy
- ✅ Store copy + content rating answers in `/app/store_submission.md`

## What v1.3 could NOT do (environment limits)
- ❌ Generate a keystore (`.jks`) — that's your permanent identity
- ❌ Generate Apple certificates or provisioning profiles — needs Mac + your Apple ID
- ❌ Run `pod install` for iOS — needs macOS + CocoaPods
- ❌ Produce a signed `.aab` or `.ipa` — needs JDK + Android SDK / Xcode
- ❌ Generate the 2732×2732 splash source PNG — the existing 512px icon is the largest source in-repo. **Recommended:** either commission a 2732×2732 export of the logo, or let Capacitor's default splash generator scale up from the 512px (it will look OK but slightly soft).
- ❌ Actually submit — that's your credentials in your account
