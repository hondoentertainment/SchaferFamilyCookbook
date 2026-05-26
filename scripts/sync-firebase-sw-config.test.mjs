import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectConfig, syncFirebaseSwConfig, ENV_FIELDS } from './sync-firebase-sw-config.mjs';

const TEMPLATE = `importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js');

/* @inject-firebase-config */
const FIREBASE_CONFIG = null;

const REQUIRED = ['apiKey', 'projectId', 'messagingSenderId', 'appId'];
if (!FIREBASE_CONFIG || REQUIRED.some((k) => !FIREBASE_CONFIG[k])) {
  console.warn('disabled');
} else {
  firebase.initializeApp(FIREBASE_CONFIG);
}
`;

const FULL_ENV = Object.freeze({
  VITE_FIREBASE_API_KEY: 'k-123',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-proj',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '987654321',
  VITE_FIREBASE_APP_ID: '1:987654321:web:abc123',
});

/**
 * Wrap the substituted SW source in a function body that stubs out the
 * browser-only globals (`importScripts`, `self`, `firebase`, `console`) so
 * the parser sees a syntactically valid program. `new Function(src)` only
 * parses — it does not execute — but this keeps the test agnostic to whether
 * Node ever decides to validate identifier references at parse time.
 */
function assertParses(src) {
  expect(() => new Function('importScripts', 'self', 'firebase', 'console', src)).not.toThrow();
}

let tmpRoot = '';

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'fcm-sw-'));
});

afterEach(async () => {
  if (tmpRoot) {
    await rm(tmpRoot, { recursive: true, force: true });
    tmpRoot = '';
  }
});

async function writeTemplate(contents = TEMPLATE) {
  const sourcePath = join(tmpRoot, 'firebase-messaging-sw.js');
  await writeFile(sourcePath, contents, 'utf8');
  return sourcePath;
}

describe('injectConfig', () => {
  it('replaces the placeholder when every env var is present', () => {
    const { output, missing, replaced, config } = injectConfig(TEMPLATE, FULL_ENV);

    expect(missing).toEqual([]);
    expect(replaced).toHaveLength(ENV_FIELDS.length);
    expect(output).not.toMatch(/const FIREBASE_CONFIG = null;/);

    // Each value made it into the resulting source.
    for (const { env, key } of ENV_FIELDS) {
      expect(config?.[key]).toBe(FULL_ENV[env]);
      expect(output).toContain(JSON.stringify(FULL_ENV[env]));
    }

    // The substitution must keep the marker comment so future builds remain idempotent.
    expect(output).toContain('/* @inject-firebase-config */');

    assertParses(output);
  });

  it('leaves the placeholder intact when env vars are missing', () => {
    const { output, missing, replaced, config } = injectConfig(TEMPLATE, {});

    expect(missing).toHaveLength(ENV_FIELDS.length);
    expect(replaced).toEqual([]);
    expect(config).toBeNull();
    expect(output).toBe(TEMPLATE);
    expect(output).toContain('const FIREBASE_CONFIG = null;');

    assertParses(output);
  });

  it('reports partial misses without partially mutating output', () => {
    const partial = { ...FULL_ENV };
    delete partial.VITE_FIREBASE_APP_ID;

    const { output, missing } = injectConfig(TEMPLATE, partial);

    expect(missing).toEqual(['VITE_FIREBASE_APP_ID']);
    // Partial substitutions are unsafe (would inject a broken object), so the
    // template stays untouched and the SW falls back to its disabled branch.
    expect(output).toBe(TEMPLATE);
  });

  it('throws a clear error when the marker is missing from the source', () => {
    const broken = TEMPLATE.replace('/* @inject-firebase-config */', '/* whoops */');
    expect(() => injectConfig(broken, FULL_ENV)).toThrow(/@inject-firebase-config/);
  });
});

describe('syncFirebaseSwConfig', () => {
  it('writes a substituted worker when env vars are present', async () => {
    const sourcePath = await writeTemplate();
    const outDir = join(tmpRoot, 'dist');
    const logger = { warn: vi.fn(), info: vi.fn() };

    const result = await syncFirebaseSwConfig({
      sourcePath,
      outDir,
      env: FULL_ENV,
      isProduction: true,
      logger,
    });

    expect(result.missing).toEqual([]);
    expect(result.outPath).toBe(join(outDir, 'firebase-messaging-sw.js'));
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledOnce();

    const written = await readFile(result.outPath, 'utf8');
    expect(written).toContain('"apiKey":"k-123"');
    expect(written).not.toContain('= null;');
    assertParses(written);
  });

  it('throws in production when env vars are missing', async () => {
    const sourcePath = await writeTemplate();
    const outDir = join(tmpRoot, 'dist');

    await expect(
      syncFirebaseSwConfig({
        sourcePath,
        outDir,
        env: {},
        isProduction: true,
        logger: { warn: vi.fn(), info: vi.fn() },
      }),
    ).rejects.toThrow(/Missing env vars/);
  });

  it('warns but still emits the placeholder worker in dev builds', async () => {
    const sourcePath = await writeTemplate();
    const outDir = join(tmpRoot, 'dist');
    const logger = { warn: vi.fn(), info: vi.fn() };

    const result = await syncFirebaseSwConfig({
      sourcePath,
      outDir,
      env: {},
      isProduction: false,
      logger,
    });

    expect(result.missing).toHaveLength(ENV_FIELDS.length);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.info).not.toHaveBeenCalled();

    const written = await readFile(result.outPath, 'utf8');
    expect(written).toContain('const FIREBASE_CONFIG = null;');
    assertParses(written);
  });

  it('creates the output directory when it does not exist', async () => {
    const sourcePath = await writeTemplate();
    const nestedOutDir = join(tmpRoot, 'nested', 'level', 'dist');
    // Sanity-check: the dir really doesn't exist yet.
    await expect(readFile(join(nestedOutDir, 'firebase-messaging-sw.js'))).rejects.toThrow();

    const result = await syncFirebaseSwConfig({
      sourcePath,
      outDir: nestedOutDir,
      env: FULL_ENV,
      isProduction: false,
      logger: { warn: vi.fn(), info: vi.fn() },
    });

    const written = await readFile(result.outPath, 'utf8');
    expect(written).toContain('"projectId":"demo-proj"');
  });
});
