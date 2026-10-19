/**
 * ============================================================
 * ConnectHub — Utilitários do frontend
 * ------------------------------------------------------------
 * Formatação de dados, máscara de telefone, validação espelhada
 * do servidor, helpers de DOM/segurança (XSS) e notificações
 * (toasts). Carregado antes de api.js e app.js.
 * ============================================================
 */

'use strict';

/* ---------- Segurança: escapar HTML dinâmico ---------- */
function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Atalhos de DOM ---------- */
function $(seletor) {
  return document.querySelector(seletor);
}

function $$(seletor) {
  return Array.from(document.querySelectorAll(seletor));
}

/* Recria os ícones Lucide após renderizações dinâmicas. */
function iconeRecriar() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/* ---------- Debounce ---------- */
function debounce(funcao, espera) {
  let temporizador = null;
  return function (...argumentos) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcao.apply(this, argumentos), espera);
  };
}

/* ---------- Formatação ---------- */

/** "19/10/2026 às 14:32" */
function formatarDataHora(iso) {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "19/10/2026" */
function formatarDataCurta(iso) {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "domingo, 19 de outubro de 2026" (com inicial maiúscula) */
function formatarDataCompletaHoje() {
  const texto = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Máscara progressiva enquanto o usuário digita: (11) 98765-4321 */
function mascararTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

/** Formata telefone armazenado apenas com dígitos para exibição. */
function formatarTelefone(digitos) {
  return mascararTelefone(digitos);
}

/** "#A1B2C3D4" — resumo do UUID para exibição na tabela. */
function idCurto(id) {
  if (!id) return '—';
  return `#${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** Iniciais para o avatar: primeira letra do primeiro e do último nome. */
function iniciaisNome(nome) {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Classe de cor do avatar derivada do nome (estável entre renderizações). */
function classeAvatar(nome) {
  const texto = String(nome || '').toLowerCase();
  let soma = 0;
  for (let i = 0; i < texto.length; i += 1) {
    soma = (soma * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return `av-${soma % 6}`;
}

/* ---------- Validação (espelha api/_lib/validation.js) ---------- */
const REGEX_NOME_CLIENTE = /^[\p{L}\p{M}'’ -]+$/u;
const REGEX_CIDADE_CLIENTE = /^[\p{L}\p{M}.'’ -]+$/u;
const REGEX_EMAIL_CLIENTE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validarCadastroCliente(entrada = {}) {
  const erros = {};
  const valores = {};

  const nome = String(entrada.nome ?? '').replace(/\s+/g, ' ').trim();
  if (!nome) {
    erros.nome = 'Informe o nome completo.';
  } else if (nome.length < 3) {
    erros.nome = 'O nome deve ter pelo menos 3 caracteres.';
  } else if (nome.length > 120) {
    erros.nome = 'O nome deve ter no máximo 120 caracteres.';
  } else if (nome.split(' ').filter(Boolean).length < 2) {
    erros.nome = 'Informe o nome completo (nome e sobrenome).';
  } else if (!REGEX_NOME_CLIENTE.test(nome)) {
    erros.nome = 'O nome deve conter apenas letras, espaços, apóstrofos e hífens.';
  } else {
    valores.nome = nome;
  }

  const email = String(entrada.email ?? '').trim().toLowerCase();
  if (!email) {
    erros.email = 'Informe o e-mail.';
  } else if (email.length > 254) {
    erros.email = 'O e-mail deve ter no máximo 254 caracteres.';
  } else if (!REGEX_EMAIL_CLIENTE.test(email)) {
    erros.email = 'Informe um e-mail válido (ex.: pessoa@dominio.com).';
  } else {
    valores.email = email;
  }

  const digitos = String(entrada.telefone ?? '').replace(/\D/g, '');
  if (!digitos) {
    erros.telefone = 'Informe o telefone com DDD.';
  } else if (!/^\d{10,11}$/.test(digitos)) {
    erros.telefone = 'O telefone deve ter DDD + número (10 ou 11 dígitos).';
  } else {
    valores.telefone = digitos;
  }

  const cidade = String(entrada.cidade ?? '').replace(/\s+/g, ' ').trim();
  if (!cidade) {
    erros.cidade = 'Informe a cidade.';
  } else if (cidade.length < 2) {
    erros.cidade = 'A cidade deve ter pelo menos 2 caracteres.';
  } else if (cidade.length > 80) {
    erros.cidade = 'A cidade deve ter no máximo 80 caracteres.';
  } else if (!REGEX_CIDADE_CLIENTE.test(cidade)) {
    erros.cidade = 'A cidade deve conter apenas letras, espaços, pontos, apóstrofos e hífens.';
  } else {
    valores.cidade = cidade;
  }

  return { valido: Object.keys(erros).length === 0, erros, valores };
}

/* ---------- Notificações (toasts) ---------- */
const ICONES_TOAST = { sucesso: 'circle-check', erro: 'circle-x', info: 'info' };
const TITULOS_TOAST = { sucesso: 'Sucesso', erro: 'Erro', info: 'Aviso' };

function mostrarToast(tipo, titulo, mensagem) {
  const container = $('#toasts');
  if (!container) return;

  const elemento = document.createElement('div');
  elemento.className = `toast toast-${tipo}`;
  elemento.setAttribute('role', 'status');
  elemento.innerHTML = `
    <span class="toast-icone"><i data-lucide="${ICONES_TOAST[tipo] || 'info'}"></i></span>
    <div class="toast-conteudo">
      <p class="toast-titulo">${esc(titulo || TITULOS_TOAST[tipo] || 'Aviso')}</p>
      ${mensagem ? `<p class="toast-mensagem">${esc(mensagem)}</p>` : ''}
    </div>
    <button type="button" class="toast-fechar" aria-label="Fechar notificação">
      <i data-lucide="x"></i>
    </button>
  `;

  const remover = () => {
    if (!elemento.isConnected) return;
    elemento.classList.add('saindo');
    setTimeout(() => elemento.remove(), 210);
  };

  elemento.querySelector('.toast-fechar').addEventListener('click', remover);
  container.appendChild(elemento);
  iconeRecriar();

  setTimeout(remover, 4600);
}
