// Testa crm-fase3-cerebro.sql (entrega 3a do Circuito) num Postgres efêmero (PGlite), em cima
// dos arquivos reais das fases 1, 1b, 2 e 2c. Não toca no Supabase real.
//
// Uso:
//   cd admin/crm/db/testes && npm install
//   APP_DB_DIR="/caminho/para/POR DENTRO APP/db" npm run test:cerebro
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
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;
const CHAVE = 'a'.repeat(64);          // chave de teste, só existe aqui
const OUTRA = 'b'.repeat(64);

async function main() {
  console.log('== Setup ==');
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
  await db.exec(readFileSync(path.resolve(HERE, '../crm-fase2.sql'), 'utf8'));
  await db.exec(readFileSync(path.resolve(HERE, '../crm-fase2c-lembretes.sql'), 'utf8'));
  const sql3 = readFileSync(path.resolve(HERE, '../crm-fase3-cerebro.sql'), 'utf8');
  await db.exec(sql3);
  const idem = await attempt(() => db.exec(sql3));
  check('fase 3 é idempotente (roda 2x sem erro)', idem.ok);
  if (!idem.ok) console.log(idem.error.message);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [outra] = await q("insert into auth.users (email) values ('curiosa@example.com') returning id");
  await db.query("insert into cerebro_chaves (rotulo, hash) values ('hub', sha256(convert_to($1, 'UTF8')))", [CHAVE]);

  console.log('\n== Envio: aceite do uso em conteúdo ==');
  const base = { email: 'maria.silva@example.com', nome: 'Maria Silva', texto: 'Meu visto vence em novembro, e agora?', artigo: 'troca-de-visto',
    aceita_servico: true, consentimento_versao: 'site-v2', texto_servico: 'Li e aceito ... inclusive o uso da minha pergunta.' };
  const envia = (p) => attempt(() => asAnon(() => db.query('select enviar_pergunta_unica($1)', [JSON.stringify(p)])));
  check('anon envia pergunta com aceite do uso', (await envia({ ...base, aceita_uso_conteudo: true })).ok);
  check('anon envia pergunta sem aceite do uso (site-v1)', (await envia({ ...base, email: 'joao@example.com', nome: 'João', texto: 'Outra dúvida', consentimento_versao: 'site-v1' })).ok);
  const pergs = await q("select p.texto, p.uso_conteudo, c.email from perguntas_unicas p join contatos c on c.id = p.contato_id order by p.id");
  check('uso_conteudo = true só na que aceitou', pergs[0].uso_conteudo === true && pergs[1].uso_conteudo === false);
  check('grava consentimento uso_conteudo com versão e texto',
    (await q("select versao, texto from consentimentos where finalidade='uso_conteudo'")).length === 1);
  check('o aceite do uso não é gravado para quem não aceitou',
    (await q("select 1 from consentimentos co join contatos c on c.id=co.contato_id where c.email='joao@example.com' and co.finalidade='uso_conteudo'")).length === 0);

  console.log('\n== Hub: perguntas_para_cerebro ==');
  const chama = (chave) => attempt(() => asAnon(() => db.query('select perguntas_para_cerebro($1) as r', [chave])));
  for (const [label, ch] of [['sem chave', null], ['chave curta', 'abc'], ['chave errada', OUTRA]]) {
    const r = await chama(ch);
    check(`recusa ${label}`, !r.ok && /chave_invalida/.test(r.error.message));
  }
  const ok1 = await chama(CHAVE);
  check('chave certa responde', ok1.ok);
  const lista = ok1.value.rows[0].r;
  check('devolve só a pergunta com aceite do uso', lista.length === 1 && /vence em novembro/.test(lista[0].texto));
  check('só as colunas necessárias', JSON.stringify(Object.keys(lista[0]).sort()) === JSON.stringify(['artigo', 'caminho', 'codigo', 'data', 'persona', 'texto']));
  const bruto = JSON.stringify(lista);
  check('nada que identifique a pessoa na resposta (e-mail, nome do contato, uuid)',
    !/maria\.silva|example\.com/i.test(bruto) && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(bruto));
  check('código opaco no formato Q-XXXXXX', /^Q-[0-9A-F]{6}$/.test(lista[0].codigo));
  const ok2 = await chama(CHAVE);
  check('segunda leitura devolve a mesma pergunta com o mesmo código', ok2.value.rows[0].r[0]?.codigo === lista[0].codigo);

  console.log('\n== Hub: confirmar_pergunta_cerebro ==');
  const conf = (ch, cod, est) => attempt(() => asAnon(() => db.query('select confirmar_pergunta_cerebro($1,$2,$3) as r', [ch, cod, est])));
  check('recusa chave errada', /chave_invalida/.test((await conf(OUTRA, lista[0].codigo, 'caso')).error?.message || ''));
  check('recusa estado inválido', /estado_invalido/.test((await conf(CHAVE, lista[0].codigo, 'qualquer')).error?.message || ''));
  check('código inexistente → ok false', (await conf(CHAVE, 'Q-000000', 'caso')).value.rows[0].r.ok === false);
  check('confirma como caso', (await conf(CHAVE, lista[0].codigo, 'caso')).value.rows[0].r.ok === true);
  check('não confirma duas vezes', (await conf(CHAVE, lista[0].codigo, 'descartada')).value.rows[0].r.ok === false);
  check('depois de caso, a pergunta não volta', (await chama(CHAVE)).value.rows[0].r.length === 0);

  console.log('\n== Chave revogável ==');
  await envia({ ...base, texto: 'Mais uma dúvida', aceita_uso_conteudo: true });
  await db.query("update cerebro_chaves set revogada_em = now() where rotulo = 'hub'");
  check('chave revogada deixa de funcionar', /chave_invalida/.test((await chama(CHAVE)).error?.message || ''));
  await db.query("insert into cerebro_chaves (rotulo, hash) values ('hub2', sha256(convert_to($1, 'UTF8')))", [OUTRA]);
  check('chave nova funciona e a antiga continua revogada', (await chama(OUTRA)).ok && !(await chama(CHAVE)).ok);

  console.log('\n== Acesso: anon e não-admin ==');
  check('anon não lê cerebro_chaves', !(await attempt(() => asAnon(() => db.query('select * from cerebro_chaves')))).ok);
  const nl = await attempt(() => asUser(outra.id, () => db.query('select * from cerebro_chaves')));
  check('logado não-admin vê 0 linhas em cerebro_chaves', nl.ok && nl.value.rows.length === 0);
  const np = await attempt(() => asUser(outra.id, () => db.query('select codigo_cerebro from perguntas_unicas')));
  check('logado não-admin não lê codigo_cerebro', np.ok && np.value.rows.length === 0);
  check('anon não lê codigo_cerebro', !(await attempt(() => asAnon(() => db.query('select codigo_cerebro from perguntas_unicas')))).ok);
  check('anon não chama crm_cerebro_chave_ok', !(await attempt(() => asAnon(() => db.query('select crm_cerebro_chave_ok($1)', [OUTRA])))).ok);
  check('admin vê o hash da chave mas a tabela não guarda a chave em texto',
    (await asUser(admin.id, () => db.query('select hash from cerebro_chaves'))).rows.every((r) => r.hash.length === 32));

  console.log('\n== Exclusão do contato ==');
  const [maria] = await q("select id from contatos where email='maria.silva@example.com'");
  await db.query('delete from contatos where id = $1', [maria.id]);
  check('apagar o contato apaga as perguntas e o código (o caso fica sem vínculo)',
    (await q("select count(*)::int n from perguntas_unicas where codigo_cerebro is not null"))[0].n === 0);

  console.log(`\n${passed} verificações ok, ${failed} falharam.`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
