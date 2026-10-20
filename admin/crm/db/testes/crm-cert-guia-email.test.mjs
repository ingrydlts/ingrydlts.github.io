// Testa crm-cert-guia-email.sql (pedido do e-mail do guia Painel do Certificado + índice de um e-mail por guia) e
// crm-cert-guia-modelo.sql (o modelo cert_guia_1) num Postgres efêmero (PGlite). Não toca no Supabase real.
// Não precisa do banco do app: usa tabelas mínimas no lugar de contatos, emails_enviados e dos modelos, e pega
// a crm_guia_email_pedir e o índice ORIGINAIS de crm-fase0-email-guia.sql para provar que o Campus France segue igual.
// pg_net e Vault não existem no PGlite: o teste cria versões falsas que só anotam a chamada.
//
// Uso:
//   cd admin/crm/db/testes && npm install && npm run test:cert
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lerSql = (f) => readFileSync(path.resolve(HERE, '..', f), 'utf8');
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
const q = async (sql, params) => (await db.query(sql, params)).rows;

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create role anon; create role authenticated;
    create table public.contatos (id uuid primary key default gen_random_uuid(), email text unique, nome text);
    create table public.emails_enviados (id bigint generated always as identity primary key,
      contato_id uuid references public.contatos(id), modelo text not null, status text);
    create schema net; create schema vault;
    create table net.chamadas (url text, body jsonb, headers jsonb);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql
      as $$ insert into net.chamadas values (url, body, headers); select 1::bigint $$;
    create table vault.decrypted_secrets (name text, decrypted_secret text);
  `);

  // A migração da fase 0 de antes: só o índice do Campus France e a crm_guia_email_pedir (o resto precisa do banco do app).
  const fase0 = lerSql('crm-fase0-email-guia.sql');
  const indiceCf = /create unique index if not exists emails_um_por_guia_idx[\s\S]*?;/.exec(fase0)?.[0];
  const funcaoCf = /create or replace function public\.crm_guia_email_pedir[\s\S]*?revoke all on function public\.crm_guia_email_pedir[^;]*;/.exec(fase0)?.[0];
  check('achou o índice e a função originais em crm-fase0-email-guia.sql', !!indiceCf && !!funcaoCf);
  await db.exec(indiceCf + '\n' + funcaoCf);
  check('a capturar_lead_guia da fase 0 chama crm_guia_email_pedir(v_id, v_guia) para qualquer guia',
    /perform public\.crm_guia_email_pedir\(v_id, v_guia\);/.test(fase0));

  const [dani] = await q("insert into contatos (email, nome) values ('dani@example.com', 'Dani') returning id");
  const [eva] = await q("insert into contatos (email, nome) values ('eva@example.com', 'Eva') returning id");
  const pedir = (id, guia) => db.query('select crm_guia_email_pedir($1, $2)', [id, guia]);
  const chamadas = () => q('select * from net.chamadas');
  const cfAntes = await attempt(() => pedir(dani.id, 'painel-do-certificado'));
  await db.exec(`insert into vault.decrypted_secrets values ('crm_worker_url', 'https://worker.example.com/'),
    ('crm_hook_secret', 'segredo-de-teste-com-mais-de-24-caracteres')`);
  await pedir(dani.id, 'painel-do-certificado');
  check('antes da migração o painel não chama (comportamento de hoje)', cfAntes.ok && (await chamadas()).length === 0);

  console.log('\n== Migração ==');
  const sql = lerSql('crm-cert-guia-email.sql');
  const r1 = await attempt(() => db.exec(sql));
  check('roda sem erro', r1.ok);
  if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('é idempotente (roda 2x sem erro)', r2.ok);
  check('não apaga o índice do Campus France', (await q("select 1 from pg_indexes where indexname = 'emails_um_por_guia_idx'")).length === 1);
  check('cria o índice do painel', (await q("select 1 from pg_indexes where indexname = 'emails_um_por_guia_cert_idx'")).length === 1);

  console.log('\n== Pedido do e-mail ==');
  await db.exec('truncate net.chamadas; delete from vault.decrypted_secrets');
  await pedir(dani.id, 'painel-do-certificado');
  await pedir(dani.id, 'etudes-en-france-2027-2028');
  check('sem segredos no Vault: não chama nada (desligado), nem dá erro', (await chamadas()).length === 0);
  await db.exec(`insert into vault.decrypted_secrets values ('crm_worker_url', 'https://worker.example.com/'),
    ('crm_hook_secret', 'segredo-de-teste-com-mais-de-24-caracteres')`);
  await db.exec(`delete from vault.decrypted_secrets where name = 'crm_hook_secret';
    insert into vault.decrypted_secrets values ('crm_hook_secret', 'curto')`);
  await pedir(dani.id, 'painel-do-certificado');
  check('segredo curto demais: não chama', (await chamadas()).length === 0);
  await db.exec(`update vault.decrypted_secrets set decrypted_secret = 'segredo-de-teste-com-mais-de-24-caracteres' where name = 'crm_hook_secret'`);

  await pedir(dani.id, 'painel-do-certificado');
  let ch = await chamadas();
  check('painel: chama a rota do Worker uma vez', ch.length === 1 && ch[0].url === 'https://worker.example.com/api/crm/guia-capturado');
  check('painel: manda contato e guia (nenhum e-mail nem link no corpo)', ch[0]?.body.contato_id === dani.id && ch[0]?.body.guia === 'painel-do-certificado' &&
    Object.keys(ch[0].body).sort().join() === 'contato_id,guia');
  check('painel: manda o segredo no cabeçalho', ch[0]?.headers['X-Crm-Hook'] === 'segredo-de-teste-com-mais-de-24-caracteres');

  await pedir(eva.id, 'etudes-en-france-2027-2028');
  ch = await chamadas();
  check('Campus France continua pedindo o e-mail 1', ch.length === 2 && ch[1].body.guia === 'etudes-en-france-2027-2028');
  await pedir(eva.id, 'vls-ts-validacao-travou');
  await pedir(eva.id, 'outro-guia');
  await pedir(null, 'painel-do-certificado');
  check('guia sem e-mail e contato nulo: não chamam', (await chamadas()).length === 2);

  await db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'cert_guia_1', 'agendado')", [dani.id]);
  await pedir(dani.id, 'painel-do-certificado');
  check('quem já recebeu o painel não pede de novo', (await chamadas()).length === 2);
  await db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'cf_guia_1', 'agendado')", [dani.id]);
  await pedir(dani.id, 'etudes-en-france-2027-2028');
  check('o painel não bloqueia o Campus France da mesma pessoa (e vice-versa)', (await chamadas()).length === 2);
  await pedir(eva.id, 'painel-do-certificado');
  check('outra pessoa pede o painel normalmente', (await chamadas()).length === 3);

  console.log('\n== Um e-mail por pessoa por guia ==');
  const dup = await attempt(() => db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'cert_guia_1', 'agendado')", [dani.id]));
  check('índice barra um 2º cert_guia_1 para a mesma pessoa', !dup.ok);
  const dupCf = await attempt(() => db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'cf_guia_1', 'agendado')", [dani.id]));
  check('índice do Campus France continua barrando o 2º cf_guia_1', !dupCf.ok);
  check('cert_guia_1 e cf_guia_1 convivem na mesma pessoa', (await q("select count(*)::int n from emails_enviados where contato_id = $1 and modelo in ('cert_guia_1', 'cf_guia_1')", [dani.id]))[0].n === 2);
  check('outros modelos continuam repetíveis', (await attempt(async () => {
    await db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'naoabriu', 'agendado')", [dani.id]);
    await db.query("insert into emails_enviados (contato_id, modelo, status) values ($1, 'naoabriu', 'agendado')", [dani.id]);
  })).ok);

  console.log('\n== Segurança e falhas ==');
  await db.exec('set role anon');
  const anon = await attempt(() => pedir(eva.id, 'painel-do-certificado'));
  await db.exec('reset role');
  check('anon não chama crm_guia_email_pedir direto', !anon.ok);
  await db.exec(`drop function net.http_post(text, jsonb, jsonb, jsonb, int);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql
      as $$ begin raise exception 'pg_net fora do ar'; end $$;`);
  const [gui] = await q("insert into contatos (email) values ('gui@example.com') returning id");
  check('pg_net com erro vira aviso e não derruba quem chamou', (await attempt(() => pedir(gui.id, 'painel-do-certificado'))).ok);

  console.log('\n== Modelo cert_guia_1 (crm-cert-guia-modelo.sql) ==');
  await db.exec(`
    create table public.modelos_email (chave text primary key, nome text not null, objetivo text not null, tipo text not null,
      como_sai text not null, quem_recebe text, automatico boolean not null default false, variaveis jsonb not null default '[]'::jsonb, ordem int not null default 100);
    create table public.modelos_email_versoes (id bigint generated always as identity primary key, chave text not null references public.modelos_email (chave),
      versao int not null, etapa text not null default 'rascunho', assunto text not null, preheader text, corpo_texto text not null, corpo_html text,
      blocos jsonb, nota text, publicado_em timestamptz, unique (chave, versao));
    create unique index modelos_email_um_no_ar_idx on public.modelos_email_versoes (chave) where etapa = 'no_ar';
  `);
  const modelo = lerSql('crm-cert-guia-modelo.sql');
  const m1 = await attempt(() => db.exec(modelo));
  check('roda sem erro', m1.ok);
  if (!m1.ok) console.log(m1.error.message);
  check('é idempotente (roda 2x sem erro e sem duplicar)', (await attempt(() => db.exec(modelo))).ok &&
    (await q("select count(*)::int n from modelos_email where chave = 'cert_guia_1'"))[0].n === 1 &&
    (await q("select count(*)::int n from modelos_email_versoes where chave = 'cert_guia_1'"))[0].n === 1);
  const [mo] = await q("select * from modelos_email where chave = 'cert_guia_1'");
  check('modelo de serviço que sai sozinho', mo.tipo === 'servico' && mo.automatico === true);
  const [ve] = await q("select * from modelos_email_versoes where chave = 'cert_guia_1'");
  check('versão 1 No ar, com blocos', ve.versao === 1 && ve.etapa === 'no_ar' && Array.isArray(ve.blocos.itens));
  check('assunto aprovado', ve.assunto === 'Seu painel do certificado está aqui');
  check('texto usa o link do painel como dado, sem link nenhum escrito', /\{link_painel\}/.test(ve.corpo_texto) && !/https?:\/\//.test(ve.corpo_texto) && !/https?:\/\/(?!imigrantepordentro)/.test(ve.corpo_html));
  const { gerar } = await import('../modelo-cert-guia.mjs');
  check('o SQL está em dia com o estudio.js (rode node admin/crm/db/modelo-cert-guia.mjs se falhar)', gerar() === modelo);

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
