/**
 * ============================================================
 * ConnectHub — Handlers dos endpoints (lógica de API)
 * ------------------------------------------------------------
 * Cada função recebe (req, res) no formato Node e é reaproveitada
 * tanto pelas Vercel Functions (api/) quanto pelo servidor local
 * de desenvolvimento (server.mjs).
 *
 * Endpoints:
 *   GET    /api/cadastros        → listarCadastros (busca, ordenação, paginação)
 *   POST   /api/cadastros        → criarCadastro
 *   GET    /api/cadastros/:id    → obterCadastro
 *   PUT    /api/cadastros/:id    → atualizarCadastro
 *   DELETE /api/cadastros/:id    → excluirCadastro
 *   GET    /api/estatisticas     → estatisticas (dashboard)
 *   GET    /api/saude            → saude (indicador de conexão)
 * ============================================================
 */

const crypto = require('node:crypto');
const { obterRepositorio } = require('./db');
const { validarCadastro } = require('./validation');
const {
  HttpError,
  responder,
  lerCorpo,
  inteiroSeguro,
} = require('./util');

/** ---- GET /api/cadastros ---- */
async function listarCadastros(req, res) {
  const repositorio = await obterRepositorio();
  const consulta = req.query || {};

  const ordenarPor = consulta.ordenarPor === 'nome' ? 'nome' : 'criado_em';
  const ordem = String(consulta.ordem || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const pagina = inteiroSeguro(consulta.pagina, 1, 1, 1_000_000);
  const porPagina = inteiroSeguro(consulta.porPagina, 10, 1, 50);
  const busca = String(consulta.busca || '').trim().slice(0, 120);

  const resultado = await repositorio.listar({ busca, ordenarPor, ordem, pagina, porPagina });
  responder(res, 200, resultado);
}

/** ---- POST /api/cadastros ---- */
async function criarCadastro(req, res) {
  const repositorio = await obterRepositorio();
  const corpo = await lerCorpo(req);

  const { valido, erros, valores } = validarCadastro(corpo);
  if (!valido) {
    throw new HttpError(400, 'Verifique os campos destacados e tente novamente.', erros);
  }

  if (await repositorio.emailEmUso(valores.email)) {
    throw new HttpError(400, 'Verifique os campos destacados e tente novamente.', {
      email: 'Já existe um cadastro com este e-mail.',
    });
  }

  const registro = await repositorio.criar({
    ...valores,
    id: crypto.randomUUID(),
    criado_em: new Date().toISOString(),
  });

  responder(res, 201, { cadastro: registro, mensagem: 'Cadastro criado com sucesso.' });
}

/** ---- GET /api/cadastros/:id ---- */
async function obterCadastro(req, res) {
  const repositorio = await obterRepositorio();
  const id = String(req.query?.id || '').trim();
  if (!id) throw new HttpError(400, 'Identificador do cadastro não informado.');

  const registro = await repositorio.obterPorId(id);
  if (!registro) throw new HttpError(404, 'Cadastro não encontrado. Ele pode ter sido excluído.');

  responder(res, 200, { cadastro: registro });
}

/** ---- PUT /api/cadastros/:id ---- */
async function atualizarCadastro(req, res) {
  const repositorio = await obterRepositorio();
  const id = String(req.query?.id || '').trim();
  if (!id) throw new HttpError(400, 'Identificador do cadastro não informado.');

  const corpo = await lerCorpo(req);
  const { valido, erros, valores } = validarCadastro(corpo);
  if (!valido) {
    throw new HttpError(400, 'Verifique os campos destacados e tente novamente.', erros);
  }

  if (await repositorio.emailEmUso(valores.email, id)) {
    throw new HttpError(400, 'Verifique os campos destacados e tente novamente.', {
      email: 'Já existe um cadastro com este e-mail.',
    });
  }

  const registro = await repositorio.atualizar(id, valores);
  if (!registro) throw new HttpError(404, 'Cadastro não encontrado. Ele pode ter sido excluído.');

  responder(res, 200, { cadastro: registro, mensagem: 'Cadastro atualizado com sucesso.' });
}

/** ---- DELETE /api/cadastros/:id ---- */
async function excluirCadastro(req, res) {
  const repositorio = await obterRepositorio();
  const id = String(req.query?.id || '').trim();
  if (!id) throw new HttpError(400, 'Identificador do cadastro não informado.');

  const excluido = await repositorio.excluir(id);
  if (!excluido) throw new HttpError(404, 'Cadastro não encontrado. Ele pode já ter sido excluído.');

  responder(res, 200, { ok: true, mensagem: 'Cadastro excluído com sucesso.' });
}

/** ---- GET /api/estatisticas ---- */
async function estatisticas(req, res) {
  const repositorio = await obterRepositorio();
  const dados = await repositorio.estatisticas();
  responder(res, 200, {
    ...dados,
    status: 'conectado',
    banco: repositorio.nome,
    gerado_em: new Date().toISOString(),
  });
}

/** ---- GET /api/saude ---- */
async function saude(req, res) {
  const repositorio = await obterRepositorio();
  await repositorio.verificarConexao();
  responder(res, 200, {
    status: 'conectado',
    banco: repositorio.nome,
    horario: new Date().toISOString(),
  });
}

module.exports = {
  listarCadastros,
  criarCadastro,
  obterCadastro,
  atualizarCadastro,
  excluirCadastro,
  estatisticas,
  saude,
};
