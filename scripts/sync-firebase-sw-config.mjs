/**
 * Inject the Firebase web config into the FCM service worker at build time.
 *
 * Reads `public/firebase-messaging-sw.js` (the template), substitutes the
 * `@inject-firebase-config` placeholder with a JSON object built from the
 * `VITE_FIREBASE_*` env vars, and writes the result to
 * `<outDir>/firebase-messaging-sw.js` (default: `dist/`).
 *
 * Usage (CLI):
 *   node scripts/sync-firebase-sw-config.mjs
 *   node scripts/sync-firebase-sw-config.mjs --out-dir build
 *
 * Behaviour:
 *   - When all six env vars are present, the placeholder `null` becomes a
 *     fully populated config object and FCM initialises at runtime.
 *   - When env vars are missing in a production build (NODE_ENV=production),
 *     the script exits 1 with a helpful error.
 *   - In non-production builds the script still writes the worker (with the
 *     `null` placeholder intact) and prints a warning. The SW itself
 *     short-circuits and disables FCM, so dev/preview keeps working.
 *
 * The pure `injectConfig(source, env)` helper is exported for unit tests.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE_PATH = join(ROOT, 'public', 'firebase-messaging-sw.js');
const DEFAULT_OUT_DIR = join(ROOT, 'dist');

/**
 * Ordered list of env vars consumed by the FCM service worker.
 *
 * Each entry maps a `VITE_FIREBASE_*` env var to the Firebase config key it
 * fills. Keys marked `required: true` must be present in production builds;
 * `authDomain` and `storageBucket` are technically optional for FCM but we
 * still treat them as required for a complete config (Firebase APIs warn
 * when they're missing).
 *
 * @type {ReadonlyArray<{ env: string, key: string, required: boolean }>}
 */
export const ENV_FIELDS = Object.freeze([
  { env: 'VITE_FIREBASE_API_KEY', key: 'apiKey', required: true },
  { env: 'VITE_FIREBASE_AUTH_DOMAIN', key: 'authDomain', required: true },
  { env: 'VITE_FIREBASE_PROJECT_ID', key: 'projectId', required: true },
  { env: 'VITE_FIREBASE_STORAGE_BUCKET', key: 'storageBucket', required: true },
  { env: 'VITE_FIREBASE_MESSAGING_SENDER_ID', key: 'messagingSenderId', required: true },
  { env: 'VITE_FIREBASE_APP_ID', key: 'appId', required: true },
]);

// Matches the `@inject-firebase-config` block-comment marker followed by
// `const FIREBASE_CONFIG = null;`. Tolerant whitespace handling lets the
// template be reformatted without breaking the substitution.
const INJECTION_PATTERN =
  /(\/\*\s*@inject-firebase-config\s*\*\/\s*const\s+FIREBASE_CONFIG\s*=\s*)null(\s*;)/;

/**
 * Pure substitution. Replaces the `@inject-firebase-config` placeholder with
 * a JSON config object built from the supplied env. When any required env var
 * is missing, the placeholder is left intact (so the worker's runtime guard
 * can detect the missing field and disable FCM).
 *
 * @param {string} source - Contents of `public/firebase-messaging-sw.js`.
 * @param {Record<string, string | undefined>} env - Build-time env (e.g. process.env).
 * @returns {{ output: string, missing: string[], replaced: string[], config: Record<string, string> | null }}
 */
export function injectConfig(source, env) {
  const config = /** @type {Record<string, string>} */ ({});
  const missing = [];
  const replaced = [];

  for (const { env: envKey, key, required } of ENV_FIELDS) {
    const value = env[envKey];
    if (typeof value === 'string' && value.length > 0) {
      config[key] = value;
      replaced.push(envKey);
    } else if (required) {
      missing.push(envKey);
    }
  }

  if (missing.length > 0) {
    return { output: source, missing, replaced, config: null };
  }

  if (!INJECTION_PATTERN.test(source)) {
    throw new Error(
      '[sync-firebase-sw-config] Could not find the `@inject-firebase-config` ' +
        'placeholder in firebase-messaging-sw.js. Did the template get edited?',
    );
  }

  // JSON.stringify produces a value that is also a valid JS expression for
  // the config object we want, so we can substitute it directly into the
  // source. The pattern preserves the leading marker comment.
  const json = JSON.stringify(config);
  const output = source.replace(INJECTION_PATTERN, (_full, pre, post) => `${pre}${json}${post}`);
  return { output, missing, replaced, config };
}

/**
 * Reads the SW template, runs `injectConfig`, and writes the result.
 *
 * @param {{
 *   outDir?: string,
 *   sourcePath?: string,
 *   env?: Record<string, string | undefined>,
 *   isProduction?: boolean,
 *   logger?: { warn: (msg: string) => void, info: (msg: string) => void },
 * }} [opts]
 * @returns {Promise<{ outPath: string, missing: string[], replaced: string[] }>}
 */
export async function syncFirebaseSwConfig(opts = {}) {
  const {
    outDir = DEFAULT_OUT_DIR,
    sourcePath = DEFAULT_SOURCE_PATH,
    env = process.env,
    isProduction = env.NODE_ENV === 'production',
    logger = console,
  } = opts;

  const source = await readFile(sourcePath, 'utf8');
  const { output, missing, replaced } = injectConfig(source, env);

  if (missing.length > 0) {
    const message =
      `[sync-firebase-sw-config] Missing env vars: ${missing.join(', ')}. ` +
      'Background push notifications will be disabled until these are set. ' +
      'See docs/FIREBASE_PUSH_NOTIFICATIONS.md.';
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn(message);
  } else {
    logger.info(
      `[sync-firebase-sw-config] Injected ${replaced.length} env values into firebase-messaging-sw.js.`,
    );
  }

  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'firebase-messaging-sw.js');
  await writeFile(outPath, output, 'utf8');
  return { outPath, missing, replaced };
}

/**
 * @param {string[]} argv
 * @returns {{ outDir?: string }}
 */
function parseArgs(argv) {
  /** @type {{ outDir?: string }} */
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-dir' || a === '-o') {
      args.outDir = argv[++i];
    } else if (a.startsWith('--out-dir=')) {
      args.outDir = a.slice('--out-dir='.length);
    } else if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log(
        'Usage: node scripts/sync-firebase-sw-config.mjs [--out-dir <path>]\n' +
          '\n' +
          'Reads public/firebase-messaging-sw.js, substitutes the\n' +
          'VITE_FIREBASE_* env vars, and writes to <out-dir>/firebase-messaging-sw.js.\n',
      );
      process.exit(0);
    }
  }
  return args;
}

/**
 * Cross-platform check for "was this file launched as a script?". On Windows
 * the drive letter case can differ between `import.meta.url` and
 * `process.argv[1]`, so we normalise before comparing.
 */
function isRunningAsScript() {
  const argvEntry = process.argv[1];
  if (!argvEntry) return false;
  try {
    const here = fileURLToPath(import.meta.url);
    const there = resolve(argvEntry);
    if (process.platform === 'win32') {
      return here.toLowerCase() === there.toLowerCase();
    }
    return here === there;
  } catch {
    return false;
  }
}

if (isRunningAsScript()) {
  const { outDir } = parseArgs(process.argv.slice(2));
  try {
    await syncFirebaseSwConfig(outDir ? { outDir: resolve(outDir) } : {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  }
}
