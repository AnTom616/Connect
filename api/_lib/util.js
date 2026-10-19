/**
 * ============================================================
 * ConnectHub — Utilitários da camada de API
 * ------------------------------------------------------------
 * Funções compartilhadas por todos os endpoints: envio de
 * respostas JSON, leitura do corpo da requisição, classes de
 * erro de domínio e cabeçalhos CORS/segurança.
 * ============================================================
 */

/** Erro HTTP com status e mensagem amigável para o usuário. */
class HttpError extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.name = 'HttpError';
    this.status = status;
    this.campos = campos;
  }
}

/** Erro de configuração ausente (ex.: DATABASE_URL na Vercel). */
class ErroConfig extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroConfig';
    this.status = 503;
  }
}

const CABECALHOS_BASE = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'X-Content-Type-Options': 'nosniff',
};

/** Envia uma resposta JSON padronizada. */
function responder(res, status, dados) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [chave, valor] of Object.entries(CABECALHOS_BASE)) {
    res.setHeader(chave, valor);
  }
  res.statusCode = status;
  res.end(JSON.stringify(dados));
}

/** Responde 204 No Content (usado no preflight CORS). */
function responderNoContent(res) {
  for (const [chave, valor] of Object.entries(CABECALHOS_BASE)) {
    res.setHeader(chave, valor);
  }
  res.setHeader('Access-Control-Max-Age', '86400');
  res.statusCode = 204;
  res.end();
}

/** Lê e interpreta o corpo JSON da requisição (com limite de tamanho). */
function lerCorpo(req) {
  return new Promise((resolver, rejeitar) => {
    let conteudo = '';
    let tamanho = 0;
    req.on('data', (pedaco) => {
      tamanho += pedaco.length;
      if (tamanho > 100 * 1024) {
        rejeitar(new HttpError(413, 'Corpo da requisição muito grande.'));
        req.destroy();
        return;
      }
      conteudo += pedaco;
    });
    req.on('end', () => {
      if (!conteudo.trim()) return resolver({});
      try {
        const dados = JSON.parse(conteudo);
        resolver(dados && typeof dados === 'object' ? dados : {});
      } catch {
        rejeitar(new HttpError(400, 'Corpo da requisição inválido: esperado JSON.'));
      }
    });
    req.on('error', () => rejeitar(new HttpError(400, 'Falha ao ler a requisição.')));
  });
}

/**
 * Executa o handler capturando erros de domínio e convertendo-os
 * em respostas amigáveis (400/404/409/503/500).
 */
async function tratarRota(req, res, funcao) {
  try {
    await funcao();
  } catch (erro) {
    if (erro instanceof ErroConfig) {
      console.error('[ConnectHub] Configuração ausente:', erro.message);
      responder(res, 503, { erro: erro.message, acao: 'configurar_banco' });
      return;
    }
    if (erro instanceof HttpError) {
      responder(res, erro.status, { erro: erro.message, ...(erro.campos ? { campos: erro.campos } : {}) });
      return;
    }
    console.error('[ConnectHub] Erro inesperado:', erro);
    responder(res, 500, { erro: 'Erro interno no servidor. Tente novamente em alguns instantes.' });
  }
}

/** Garante que o valor seja um inteiro dentro de um intervalo. */
function inteiroSeguro(valor, padrao, minimo, maximo) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(maximo, Math.max(minimo, numero));
}

module.exports = { HttpError, ErroConfig, responder, responderNoContent, lerCorpo, tratarRota, inteiroSeguro };
