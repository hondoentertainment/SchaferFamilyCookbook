#!/usr/bin/env node
/**
 * Copy seed recipes next to API handlers so Vercel bundles them with serverless functions.
 * Run automatically via package.json postinstall / pre-test hooks.
 */
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/data/recipes.json');
const dest = join(root, 'api/recipes.bundle.json');
copyFileSync(src, dest);
