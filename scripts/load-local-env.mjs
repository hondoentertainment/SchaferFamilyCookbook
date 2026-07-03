#!/usr/bin/env node
/**
 * Load key=value pairs from .env-style files into process.env (without overwriting set vars).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadEnvFiles(...paths) {
    for (const filePath of paths) {
        if (!filePath || !existsSync(filePath)) continue;
        const raw = readFileSync(filePath, 'utf8');
        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq <= 0) continue;
            const key = trimmed.slice(0, eq).trim();
            let value = trimmed.slice(eq + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            value = value.replace(/\r\n/g, '').replace(/\n/g, '').replace(/\r$/, '');
            if (process.env[key] === undefined || process.env[key] === '') {
                process.env[key] = value;
            }
        }
    }
}

/** Load repo-local Vercel pull + optional user overrides. */
export function loadLocalOpsEnv(rootDir) {
    loadEnvFiles(
        join(rootDir, '.env.vercel.local'),
        join(rootDir, '.env.local'),
        join(rootDir, '.env.production.local'),
    );
}
