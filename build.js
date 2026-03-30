#!/usr/bin/env node
/**
 * build.js — Génère app.bundle.js avec le dictionnaire intégré
 * Usage: node build.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// 1. Lire dico.txt (encodage Windows-1252)
console.log('📖 Lecture de dico.txt…');
const buffer = readFileSync(join(__dir, 'data/dico.txt'));
const text = new TextDecoder('windows-1252').decode(buffer);

// 2. Parser les mots (même logique que dictionary.js)
const words = new Set();
const prefixes = new Set();

for (const line of text.split(/\r?\n/)) {
  const word = line.trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');

  if (word.length < 2) continue;
  words.add(word);
  for (let i = 1; i <= word.length; i++) {
    prefixes.add(word.substring(0, i));
  }
}

console.log(`✅ ${words.size} mots, ${prefixes.size} préfixes`);

// 3. Générer js/data/dico-embedded.js
const wordsJson = JSON.stringify([...words]);
const prefixesJson = JSON.stringify([...prefixes]);
const embedded = `// AUTO-GENERATED — ne pas éditer manuellement (voir build.js)
export const DICO_WORDS = new Set(${wordsJson});
export const DICO_PREFIXES = new Set(${prefixesJson});
`;
writeFileSync(join(__dir, 'js/data/dico-embedded.js'), embedded, 'utf8');
console.log('✅ js/data/dico-embedded.js généré');

// 4. Bundler avec esbuild
console.log('📦 Bundle esbuild…');
execSync('npx esbuild js/app.js --bundle --format=iife --outfile=app.bundle.js --minify', {
  cwd: __dir,
  stdio: 'inherit'
});

console.log('✅ app.bundle.js prêt !');
