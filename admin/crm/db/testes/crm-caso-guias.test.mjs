// Testa crm-caso-guias.sql (vários bilans com data e palavras-chave, documentos e mensagens prontas) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:caso-guias
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, error: e }; } }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, p) => (await db.query(sql, p)).rows;
const um = async (sql, p) => (await q(sql, p))[0];

async function main() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql', 'crm-fase1c-vinculo.sql', 'crm-fase1d-conta-confirmada.sql']) await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const ok = async (tipo, dados) => (await um('select caso_board_chaves_ok($1, $2::jsonb, false) ok', [tipo, JSON.stringify(dados)])).ok;
  check('antes do arquivo novo: o bilan só aceita "secoes" (data e palavras são recusadas)', (await ok('bilan', { secoes: [] })) === true && (await ok('bilan', { data: '2026-11-12' })) === false);
  const sql = readFileSync(path.resolve(HERE, '../crm-caso-guias.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);
  check('bilan: aceita secoes, data (AAAA-MM-DD) e até 6 palavras-chave curtas', await ok('bilan', { secoes: [], data: '2026-11-12', palavras: ['Prazo', 'Dinheiro', 'Idioma', 'Visto', 'DU', 'Alliance'] }));
  check('bilan: data fora do formato, palavras demais, palavra vazia, longa demais ou que não é texto são recusadas', !(await ok('bilan', { data: '12/11/2026' })) && !(await ok('bilan', { palavras: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })) && !(await ok('bilan', { palavras: [''] })) && !(await ok('bilan', { palavras: ['x'.repeat(31)] })) && !(await ok('bilan', { palavras: [1] })) && !(await ok('bilan', { palavras: 'Prazo' })));
  check('"data" e "palavras" só existem no bilan: em documento ou modelo continuam recusados', !(await ok('documento', { data: '2026-11-12' })) && !(await ok('modelo', { palavras: ['x'] })));
  check('o que já era aceito continua: modelo, documento, marco, escola', await ok('modelo', { idioma: 'fr', assunto: 'x', corpo: 'y', traducao: 'z' }) && await ok('documento', { rotulo: 'x', direcao: 'recebe' }) && await ok('marco', { data: '2026-11-30', a_confirmar: false, nota: 'x' }) && await ok('escola', { cidade: 'Aix', curso: 'DU', custo_eur: 1 }));
  check('chave desconhecida continua recusada', !(await ok('bilan', { segredo: 'x' })) && !(await ok('modelo', { data: '2026-01-01' })));

  // Vários bilans da mesma pessoa, cada um com a sua data e as suas palavras, e a pessoa só vê os publicados.
  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  await db.query("insert into contatos (email, user_id, estagio) values ('ana@example.com', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [ana.id]);
  const c = (await um("select id from contatos where email='ana@example.com'")).id;
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [c]);
  const ins = (tipo, titulo, resumo, dados, link) => um('insert into board_itens (contato_id, tipo, titulo, resumo, dados, link) values ($1,$2,$3,$4,$5::jsonb,$6) returning id', [c, tipo, titulo, resumo, JSON.stringify(dados), link || null]);
  const b1 = await ins('bilan', 'Primeira conversa', null, { data: '2026-10-29', palavras: ['PVT', 'visto de estudante', 'Alliance'], secoes: [] });
  const b2 = await ins('bilan', 'Segunda conversa', null, { data: '2026-11-12', palavras: ['Prazo', 'DU'], secoes: [] });
  const d1 = await ins('documento', 'PDF das escolas de FLE', 'Escolas de francês por região', { direcao: 'recebe' }, 'https://exemplo.org/pdf');
  const m1 = await ins('modelo', 'E-mail para as escolas', 'Para pedir informações de inscrição', { assunto: 'Inscription', corpo: 'Bonjour' });
  for (const id of [b1.id, b2.id, d1.id, m1.id]) { await db.query("update board_itens set estado='revisado' where id=$1", [id]); }
  for (const id of [b1.id, b2.id, d1.id]) await asUser(admin.id, () => db.query('select crm_board_publicar($1)', [id]));
  const meu = (await asUser(ana.id, () => um('select meu_caso() r'))).r;
  check('a pessoa vê os dois bilans publicados, cada um com a sua data e as palavras-chave, e o documento com o "o que é"; a mensagem ainda não publicada não aparece', meu.board.filter((b) => b.tipo === 'bilan').length === 2 && meu.board.find((b) => b.titulo === 'Segunda conversa').dados.palavras.join() === 'Prazo,DU' && meu.board.find((b) => b.tipo === 'documento').resumo === 'Escolas de francês por região' && !meu.board.some((b) => b.tipo === 'modelo'));
  check('o banco recusa bilan com data inválida mesmo pela tabela', !(await attempt(() => ins('bilan', 'x', null, { data: 'ontem' }))).ok);
  // crm-caso-documentos.sql: selos nos documentos e o botão "conferir_documentos"
  const sqlDoc = readFileSync(path.resolve(HERE, '../crm-caso-documentos.sql'), 'utf8');
  check('crm-caso-documentos.sql roda duas vezes sem erro', (await attempt(() => db.exec(sqlDoc))).ok && (await attempt(() => db.exec(sqlDoc))).ok);
  check('documento aceita selos válidos (até 4)', await ok('documento', { direcao: 'reune', selos: ['traducao', 'haia', 'equivaler', 'original'] }));
  check('selos inválidos são recusados: valor fora da lista, mais de 4, não é lista, em outro tipo', !(await ok('documento', { selos: ['xyz'] })) && !(await ok('documento', { selos: ['traducao', 'haia', 'equivaler', 'original', 'traducao'] })) && !(await ok('documento', { selos: 'traducao' })) && !(await ok('documento', { selos: [1] })) && !(await ok('escola', { selos: ['haia'] })));
  check('a pessoa não edita selos (dados_dela do documento só aceita "reunido")', !(await um("select caso_board_chaves_ok('documento', '{\"selos\":[\"haia\"]}'::jsonb, true) r")).r);
  check('o que o guias já validava continua (bilan com data inválida)', !(await ok('bilan', { data: '12/11/2026' })) && await ok('bilan', { data: '2026-11-12', palavras: ['a'] }));
  const dsel = await ins('documento', 'Certidão de nascimento', null, { direcao: 'reune', selos: ['traducao', 'haia'] });
  check('o documento com selos é gravado pela tabela', !!dsel.id);
  const acaoOk = await attempt(() => db.query("insert into caso_acoes (contato_id, titulo, dono, canal, botao, passo_chave) values ($1, 'Tradução juramentada de documentos', 'ela', 'plataforma', 'conferir_documentos', 'docs:traducao')", [c]));
  check('caso_acoes aceita o botão conferir_documentos e continua recusando botão inventado', acaoOk.ok && !(await attempt(() => db.query("insert into caso_acoes (contato_id, titulo, dono, canal, botao, passo_chave) values ($1, 'x', 'ela', 'plataforma', 'inventado', 'x')", [c]))).ok);
  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
