#!/usr/bin/env node
/**
 * build.js — Génère le bundle à partir de dico.json (source unique)
 *
 * Produit :
 *   js/data/dico-embedded.js   — Sets de mots + préfixes + compteur défs
 *   data/defs/A.json … Z.json  — Définitions par lettre (chargées à la demande)
 *   app.bundle.js              — Bundle final
 *
 * Usage : node build.js
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── 1. Lire dico.json ───────────────────────────────────────────────
console.log('📖 Lecture de dico.json…');
const raw  = readFileSync(join(__dir, 'data/dico.json'), 'utf8');
const data = JSON.parse(raw);
console.log(`   ${data.length} entrées lues`);

// ── 2. Construire les Sets mots + préfixes ──────────────────────────
const words    = new Set();
const prefixes = new Set();

function normalize(mot) {
  return mot.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');
}

for (const entry of data) {
  const word = normalize(entry.mot);
  if (word.length < 2) continue;
  words.add(word);
  for (let i = 1; i <= word.length; i++) {
    prefixes.add(word.substring(0, i));
  }
}

console.log(`✅ ${words.size} mots, ${prefixes.size} préfixes`);

// ── 3. Construire les fichiers de définitions par lettre ─────────────
const defsDir = join(__dir, 'data/defs');
if (!existsSync(defsDir)) mkdirSync(defsDir, { recursive: true });

const byLetter = {};
let defCount   = 0;

for (const entry of data) {
  const word = normalize(entry.mot);
  if (word.length < 2) continue;

  const desc = (entry.description || '').trim();
  const def  = (entry.definition  || '').trim();
  if (!desc && !def) continue;

  const letter = word.charAt(0);
  if (!byLetter[letter]) byLetter[letter] = {};
  byLetter[letter][word] = {};
  if (desc) byLetter[letter][word].d = desc;
  if (def)  byLetter[letter][word].f = def;
  defCount++;
}

for (const [letter, entries] of Object.entries(byLetter)) {
  const path = join(defsDir, `${letter}.json`);
  writeFileSync(path, JSON.stringify(entries), 'utf8');
  const count = Object.keys(entries).length;
  const sizeKB = Math.round(JSON.stringify(entries).length / 1024);
  console.log(`   ${letter}.json — ${count} déf. (${sizeKB} Ko)`);
}

console.log(`✅ ${defCount} définitions réparties en ${Object.keys(byLetter).length} fichiers`);

// ── 4. Générer js/data/dico-embedded.js ─────────────────────────────
const wordsJson    = JSON.stringify([...words]);
const prefixesJson = JSON.stringify([...prefixes]);
const embedded = `// AUTO-GENERATED — ne pas éditer manuellement (voir build.js)
export const DICO_WORDS = new Set(${wordsJson});
export const DICO_PREFIXES = new Set(${prefixesJson});
export const DICO_DEF_COUNT = ${defCount};
`;
writeFileSync(join(__dir, 'js/data/dico-embedded.js'), embedded, 'utf8');
console.log('✅ js/data/dico-embedded.js généré');

// ── 5. Bundler avec esbuild ─────────────────────────────────────────
console.log('📦 Bundle esbuild…');
execSync('npx esbuild js/app.js --bundle --format=iife --outfile=app.bundle.js --minify', {
  cwd: __dir,
  stdio: 'inherit'
});

console.log('✅ app.bundle.js prêt !');
