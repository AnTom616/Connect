/**
 * ============================================================
 * ConnectHub — Fábrica da camada de acesso a dados
 * ------------------------------------------------------------
 * Decide qual repositório usar de acordo com o ambiente:
 *
 *  1. DATABASE_URL com PostgreSQL  → repository-postgres (Neon)
 *     → modo produção (Vercel) com persistência real;
 *  2. Sem DATABASE_URL + rodando localmente → repository-sqlite
 *     → modo desenvolvimento (arquivo /data/connecthub.db);
 *  3. Sem DATABASE_URL + rodando na Vercel → erro orientado:
 *     o sistema NUNCA simula persistência que não existe.
 * ============================================================
 */

const { ErroConfig } = require('./util');

const MENSAGEM_CONFIG = [
  'Banco de dados não configurado nesta implantação.',
  'Defina a variável de ambiente DATABASE_URL com a string de conexão de um PostgreSQL (recomendado: Neon Postgres, integração oficial da Vercel).',
  'O passo a passo completo está no arquivo README.md do projeto.',
].join(' ');

let promessaRepositorio = null;

function eUrlPostgres(url) {
  return /^postgres(ql)?:\/\//i.test(url);
}

async function criarRepositorio() {
  const url = (process.env.DATABASE_URL || '').trim();

  if (url && eUrlPostgres(url)) {
    const { criarRepositorioPostgres } = require('./repository-postgres');
    const repositorio = criarRepositorioPostgres(url);
    await repositorio.init();
    return repositorio;
  }

  if (url) {
    console.warn(
      '[ConnectHub] DATABASE_URL definida, mas não é uma URL de PostgreSQL (esperado "postgres://..."). Ignorando.'
    );
  }

  if (process.env.VERCEL) {
    throw new ErroConfig(MENSAGEM_CONFIG);
  }

  const path = require('node:path');
  const { criarRepositorioSQLite } = require('./repository-sqlite');
  const repositorio = criarRepositorioSQLite(path.join(process.cwd(), 'data', 'connecthub.db'));
  await repositorio.init();
  return repositorio;
}

/** Retorna o repositório ativo (cria na primeira chamada; refaz em caso de falha). */
function obterRepositorio() {
  if (!promessaRepositorio) {
    promessaRepositorio = criarRepositorio().catch((erro) => {
      promessaRepositorio = null; // permite nova tentativa na próxima requisição
      throw erro;
    });
  }
  return promessaRepositorio;
}

module.exports = { obterRepositorio, MENSAGEM_CONFIG };
