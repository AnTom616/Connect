/**
 * ============================================================
 * ConnectHub — Servidor local de desenvolvimento
 * ------------------------------------------------------------
 * Reproduz, localmente, o mesmo comportamento da Vercel:
 *   - arquivos estáticos de /public (frontend);
 *   - rotas /api/* atendidas pelos MESMOS handlers das Functions.
 *
 * Uso: npm run dev  →  http://localhost:3000
 * ============================================================
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { listarCadastros, criarCadastro, obterCadastro, atualizarCadastro, excluirCadastro, estatisticas, saude } =
  require('./api/_lib/handlers.js');
const { responder, responderNoContent, tratarRota } = require('./api/_lib/util.js');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PASTA_PUBLICA = path.join(RAIZ, 'public');
const PORTA = Number(process.env.PORT) || 3000;

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function aplicarCabecalhos(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/** Serve arquivos estáticos da pasta public/ com proteção contra path traversal. */
function servirEstatico(req, res, caminhoUrl) {
  const caminhoRelativo = decodeURIComponent(caminhoUrl).replace(/^\/+/, '');
  let arquivo = path.normalize(path.join(PASTA_PUBLICA, caminhoRelativo || 'index.html'));

  if (!arquivo.startsWith(PASTA_PUBLICA)) {
    res.statusCode = 403;
    return res.end('Acesso negado.');
  }
  if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    arquivo = path.join(PASTA_PUBLICA, 'index.html'); // fallback SPA
    if (!fs.existsSync(arquivo)) {
      res.statusCode = 404;
      return res.end('Não encontrado.');
    }
  }

  const extensao = path.extname(arquivo).toLowerCase();
  res.setHeader('Content-Type', TIPOS_MIME[extensao] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(arquivo).pipe(res);
}

/** Distribui as rotas /api/* para os mesmos handlers usados na Vercel. */
async function atenderApi(req, res, url) {
  const { pathname } = url;
  aplicarCabecalhos(res);

  if (req.method === 'OPTIONS') return responderNoContent(res);

  if (pathname === '/api/saude' && req.method === 'GET') {
    return tratarRota(req, res, () => saude(req, res));
  }
  if (pathname === '/api/estatisticas' && req.method === 'GET') {
    return tratarRota(req, res, () => estatisticas(req, res));
  }
  if (pathname === '/api/cadastros' && (req.method === 'GET' || req.method === 'POST')) {
    req.query = Object.fromEntries(url.searchParams); // espelha o comportamento das Vercel Functions
    return tratarRota(req, res, () =>
      req.method === 'GET' ? listarCadastros(req, res) : criarCadastro(req, res)
    );
  }

  const correspondencia = pathname.match(/^\/api\/cadastros\/([^/]+)$/);
  if (correspondencia) {
    req.query = { ...Object.fromEntries(url.searchParams), id: decodeURIComponent(correspondencia[1]) };
    if (req.method === 'GET') return tratarRota(req, res, () => obterCadastro(req, res));
    if (req.method === 'PUT') return tratarRota(req, res, () => atualizarCadastro(req, res));
    if (req.method === 'DELETE') return tratarRota(req, res, () => excluirCadastro(req, res));
    return responder(res, 405, { erro: 'Método não permitido. Use GET, PUT ou DELETE.' });
  }

  responder(res, 404, { erro: 'Endpoint não encontrado.' });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await atenderApi(req, res, url);
    } else {
      aplicarCabecalhos(res);
      servirEstatico(req, res, url.pathname);
    }
  } catch (erro) {
    console.error('[ConnectHub] Falha não tratada:', erro);
    if (!res.headersSent) {
      responder(res, 500, { erro: 'Erro interno no servidor.' });
    }
  }
});

servidor.listen(PORTA, () => {
  console.log('┌──────────────────────────────────────────────────┐');
  console.log('│  ConnectHub — Sistema de Gerenciamento de         │');
  console.log('│  Cadastros                                        │');
  console.log('│──────────────────────────────────────────────────│');
  console.log(`│  Servidor local:  http://localhost:${PORTA}           │`);
  console.log(`│  Banco de dados:  ${process.env.DATABASE_URL ? 'PostgreSQL (DATABASE_URL)' : 'SQLite (desenvolvimento)'}  │`);
  console.log('│  Modo de uso:     npm run dev                     │');
  console.log('└──────────────────────────────────────────────────┘');
});

/** Encerramento gracioso (Ctrl+C). */
process.on('SIGINT', () => {
  console.log('\n[ConnectHub] Encerrando o servidor local...');
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
});
