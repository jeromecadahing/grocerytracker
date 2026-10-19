// Firebase sync for Grocery Tally: shared settings + trips, one cart per person, works offline.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
         doc, collection, setDoc, deleteDoc, onSnapshot, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GT = window.GT;
const $ = id => document.getElementById(id);
const cfg = window.FIREBASE_CONFIG || {};
const HH = String(window.HOUSEHOLD || "home").replace(/[^a-zA-Z0-9_-]/g, "-");

const authBtn = $("signOutBtn");
authBtn.hidden = false;

if (!cfg.apiKey || cfg.apiKey.startsWith("PASTE")) {
  GT.setSync("Not set up for syncing yet");
  authBtn.hidden = true;
} else {
  start();
}

function start() {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  let fs;
  try { fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { fs = getFirestore(app); }

  const settingsRef = doc(fs, "households", HH, "meta", "settings");
  const tripsCol = collection(fs, "households", HH, "trips");
  const listRef = doc(fs, "households", HH, "meta", "list");
  const productsCol = collection(fs, "households", HH, "products");
  const seededKey = "gt_seeded_" + HH;
  let unsubs = [];

  const fail = err => {
    console.error(err);
    if (err && err.code === "permission-denied") GT.setSync("No access: check the email list in your Firestore rules");
    else GT.setSync("Not synced: " + (err && err.code ? err.code : "error"));
  };

  /* ----- sign-in sheet ----- */
  const sheet = $("authScrim");
  const showSheet = () => { $("aErr").textContent = ""; sheet.classList.add("open"); setTimeout(() => $("aEmail").focus(), 50); };
  const hideSheet = () => sheet.classList.remove("open");
  const friendly = code => ({
    "auth/invalid-email": "That email doesn't look right.",
    "auth/missing-password": "Enter a password.",
    "auth/weak-password": "Use at least 6 characters for the password.",
    "auth/email-already-in-use": "That email already has an account. Tap Sign in instead.",
    "auth/invalid-credential": "Email or password is wrong.",
    "auth/wrong-password": "Email or password is wrong.",
    "auth/user-not-found": "No account with that email yet. Tap Create account.",
    "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
    "auth/network-request-failed": "No internet connection. Try again when you have signal.",
    "auth/operation-not-allowed": "Email sign-in isn't turned on in Firebase yet (Authentication → Sign-in method)."
  })[code] || "Couldn't sign in (" + code + ").";
  const creds = () => [$("aEmail").value.trim().toLowerCase(), $("aPass").value];
  $("aSignIn").onclick = async () => {
    try { await signInWithEmailAndPassword(auth, ...creds()); } catch (e) { $("aErr").textContent = friendly(e.code); }
  };
  $("aCreate").onclick = async () => {
    try { await createUserWithEmailAndPassword(auth, ...creds()); } catch (e) { $("aErr").textContent = friendly(e.code); }
  };
  $("aPass").addEventListener("keydown", e => { if (e.key === "Enter") $("aSignIn").click(); });
  $("aSkip").onclick = () => { try { localStorage.setItem("gt_skip", "1"); } catch (e) {} hideSheet(); };

  /* ----- live sync while signed in ----- */
  onAuthStateChanged(auth, user => {
    unsubs.forEach(u => u()); unsubs = [];

    if (!user) {
      GT.setRemote(null);
      GT.setUser(null);
      GT.setSync("Saved on this phone");
      authBtn.textContent = "Sign in";
      authBtn.onclick = () => { $("setScrim").classList.remove("open"); showSheet(); };
      let skipped = false; try { skipped = localStorage.getItem("gt_skip") === "1"; } catch (e) {}
      if (!skipped) showSheet();
      return;
    }

    hideSheet();
    try { localStorage.removeItem("gt_skip"); } catch (e) {}
    GT.setUser(user.email);
    authBtn.textContent = "Sign out";
    authBtn.onclick = () => { if (confirm("Sign out? Your saved trips stay online.")) signOut(auth); };
    GT.setSync("Connecting…");

    const cartRef = doc(fs, "households", HH, "carts", user.uid);
    const local = GT.local();

    GT.setRemote({
      saveSettings: s => setDoc(settingsRef, s).catch(fail),
      saveCart: c => setDoc(cartRef, c).catch(fail),
      saveTrip: t => setDoc(doc(tripsCol, t.id), t).catch(fail),
      deleteTrip: id => deleteDoc(doc(tripsCol, id)).catch(fail),
      saveList: l => setDoc(listRef, l).catch(fail),
      saveProduct: (code, p) => setDoc(doc(productsCol, code), p).catch(fail)
    });

    unsubs.push(onSnapshot(listRef, snap => {
      if (snap.exists()) GT.applyList(snap.data());
      else if (!snap.metadata.fromCache) setDoc(listRef, local.list || { items: [] }).catch(fail);
    }, fail));

    let productsSeeded = false;
    unsubs.push(onSnapshot(productsCol, snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      if (!productsSeeded && !snap.metadata.fromCache) {
        productsSeeded = true;
        Object.entries(local.products || {}).forEach(([code, p]) => { if (!map[code]) { map[code] = p; setDoc(doc(productsCol, code), p).catch(fail); } });
      }
      GT.applyProducts(map);
    }, fail));

    unsubs.push(onSnapshot(settingsRef, snap => {
      if (snap.exists()) GT.applySettings(snap.data());
      else if (!snap.metadata.fromCache) setDoc(settingsRef, local.settings).catch(fail);
    }, fail));

    unsubs.push(onSnapshot(cartRef, snap => {
      if (snap.exists()) GT.applyCart(snap.data());
      else if (!snap.metadata.fromCache) setDoc(cartRef, local.cart).catch(fail);
    }, fail));

    unsubs.push(onSnapshot(tripsCol, { includeMetadataChanges: true }, snap => {
      // One time per phone: upload trips that were saved before syncing was set up.
      let seeded = false; try { seeded = localStorage.getItem(seededKey) === "1"; } catch (e) {}
      if (!snap.metadata.fromCache && !seeded) {
        const ids = new Set(snap.docs.map(d => d.id));
        const missing = local.trips.filter(t => t && t.id && !ids.has(t.id));
        for (let i = 0; i < missing.length; i += 400) {
          const b = writeBatch(fs);
          missing.slice(i, i + 400).forEach(t => b.set(doc(tripsCol, t.id), t));
          b.commit().catch(fail);
        }
        try { localStorage.setItem(seededKey, "1"); } catch (e) {}
        seeded = true;
      }
      if (!seeded && snap.empty) return; // don't blank the list before the server answers

      GT.applyTrips(snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
      GT.setSync(snap.metadata.hasPendingWrites ? "Saving…" : snap.metadata.fromCache ? "Offline: will sync" : "Synced");
    }, fail));
  });
}
