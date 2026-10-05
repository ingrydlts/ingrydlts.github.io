// Testa crm-fase3c-agregados.sql (entrega 3c do Circuito) num Postgres efêmero (PGlite).
// Uso:  APP_DB_DIR="/caminho/para/POR DENTRO APP/db" npm run test:agregados
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../POR DENTRO APP/db');
const db = new PGlite();
let passed = 0, failed = 0;
const check = (label, cond) => { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } };
const attempt = async (fn) => { try { return { ok: true, value: await fn(), error: null }; } catch (e) { return { ok: false, value: null, error: e }; } };
async function asRole(role, fn) { await db.exec(`set role ${role}`); try { return await fn(); } finally { await db.exec('reset role'); } }
const q = async (sql, params) => (await db.query(sql, params)).rows;
const CHAVE = 'c'.repeat(64);

async function main() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz not null default now());
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of ['schema.sql', 'crm-fase1.sql', 'crm-fase1b-minha-ficha.sql', 'caminhos-opcoes.sql'])
    await db.exec(readFileSync(path.join(APP_DB, f), 'utf8'));
  for (const f of ['../crm-fase2.sql', '../crm-fase2c-lembretes.sql', '../crm-fase3-cerebro.sql']) await db.exec(readFileSync(path.resolve(HERE, f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-fase3c-agregados.sql'), 'utf8');
  await db.exec(sql);
  check('3c é idempotente', (await attempt(() => db.exec(sql))).ok);
  await db.query("insert into cerebro_chaves (rotulo, hash) values ('hub', sha256(convert_to($1, 'UTF8')))", [CHAVE]);

  // 4 pessoas do artigo carte-vitale (1 avançou), 3 do cpf-saldo, 2 do 'raro' (ficam em outros), 1 sem origem, 1 antiga (fora da janela)
  const novo = async (email, origem, estagio = 'lead', dias = 1) =>
    q("insert into contatos (email, origem, estagio, criado_em) values ($1,$2,$3, now() - make_interval(days => $4)) returning id", [email, origem, estagio, dias]);
  for (let i = 0; i < 3; i++) await novo(`cv${i}@example.com`, 'carte-vitale');
  await novo('cv3@example.com', 'carte-vitale', 'ativado');
  for (let i = 0; i < 3; i++) await novo(`cpf${i}@example.com`, 'cpf-saldo', 'lead');
  await novo('r0@example.com', 'raro'); await novo('r1@example.com', 'raro-dois');
  await novo('sem@example.com', null);
  await novo('velha@example.com', 'carte-vitale', 'lead', 200);
  const [pessoa] = await q("select id from contatos where email='cv0@example.com'");
  for (let i = 0; i < 3; i++) await db.query("insert into perguntas_unicas (contato_id, texto, origem) values ($1,'x','carte-vitale')", [pessoa.id]);
  await db.query("insert into perguntas_unicas (contato_id, texto, origem) values ($1,'y','raro')", [pessoa.id]);

  const chama = (chave, dias) => attempt(() => asRole('anon', () => db.query('select agregados_para_cerebro($1,$2) as r', [chave, dias ?? 90])));
  for (const [label, ch] of [['sem chave', null], ['chave errada', 'd'.repeat(64)], ['chave curta', 'abc']]) {
    const r = await chama(ch); check(`recusa ${label}`, !r.ok && /chave_invalida/.test(r.error.message));
  }
  const ok = await chama(CHAVE);
  check('chave certa responde', ok.ok);
  const r = ok.value.rows[0].r;
  check('janela de 90 dias deixa a pessoa antiga de fora', r.total_contatos === 10 && r.janela_dias === 90);
  const origem = (o) => r.por_origem.find((x) => x.origem === o);
  check('carte-vitale: 4 pessoas, 3 leads e 1 ativado', origem('carte-vitale')?.total === 4 && origem('carte-vitale').por_estagio.lead === 3 && origem('carte-vitale').por_estagio.ativado === 1);
  check('cpf-saldo: 3 pessoas', origem('cpf-saldo')?.total === 3);
  check('origem com menos de 3 pessoas vira (outros) e não aparece com o nome', !origem('raro') && !origem('raro-dois') && origem('(outros)')?.total === 2);
  check('contato sem origem é contado à parte', origem('(sem origem)')?.total === 1);
  check('perguntas: 3 do carte-vitale; a de origem rara vai para (outros)', r.perguntas_por_origem.find((x) => x.origem === 'carte-vitale')?.perguntas === 3 && r.perguntas_por_origem.find((x) => x.origem === '(outros)')?.perguntas === 1 && !r.perguntas_por_origem.some((x) => x.origem === 'raro'));
  check('por_estagio geral', r.por_estagio.lead === 9 && r.por_estagio.ativado === 1);
  const bruto = JSON.stringify(r);
  check('nada de pessoa na resposta (e-mail, id, nome de origem rara)', !/example\.com|@/.test(bruto) && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(bruto) && !/raro/.test(bruto));
  check('janela é limitada (7 a 365)', (await chama(CHAVE, 1)).value.rows[0].r.janela_dias === 7 && (await chama(CHAVE, 9999)).value.rows[0].r.janela_dias === 365);
  check('janela de 365 dias traz a pessoa antiga', (await chama(CHAVE, 365)).value.rows[0].r.total_contatos === 11);
  await db.query("update cerebro_chaves set revogada_em = now()");
  check('chave revogada deixa de funcionar', !(await chama(CHAVE)).ok);
  check('autenticado sem chave também não chama', !(await attempt(() => asRole('authenticated', () => db.query('select agregados_para_cerebro($1,90)', ['e'.repeat(64)])))).ok);

  console.log(`\n${passed} verificações ok, ${failed} falharam.`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
