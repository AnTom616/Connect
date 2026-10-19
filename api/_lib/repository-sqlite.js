/**
 * ============================================================
 * ConnectHub — Repositório SQLite (ambiente de DESENVOLVIMENTO)
 * ------------------------------------------------------------
 * Implementa a interface de acesso a dados usando o SQLite
 * nativo do Node.js (node:sqlite), sem dependências externas.
 *
 * ⚠ IMPORTANTE: este driver existe para facilitar o desenvolvimento
 * local (npm run dev). Ele NÃO é usado na Vercel: em produção o
 * armazenamento é o PostgreSQL (Neon) via repository-postgres.js,
 * ativado automaticamente quando DATABASE_URL está definida.
 * ============================================================
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SQL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS cadastros (
    id        TEXT PRIMARY KEY,
    nome      TEXT NOT NULL,
    email     TEXT NOT NULL,
    telefone  TEXT NOT NULL,
    cidade    TEXT NOT NULL,
    criado_em TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_cadastros_email ON cadastros (email COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS ix_cadastros_nome ON cadastros (nome);
  CREATE INDEX IF NOT EXISTS ix_cadastros_criado_em ON cadastros (criado_em);
`;

function criarRepositorioSQLite(caminhoArquivo) {
  let db = null;

  /** Garante que o banco e o schema existam (executado uma única vez). */
  async function init() {
    fs.mkdirSync(path.dirname(caminhoArquivo), { recursive: true });
    db = new DatabaseSync(caminhoArquivo);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SQL_SCHEMA);
    console.log(`[ConnectHub] SQLite pronto em ${caminhoArquivo}`);
  }

  /** Converte um termo de busca em cláusula segura (apenas colunas fixas). */
  function condicaoBusca(termo) {
    if (!termo) return { sql: '', params: [] };
    const padrao = `%${termo}%`;
    return {
      sql: ' AND (nome LIKE ? OR email LIKE ? OR cidade LIKE ?)',
      params: [padrao, padrao, padrao],
    };
  }

  async function listar({ busca = '', ordenarPor = 'criado_em', ordem = 'desc', pagina = 1, porPagina = 10 }) {
    const colunas = { nome: 'nome COLLATE NOCASE', criado_em: 'criado_em' };
    const coluna = colunas[ordenarPor] ?? colunas.criado_em;
    const direcao = String(ordem).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const deslocamento = (pagina - 1) * porPagina;

    const { sql: filtro, params: paramsFiltro } = condicaoBusca(busca);

    const totalLinha = db
      .prepare(`SELECT COUNT(*) AS total FROM cadastros WHERE 1 = 1${filtro}`)
      .get(...paramsFiltro);
    const total = Number(totalLinha?.total ?? 0);

    const linhas = db
      .prepare(`SELECT * FROM cadastros WHERE 1 = 1${filtro} ORDER BY ${coluna} ${direcao} LIMIT ? OFFSET ?`)
      .all(...paramsFiltro, porPagina, deslocamento);

    return {
      itens: linhas,
      total,
      pagina,
      porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    };
  }

  async function obterPorId(id) {
    return db.prepare('SELECT * FROM cadastros WHERE id = ?').get(id) ?? null;
  }

  async function emailEmUso(email, excetoId = null) {
    const linha = excetoId
      ? db.prepare('SELECT id FROM cadastros WHERE email = ? COLLATE NOCASE AND id != ?').get(email, excetoId)
      : db.prepare('SELECT id FROM cadastros WHERE email = ? COLLATE NOCASE').get(email);
    return Boolean(linha);
  }

  async function criar(dados) {
    const registro = {
      id: dados.id,
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      cidade: dados.cidade,
      criado_em: dados.criado_em,
    };
    db.prepare(
      'INSERT INTO cadastros (id, nome, email, telefone, cidade, criado_em) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(registro.id, registro.nome, registro.email, registro.telefone, registro.cidade, registro.criado_em);
    return registro;
  }

  async function atualizar(id, dados) {
    const resultado = db
      .prepare('UPDATE cadastros SET nome = ?, email = ?, telefone = ?, cidade = ? WHERE id = ?')
      .run(dados.nome, dados.email, dados.telefone, dados.cidade, id);
    if (Number(resultado.changes) === 0) return null;
    return obterPorId(id);
  }

  async function excluir(id) {
    const resultado = db.prepare('DELETE FROM cadastros WHERE id = ?').run(id);
    return Number(resultado.changes) > 0;
  }

  async function estatisticas() {
    const totalLinha = db.prepare('SELECT COUNT(*) AS total FROM cadastros').get();
    const limiteRecente = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentesLinha = db
      .prepare('SELECT COUNT(*) AS total FROM cadastros WHERE criado_em >= ?')
      .get(limiteRecente);
    return { total: Number(totalLinha?.total ?? 0), recentes: Number(recentesLinha?.total ?? 0) };
  }

  async function verificarConexao() {
    db.prepare('SELECT 1').get();
    return true;
  }

  return {
    nome: 'SQLite (desenvolvimento local)',
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

module.exports = { criarRepositorioSQLite };
