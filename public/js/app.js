/**
 * ============================================================
 * ConnectHub — Lógica da aplicação (SPA sem frameworks)
 * ------------------------------------------------------------
 * Roteamento por hash, dashboard com indicadores reais, tabela
 * com busca/ordenação/paginação (executadas no banco), modais
 * de criar/editar/detalhes/excluir e notificações toast.
 * ============================================================
 */

'use strict';

/* ---------- Estado global ---------- */
const estado = {
  vista: 'dashboard',
  busca: '',
  ordenarPor: 'criado_em',
  ordem: 'desc',
  pagina: 1,
  porPagina: 10,
  total: 0,
  totalPaginas: 1,
  idEditando: null,
  idExcluindo: null,
  cadastroDetalhes: null,
  tokenPainel: 0,
  tokenLista: 0,
};

const TITULOS_VISTA = {
  dashboard: { titulo: 'Dashboard', subtitulo: 'Visão geral dos cadastros do sistema' },
  cadastros: { titulo: 'Cadastros', subtitulo: 'Gerencie os registros do sistema' },
  sobre: { titulo: 'Sobre o Projeto', subtitulo: 'Arquitetura, tecnologias e funcionamento' },
};

/* ============================================================
   Inicialização e roteamento
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  registrarEventos();
  $('#data-atual').textContent = formatarDataCompletaHoje();
  rotear();
  atualizarSeloBanco('verificando');
  verificarConexaoInicial();
  iconeRecriar();
});

async function verificarConexaoInicial() {
  try {
    const saude = await verificarSaudeApi();
    atualizarSeloBanco(saude.status === 'conectado' ? 'conectado' : 'indisponivel', saude.banco);
  } catch (erro) {
    atualizarSeloBanco(erro.acao === 'configurar_banco' ? 'configurar' : 'indisponivel');
  }
}

function rotear() {
  const hash = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  const vista = TITULOS_VISTA[hash] ? hash : 'dashboard';
  estado.vista = vista;

  $$('.vista').forEach((secao) => secao.classList.toggle('ativa', secao.id === `vista-${vista}`));

  $$('.nav-item').forEach((item) => {
    const ativo = item.dataset.vista === vista;
    item.classList.toggle('ativo', ativo);
    if (ativo) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });

  const titulos = TITULOS_VISTA[vista];
  $('#titulo-pagina').textContent = titulos.titulo;
  $('#subtitulo-pagina').textContent = titulos.subtitulo;

  fecharSidebarMobile();

  if (vista === 'dashboard') carregarPainel();
  if (vista === 'cadastros') carregarCadastros();
}

/* ============================================================
   Selo de conexão com o banco (topbar, sidebar e KPI)
   ============================================================ */

function atualizarSeloBanco(status, nomeBanco = '') {
  const selo = $('#selo-conexao');
  const textoSelo = $('#selo-conexao-texto');
  const pontoMini = $('#status-mini-ponto');
  const textoMini = $('#status-mini-texto');
  if (!selo) return;

  const configuracoes = {
    conectado: { classe: 'conectado', texto: 'Banco conectado', ponto: 'ponto-verde', mini: `Banco: ${nomeBanco || 'conectado'}` },
    indisponivel: { classe: 'indisponivel', texto: 'Banco offline', ponto: 'ponto-vermelho', mini: 'Banco offline' },
    configurar: { classe: 'configurar', texto: 'Banco não configurado', ponto: 'ponto-ambar', mini: 'Configure DATABASE_URL' },
    verificando: { classe: 'verificando', texto: 'Verificando…', ponto: 'ponto-cinza', mini: 'Verificando banco…' },
  };

  const config = configuracoes[status] || configuracoes.verificando;
  selo.className = `selo selo-conexao ${config.classe}`;
  textoSelo.textContent = config.texto;
  if (pontoMini) pontoMini.className = `ponto ${config.ponto}`;
  if (textoMini) textoMini.textContent = config.mini;
}

/* ============================================================
   Dashboard: KPIs + lista de recentes
   ============================================================ */

async function carregarPainel({ comEsqueleto = true } = {}) {
  const token = ++estado.tokenPainel;

  if (comEsqueleto) {
    $('#kpi-total').classList.add('carregando');
    $('#kpi-recentes').classList.add('carregando');
    $('#kpi-status').classList.add('carregando');
    $('#esqueleto-recentes').hidden = false;
    $('#lista-recentes').innerHTML = '';
    $('#vazio-recentes').hidden = true;
  }

  try {
    const [estatisticas, lista] = await Promise.all([
      obterEstatisticasApi(),
      listarCadastrosApi({ porPagina: 5, ordenarPor: 'criado_em', ordem: 'desc' }),
    ]);

    if (token !== estado.tokenPainel) return; // resposta obsoleta

    $('#kpi-total').textContent = String(estatisticas.total);
    $('#kpi-recentes').textContent = String(estatisticas.recentes);
    atualizarSeloBanco('conectado', estatisticas.banco);

    const kpiStatus = $('#kpi-status');
    kpiStatus.classList.remove('carregando', 'falha', 'configurar');
    kpiStatus.classList.add('ok');
    kpiStatus.innerHTML = '<span class="ponto ponto-verde"></span>Operacional';
    $('#kpi-status-dica').textContent = `Conexão com o banco de dados · ${estatisticas.banco}`;

    renderizarRecentes(lista.itens);
    iconeRecriar();
  } catch (erro) {
    if (token !== estado.tokenPainel) return;
    const configErro = erro.acao === 'configurar_banco';
    atualizarSeloBanco(configErro ? 'configurar' : 'indisponivel');

    const kpiStatus = $('#kpi-status');
    kpiStatus.classList.remove('carregando', 'ok');
    kpiStatus.classList.add(configErro ? 'configurar' : 'falha');
    kpiStatus.textContent = configErro ? 'Sem banco' : 'Offline';
    $('#kpi-status-dica').textContent = configErro
      ? 'Configure a variável DATABASE_URL'
      : 'Não foi possível conectar ao banco de dados';

    if (comEsqueleto) {
      renderizarErroEm(
        $('#lista-recentes'),
        'Não foi possível carregar os cadastros recentes.',
        () => carregarPainel()
      );
      $('#esqueleto-recentes').hidden = true;
    }
  } finally {
    if (token === estado.tokenPainel) {
      $('#kpi-total').classList.remove('carregando');
      $('#kpi-recentes').classList.remove('carregando');
      $('#kpi-status').classList.remove('carregando');
      $('#esqueleto-recentes').hidden = true;
    }
  }
}

function renderizarRecentes(itens) {
  const lista = $('#lista-recentes');
  const vazio = $('#vazio-recentes');

  if (!itens || itens.length === 0) {
    lista.innerHTML = '';
    vazio.hidden = false;
    return;
  }

  vazio.hidden = true;
  lista.innerHTML = itens
    .map(
      (cadastro) => `
      <li>
        <div class="item-recente" data-id="${esc(cadastro.id)}" role="button" tabindex="0" aria-label="Ver detalhes de ${esc(cadastro.nome)}">
          <div class="item-recente-identidade">
            <span class="avatar ${classeAvatar(cadastro.nome)}">${esc(iniciaisNome(cadastro.nome))}</span>
            <div class="item-recente-dados">
              <p class="item-recente-nome">${esc(cadastro.nome)}</p>
              <p class="item-recente-email">${esc(cadastro.email)}</p>
            </div>
          </div>
          <div class="item-recente-meta">
            <p class="item-recente-cidade">${esc(cadastro.cidade)}</p>
            <p class="item-recente-data">${esc(formatarDataCurta(cadastro.criado_em))}</p>
          </div>
        </div>
      </li>`
    )
    .join('');

  $$('#lista-recentes .item-recente').forEach((elemento) => {
    elemento.addEventListener('click', () => abrirDetalhes(elemento.dataset.id));
    elemento.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        abrirDetalhes(elemento.dataset.id);
      }
    });
  });
}

/* ============================================================
   Cadastros: busca, ordenação, tabela, cartões e paginação
   ============================================================ */

async function carregarCadastros({ comEsqueleto = true } = {}) {
  const token = ++estado.tokenLista;

  if (comEsqueleto) {
    $('#esqueleto-tabela').hidden = false;
    $('#corpo-tabela').innerHTML = '';
    $('#lista-cartoes').innerHTML = '';
    $('#estado-vazio-cadastros').hidden = true;
  }

  try {
    const resultado = await listarCadastrosApi({
      busca: estado.busca,
      ordenarPor: estado.ordenarPor,
      ordem: estado.ordem,
      pagina: estado.pagina,
      porPagina: estado.porPagina,
    });

    if (token !== estado.tokenLista) return;

    estado.total = resultado.total;
    estado.totalPaginas = resultado.totalPaginas;

    renderizarTabela(resultado.itens);
    renderizarCartoes(resultado.itens);
    renderizarEstadoVazio(resultado);
    renderizarPaginacao(resultado);
    iconeRecriar();
  } catch (erro) {
    if (token !== estado.tokenLista) return;
    const mensagem =
      erro.acao === 'configurar_banco'
        ? 'O banco de dados ainda não foi configurado nesta implantação. Defina a variável DATABASE_URL conforme o README.md.'
        : erro.message;
    renderizarErroCadastros(mensagem);
  } finally {
    if (token === estado.tokenLista) {
      $('#esqueleto-tabela').hidden = true;
    }
  }
}

function acoesCadastroHtml(cadastro) {
  return `
    <button type="button" class="icone-botao acao-ver" data-acao="ver" data-id="${esc(cadastro.id)}" title="Ver detalhes" aria-label="Ver detalhes de ${esc(cadastro.nome)}"><i data-lucide="eye"></i></button>
    <button type="button" class="icone-botao acao-editar" data-acao="editar" data-id="${esc(cadastro.id)}" title="Editar" aria-label="Editar ${esc(cadastro.nome)}"><i data-lucide="pencil"></i></button>
    <button type="button" class="icone-botao acao-excluir" data-acao="excluir" data-id="${esc(cadastro.id)}" title="Excluir" aria-label="Excluir ${esc(cadastro.nome)}"><i data-lucide="trash-2"></i></button>
  `;
}

function renderizarTabela(itens) {
  const corpo = $('#corpo-tabela');
  if (!itens || itens.length === 0) {
    corpo.innerHTML = '';
    return;
  }

  corpo.innerHTML = itens
    .map(
      (cadastro) => `
      <tr data-id="${esc(cadastro.id)}">
        <td class="celula-id"><code title="${esc(cadastro.id)}">${esc(idCurto(cadastro.id))}</code></td>
        <td>
          <div class="celula-nome">
            <span class="avatar ${classeAvatar(cadastro.nome)}">${esc(iniciaisNome(cadastro.nome))}</span>
            <span class="celula-nome-nome">${esc(cadastro.nome)}</span>
          </div>
        </td>
        <td class="celula-email" title="${esc(cadastro.email)}">${esc(cadastro.email)}</td>
        <td class="celula-telefone">${esc(formatarTelefone(cadastro.telefone))}</td>
        <td class="celula-cidade">${esc(cadastro.cidade)}</td>
        <td class="celula-data">${esc(formatarDataHora(cadastro.criado_em))}</td>
        <td class="celula-acoes">${acoesCadastroHtml(cadastro)}</td>
      </tr>`
    )
    .join('');
}

function renderizarCartoes(itens) {
  const lista = $('#lista-cartoes');
  if (!itens || itens.length === 0) {
    lista.innerHTML = '';
    return;
  }

  lista.innerHTML = itens
    .map(
      (cadastro) => `
      <li class="item-cartao" data-id="${esc(cadastro.id)}">
        <div class="item-cartao-topo">
          <span class="avatar ${classeAvatar(cadastro.nome)}">${esc(iniciaisNome(cadastro.nome))}</span>
          <div class="item-cartao-identidade">
            <p class="item-cartao-nome">${esc(cadastro.nome)}</p>
            <p class="item-cartao-email">${esc(cadastro.email)}</p>
          </div>
          <div class="item-cartao-acoes">${acoesCadastroHtml(cadastro)}</div>
        </div>
        <div class="item-cartao-dados">
          <span><i data-lucide="phone"></i>${esc(formatarTelefone(cadastro.telefone))}</span>
          <span><i data-lucide="map-pin"></i>${esc(cadastro.cidade)}</span>
          <span><i data-lucide="calendar"></i>${esc(formatarDataCurta(cadastro.criado_em))}</span>
        </div>
      </li>`
    )
    .join('');
}

function renderizarEstadoVazio(resultado) {
  const container = $('#estado-vazio-cadastros');
  const temRegistros = resultado.total > 0;

  if (temRegistros) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  const busca = estado.busca.trim();
  if (busca) {
    container.innerHTML = `
      <span class="vazio-icone"><i data-lucide="search-x"></i></span>
      <h3>Nenhum resultado para “${esc(busca)}”</h3>
      <p>Nenhum cadastro do banco corresponde à pesquisa. Tente outro nome, e-mail ou cidade.</p>
      <button type="button" class="botao botao-fantasma" id="botao-limpar-busca"><i data-lucide="x"></i> Limpar pesquisa</button>`;
    container.querySelector('#botao-limpar-busca').addEventListener('click', () => {
      $('#campo-busca').value = '';
      estado.busca = '';
      estado.pagina = 1;
      carregarCadastros();
    });
  } else {
    container.innerHTML = `
      <span class="vazio-icone"><i data-lucide="users"></i></span>
      <h3>Nenhum cadastro encontrado</h3>
      <p>O banco de dados está vazio. Registre o primeiro contato para começar.</p>
      <button type="button" class="botao botao-primario" data-abrir-criacao><i data-lucide="plus"></i> Criar primeiro cadastro</button>`;
    container.querySelector('[data-abrir-criacao]').addEventListener('click', abrirFormularioCriacao);
  }
  container.hidden = false;
}

function renderizarErroCadastros(mensagem) {
  const container = $('#estado-vazio-cadastros');
  container.innerHTML = `
    <span class="vazio-icone"><i data-lucide="cloud-off"></i></span>
    <h3>Não foi possível carregar os cadastros</h3>
    <p>${esc(mensagem)}</p>
    <button type="button" class="botao botao-fantasma" id="botao-tentar-novamente"><i data-lucide="refresh-cw"></i> Tentar novamente</button>`;
  container.querySelector('#botao-tentar-novamente').addEventListener('click', () => carregarCadastros());
  container.hidden = false;

  $('#corpo-tabela').innerHTML = '';
  $('#lista-cartoes').innerHTML = '';
  $('#info-paginacao').textContent = '—';
  $('#rotulo-pagina').textContent = 'Página 1 de 1';
  $('#botao-pagina-anterior').disabled = true;
  $('#botao-pagina-seguinte').disabled = true;
}

function renderizarPaginacao(resultado) {
  const { total, pagina, totalPaginas, porPagina } = resultado;
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);

  $('#info-paginacao').textContent =
    total === 0
      ? 'Nenhum cadastro para exibir'
      : `Exibindo ${primeiro}–${ultimo} de ${total} ${total === 1 ? 'cadastro' : 'cadastros'}`;
  $('#rotulo-pagina').textContent = `Página ${pagina} de ${totalPaginas}`;
  $('#botao-pagina-anterior').disabled = pagina <= 1;
  $('#botao-pagina-seguinte').disabled = pagina >= totalPaginas;
}

/** Delegação de eventos para os botões de ação (tabela e cartões). */
function tratarAcaoCadastro(evento) {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const { acao, id } = botao.dataset;
  if (acao === 'ver') abrirDetalhes(id);
  if (acao === 'editar') abrirFormularioEdicao(id);
  if (acao === 'excluir') abrirConfirmacaoExclusao(id);
}

/* ============================================================
   Renderização de erro genérica (listas)
   ============================================================ */

function renderizarErroEm(container, mensagem, acaoRepetir) {
  container.innerHTML = `
    <li class="estado-vazio">
      <span class="vazio-icone"><i data-lucide="cloud-off"></i></span>
      <h3>Ops, algo deu errado</h3>
      <p>${esc(mensagem)}</p>
      <button type="button" class="botao botao-fantasma" id="botao-repetir-erro"><i data-lucide="refresh-cw"></i> Tentar novamente</button>
    </li>`;
  container.querySelector('#botao-repetir-erro').addEventListener('click', acaoRepetir);
  iconeRecriar();
}

/* ============================================================
   Modais: infraestrutura
   ============================================================ */

let ultimoElementoFocado = null;

function abrirModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  ultimoElementoFocado = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const primeiroCampo = modal.querySelector('input, select, textarea, button:not([data-fechar-modal])');
  if (primeiroCampo) setTimeout(() => primeiroCampo.focus(), 60);
}

function fecharModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  if (ultimoElementoFocado && typeof ultimoElementoFocado.focus === 'function') {
    ultimoElementoFocado.focus();
  }
  ultimoElementoFocado = null;
}

function configurarFechamentoModal(overlay) {
  overlay.addEventListener('mousedown', (evento) => {
    if (evento.target === overlay) fecharModal(overlay.id);
  });
  overlay.querySelectorAll('[data-fechar-modal]').forEach((botao) => {
    botao.addEventListener('click', () => fecharModal(overlay.id));
  });
}

document.addEventListener('keydown', (evento) => {
  if (evento.key !== 'Escape') return;
  const abertos = $$('.modal-overlay').filter((modal) => !modal.hidden);
  if (abertos.length > 0) fecharModal(abertos[abertos.length - 1].id);
});

/* ============================================================
   Modal: criar / editar cadastro
   ============================================================ */

function abrirFormularioCriacao() {
  estado.idEditando = null;
  $('#titulo-modal-form').textContent = 'Novo cadastro';
  $('#subtitulo-modal-form').textContent = 'Preencha os dados do registro. O e-mail deve ser único.';
  $('#texto-botao-salvar').textContent = 'Salvar cadastro';
  limparFormulario();
  abrirModal('modal-formulario');
  $('#campo-nome').focus();
}

async function abrirFormularioEdicao(id) {
  let cadastro = null;

  try {
    const resposta = await obterCadastroApi(id);
    cadastro = resposta.cadastro;
  } catch (erro) {
    mostrarToast('erro', 'Não foi possível abrir o cadastro', erro.message);
    return;
  }

  estado.idEditando = id;
  $('#titulo-modal-form').textContent = 'Editar cadastro';
  $('#subtitulo-modal-form').textContent = 'Atualize as informações do registro e salve.';
  $('#texto-botao-salvar').textContent = 'Salvar alterações';
  limparFormulario();

  $('#campo-nome').value = cadastro.nome;
  $('#campo-email').value = cadastro.email;
  $('#campo-telefone').value = formatarTelefone(cadastro.telefone);
  $('#campo-cidade').value = cadastro.cidade;

  abrirModal('modal-formulario');
  $('#campo-nome').focus();
}

function limparFormulario() {
  $('#formulario-cadastro').reset();
  ['nome', 'email', 'telefone', 'cidade'].forEach((campo) => limparErroCampo(campo));
}

function mostrarErroCampo(campo, mensagem) {
  const elementoErro = $(`#erro-${campo}`);
  const elementoCampo = $(`#campo-${campo}`).closest('.campo');
  if (!elementoErro || !elementoCampo) return;
  elementoErro.textContent = mensagem;
  elementoErro.hidden = false;
  elementoCampo.classList.add('invalido');
}

function limparErroCampo(campo) {
  const elementoErro = $(`#erro-${campo}`);
  const elementoCampo = $(`#campo-${campo}`).closest('.campo');
  if (!elementoErro || !elementoCampo) return;
  elementoErro.textContent = '';
  elementoErro.hidden = true;
  elementoCampo.classList.remove('invalido');
}

function definirBotaoSalvando(salvando) {
  const botao = $('#botao-salvar');
  botao.disabled = salvando;
  $('#spinner-salvar').hidden = !salvando;
  $('#texto-botao-salvar').textContent = salvando ? 'Salvando…' : estado.idEditando ? 'Salvar alterações' : 'Salvar cadastro';
}

async function enviarFormulario(evento) {
  evento.preventDefault();

  const dadosBrutos = {
    nome: $('#campo-nome').value,
    email: $('#campo-email').value,
    telefone: $('#campo-telefone').value,
    cidade: $('#campo-cidade').value,
  };

  ['nome', 'email', 'telefone', 'cidade'].forEach(limparErroCampo);

  const { valido, erros, valores } = validarCadastroCliente(dadosBrutos);
  if (!valido) {
    Object.entries(erros).forEach(([campo, mensagem]) => mostrarErroCampo(campo, mensagem));
    mostrarToast('erro', 'Verifique o formulário', 'Corrija os campos destacados e tente novamente.');
    return;
  }

  definirBotaoSalvando(true);
  try {
    if (estado.idEditando) {
      const resposta = await atualizarCadastroApi(estado.idEditando, valores);
      mostrarToast('sucesso', 'Cadastro atualizado', resposta.mensagem);
    } else {
      const resposta = await criarCadastroApi(valores);
      mostrarToast('sucesso', 'Cadastro criado', resposta.mensagem);
    }
    fecharModal('modal-formulario');
    estado.idEditando = null;
    atualizarDadosAposOperacao();
  } catch (erro) {
    if (erro.campos) {
      Object.entries(erro.campos).forEach(([campo, mensagem]) => mostrarErroCampo(campo, mensagem));
    }
    mostrarToast('erro', 'Não foi possível salvar', erro.message);
  } finally {
    definirBotaoSalvando(false);
  }
}

/* ============================================================
   Modal: detalhes do cadastro
   ============================================================ */

async function abrirDetalhes(id) {
  try {
    const resposta = await obterCadastroApi(id);
    const cadastro = resposta.cadastro;
    estado.cadastroDetalhes = cadastro;

    $('#detalhes-avatar').className = `avatar avatar-grande ${classeAvatar(cadastro.nome)}`;
    $('#detalhes-avatar').textContent = iniciaisNome(cadastro.nome);
    $('#detalhes-nome').textContent = cadastro.nome;
    $('#detalhes-email').textContent = cadastro.email;
    $('#detalhes-id').textContent = cadastro.id;
    $('#detalhes-telefone').textContent = formatarTelefone(cadastro.telefone);
    $('#detalhes-cidade').textContent = cadastro.cidade;
    $('#detalhes-data').textContent = formatarDataHora(cadastro.criado_em);

    abrirModal('modal-detalhes');
  } catch (erro) {
    mostrarToast('erro', 'Não foi possível carregar os detalhes', erro.message);
  }
}

async function copiarIdCadastro() {
  const id = estado.cadastroDetalhes?.id;
  if (!id) return;
  try {
    await navigator.clipboard.writeText(id);
    mostrarToast('info', 'ID copiado', 'O identificador do registro está na área de transferência.');
  } catch {
    mostrarToast('erro', 'Não foi possível copiar', 'Seu navegador bloqueou o acesso à área de transferência.');
  }
}

/* ============================================================
   Modal: excluir cadastro (com confirmação)
   ============================================================ */

async function abrirConfirmacaoExclusao(id) {
  try {
    const resposta = await obterCadastroApi(id);
    const cadastro = resposta.cadastro;
    estado.idExcluindo = id;
    $('#excluir-nome').textContent = cadastro.nome;
    abrirModal('modal-excluir');
  } catch (erro) {
    mostrarToast('erro', 'Não foi possível abrir o cadastro', erro.message);
  }
}

function definirBotaoExcluindo(excluindo) {
  const botao = $('#botao-confirmar-exclusao');
  botao.disabled = excluindo;
  $('#spinner-excluir').hidden = !excluindo;
}

async function confirmarExclusao() {
  if (!estado.idExcluindo) return;
  definirBotaoExcluindo(true);

  try {
    const resposta = await excluirCadastroApi(estado.idExcluindo);
    mostrarToast('sucesso', 'Cadastro excluído', resposta.mensagem);
    fecharModal('modal-excluir');

    // Ajusta a página caso a atual tenha ficado vazia.
    if (estado.pagina > 1 && (estado.total - 1) % estado.porPagina === 0) {
      estado.pagina = Math.max(1, estado.pagina - 1);
    }

    estado.idExcluindo = null;
    atualizarDadosAposOperacao();
  } catch (erro) {
    mostrarToast('erro', 'Não foi possível excluir', erro.message);
  } finally {
    definirBotaoExcluindo(false);
  }
}

/* ============================================================
   Atualização em cadeia após criar / editar / excluir
   ============================================================ */

function atualizarDadosAposOperacao() {
  if (estado.vista === 'cadastros') {
    carregarCadastros({ comEsqueleto: false });
  }
  // KPIs e selo sempre atualizados (sem skeleton, para não piscar).
  carregarPainel({ comEsqueleto: false });
}

/* ============================================================
   Sidebar mobile
   ============================================================ */

function abrirSidebarMobile() {
  document.body.classList.add('sidebar-aberta');
  $('#sidebar-overlay').hidden = false;
}

function fecharSidebarMobile() {
  document.body.classList.remove('sidebar-aberta');
  $('#sidebar-overlay').hidden = true;
}

/* ============================================================
   Registro de eventos
   ============================================================ */

function registrarEventos() {
  // Roteamento
  window.addEventListener('hashchange', rotear);

  // Sidebar mobile
  $('#botao-menu').addEventListener('click', abrirSidebarMobile);
  $('#botao-fechar-sidebar').addEventListener('click', fecharSidebarMobile);
  $('#sidebar-overlay').addEventListener('click', fecharSidebarMobile);
  $$('.nav-item').forEach((item) => item.addEventListener('click', fecharSidebarMobile));

  // Botões de criação
  $('#botao-novo-cadastro').addEventListener('click', abrirFormularioCriacao);
  $('#botao-fab').addEventListener('click', abrirFormularioCriacao);
  $$('[data-abrir-criacao]').forEach((botao) => botao.addEventListener('click', abrirFormularioCriacao));

  // Busca (com debounce) e ordenação
  $('#campo-busca').addEventListener(
    'input',
    debounce((evento) => {
      estado.busca = evento.target.value.trim();
      estado.pagina = 1;
      carregarCadastros();
    }, 350)
  );

  $('#seletor-ordenacao').addEventListener('change', (evento) => {
    const [ordenarPor, ordem] = evento.target.value.split(':');
    estado.ordenarPor = ordenarPor;
    estado.ordem = ordem;
    estado.pagina = 1;
    carregarCadastros();
  });

  $('#botao-atualizar').addEventListener('click', () => {
    const botao = $('#botao-atualizar');
    botao.classList.add('girando');
    const promessa = estado.vista === 'dashboard' ? carregarPainel({ comEsqueleto: false }) : carregarCadastros({ comEsqueleto: false });
    Promise.resolve(promessa).finally(() => {
      setTimeout(() => botao.classList.remove('girando'), 500);
    });
  });

  // Paginação
  $('#botao-pagina-anterior').addEventListener('click', () => {
    if (estado.pagina > 1) {
      estado.pagina -= 1;
      carregarCadastros({ comEsqueleto: false });
    }
  });
  $('#botao-pagina-seguinte').addEventListener('click', () => {
    if (estado.pagina < estado.totalPaginas) {
      estado.pagina += 1;
      carregarCadastros({ comEsqueleto: false });
    }
  });

  // Ações da tabela e dos cartões (delegação)
  $('#corpo-tabela').addEventListener('click', tratarAcaoCadastro);
  $('#lista-cartoes').addEventListener('click', tratarAcaoCadastro);

  // Formulário
  $('#formulario-cadastro').addEventListener('submit', enviarFormulario);
  $('#campo-telefone').addEventListener('input', (evento) => {
    evento.target.value = mascararTelefone(evento.target.value);
  });
  ['nome', 'email', 'telefone', 'cidade'].forEach((campo) => {
    $(`#campo-${campo}`).addEventListener('input', () => limparErroCampo(campo));
  });

  // Detalhes
  $('#botao-copiar-id').addEventListener('click', copiarIdCadastro);
  $('#botao-editar-detalhes').addEventListener('click', () => {
    const id = estado.cadastroDetalhes?.id;
    if (!id) return;
    fecharModal('modal-detalhes');
    abrirFormularioEdicao(id);
  });

  // Exclusão
  $('#botao-confirmar-exclusao').addEventListener('click', confirmarExclusao);

  // Fechamento genérico de modais
  $$('.modal-overlay').forEach(configurarFechamentoModal);
}

