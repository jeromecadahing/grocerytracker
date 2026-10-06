# Grocery Tally (synced with Firebase)

Running total while you shop (per-item tax on/off, USD / GBP / PHP), plus a monthly view of who paid, from which bank or card, and at which store. Trips and settings are shared between everyone signed in. Each person has their own cart, so you can shop separately. Works with no signal and catches up when you're back online.

## Part 1: Set up Firebase (about 10 minutes, free plan is fine)

1. Go to https://console.firebase.google.com and open your project (or click **Add project** to make a new one, e.g. "grocery-tally").
2. **Add a web app:** click the gear ⚙ → **Project settings** → scroll to **Your apps** → click the **</>** (Web) icon → give it a nickname → **Register app**. Firebase shows a `firebaseConfig = { ... }` block. Copy the values into `config.js` in this folder.
3. **Turn on sign-in:** left menu **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**.
4. **Create the database:** **Build → Firestore Database → Create database**. Pick a location near you, choose **Start in production mode**, then **Create**.
5. **Set who's allowed in:** in Firestore, open the **Rules** tab, delete what's there, paste everything from `firestore.rules`, change the two emails to yours and your wife's (lowercase), and click **Publish**.
6. **Allow your GitHub address:** **Authentication → Settings → Authorized domains → Add domain**, and add `<your-github-username>.github.io`.

## Part 2: Put it on GitHub Pages

1. On github.com, create a new **public** repository (e.g. `grocery-tally`).
2. **Add file → Upload files**, drag in every file from this folder (including the edited `config.js`), and commit.
3. **Settings → Pages**, Source **Deploy from a branch**, branch `main`, folder `/ (root)`, **Save**.
4. After a minute the app is at `https://<your-username>.github.io/grocery-tally/`.

## Part 3: Install on both phones

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open the link in Chrome → ⋮ → **Install app** (or **Add to Home screen**).

Open it and tap **Create account** with the email you put in the rules. Your wife does the same on her phone with her email. After that, it remembers you. You can also open the same link on your PC.

## Good to know

- The Firebase config in `config.js` is meant to be public; that's normal for Firebase web apps. What protects your data is the email list in the rules.
- Once you've both created accounts, you can optionally stop anyone else signing up: **Authentication → Settings → User actions →** untick **Enable create (sign-up)**.
- If you ever change the app files, bump `CACHE = "grocery-tally-v3"` in `sw.js` (e.g. to v4) so phones pick up the new version.
- If the app says "No access: check the email list in your Firestore rules", the email you signed in with doesn't match the rules exactly.
