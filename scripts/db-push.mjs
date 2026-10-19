/**
 * Garante que o schema do banco existe (usado pelo `npm run db:push`).
 * Com DATABASE_URL PostgreSQL → cria a tabela no banco remoto.
 * Sem DATABASE_URL            → cria o arquivo SQLite local de desenvolvimento.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { obterRepositorio } = require('../api/_lib/db.js');

try {
  const repositorio = await obterRepositorio();
  await repositorio.verificarConexao();
  const dados = await repositorio.estatisticas();
  console.log(`✔ Schema garantido. Banco ativo: ${repositorio.nome}`);
  console.log(`  Registros armazenados: ${dados.total}`);
} catch (erro) {
  console.error('✖ Falha ao preparar o banco de dados:');
  console.error(`  ${erro.message}`);
  console.error('  Dica: na Vercel, configure a variável DATABASE_URL (veja o README.md).');
  process.exitCode = 1;
}
