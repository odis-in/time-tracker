// build/notarize.js
const { notarize } = require('@electron/notarize');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function sh(cmd, args, opts = {}) {
  console.log(`[exec] ${cmd} ${args.join(' ')}`);
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function tryStaple(target) {
  try {
    sh('xcrun', ['stapler', 'staple', '-v', target]);
  } catch (e) {
    console.warn(`[staple] warning on ${target}:`, e.message || e);
  }
}

exports.default = async function notarizeHook(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;
  if (appOutDir.includes('mas')) {
    console.log('[notarize] skipping MAS build');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appBundleId = packager.appInfo.appId;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // *** OJO: usamos variables NOTARY_* en vez de ASC_* ***
  const useApiKey =
    !!process.env.NOTARY_KEY_ID &&
    !!process.env.NOTARY_ISSUER_ID &&
    !!process.env.NOTARY_KEY_PATH;

  const useAppleId =
    !!process.env.NOTARY_APPLE_ID &&
    !!process.env.NOTARY_APPLE_TEAM_ID &&
    !!process.env.NOTARY_APP_PW; // app-specific password

  if (!useApiKey && !useAppleId) {
    throw new Error(
      'Set NOTARY_* vars (NOTARY_KEY_ID / NOTARY_ISSUER_ID / NOTARY_KEY_PATH) o (NOTARY_APPLE_ID / NOTARY_APPLE_TEAM_ID / NOTARY_APP_PW)'
    );
  }

  console.log('[notarize] app:', appName, ' bundleId:', appBundleId);

  try {
    sh('codesign', ['-dv', '--verbose=4', appPath]);
  } catch {}

  const base = { tool: 'notarytool', appBundleId, appPath };
  const auth = useApiKey
    ? {
        appleApiKey: process.env.NOTARY_KEY_PATH,
        appleApiKeyId: process.env.NOTARY_KEY_ID,
        appleApiIssuer: process.env.NOTARY_ISSUER_ID,
      }
    : {
        appleId: process.env.NOTARY_APPLE_ID,
        teamId: process.env.NOTARY_APPLE_TEAM_ID,
        password: process.env.NOTARY_APP_PW,
      };

  console.log('[notarize] submitting to Apple…');
  await notarize({ ...base, ...auth });
  console.log('[notarize] Apple notarization: DONE');

  console.log('[notarize] stapling .app…');
  tryStaple(appPath);

  // staple al DMG si existe
  try {
    const distDir = path.resolve(appOutDir, '..');
    const dmg = fs.readdirSync(distDir).find((f) => f.endsWith('.dmg'));
    if (dmg) {
      console.log('[notarize] stapling .dmg…', dmg);
      tryStaple(path.join(distDir, dmg));
    }
  } catch {}
};