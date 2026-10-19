/**
 * Vercel Function — GET /api/estatisticas
 * Indicadores do dashboard calculados a partir dos registros armazenados.
 */
const { estatisticas } = require('./_lib/handlers');
const { responder, responderNoContent, tratarRota } = require('./_lib/util');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return responderNoContent(res);
  if (req.method === 'GET') return tratarRota(req, res, () => estatisticas(req, res));
  responder(res, 405, { erro: 'Método não permitido. Use GET.' });
};
