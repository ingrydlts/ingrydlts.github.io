// Testa crm-caso-catalogo.sql (tipos de bloco e destinos de resposta como DADO, não como SQL por tipo) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:catalogo
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
async function falha(fn, motivo) { const r = await attempt(fn); return !r.ok && (!motivo || String(r.error.message).includes(motivo)); }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asUser = (id, fn) => asRole('authenticated', id, fn);
const asAnon = (fn) => asRole('anon', null, fn);
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
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-guias.sql', 'crm-caso-documentos.sql', 'crm-caso-checklists.sql', 'crm-caso-criterios.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-caso-catalogo.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [ana] = await q("insert into auth.users (email, email_confirmed_at) values ('ana@example.com', now()) returning id");
  await db.query("insert into contatos (email, user_id, estagio) values ('ana@example.com', $1, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [ana.id]);
  const cAna = (await um("select id from contatos where email='ana@example.com'")).id;
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [cAna]);
  const item = (tipo, titulo, dados = {}, dela = {}) => um('insert into board_itens (contato_id, tipo, titulo, dados, dados_dela) values ($1,$2,$3,$4,$5) returning id', [cAna, tipo, titulo, JSON.stringify(dados), JSON.stringify(dela)]);
  const aviso = (extra) => um(`insert into caso_avisos (contato_id, tipo, titulo, resposta_tipo, opcoes, grava_em) values ($1,'pergunta','Quando acaba o seu PVT?', $2, $3, $4) returning id`, [cAna, extra.rt ?? 'data', extra.op ?? null, extra.g]);

  console.log('== Tabelas do catálogo: só admin ==');
  for (const t of ['bloco_tipos', 'respostas_permitidas']) {
    const pol = await q("select polname, pg_get_expr(polqual, polrelid) as q from pg_policy where polrelid = $1::regclass", ['public.' + t]);
    check(`${t}: RLS ligada com uma só política, a do admin`, (await um("select relrowsecurity r from pg_class where oid = $1::regclass", ['public.' + t])).r && pol.length === 1 && /eh_admin\(\)/.test(pol[0].q));
    check(`${t}: anônimo não lê`, !(await attempt(() => asAnon(() => q(`select * from ${t}`)))).ok);
    check(`${t}: pessoa logada não lê`, (await asUser(ana.id, () => q(`select * from ${t}`))).length === 0);
    check(`${t}: admin lê`, (await asUser(admin.id, () => q(`select * from ${t}`))).length > 0);
  }
  const tipos = (await q('select chave from bloco_tipos where ativo order by chave')).map((r) => r.chave);
  check('os 6 blocos iniciais existem (escola, empresa, consulado, tradutor, seguro, contador)', JSON.stringify(tipos) === JSON.stringify(['consulado', 'contador', 'empresa', 'escola', 'seguro', 'tradutor']));
  check('as 4 respostas que já existiam continuam permitidas', (await q('select chave from respostas_permitidas')).length >= 4);

  console.log('\n== Perguntas da equipe: destino vem da tabela, não de um CHECK ==');
  check('destino antigo continua valendo (respostas.fim_pvt)', (await attempt(() => aviso({ g: 'respostas.fim_pvt' }))).ok);
  check('destino fora da tabela é recusado', await falha(() => aviso({ g: 'respostas.qualquer_coisa' }), 'destino_nao_permitido'));
  check('formato inseguro de destino é recusado', await falha(() => aviso({ g: 'contatos.email' })) && await falha(() => aviso({ g: 'respostas.A b' })));
  await db.query("insert into respostas_permitidas (chave, tipo) values ('respostas.data_prova_frances', 'data')");
  check('destino novo entra por UMA linha na tabela, sem SQL novo', (await attempt(() => aviso({ g: 'respostas.data_prova_frances' }))).ok);
  check('o tipo da resposta tem que bater com o do destino (data x opcoes)', await falha(() => aviso({ g: 'respostas.data_prova_frances', rt: 'opcoes', op: '{Sim,Nao}' }), 'destino_nao_permitido'));

  console.log('\n== Blocos de contatos: tipo de bloco vem do catálogo ==');
  check('bloco "empresa" (PVT) cabe como item do espaço', (await attempt(() => item('contato', 'Empresas para contactar', { bloco_tipo: 'empresa', nome: 'Acme SAS', link: 'https://acme.example/estagio', canal: 'e-mail', nota: 'Pedir atestado de formação' }))).ok);
  check('bloco "consulado" também, sem SQL novo', (await attempt(() => item('contato', 'Consulado', { bloco_tipo: 'consulado' }))).ok);
  check('tipo de bloco que não existe no catálogo é recusado', await falha(() => item('contato', 'X', { bloco_tipo: 'inexistente' }), 'bloco_tipo_invalido'));
  check('item "contato" sem bloco_tipo é recusado', await falha(() => item('contato', 'X', { nome: 'sem tipo' }), 'bloco_tipo_invalido'));
  await db.query("update bloco_tipos set ativo = false where chave = 'seguro'");
  check('tipo de bloco desativado deixa de aceitar itens novos', await falha(() => item('contato', 'Seguro', { bloco_tipo: 'seguro' }), 'bloco_tipo_invalido'));
  check('chave fora da lista em "contato" é recusada', !(await attempt(() => item('contato', 'X', { bloco_tipo: 'empresa', cor: 'azul' }))).ok);
  check('link do contato que não é https é recusado', !(await attempt(() => item('contato', 'X', { bloco_tipo: 'empresa', link: 'http://x.org' }))).ok);
  check('o que a pessoa preenche num contato: critérios e status', (await attempt(() => item('contato', 'Y', { bloco_tipo: 'empresa' }, { criterios: { aceita: 'sim' }, status_contato: 'contatado' }))).ok);
  check('status de contato fora da lista é recusado', !(await attempt(() => item('contato', 'Y', { bloco_tipo: 'empresa' }, { status_contato: 'ghosted' }))).ok);

  console.log('\n== Regressão: nada do que já era aceito deixou de ser (a função canônica junta as três versões) ==');
  check('documento com rotulo, direcao, selos e checklists', (await attempt(() => item('documento', 'Diploma', { rotulo: 'Diploma', direcao: 'ela_envia', selos: ['traducao', 'haia'], checklists: ['visa', 'visa_estudante'] }))).ok);
  check('selo desconhecido continua recusado', !(await attempt(() => item('documento', 'Diploma', { selos: ['carimbo'] }))).ok);
  check('bilan com secoes, data e palavras', (await attempt(() => item('bilan', 'Bilan', { secoes: [], data: '2026-11-16', palavras: ['pvt'] }))).ok);
  check('bilan com data inválida continua recusado', !(await attempt(() => item('bilan', 'Bilan', { data: '16/11/2026' }))).ok);
  check('escola com critérios, meses e custo (dados dela)', (await attempt(() => item('escola', 'Alliance', { cidade: 'Lyon' }, { criterios: { carga: 'sim' }, meses: 4, custo_eur: 1200 }))).ok);
  check('marco e modelo com as chaves de sempre', (await attempt(() => item('marco', 'Prazo', { data: '2026-11-30', a_confirmar: true }))).ok && (await attempt(() => item('modelo', 'Ligação', { idioma: 'fr', assunto: 'x', corpo: 'y' }))).ok);

  console.log('\n== A pessoa preenche o contato dela (salvar_dados_dela aceita o tipo novo) ==');
  const c = await item('contato', 'Empresas', { bloco_tipo: 'empresa', nome: 'Acme' });
  await db.query("update board_itens set estado = 'revisado' where id = $1", [c.id]);
  await db.query("update board_itens set estado = 'publicado' where id = $1", [c.id]);
  await asUser(ana.id, () => db.query('select salvar_dados_dela($1, $2::jsonb)', [c.id, JSON.stringify({ status_contato: 'respondeu', criterios: { aceita: 'sim' } })]));
  const dela = (await um('select dados_dela from board_itens where id = $1', [c.id])).dados_dela;
  check('ela marca o status e os critérios do contato', dela.status_contato === 'respondeu' && dela.criterios.aceita === 'sim');
  check('ela não muda o conteúdo da equipe nem usa chave de outro tipo (meses é de escola)', await falha(() => asUser(ana.id, () => db.query('select salvar_dados_dela($1, $2::jsonb)', [c.id, JSON.stringify({ nome: 'Outra' })])), 'chave_invalida') && await falha(() => asUser(ana.id, () => db.query('select salvar_dados_dela($1, $2::jsonb)', [c.id, JSON.stringify({ meses: 3 })])), 'chave_invalida'));
  check('o item de contato publicado chega à pessoa por meu_caso()', (await asUser(ana.id, () => um('select meu_caso() r'))).r.board.some((b) => b.tipo === 'contato' && b.dados.bloco_tipo === 'empresa'));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
