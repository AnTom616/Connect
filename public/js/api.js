/**
 * ============================================================
 * ConnectHub — Cliente da API REST
 * ------------------------------------------------------------
 * Única porta de entrada do frontend para o servidor. Todos os
 * métodos devolvem dados JSON já tratados ou lançam Error com
 * mensagem amigável (incluindo erros de campo vindos do backend).
 * ============================================================
 */

'use strict';

const MENSAGEM_CONEXAO =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

/**
 * Executa uma requisição contra a API interna (/api).
 * @throws {Error} com .status, .campos (erros de validação) e .acao
 */
async function requisicaoApi(caminho, { metodo = 'GET', corpo = null } = {}) {
  let resposta;
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    const erro = new Error(MENSAGEM_CONEXAO);
    erro.status = 0;
    throw erro;
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    const erro = new Error(dados?.erro || `Falha na requisição (código ${resposta.status}).`);
    erro.status = resposta.status;
    erro.campos = dados?.campos || null;
    erro.acao = dados?.acao || null;
    throw erro;
  }

  return dados;
}

/** Monta query string ignorando valores vazios. */
function construirConsulta(parametros) {
  const pares = Object.entries(parametros).filter(([, valor]) => valor !== '' && valor != null);
  return new URLSearchParams(pares).toString();
}

/* ---------- Cadastros ---------- */

async function listarCadastrosApi({ busca = '', ordenarPor = 'criado_em', ordem = 'desc', pagina = 1, porPagina = 10 } = {}) {
  const consulta = construirConsulta({ busca, ordenarPor, ordem, pagina, porPagina });
  return requisicaoApi(`/api/cadastros?${consulta}`);
}

async function criarCadastroApi(dados) {
  return requisicaoApi('/api/cadastros', { metodo: 'POST', corpo: dados });
}

async function obterCadastroApi(id) {
  return requisicaoApi(`/api/cadastros/${encodeURIComponent(id)}`);
}

async function atualizarCadastroApi(id, dados) {
  return requisicaoApi(`/api/cadastros/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: dados });
}

async function excluirCadastroApi(id) {
  return requisicaoApi(`/api/cadastros/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
}

/* ---------- Dashboard / indicadores ---------- */

async function obterEstatisticasApi() {
  return requisicaoApi('/api/estatisticas');
}

async function verificarSaudeApi() {
  return requisicaoApi('/api/saude');
}
