#!/usr/bin/env bun
/**
 * Converte assets/images/icon.png → assets/images/favicon.png em 48×48px
 * Uso: bun scripts/make-favicon.ts
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dir, '..');
const input = resolve(root, 'assets/images/icon.png');
const output = resolve(root, 'assets/images/favicon.png');
const SIZE = 48;

if (!existsSync(input)) {
  console.error(`Arquivo não encontrado: ${input}`);
  process.exit(1);
}

await sharp(input)
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(output);

console.log(`✓ favicon.png gerado em ${output} (${SIZE}×${SIZE}px)`);
