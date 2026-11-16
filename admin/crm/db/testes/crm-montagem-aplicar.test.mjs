// Testa crm-montagem-aplicar.sql (aplicar a proposta de montagem como RASCUNHOS, com IDs estáveis e diff) num Postgres efêmero (PGlite).
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db npm run test:montagem-aplicar
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
  for (const f of ['crm-fase2.sql', 'crm-propostas.sql', 'crm-chat.sql', 'crm-caso.sql', 'crm-caso-importar.sql', 'crm-caso-guias.sql', 'crm-caso-documentos.sql', 'crm-caso-checklists.sql', 'crm-caso-criterios.sql', 'crm-caso-catalogo.sql', 'crm-caso-listas.sql', 'crm-montagem.sql']) await db.exec(readFileSync(path.resolve(HERE, '..', f), 'utf8'));
  const sql = readFileSync(path.resolve(HERE, '../crm-montagem-aplicar.sql'), 'utf8');
  const r1 = await attempt(() => db.exec(sql)); check('roda a 1ª vez', r1.ok); if (!r1.ok) { console.log(r1.error.message); process.exit(1); }
  check('roda a 2ª vez (idempotente)', (await attempt(() => db.exec(sql))).ok);

  const [admin] = await q("insert into auth.users (email) values ('admin@example.com') returning id");
  await db.query('insert into admins (user_id) values ($1)', [admin.id]);
  const nova = async (email) => { const [u] = await q("insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id", [email]);
    await db.query("insert into contatos (email, user_id, estagio) values ($1, $2, 'em_uso') on conflict (email) do update set user_id = excluded.user_id", [email, u.id]);
    return { u, c: (await um('select id from contatos where email=$1', [email])).id }; };
  const ana = await nova('ana@example.com'), bia = await nova('bia@example.com');
  await db.query("insert into consentimentos (contato_id, finalidade, aceito) values ($1, 'servico', true)", [ana.c]);
  const adm = (sqlTxt, p) => asUser(admin.id, () => db.query(sqlTxt, p));
  const o = { momento: '20:05', trecho: 'tu peux les appeler' };
  const PROP = () => ({
    bilan: { resumo: 'x', afirmacoes: [] },
    encaminhamentos: [
      { chave: 'ligar_escola', texto: 'Ligar para a escola', camada: 'particular', dono: 'ela', prazo: '2026-11-30', prazo_texto: '', origem: o, certeza: 'literal', cobre: [] },
      { chave: 'mandar_guia', texto: 'Enviar o guia de escolas', camada: 'entrega_equipe', dono: 'ingryd', prazo: null, prazo_texto: '', origem: o, certeza: 'literal', cobre: [0] }],
    checklists: [{ chave: 'dossie_empresa', titulo: 'Dossiê para empresas', origem: 'particular', itens: [
      { chave: 'cv_fr', titulo: 'Montar o CV em francês', prazo: null, fonte: null, nivel: null, a_conferir: true },
      { chave: 'carta', titulo: 'Escrever a carta de motivação', prazo: null, fonte: { rotulo: 'Guia', url: 'https://exemplo.org/guia' }, nivel: 'institucional', a_conferir: false }] }],
    documentos: [{ chave: 'diploma', rotulo: 'Diploma do ensino médio', selos: ['traducao'], checklists: ['dossie_empresa'], direcao: 'ela_envia', cobre: [] }],
    perguntas_equipe: [{ chave: 'fim_pvt', texto: 'Quando termina o seu PVT?', resposta_tipo: 'data', grava_em: 'respostas.fim_pvt' }],
    blocos: [{ tipo: 'empresa', titulo: 'Empresas para contactar', itens: [{ chave: 'acme', nome: 'Acme SAS', link: 'https://acme.example/estagio', canal: 'e-mail', nota: 'Pedir atestado' }] }],
    compromissos: [{ texto: 'Enviar o guia', momento: '45:10', trecho: 'je t\'envoie' }, { texto: 'Mandar o link da gravação', momento: '50:00', trecho: 'je te mande' }],
    omissoes: [{ chave: 'compromisso_2', texto: 'Conferir se foi entregue: Mandar o link da gravação', camada: 'entrega_equipe', dono: 'ingryd', origem: { momento: '50:00', trecho: 'je te mande' }, certeza: 'confirmar' }]
  });
  let hashN = 0;
  const montagem = async (p, prop) => (await um('insert into montagens (contato_id, hash_entrada, proposta, persona) values ($1,$2,$3,$4) returning id, versao', [p.c, String(++hashN).repeat(64).slice(0, 64), JSON.stringify(prop), 'pvt']));
  const aprovarTudo = (prop, extra = []) => [...prop.encaminhamentos.map((x) => 'enc:' + x.chave), ...prop.omissoes.map((x) => 'enc:' + x.chave), ...prop.checklists.map((c) => 'lista:' + c.chave),
    ...prop.checklists.flatMap((c) => c.itens.map((i) => 'chk:' + c.chave + ':' + i.chave)), ...prop.documentos.map((d) => 'doc:' + d.chave), ...prop.perguntas_equipe.map((p) => 'perg:' + p.chave),
    ...prop.blocos.flatMap((b) => b.itens.map((i) => 'bloco:' + b.tipo + ':' + i.chave)), ...extra].map((k) => ({ origem_chave: k, decisao: 'aprovar' }));
  const aplicar = (p, m, dec) => asUser(admin.id, () => um('select crm_montagem_aplicar($1, $2, $3::jsonb) r', [p.c, m.id, JSON.stringify(dec)])).then((x) => x.r);
  const meu = async (p) => (await asUser(p.u.id, () => um('select meu_caso() r'))).r;

  console.log('== Aplicar: tudo nasce como rascunho ==');
  const p1 = PROP(), m1 = await montagem(ana, p1);
  const r = await aplicar(ana, m1, aprovarTudo(p1));
  check('devolve as contagens (9 itens criados, nada mantido nem em conflito)', r.criados === 9 && r.mantidos === 0 && r.conflitos.length === 0 && r.atualizados === 0);
  const ac = async (k) => um('select *, prazo::text as prazo_txt from caso_acoes where contato_id=$1 and origem_chave=$2', [ana.c, k]);
  const a1 = await ac('enc:ligar_escola'), a2 = await ac('enc:mandar_guia'), a3 = await ac('enc:compromisso_2');
  check('encaminhamento "ela" vira passo dela no Checklist (rascunho, com a camada e o prazo)', a1.dono === 'ela' && a1.canal === 'plataforma' && a1.passo_chave === 'mont_ligar_escola' && a1.camada === 'particular' && a1.prazo_txt === '2026-11-30' && a1.publicada_em === null && a1.estado === 'aberta');
  check('encaminhamento da equipe e a omissão viram pendência só da equipe', a2.dono === 'ingryd' && a2.canal === 'so_eu' && a2.camada === 'entrega_equipe' && a3.dono === 'ingryd' && a3.camada === 'entrega_equipe');
  const lst = await um("select * from caso_listas where contato_id=$1 and chave='dossie_empresa'", [ana.c]);
  check('checklist vira lista proposta, com os itens ligados a ela e a camada "particular"', lst.estado === 'proposto' && lst.origem === 'particular' && (await q("select * from caso_acoes where contato_id=$1 and lista_chave='dossie_empresa' and camada='particular'", [ana.c])).length === 2);
  check('item sem fonte nasce a_conferir; com fonte, não', (await ac('chk:dossie_empresa:cv_fr')).a_conferir === true && (await ac('chk:dossie_empresa:carta')).a_conferir === false);
  const doc = await um("select * from board_itens where contato_id=$1 and origem_chave='doc:diploma'", [ana.c]);
  check('documento vira item do espaço (proposto) com selos e checklists', doc.tipo === 'documento' && doc.estado === 'proposto' && doc.dados.selos[0] === 'traducao' && doc.dados.checklists[0] === 'dossie_empresa' && doc.titulo === 'Diploma do ensino médio');
  const ct = await um("select * from board_itens where contato_id=$1 and origem_chave='bloco:empresa:acme'", [ana.c]);
  check('contato do bloco vira item "contato" do tipo de bloco certo', ct.tipo === 'contato' && ct.dados.bloco_tipo === 'empresa' && ct.dados.nome === 'Acme SAS' && ct.estado === 'proposto');
  const pg = await um("select * from caso_avisos where contato_id=$1 and origem_chave='perg:fim_pvt'", [ana.c]);
  check('pergunta da equipe vira aviso em rascunho com o destino permitido', pg.tipo === 'pergunta' && pg.estado === 'rascunho' && pg.grava_em === 'respostas.fim_pvt' && pg.resposta_tipo === 'data');
  const mc = await meu(ana);
  check('NADA chega à pessoa: o espaço dela continua vazio', mc.board.length === 0 && mc.acoes.length === 0 && mc.listas.length === 0 && mc.avisos.length === 0);
  check('a montagem vira aprovada_parcial e o evento fica na linha do tempo', (await um('select estado from montagens where id=$1', [m1.id])).estado === 'aprovada_parcial' && (await um("select count(*)::int n from eventos where contato_id=$1 and tipo='montagem_aplicada'", [ana.c])).n === 1);

  console.log('\n== Idempotência e o que a equipe já decidiu ==');
  const r2 = await aplicar(ana, m1, aprovarTudo(p1));
  check('aplicar de novo não duplica nada', r2.criados === 0 && r2.mantidos === 9 && (await um('select count(*)::int n from caso_acoes where contato_id=$1', [ana.c])).n === 5);
  const idCv = (await ac('chk:dossie_empresa:cv_fr')).id, idCarta = (await ac('chk:dossie_empresa:carta')).id;
  check('item a_conferir não pode ser publicado para ela; o que tem fonte pode', await falha(() => db.query('update caso_acoes set publicada_em = now() where id = $1', [idCv]), 'a_conferir') && (await attempt(() => db.query('update caso_acoes set publicada_em = now() where id = $1', [idCarta]))).ok);
  await db.query("update board_itens set estado = 'revisado' where id = $1", [doc.id]);                          // a equipe já revisou o documento
  await db.query("update caso_acoes set publicada_em = now() where id = $1", [a1.id]);                            // e publicou o passo
  await asUser(ana.u.id, () => db.query('select marcar_acao($1, true)', [a1.id]));                                // e ela já concluiu
  const p2 = PROP(); p2.documentos[0].rotulo = 'Diploma e histórico'; p2.encaminhamentos[0].texto = 'Ligar para a escola amanhã'; p2.encaminhamentos[1].texto = 'Enviar o guia de escolas (PDF)';
  const m2 = await montagem(ana, p2);
  const r3 = await aplicar(ana, m2, aprovarTudo(p2));
  check('o que a equipe revisou ou ela concluiu NÃO é alterado: vai para conflitos', r3.conflitos.includes('doc:diploma') && r3.conflitos.includes('enc:ligar_escola'));
  check('o título do documento revisado e o passo concluído continuam como estavam', (await um('select titulo from board_itens where id=$1', [doc.id])).titulo === 'Diploma do ensino médio' && (await ac('enc:ligar_escola')).estado === 'concluida' && (await ac('enc:ligar_escola')).titulo === 'Ligar para a escola');
  check('o que ainda é rascunho puro é atualizado pela versão nova', (await ac('enc:mandar_guia')).titulo === 'Enviar o guia de escolas (PDF)' && r3.atualizados >= 1);

  console.log('\n== Rejeitar, motivo e tudo-ou-nada ==');
  const p3 = PROP(); p3.blocos[0].itens.push({ chave: 'beta', nome: 'Beta SA', link: null, canal: '', nota: '' });
  const m3 = await montagem(ana, p3);
  await aplicar(ana, m3, [{ origem_chave: 'bloco:empresa:beta', decisao: 'rejeitar', motivo: 'excecao' }]);
  check('rejeitar não cria o item e registra o motivo', (await q("select 1 from board_itens where contato_id=$1 and origem_chave='bloco:empresa:beta'", [ana.c])).length === 0 && (await um("select dados->>'motivo' m from eventos where contato_id=$1 and tipo='montagem_item_rejeitado'", [ana.c])).m === 'excecao');
  check('motivo fora da lista e chave que não está na proposta são recusados', await falha(() => aplicar(ana, m3, [{ origem_chave: 'bloco:empresa:beta', decisao: 'rejeitar', motivo: 'porque_sim' }]), 'motivo_invalido') && await falha(() => aplicar(ana, m3, [{ origem_chave: 'enc:nao_existe', decisao: 'aprovar' }]), 'item_desconhecido'));
  const p4 = PROP(); p4.blocos[0].itens.push({ chave: 'gama', nome: 'Gama SA', link: null, canal: '', nota: '' }); p4.perguntas_equipe[0] = { chave: 'ruim', texto: 'Pergunta com destino fora da tabela', resposta_tipo: 'data', grava_em: 'respostas.qualquer' };
  const m4 = await montagem(ana, p4);
  check('um item inválido desfaz a aplicação inteira (tudo ou nada)', await falha(() => aplicar(ana, m4, [{ origem_chave: 'bloco:empresa:gama', decisao: 'aprovar' }, { origem_chave: 'perg:ruim', decisao: 'aprovar' }])) && (await q("select 1 from board_itens where contato_id=$1 and origem_chave='bloco:empresa:gama'", [ana.c])).length === 0);

  console.log('\n== Diff: mudança de percurso ==');
  const p5 = PROP(); p5.blocos = [{ tipo: 'escola', titulo: 'Escolas para contactar', itens: [{ chave: 'alliance', nome: 'Alliance Française', link: null, canal: '', nota: '' }] }];
  const m5 = await montagem(ana, p5);
  const d = (await asUser(admin.id, () => um('select crm_montagem_diff($1, $2) r', [ana.c, m5.id]))).r;
  check('novos: o bloco de escola que entra; retirar sugerido: o de empresa que sai (nada é apagado)', d.novos.includes('bloco:escola:alliance') && d.retirar_sugerido.includes('bloco:empresa:acme') && (await q("select 1 from board_itens where origem_chave='bloco:empresa:acme'")).length === 1);
  check('conflitos: o que a equipe já decidiu; mantidos: o que ainda é rascunho e não mudou', d.conflitos.includes('doc:diploma') && d.mantidos.includes('perg:fim_pvt'));
  await aplicar(ana, m5, [{ origem_chave: 'bloco:escola:alliance', decisao: 'aprovar' }]);
  check('trocar de percurso: o bloco de escolas entra UMA vez e o de empresas continua existindo até a equipe retirar', (await q("select 1 from board_itens where contato_id=$1 and origem_chave like 'bloco:escola:%'", [ana.c])).length === 1 && (await q("select 1 from board_itens where contato_id=$1 and origem_chave like 'bloco:empresa:%'", [ana.c])).length === 1);
  await aplicar(ana, m5, [{ origem_chave: 'bloco:escola:alliance', decisao: 'aprovar' }]);
  check('aplicar a troca de novo não duplica a escola', (await q("select 1 from board_itens where contato_id=$1 and origem_chave='bloco:escola:alliance'", [ana.c])).length === 1);

  console.log('\n== Acesso ==');
  check('quem não é admin não aplica nem vê o diff; a montagem de outra pessoa não vale', await falha(() => asUser(ana.u.id, () => db.query('select crm_montagem_aplicar($1,$2,$3::jsonb)', [ana.c, m5.id, '[]'])), 'sem_permissao') && await falha(() => asUser(ana.u.id, () => db.query('select crm_montagem_diff($1,$2)', [ana.c, m5.id])), 'sem_permissao') && await falha(() => aplicar(bia, m5, []), 'montagem_nao_encontrada'));
  check('anônimo não executa nenhuma das duas', !(await attempt(() => asAnon(() => db.query('select crm_montagem_diff($1,$2)', [ana.c, m5.id])))).ok && !(await attempt(() => asAnon(() => db.query('select crm_montagem_aplicar($1,$2,$3::jsonb)', [ana.c, m5.id, '[]'])))).ok);
  for (const f of ['crm_montagem_aplicar', 'crm_montagem_diff']) {
    const x = await um("select p.prosecdef, has_function_privilege('anon', p.oid, 'execute') as anon_exec, array_to_string(p.proconfig, ',') as cfg from pg_proc p where p.proname = $1", [f]);
    check(`${f}: security definer, search_path fixo, anon não executa`, x.prosecdef && /search_path=/.test(x.cfg) && !x.anon_exec);
  }

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
