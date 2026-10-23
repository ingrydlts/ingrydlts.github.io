// Testa crm-onboarding.sql (Onboarding: pessoa criada/atualizada a partir do que a IA leu, e o evento do link de pagamento)
// e crm-link-pagamento-email.sql (o modelo de e-mail) num Postgres efêmero (PGlite). Não toca no Supabase real. Pessoas fictícias.
//
// O esquema do app (POR-DENTRO-APP) não vive neste repositório: o teste cria só o mínimo que a função usa (contatos, eventos,
// admins, eh_admin() e o gatilho que atualiza "último sinal") e roda os arquivos REAIS crm-dossie.sql e crm-onboarding.sql em cima.
//
// Uso: cd admin/crm/db/testes && npm install && npm run test:onboarding
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const db = new PGlite();
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
async function attempt(fn) { try { return { ok: true, error: null, value: await fn() }; } catch (e) { return { ok: false, error: e, value: null }; } }
async function asRole(role, userId, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role;`); }
}
const asAnon = (fn) => asRole('anon', null, fn);
const asUser = (id, fn) => asRole('authenticated', id, fn);
const q = async (sql, params) => (await db.query(sql, params)).rows;
const campo = (valor, origem = 'documento', confianca = 'alta') => ({ valor, origem, confianca });

async function main() {
  console.log('== Setup ==');
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated;
    grant usage on schema public to anon, authenticated;

    create table public.admins (user_id uuid primary key);
    create or replace function public.eh_admin() returns boolean language sql stable security definer
      set search_path = public as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;
    create table public.contatos (
      id uuid primary key default gen_random_uuid(), email text not null unique, nome text, persona text, fase text,
      nivel_estudos text, preocupacao text, origem text, estagio text not null default 'lead',
      ultimo_evento_em timestamptz default now(), criado_em timestamptz not null default now());
    create table public.eventos (id bigint generated always as identity primary key,
      contato_id uuid not null references contatos(id) on delete cascade, tipo text not null, dados jsonb not null default '{}'::jsonb,
      criado_em timestamptz not null default now());
    -- igual a crm_evento_recente de crm-fase2.sql: o que a pessoa faz zera o "parada há N dias"; o que você faz, não
    create or replace function public.crm_evento_recente() returns trigger language plpgsql security definer as $f$
    begin
      if new.tipo <> all (array['estagio_alterado', 'sinal_enviado', 'email_enviado', 'pergunta_respondida', 'um_a_um_agendado']) then
        update contatos set ultimo_evento_em = new.criado_em where id = new.contato_id;
      end if;
      return new;
    end $f$;
    create trigger crm_eventos_recente after insert on public.eventos for each row execute function public.crm_evento_recente();
  `);
  const dossieSql = readFileSync(path.resolve(HERE, '../crm-dossie.sql'), 'utf8');
  const sql = readFileSync(path.resolve(HERE, '../crm-onboarding.sql'), 'utf8');
  check('crm-dossie.sql roda', (await attempt(() => db.exec(dossieSql))).ok);
  const r1 = await attempt(() => db.exec(sql));
  check('crm-onboarding.sql roda a 1ª vez sem erro', r1.ok); if (!r1.ok) console.log(r1.error.message);
  const r2 = await attempt(() => db.exec(sql));
  check('crm-onboarding.sql roda a 2ª vez sem erro (idempotente)', r2.ok); if (!r2.ok) console.log(r2.error.message);
  // o grant de execute das funções só vale para quem entra com token (authenticated); anon fica de fora
  await db.exec('grant select, insert, update, delete on all tables in schema public to authenticated');

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const [pessoa] = await q("insert into auth.users (email) values ('pessoa@example.com') returning id");
  const aplicar = (email, campos, custo = null, quem = admin.id) =>
    asUser(quem, () => db.query('select crm_onboarding_aplicar($1, $2, $3) as r', [email, JSON.stringify(campos), custo]));
  const get = (email) => q('select * from contatos where email = $1', [email]);

  console.log('\n== Permissões ==');
  check('anon não chama', !(await attempt(() => asAnon(() => db.query("select crm_onboarding_aplicar('a@example.com', '{}')")))).ok);
  const rp = await attempt(() => aplicar('a@example.com', {}, null, pessoa.id));
  check('pessoa logada (não admin) recebe sem_permissao', !rp.ok && /sem_permissao/.test(rp.error.message));
  check('nada foi criado para quem não é admin', (await get('a@example.com')).length === 0);
  const rl = await attempt(() => asUser(pessoa.id, () => db.query("select crm_registrar_link_pagamento(gen_random_uuid(), 'basico_mensal_brl', 'BRL')")));
  check('pessoa logada não registra link de pagamento', !rl.ok && /sem_permissao/.test(rl.error.message));

  console.log('\n== Pessoa nova ==');
  const campos = {
    nome: campo('Ana Documento', 'documento', 'alta'),
    persona: campo('au_pair_estudante', 'documento', 'media'),
    data_chegada: campo('2026-09-01', 'documento', 'alta'),
    documento_vencimento: campo('2027-09-01', 'documento', 'alta'),
    trilha_estudo: campo('fle', 'anotacao', 'baixa'),
    comprova_recursos: campo(false, 'anotacao', 'media'),
    cfEtapa: campo(3, 'anotacao', 'media'),
    ligacao_resumo: campo('Quer estudar FLE em Lyon.', 'anotacao', 'alta'),
    cidade: campo(null, 'documento', 'baixa')
  };
  const n = await attempt(() => aplicar('Ana@Example.com', campos, 0.0123));
  check('cria a pessoa', n.ok); if (!n.ok) console.log(n.error.message);
  const rn = n.value && n.value.rows[0].r;
  check('devolve o id e criado = true', rn && rn.criado === true && /^[0-9a-f-]{36}$/.test(rn.contato_id));
  const [ana] = await get('ana@example.com');
  check('e-mail guardado em minúsculas, origem onboarding', ana && ana.origem === 'onboarding');
  check('colunas preenchidas (nome, persona)', ana.nome === 'Ana Documento' && ana.persona === 'au_pair_estudante');
  const d = (await q('select dossie, dossie_origem, onboarding_em from contatos where id=$1', [ana.id]))[0];
  check('dossiê preenchido com tipos certos', d.dossie.data_chegada === '2026-09-01' && d.dossie.comprova_recursos === false && d.dossie.cfEtapa === 3 && d.dossie.trilha_estudo === 'fle');
  check('campo nulo (sem fonte) fica vazio', !('cidade' in d.dossie));
  check('guarda origem e confiança por campo', d.dossie_origem.trilha_estudo.origem === 'anotacao' && d.dossie_origem.trilha_estudo.confianca === 'baixa'
    && d.dossie_origem.nome.origem === 'documento' && d.dossie_origem.data_chegada.valor === '2026-09-01');
  check('marca o onboarding_em', !!d.onboarding_em);
  check('preenchidos lista os campos que entraram', ['nome', 'persona', 'data_chegada', 'trilha_estudo', 'ligacao_resumo'].every((k) => rn.preenchidos.includes(k)) && !rn.preenchidos.includes('cidade'));
  const ev = await q("select tipo, dados from eventos where contato_id=$1 and tipo='onboarding_documento_lido'", [ana.id]);
  check('registra onboarding_documento_lido', ev.length === 1);
  check('o evento guarda só os nomes dos campos e o custo', Number(ev[0].dados.custo_estimado_usd) === 0.0123 && ev[0].dados.campos.includes('nome')
    && Object.keys(ev[0].dados).sort().join() === 'campos,custo_estimado_usd');
  check('o evento não carrega o conteúdo lido', !JSON.stringify(ev[0].dados).includes('Ana Documento') && !JSON.stringify(ev[0].dados).includes('2026-09-01'));
  const antes = (await q("select ultimo_evento_em from contatos where id=$1", [ana.id]))[0].ultimo_evento_em;
  await new Promise((r) => setTimeout(r, 20));
  await aplicar('ana@example.com', { cidade: campo('Lyon') });
  check('o Onboarding não zera o "parada há N dias" dela', (await q("select ultimo_evento_em from contatos where id=$1", [ana.id]))[0].ultimo_evento_em.getTime() === antes.getTime());

  console.log('\n== E-mail repetido não duplica ==');
  const rep = await aplicar('ANA@example.com', { cidade: campo('Paris') });
  check('segunda leitura não cria outra pessoa', (await q("select count(*)::int n from contatos where lower(email)='ana@example.com'"))[0].n === 1);
  check('criado = false', rep.rows[0].r.criado === false && rep.rows[0].r.contato_id === ana.id);
  check('campo que já tinha valor fica de fora e é avisado', rep.rows[0].r.ja_preenchidos.includes('cidade'));

  console.log('\n== O que a Ingryd digitou prevalece ==');
  await db.query("insert into contatos (email, nome, persona) values ('bia@example.com', 'Bia Digitada', 'pvt')");
  const [bia] = await get('bia@example.com');
  await asUser(admin.id, () => db.query('select crm_salvar_dossie($1, $2)', [bia.id, JSON.stringify({ cidade: 'Toulouse', nivel_frances: 'b1' })]));
  const b = await aplicar('bia@example.com', {
    nome: campo('Bia Documento'), persona: campo('campus_france'), cidade: campo('Paris'), nivel_frances: campo('a1_a2'), telefone: campo('+33 6 00 00 00 00')
  });
  const [bia2] = await q('select nome, persona, dossie, dossie_origem from contatos where id=$1', [bia.id]);
  check('nome digitado prevalece', bia2.nome === 'Bia Digitada');
  check('persona já definida prevalece', bia2.persona === 'pvt');
  check('dossiê digitado prevalece', bia2.dossie.cidade === 'Toulouse' && bia2.dossie.nivel_frances === 'b1');
  check('o que estava vazio entrou', bia2.dossie.telefone === '+33 6 00 00 00 00' && b.rows[0].r.preenchidos.join() === 'telefone');
  check('os que não entraram não ganham origem de documento', !('cidade' in bia2.dossie_origem) && !('nome' in bia2.dossie_origem));
  check('ja_preenchidos lista os quatro', ['nome', 'persona', 'cidade', 'nivel_frances'].every((k) => b.rows[0].r.ja_preenchidos.includes(k)));
  await db.query("insert into contatos (email, persona) values ('caio@example.com', 'sem')");
  await aplicar('caio@example.com', { persona: campo('campus_france') });
  check('persona "sem" (sem situação) é preenchida', (await get('caio@example.com'))[0].persona === 'campus_france');

  console.log('\n== Valores que o CRM não conhece ==');
  const ruim = await attempt(() => aplicar('dani@example.com', { nome: campo('Dani'), passaporte_numero: campo('AB123456') }));
  check('chave fora do Dossiê é recusada (não há onde guardar número de passaporte)', !ruim.ok && /campo_desconhecido/.test(ruim.error.message));
  check('e nada fica pela metade: a pessoa nem é criada', (await get('dani@example.com')).length === 0);
  const ruim2 = await attempt(() => aplicar('dani@example.com', { data_chegada: campo('01/09/2026') }));
  check('data fora do formato é recusada', !ruim2.ok && /valor_invalido/.test(ruim2.error.message));
  await aplicar('dani@example.com', { persona: campo('astronauta'), fase: campo('talvez'), preocupacao: campo('prazo') });
  const [dani] = await get('dani@example.com');
  check('persona e fase desconhecidas são ignoradas, preocupação válida entra', dani.persona == null && dani.fase == null && dani.preocupacao === 'prazo');
  check('e-mail inválido é recusado', !(await attempt(() => aplicar('sem-arroba', {}))).ok);
  check('campos que não são objeto são recusados', !(await attempt(() => asUser(admin.id, () => db.query("select crm_onboarding_aplicar('e@example.com', '[1]'::jsonb)")))).ok);
  check('custo absurdo é recusado', !(await attempt(() => aplicar('f@example.com', {}, 5000))).ok);

  console.log('\n== Link de pagamento enviado ==');
  const antesBia = (await q('select ultimo_evento_em from contatos where id=$1', [bia.id]))[0].ultimo_evento_em;
  await new Promise((r) => setTimeout(r, 20));
  const lk = await attempt(() => asUser(admin.id, () => db.query("select crm_registrar_link_pagamento($1, 'basico_mensal_brl', 'BRL', 'Básico · mensal')", [bia.id])));
  check('registra', lk.ok); if (!lk.ok) console.log(lk.error.message);
  const e2 = await q("select dados, criado_em from eventos where contato_id=$1 and tipo='link_pagamento_enviado'", [bia.id]);
  check('evento com plano, moeda e rótulo', e2.length === 1 && e2[0].dados.plano === 'basico_mensal_brl' && e2[0].dados.moeda === 'BRL' && e2[0].dados.rotulo === 'Básico · mensal');
  check('não zera o "parada há N dias"', (await q("select ultimo_evento_em from contatos where id=$1", [bia.id]))[0].ultimo_evento_em.getTime() === antesBia.getTime());
  check('plano inválido é recusado', !(await attempt(() => asUser(admin.id, () => db.query("select crm_registrar_link_pagamento($1, 'Plano Ruim!', 'BRL')", [bia.id])))).ok);
  check('moeda inválida é recusada', !(await attempt(() => asUser(admin.id, () => db.query("select crm_registrar_link_pagamento($1, 'basico', 'real')", [bia.id])))).ok);
  check('contato inexistente é recusado', !(await attempt(() => asUser(admin.id, () => db.query("select crm_registrar_link_pagamento(gen_random_uuid(), 'basico', 'EUR')")))).ok);
  const reenvio = await attempt(() => asUser(admin.id, () => db.query("select crm_registrar_link_pagamento($1, 'basico_mensal_brl', 'BRL')", [bia.id])));
  check('reenviar registra de novo (a ficha mostra o último)', reenvio.ok && (await q("select count(*)::int n from eventos where contato_id=$1 and tipo='link_pagamento_enviado'", [bia.id]))[0].n === 2);

  console.log('\n== Modelo de e-mail link_pagamento (crm-link-pagamento-email.sql) ==');
  const { gerar, BLOCOS } = await import('../modelo-link-pagamento.mjs');
  const arqEmail = readFileSync(path.resolve(HERE, '../crm-link-pagamento-email.sql'), 'utf8');
  check('o arquivo versionado é o que o gerador produz hoje', arqEmail === gerar());
  await db.exec(`
    create table public.modelos_email (chave text primary key, nome text not null, objetivo text not null, tipo text not null, como_sai text not null,
      quem_recebe text, automatico boolean not null default false, variaveis jsonb not null default '[]'::jsonb, ordem int not null default 100,
      criado_no_estudio boolean not null default false, objetivo_chave text, para_quem jsonb not null default '{}'::jsonb, excluido_em timestamptz);
    create table public.modelos_email_versoes (id bigint generated always as identity primary key, chave text not null references modelos_email(chave),
      versao int not null, etapa text not null default 'rascunho', assunto text not null, preheader text, corpo_texto text not null, corpo_html text,
      blocos jsonb, nota text, publicado_em timestamptz, unique (chave, versao));
    create unique index modelos_um_no_ar on public.modelos_email_versoes (chave) where etapa = 'no_ar';`);
  check('roda a 1ª vez', (await attempt(() => db.exec(arqEmail))).ok);
  check('roda a 2ª vez sem duplicar', (await attempt(() => db.exec(arqEmail))).ok);
  const [m] = await q("select * from modelos_email where chave='link_pagamento'");
  check('modelo do estúdio, tipo serviço (transacional), sem Envio automático', m && m.criado_no_estudio && m.tipo === 'servico' && !m.automatico);
  const vs = await q("select * from modelos_email_versoes where chave='link_pagamento'");
  check('uma versão só, a 1, No ar', vs.length === 1 && vs[0].versao === 1 && vs[0].etapa === 'no_ar' && !!vs[0].publicado_em);
  const mt = ES.montar(BLOCOS, 'servico');
  check('o texto guardado é o que o estúdio monta', vs[0].assunto === mt.assunto && vs[0].corpo_texto === mt.corpo_texto && vs[0].corpo_html === mt.corpo_html);
  check('usa só {nome}, {email} e {link_pagamento}', ES.varsDoModelo('link_pagamento', m).join() === 'nome,email,link_pagamento'
    && [...(vs[0].corpo_texto + vs[0].corpo_html + vs[0].assunto).matchAll(/\{[#^/]?(\w+)\}/g)].every((x) => ['nome', 'link_pagamento', 'pre', 'assunto'].includes(x[1])));
  check('o botão aponta para {link_pagamento}', vs[0].corpo_html.includes('href="{link_pagamento}"'));
  check('sem rodapé de descadastro (não é marketing)', !/palavra\s+sair/i.test(vs[0].corpo_texto));
  check('o texto fala de escolher o plano (a página de planos) e o botão diz isso', /escolher o plano que combina com você/.test(vs[0].corpo_texto) && /Escolher o meu plano/.test(vs[0].corpo_html));

  console.log('\n== Quem já tinha a versão anterior do modelo ganha a versão 2 ==');
  await db.exec("delete from modelos_email_versoes where chave='link_pagamento'");
  await db.query(`insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, corpo_html, nota, publicado_em)
    values ('link_pagamento', 1, 'no_ar', 'antigo', 'Oi! Aqui está o link para você concluir o pagamento do plano que combinamos.', '<p>antigo</p>', 'link de pagamento: versão inicial', now())`);
  check('roda sobre a versão antiga sem erro', (await attempt(() => db.exec(arqEmail))).ok);
  const up = await q("select versao, etapa, corpo_texto from modelos_email_versoes where chave='link_pagamento' order by versao");
  check('a versão 1 antiga fica arquivada e a 2 entra No ar com o texto novo', up.length === 2 && up[0].etapa === 'arquivado' && up[1].versao === 2 && up[1].etapa === 'no_ar' && up[1].corpo_texto === mt.corpo_texto);
  check('rodar de novo não cria versão 3', (await attempt(() => db.exec(arqEmail))).ok && (await q("select count(*)::int n from modelos_email_versoes where chave='link_pagamento'"))[0].n === 2);
  await db.exec("delete from modelos_email_versoes where chave='link_pagamento'");
  await db.query(`insert into modelos_email_versoes (chave, versao, etapa, assunto, corpo_texto, corpo_html, nota, publicado_em)
    values ('link_pagamento', 1, 'no_ar', 'meu assunto', 'Texto que eu mesma editei.', '<p>meu</p>', 'editado no estúdio', now())`);
  await db.exec(arqEmail);
  const keep = await q("select versao, etapa, corpo_texto from modelos_email_versoes where chave='link_pagamento'");
  check('texto que a Ingryd já editou no Estúdio não é tocado', keep.length === 1 && keep[0].etapa === 'no_ar' && keep[0].corpo_texto === 'Texto que eu mesma editei.');

  console.log(`\n${passed} ok, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
