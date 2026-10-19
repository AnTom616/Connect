/**
 * ============================================================
 * ConnectHub — Validação e normalização dos cadastros
 * ------------------------------------------------------------
 * Regras autoritativas aplicadas no servidor. O navegador
 * replica as mesmas regras (public/js/utils.js) para dar um
 * retorno imediato ao usuário, mas o servidor sempre revalida.
 * ============================================================
 */

const REGEX_NOME = /^[\p{L}\p{M}'’ -]+$/u;
const REGEX_CIDADE = /^[\p{L}\p{M}.'’ -]+$/u;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida e normaliza os dados de um cadastro.
 * @param {object} entrada - dados brutos recebidos
 * @returns {{ valido: boolean, erros: object, valores: object }}
 */
function validarCadastro(entrada = {}) {
  const erros = {};
  const valores = {};

  // ---- Nome completo ----
  const nome = String(entrada.nome ?? '').replace(/\s+/g, ' ').trim();
  if (!nome) {
    erros.nome = 'Informe o nome completo.';
  } else if (nome.length < 3) {
    erros.nome = 'O nome deve ter pelo menos 3 caracteres.';
  } else if (nome.length > 120) {
    erros.nome = 'O nome deve ter no máximo 120 caracteres.';
  } else if (nome.split(' ').filter(Boolean).length < 2) {
    erros.nome = 'Informe o nome completo (nome e sobrenome).';
  } else if (!REGEX_NOME.test(nome)) {
    erros.nome = 'O nome deve conter apenas letras, espaços, apóstrofos e hífens.';
  } else {
    valores.nome = nome;
  }

  // ---- E-mail ----
  const email = String(entrada.email ?? '').trim().toLowerCase();
  if (!email) {
    erros.email = 'Informe o e-mail.';
  } else if (email.length > 254) {
    erros.email = 'O e-mail deve ter no máximo 254 caracteres.';
  } else if (!REGEX_EMAIL.test(email)) {
    erros.email = 'Informe um e-mail válido (ex.: pessoa@dominio.com).';
  } else {
    valores.email = email;
  }

  // ---- Telefone (armazenado apenas com dígitos: DDD + número) ----
  const digitos = String(entrada.telefone ?? '').replace(/\D/g, '');
  if (!digitos) {
    erros.telefone = 'Informe o telefone com DDD.';
  } else if (!/^\d{10,11}$/.test(digitos)) {
    erros.telefone = 'O telefone deve ter DDD + número (10 ou 11 dígitos).';
  } else {
    valores.telefone = digitos;
  }

  // ---- Cidade ----
  const cidade = String(entrada.cidade ?? '').replace(/\s+/g, ' ').trim();
  if (!cidade) {
    erros.cidade = 'Informe a cidade.';
  } else if (cidade.length < 2) {
    erros.cidade = 'A cidade deve ter pelo menos 2 caracteres.';
  } else if (cidade.length > 80) {
    erros.cidade = 'A cidade deve ter no máximo 80 caracteres.';
  } else if (!REGEX_CIDADE.test(cidade)) {
    erros.cidade = 'A cidade deve conter apenas letras, espaços, pontos, apóstrofos e hífens.';
  } else {
    valores.cidade = cidade;
  }

  return { valido: Object.keys(erros).length === 0, erros, valores };
}

module.exports = { validarCadastro };
