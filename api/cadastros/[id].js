/**
 * Vercel Function — /api/cadastros/:id
 *   GET    → detalhes do cadastro
 *   PUT    → atualizar cadastro
 *   DELETE → excluir cadastro
 */
const { obterCadastro, atualizarCadastro, excluirCadastro } = require('../_lib/handlers');
const { responder, responderNoContent, tratarRota } = require('../_lib/util');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return responderNoContent(res);
  if (req.method === 'GET') return tratarRota(req, res, () => obterCadastro(req, res));
  if (req.method === 'PUT') return tratarRota(req, res, () => atualizarCadastro(req, res));
  if (req.method === 'DELETE') return tratarRota(req, res, () => excluirCadastro(req, res));
  responder(res, 405, { erro: 'Método não permitido. Use GET, PUT ou DELETE.' });
};
