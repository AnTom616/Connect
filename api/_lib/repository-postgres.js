/**
 * ============================================================
 * ConnectHub — Repositório PostgreSQL (PRODUÇÃO — Vercel)
 * ------------------------------------------------------------
 * Implementa a mesma interface do repositório SQLite, mas usando
 * PostgreSQL — o banco recomendado para a publicação na Vercel.
 *
 * ✅ Recomendado: Neon Postgres (https://neon.tech)
 *    - Integração oficial no Marketplace da Vercel (tier gratuito);
 *    - Connection string fornecida via variável DATABASE_URL;
 *    - Funciona também com Railway, Render, Aiven, Amazon RDS etc.
 *
 * O driver usado é o `pg` (node-postgres), compatível com qualquer
 * provedor de PostgreSQL padrão.
 * ============================================================
 */

const { Pool } = require('pg');
const { HttpError } = require('./util');

const SQL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS cadastros (
    id        TEXT PRIMARY KEY,
    nome      TEXT NOT NULL,
    email     TEXT NOT NULL,
    telefone  TEXT NOT NULL,
    cidade    TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_cadastros_email ON cadastros (lower(email));
  CREATE INDEX IF NOT EXISTS ix_cadastros_nome ON cadastros (nome);
  CREATE INDEX IF NOT EXISTS ix_cadastros_criado_em ON cadastros (criado_em);
`;

const CODIGO_VIOLACAO_UNICA = '23505';

function criarRepositorioPostgres(urlConexao) {
  const pool = new Pool({
    connectionString: urlConexao,
    max: 5,
    // Neon e demais provedores exigem TLS; sslmode=disable na URL desativa.
    ssl: /sslmode=disable/i.test(urlConexao) ? false : { rejectUnauthorized: false },
  });

  /** Garante que o schema exista (executado uma única vez por instância). */
  async function init() {
    await pool.query(SQL_SCHEMA);
    console.log('[ConnectHub] PostgreSQL pronto (DATABASE_URL configurada).');
  }

  /** Converte datas do driver para ISO 8601. */
  function mapearLinha(linha) {
    if (!linha) return null;
    return {
      ...linha,
      criado_em:
        linha.criado_em instanceof Date ? linha.criado_em.toISOString() : String(linha.criado_em),
    };
  }

  async function listar({ busca = '', ordenarPor = 'criado_em', ordem = 'desc', pagina = 1, porPagina = 10 }) {
    const colunas = { nome: 'nome', criado_em: 'criado_em' };
    const coluna = colunas[ordenarPor] ?? colunas.criado_em;
    const direcao = String(ordem).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const deslocamento = (pagina - 1) * porPagina;

    const params = [];
    let filtro = '';
    if (busca) {
      params.push(`%${busca}%`);
      filtro = ` AND (nome ILIKE $1 OR email ILIKE $1 OR cidade ILIKE $1)`;
    }

    const totalResultado = await pool.query(`SELECT COUNT(*)::int AS total FROM cadastros WHERE 1 = 1${filtro}`, params);
    const total = Number(totalResultado.rows[0]?.total ?? 0);

    const linhas = await pool.query(
      `SELECT * FROM cadastros WHERE 1 = 1${filtro} ORDER BY ${coluna} ${direcao} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, porPagina, deslocamento]
    );

    return {
      itens: linhas.rows.map(mapearLinha),
      total,
      pagina,
      porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    };
  }

  async function obterPorId(id) {
    const resultado = await pool.query('SELECT * FROM cadastros WHERE id = $1', [id]);
    return mapearLinha(resultado.rows[0] ?? null);
  }

  async function emailEmUso(email, excetoId = null) {
    const resultado = excetoId
      ? await pool.query('SELECT 1 FROM cadastros WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1', [email, excetoId])
      : await pool.query('SELECT 1 FROM cadastros WHERE lower(email) = lower($1) LIMIT 1', [email]);
    return resultado.rowCount > 0;
  }

  async function criar(dados) {
    try {
      const resultado = await pool.query(
        `INSERT INTO cadastros (id, nome, email, telefone, cidade)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nome, email, telefone, cidade, criado_em`,
        [dados.id, dados.nome, dados.email, dados.telefone, dados.cidade]
      );
      return mapearLinha(resultado.rows[0]);
    } catch (erro) {
      if (erro && erro.code === CODIGO_VIOLACAO_UNICA) {
        throw new HttpError(409, 'Já existe um cadastro com este e-mail.');
      }
      throw erro;
    }
  }

  async function atualizar(id, dados) {
    try {
      const resultado = await pool.query(
        `UPDATE cadastros
         SET nome = $1, email = $2, telefone = $3, cidade = $4
         WHERE id = $5
         RETURNING id, nome, email, telefone, cidade, criado_em`,
        [dados.nome, dados.email, dados.telefone, dados.cidade, id]
      );
      return mapearLinha(resultado.rows[0] ?? null);
    } catch (erro) {
      if (erro && erro.code === CODIGO_VIOLACAO_UNICA) {
        throw new HttpError(409, 'Já existe um cadastro com este e-mail.');
      }
      throw erro;
    }
  }

  async function excluir(id) {
    const resultado = await pool.query('DELETE FROM cadastros WHERE id = $1', [id]);
    return resultado.rowCount > 0;
  }

  async function estatisticas() {
    const total = await pool.query('SELECT COUNT(*)::int AS total FROM cadastros');
    const recentes = await pool.query(
      "SELECT COUNT(*)::int AS total FROM cadastros WHERE criado_em >= now() - interval '7 days'"
    );
    return {
      total: Number(total.rows[0]?.total ?? 0),
      recentes: Number(recentes.rows[0]?.total ?? 0),
    };
  }

  async function verificarConexao() {
    await pool.query('SELECT 1');
    return true;
  }

  return {
    nome: 'PostgreSQL',
    init,
    listar,
    obterPorId,
    emailEmUso,
    criar,
    atualizar,
    excluir,
    estatisticas,
    verificarConexao,
  };
}

module.exports = { criarRepositorioPostgres };
