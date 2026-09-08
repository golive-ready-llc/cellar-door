# Cellar Door — Maestro E2E Tests

Mobile UI tests for the Capacitor APK using [Maestro](https://maestro.mobile.dev/).
Runs on an Android emulator (or any USB-connected Android device with developer
mode enabled). Catches the things Vitest unit tests can't:

- Capacitor plugin behavior (camera, local-notifications, Firebase Auth)
- Hardware Android back button across Radix overlays
- Status-bar safe-area on real screen sizes
- WebView ↔ native bridge round-trips
- Real Google Sign-In flow

## One-time setup

You'll do this once. After that, every flow run is a single command.

### 1. Create an emulator (~5 min, Android Studio already installed)

The Android SDK lives at `$ANDROID_HOME`
and `adb.exe` is already at `…\Sdk\platform-tools\adb.exe`.

1. Open Android Studio → "More Actions" → "Virtual Device Manager".
2. Create a new device. Recommended: **Pixel Tablet** (matches the
   user's actual prod device) with **API 34 (Android 14)**.
3. Boot it once to confirm it works.

If `adb` isn't on `PATH` yet, add it for this session:
```powershell
$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```
Or persist via System → Environment Variables.

### 2. Install Maestro (~2 min)

```bash
# macOS / Linux / WSL
curl -Ls "https://get.maestro.mobile.dev" | bash

# Windows native (PowerShell, requires Java 8+)
iwr https://get.maestro.mobile.dev | iex
```

Verify: `maestro --version`.

### 3. Build + install the debug APK

From the repo root:

```bash
# (one-time) install Capacitor + sync
npm install
npx cap sync android

# build the debug APK
cd android && ./gradlew assembleDebug && cd ..

# boot the emulator first via Android Studio's AVD manager, then:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

(Whenever JS changes, just `npm run build && npx cap sync android` and the
running APK will pick up the new bundle next launch — no reinstall.)

### 4. Configure a test Google account on the emulator

For `01-google-signin.yaml` to work, the emulator needs a Google account
signed into Android itself.

- Emulator → Settings app → Passwords & Accounts → Add account → Google
- Use a dedicated test account, not your personal one
- For headless CI later, you can use Firebase Auth's email/password path
  instead of Google

## Running the tests

From the repo root:

```bash
# all flows
npm run e2e

# single flow
maestro test tests/e2e/01-google-signin.yaml

# with screenshots on every step (great for debugging)
maestro test --format junit --output-dir maestro-output tests/e2e/

# Maestro Studio (visual editor / element inspector)
maestro studio
```

## What each flow covers

| Flow | What it verifies |
|---|---|
| `00-launch-and-dismiss-onboarding` | App boots, dismisses any first-run modals |
| `01-google-signin` | Sign-in pre-warm + retry fix from audit batch 2 |
| `02-cellar-disposition-consistency` | Cellar grid icon matches detail dialog (`getEffectiveDisposition`) |
| `03-stats-drilldown-and-back` | Clickable stat cards + hardware-back-from-Radix fix |
| `04-camera-open-close` | Camera FAB + mode tabs + status-bar safe area |
| `05-add-wine-manual` | AddWineDialog auto-jump + manual entry → server save |
| `06-notifications-toggle` | Settings notifications card + OS permission flow |

## Adding new flows

1. Copy an existing flow as a starting point.
2. Use `maestro studio` to inspect element ids / text.
3. Prefer matching by visible text over coordinates (less brittle).
4. Use `extendedWaitUntil` for navigation; the WebView can take 1–3s to
   transition.
5. Whenever Maestro can't find an element by text, fall back to `tapOn:
   point: "X%,Y%"` — but flag it for follow-up with a real id.
6. Add the new flow to the table in this README.

## CI integration (optional)

GitHub Actions has emulators in macOS runners but they're slow (~10 min boot).
Better: use [Maestro Cloud](https://cloud.mobile.dev/) — free tier covers
~100 minutes/month, CI uploads the APK + flows and runs against real devices.

```yaml
# .github/workflows/e2e.yml
name: E2E (Maestro Cloud)
on: [pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build && npx cap sync android
      - run: cd android && ./gradlew assembleDebug
      - uses: mobile-dev-inc/action-maestro-cloud@v1
        with:
          api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
          app-file: android/app/build/outputs/apk/debug/app-debug.apk
```

## Troubleshooting

- **"No connected devices"** → boot the AVD first; verify with `adb devices`.
- **Element not found** → run `maestro studio` and inspect the actual ids.
  WebView elements get `accessibility-id` from React's `id` prop or `aria-label`.
- **Flows pass locally, fail on someone else's machine** → coordinate-based
  taps are screen-size-dependent. Replace with text/id matching.
- **Google sign-in flow gets stuck on a captcha** → use a real phone number
  on the test Google account, or switch the flow to email/password sign-in.
