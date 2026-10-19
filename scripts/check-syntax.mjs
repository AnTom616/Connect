/**
 * Verifica a sintaxe de todos os arquivos JS do projeto (`npm run lint`).
 * Usa `node --check` (não executa os arquivos, apenas valida a sintaxe).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));

function coletarArquivos(pasta) {
  const encontrados = [];
  if (!fs.existsSync(pasta)) return encontrados;
  for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...coletarArquivos(caminho));
    else if (/\.(js|mjs)$/.test(entrada.name)) encontrados.push(caminho);
  }
  return encontrados;
}

const arquivos = [
  path.join(raiz, '..', 'server.mjs'),
  ...coletarArquivos(path.join(raiz, '..', 'api')),
  ...coletarArquivos(path.join(raiz, '..', 'public', 'js')),
  ...coletarArquivos(raiz),
];

let falhas = 0;
for (const arquivo of arquivos) {
  try {
    execFileSync(process.execPath, ['--check', arquivo], { stdio: 'pipe' });
    console.log(`✔ ${path.relative(path.join(raiz, '..'), arquivo)}`);
  } catch (erro) {
    falhas += 1;
    console.error(`✖ ${arquivo}`);
    console.error(String(erro.stderr || erro.message));
  }
}

if (falhas > 0) {
  console.error(`\n${falhas} arquivo(s) com erro de sintaxe.`);
  process.exitCode = 1;
} else {
  console.log(`\n✔ Sintaxe OK em ${arquivos.length} arquivo(s).`);
}
