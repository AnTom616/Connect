/**
 * Vercel Function — GET /api/saude
 * Indicador de funcionamento da aplicação (conexão com o banco).
 */
const { saude } = require('./_lib/handlers');
const { responder, responderNoContent, tratarRota } = require('./_lib/util');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return responderNoContent(res);
  if (req.method === 'GET') return tratarRota(req, res, () => saude(req, res));
  responder(res, 405, { erro: 'Método não permitido. Use GET.' });
};
