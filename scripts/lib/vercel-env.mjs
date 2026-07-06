#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

export function listVercelEnvNames() {
    const r = spawnSync('npx', ['vercel', 'env', 'ls'], { encoding: 'utf8', shell: true });
    if (r.status !== 0) return null;
    return new Set(
        (r.stdout ?? '')
            .split('\n')
            .map((line) => line.trim().split(/\s+/)[0])
            .filter((name) => name && /^[A-Z0-9_]+$/.test(name)),
    );
}

export function setVercelEnv(name, value) {
    spawnSync('npx', ['vercel', 'env', 'rm', name, 'production', '--yes'], {
        encoding: 'utf8',
        shell: true,
    });
    return spawnSync('npx', ['vercel', 'env', 'add', name, 'production'], {
        encoding: 'utf8',
        shell: true,
        input: `${value}\n`,
    });
}

/** Push env vars from process.env to Vercel production when values are non-empty. */
export function applyVercelEnvVars(names) {
    const applied = [];
    const skipped = [];
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (!value) {
            skipped.push(name);
            continue;
        }
        const r = setVercelEnv(name, value);
        if ((r.status ?? 1) !== 0) {
            return { ok: false, applied, skipped, failed: name };
        }
        applied.push(name);
    }
    return { ok: true, applied, skipped, failed: null };
}
