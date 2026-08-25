#!/usr/bin/env node
// Serveur statique minimal pour les bancs d'essai, sans aucune dépendance.
//
// Pourquoi pas le serveur de dev Vite : son rechargement à chaud tue un run en cours
// dès qu'un fichier bouge dans l'arborescence — mesuré, un index de 337 affirmations
// perdu à 320. Il impose aussi une base `/FITTRACK-RELOADED/` qui n'a rien à faire ici.
//
// Sert `tools/e5-retrieval/` à la racine et les données sous `/lab/`.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contractRoot = resolve(here, '../..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

// Les données restent à leur place dans le dépôt : on les expose, on ne les duplique
// pas. Une copie dans public/ finissait dans le build de la PWA.
const ROUTES = {
  '/lab/corpus.json': join(contractRoot, 'candidates/e5-corpus.json'),
  '/lab/fragments.json': join(contractRoot, 'candidates/e5-prose-fragments.json'),
  '/lab/questions.json': join(contractRoot, 'benchmark/e5-retrieval/questions-30.json')
};

const port = Number(process.argv[2] ?? 5210);

createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const path = url.pathname === '/' ? '/index.html' : url.pathname;

  // Les bancs tournent dans le navigateur mais leurs mesures doivent finir versionnees
  // dans le depot. Les faire transiter par la console tronque le JSON et coute cher :
  // le banc POSTe son resultat ici. Ecriture confinee a benchmark/e5-retrieval/.
  if (request.method === 'POST' && path === '/lab/save') {
    const name = (url.searchParams.get('name') ?? '').replace(/[^a-z0-9.-]/gi, '');
    if (!name.endsWith('.json')) {
      response.writeHead(400).end('nom invalide');
      return;
    }
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const target = join(contractRoot, 'benchmark/e5-retrieval', name);
      writeFileSync(target, Buffer.concat(chunks));
      console.log('écrit : ' + target);
      response.writeHead(200, { 'content-type': 'text/plain' }).end(String(target));
    });
    return;
  }

  let file = ROUTES[path];
  if (!file) {
    // Confinement : un chemin ne peut pas remonter au-dessus du dossier servi.
    const candidate = resolve(here, `.${normalize(path)}`);
    if (candidate.startsWith(here) && existsSync(candidate) && statSync(candidate).isFile()) {
      file = candidate;
    }
  }
  if (!file || !existsSync(file)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`introuvable : ${path}`);
    return;
  }
  response.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store'
  });
  response.end(readFileSync(file));
}).listen(port, () => {
  console.log(`banc d'essai servi sur http://localhost:${port}`);
  console.log('  /embed-lab.html   recherche sémantique seule');
  console.log('  /judge-lab.html   le modèle juge et refuse');
});
