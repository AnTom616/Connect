/**
 * ============================================================
 * ConnectHub — Seed OPCIONAL (dados de teste)
 * ------------------------------------------------------------
 * Insere 8 cadastros de exemplo no banco ATIVO (SQLite local ou
 * Postgres de produção, conforme DATABASE_URL) para facilitar
 * a demonstração e os testes após o deploy.
 *
 * ⚠ Os registros são reais (gravados no banco) e podem ser
 *   excluídos pela própria interface quando não forem mais
 *   necessários. Nenhum dado é inventado pela interface: todos
 *   os números exibidos vêm sempre do banco de dados.
 *
 * Uso: npm run seed
 * ============================================================
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { obterRepositorio } = require('../api/_lib/db.js');

const EXEMPLOS = [
  { nome: 'Ana Beatriz Souza', email: 'ana.souza@exemplo.com', telefone: '11987654321', cidade: 'São Paulo' },
  { nome: 'Bruno Carvalho Lima', email: 'bruno.lima@exemplo.com', telefone: '21999887766', cidade: 'Rio de Janeiro' },
  { nome: 'Carolina Menezes', email: 'carolina.menezes@exemplo.com', telefone: '31987651234', cidade: 'Belo Horizonte' },
  { nome: 'Diego Almeida Ramos', email: 'diego.ramos@exemplo.com', telefone: '41988776655', cidade: 'Curitiba' },
  { nome: 'Fernanda Duarte', email: 'fernanda.duarte@exemplo.com', telefone: '51997766554', cidade: 'Porto Alegre' },
  { nome: 'Gabriel Torres Neto', email: 'gabriel.neto@exemplo.com', telefone: '61987659876', cidade: 'Brasília' },
  { nome: 'Helena Castro Pires', email: 'helena.pires@exemplo.com', telefone: '71988771234', cidade: 'Salvador' },
  { nome: 'Lucas Ferreira Antunes', email: 'lucas.antunes@exemplo.com', telefone: '81997766123', cidade: 'Recife' },
];

try {
  const repositorio = await obterRepositorio();
  const { randomUUID } = await import('node:crypto');

  let criados = 0;
  let ignorados = 0;

  for (const exemplo of EXEMPLOS) {
    if (await repositorio.emailEmUso(exemplo.email)) {
      ignorados += 1;
      continue;
    }
    await repositorio.criar({
      ...exemplo,
      id: randomUUID(),
      criado_em: new Date(Date.now() - Math.floor(Math.random() * 20) * 24 * 60 * 60 * 1000).toISOString(),
    });
    criados += 1;
  }

  console.log(`✔ Seed concluído — banco: ${repositorio.nome}`);
  console.log(`  Criados: ${criados} | Já existentes (ignorados): ${ignorados}`);
  console.log('  Os cadastros de teste usam e-mails @exemplo.com e podem ser excluídos pela interface.');
} catch (erro) {
  console.error('✖ Falha no seed:');
  console.error(`  ${erro.message}`);
  process.exitCode = 1;
}
