/**
 * One-shot: register the Android app in Firebase, add the SHA-1
 * fingerprint, and download google-services.json — all via the
 * Firebase Management API. Saves you the click-through in the
 * Firebase Console UI.
 *
 * Usage:
 *   node scripts/firebase-register-android.mjs <path-to-service-account.json>
 *
 * Requires the service account to have firebase.androidApps.create
 * permission (default firebase-adminsdk-* accounts have it).
 *
 * Output: writes android/app/google-services.json.
 *
 * Idempotent on the app: if an Android app with this packageName
 * already exists, it'll skip creation and reuse it. The SHA-1 add is
 * also de-duped server-side.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = "cellar-door-3bbeb";
const PACKAGE_NAME = "com.cellardoor.app";
const APP_NICKNAME = "Cellar Door Android";
const SHA1 = "61:69:33:76:6C:93:82:15:D0:BD:2F:D0:96:71:CB:24:93:D0:D5:79";
const OUTPUT = path.join("android", "app", "google-services.json");

const KEY_FILE = process.argv[2];
if (!KEY_FILE) {
  console.error("Usage: node scripts/firebase-register-android.mjs <service-account.json>");
  process.exit(1);
}

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"],
});

async function fbApi(method, path, body) {
  const client = await auth.getClient();
  const url = `https://firebase.googleapis.com/v1beta1/${path}`;
  const res = await client.request({ method, url, ...(body && { data: body }) });
  return res.data;
}

async function main() {
  console.log(`[step 1/4] Listing existing Android apps for ${PROJECT_ID}...`);
  let app;
  try {
    const list = await fbApi("GET", `projects/${PROJECT_ID}/androidApps`);
    app = (list.apps || []).find((a) => a.packageName === PACKAGE_NAME);
    if (app) console.log(`  found existing: ${app.appId} (${app.packageName})`);
  } catch (err) {
    console.error(`  error listing: ${err.message || err}`);
    throw err;
  }

  if (!app) {
    console.log(`[step 2/4] Creating new Android app for ${PACKAGE_NAME}...`);
    // POST returns a long-running operation; we poll until done.
    const op = await fbApi("POST", `projects/${PROJECT_ID}/androidApps`, {
      displayName: APP_NICKNAME,
      packageName: PACKAGE_NAME,
    });
    console.log(`  operation: ${op.name}`);
    // Poll the operation
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await fbApi("GET", op.name);
      if (status.done) {
        if (status.error) throw new Error(`Create failed: ${JSON.stringify(status.error)}`);
        app = status.response;
        console.log(`  created: ${app.appId}`);
        break;
      }
      process.stdout.write(".");
    }
    if (!app) throw new Error("Create operation timed out");
  } else {
    console.log("[step 2/4] Skipped (app already exists)");
  }

  // Extract just the appId from the resource name (projects/.../androidApps/<appId>)
  const appResource = app.name.split("/").slice(-1)[0];

  console.log(`[step 3/4] Adding SHA-1 fingerprint ${SHA1}...`);
  try {
    await fbApi("POST", `projects/-/androidApps/${appResource}/sha`, {
      shaHash: SHA1,
      certType: "SHA_1",
    });
    console.log("  added");
  } catch (err) {
    if (err.response?.data?.error?.message?.includes("already")) {
      console.log("  already present (skipped)");
    } else {
      console.error(`  error adding SHA: ${err.message}`);
      // non-fatal; google-services.json still useful without SHA
    }
  }

  console.log(`[step 4/4] Downloading google-services.json...`);
  const cfg = await fbApi("GET", `projects/-/androidApps/${appResource}/config`);
  if (!cfg.configFileContents) throw new Error("No configFileContents in response");
  // configFileContents is base64-encoded JSON
  const json = Buffer.from(cfg.configFileContents, "base64").toString("utf-8");
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, json);
  console.log(`  wrote ${OUTPUT} (${json.length} bytes)`);

  // Pretty-print summary
  console.log(`\nDone.`);
  console.log(`  appId:        ${app.appId}`);
  console.log(`  packageName:  ${app.packageName}`);
  console.log(`  google-services.json: ${OUTPUT}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
