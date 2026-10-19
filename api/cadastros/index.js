/**
 * Vercel Function — GET /api/cadastros (listar) e POST /api/cadastros (criar)
 */
const { listarCadastros, criarCadastro } = require('../_lib/handlers');
const { responder, responderNoContent, tratarRota, HttpError } = require('../_lib/util');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return responderNoContent(res);
  if (req.method === 'GET') return tratarRota(req, res, () => listarCadastros(req, res));
  if (req.method === 'POST') return tratarRota(req, res, () => criarCadastro(req, res));
  responder(res, 405, { erro: 'Método não permitido. Use GET ou POST.' });
};
