// O e-mail 1 do guia "Rota da Sécu", em blocos, pronto para revisão no Estúdio de e-mails.
// Um modelo serve às 20 combinações (porta.ponto): cada combinação é um bloco "só se #caso_<porta>_<ponto>", com o MESMO texto da página
// (guias/rota-da-secu/casos.js é a única fonte). Quem não tem porta e ponto válidos cai no bloco "só se #caso_geral".
// Gera crm-modelos-rota-da-secu.sql (rode: node admin/crm/db/modelo-rota-da-secu.mjs). O SQL só cria o modelo e a versão 1
// em RASCUNHO, com o Envio DESLIGADO: quem revisa, testa, publica (No ar) e liga é a Ingryd, pelo estúdio.
// Os textos são NOVOS. Do Mapa da saúde (modelo-mapa-saude.mjs) vem só a mecânica de gerar o SQL.
// O e-mail 2 (retomada pela dor de cada resposta) fica para depois: ainda não foi desenhado.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';
import { PORTAS, PONTOS, OFICIAL, caso, rotuloFrances } from '../../../guias/rota-da-secu/casos.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '18/11/2026';
export const SLUG = 'rota-da-secu';
export const ORIGEM = 'guia-' + SLUG; // a origem que a página grava no cadastro (identificacaoCrm do Estúdio)
export const CHAVE_1 = 'saude_rota_1';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const PROTECAO = { tipo: 'texto', texto: 'Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica.' };
const AJUDA = 'É só responder este e-mail. Eu leio cada resposta.';

const PERGUNTA = {
  estudante: 'Para eu entender melhor: você já se inscreveu no site do estudante e quando chega (ou chegou) à França?',
  trabalho: 'Para eu entender melhor: desde quando você tem contrato e quando chegou à França?',
  aupair: 'Para eu entender melhor: qual é o seu visto, a família já declarou você à Urssaf e quando você chegou?',
  outro: 'Para eu entender melhor: qual é o seu visto hoje, você exerce atividade profissional e quando chegou?'
};

// Os blocos de um caso: o primeiro passo numa faixa verde (o que fazer já) e um bloco "passo" numerado por passo,
// com a frase em francês de apoio num cartão dentro do passo (se houver).
function blocosDoCaso(porta, ponto) {
  const c = caso(porta, ponto), se = '#caso_' + porta + '_' + ponto;
  return [
    { tipo: 'destaque', se, estilo: 'verde', rotulo: c.tipo, valor: c.primeiro, nota: '' },
    ...c.passos.map((p, i) => ({ tipo: 'passo', se, n: String(i + 1), titulo: p.t, texto: p.x, ...(p.fr ? { fr_rotulo: rotuloFrances(), fr: p.fr } : {}) }))
  ];
}

// E-mail 1: o roteiro do caso dela e a oferta do serviço, sem preço. O assunto por porta vem do Worker (assunto_rota), com assunto reserva.
export const D1 = {
  assunto: '{assunto_rota}',
  assunto_alt: 'Seu roteiro da Sécu, na ordem',
  pre: 'O link oficial primeiro e, depois, o roteiro do seu caso.',
  rodape: 'pediu o roteiro da Sécu no Por Dentro com {email}',
  itens: [
    { tipo: 'titulo', texto: 'O seu roteiro da Sécu está aqui.' },
    { tipo: 'texto', texto: 'Oi, {nome},', alt: 'Oi,' },
    { tipo: 'texto', estilo: 'caixa', texto: '**Lembrete:** o formulário oficial (Cerfa S1106) e a sua CPAM estão no site do governo: ' + OFICIAL + '\n**Estudante?** O seu pedido é em etudiant-etranger.ameli.fr.' },
    ...PORTAS.flatMap((p) => PONTOS.flatMap((o) => blocosDoCaso(p.id, o.id))),
    { tipo: 'texto', se: '#caso_geral', texto: 'Para ver o roteiro do seu caso, abra a página e responda as duas perguntas: a sua situação e em que ponto você está.' },
    { tipo: 'botao', rotulo: 'Voltar à página', link: 'link_pagina' },
    { tipo: 'texto', texto: '**Prefere ter alguém com você?** Eu acompanho o seu caso, de três jeitos:' },
    { tipo: 'texto', texto: '**Ligue sem medo.** Eu preparo você antes da ligação e entro na linha com você.' },
    { tipo: 'texto', texto: '**Escreva sem erro.** Eu redijo o e-mail em francês com você e confiro antes de você enviar.' },
    { tipo: 'texto', texto: '**Resolva de ponta a ponta.** Durante 30 dias, até 3 ligações preparadas e e-mails acompanhados.' },
    { tipo: 'texto', texto: 'Quem fala com a CPAM é você, e o que sai é da sua conta. Eu não falo pelo órgão, não discuto direitos e não redijo recurso.' },
    ...Object.keys(PERGUNTA).map((p) => ({ tipo: 'pergunta', se: '#porta_' + p, texto: PERGUNTA[p], ajuda: AJUDA })),
    PROTECAO, ASS
  ]
};

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const jsonb = (o) => lit(JSON.stringify(o)) + '::jsonb';
const PARA = { materiais: [ORIGEM] };

function modelo({ chave, nome, objetivo, D, quem, gatilho, depois, dias, hora, minutos, ordem, nota }) {
  const o = ES.objetivo(objetivo), m = { chave, criado_no_estudio: true, tipo: o.tipo, para_quem: PARA };
  const d = JSON.parse(JSON.stringify(D)); d.v = 1; d.planos = d.planos || {};
  const mt = ES.montar(d, o.tipo);
  const vars = ES.varsDoModelo(chave, m).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
  const t = chave;
  return `insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values (${lit(chave)}, ${lit(nome)}, ${lit(o.nome + ': ' + o.d)}, ${lit(o.tipo)},
  'Sozinho, pela parte Envio (sequência).', ${lit(quem)},
  ${jsonb(vars)}, ${ordem}, true, ${lit(o.k)}, ${jsonb(PARA)},
  ${lit(gatilho)}, ${lit(depois)}, ${dias == null ? 'null' : dias}, ${hora == null ? 'null' : hora}, ${minutos == null ? 'null' : minutos}, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(chave)}, 1, 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  ${lit(nota + ' ' + HOJE + ': escrita para revisão')}
where exists (select 1 from public.modelos_email where chave = ${lit(chave)} and criado_no_estudio and objetivo_chave = ${lit(o.k)})
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(chave)});
`;
}

export function gerar() {
  return `-- Por Dentro — Estúdio de e-mails: o e-mail 1 do guia "Rota da Sécu" (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql e de crm-saude-porta-ponto.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-rota-da-secu.mjs, a partir de estudio.js (ES.montar) e de guias/rota-da-secu/casos.js (o texto dos 20 casos).
-- Para mudar um texto, mude lá e gere de novo. Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Só cria o modelo e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Saúde · Rota da Sécu (e-mail 1)   serviço, sai 5 minutos depois de se cadastrar na página (origem ${ORIGEM}).
--       Um modelo para as 20 combinações: o roteiro, o assunto e a pergunta mudam por porta e ponto. Abre com o lembrete do link oficial,
--       traz o botão de volta à página e oferece o acompanhamento, sem preço.
-- O e-mail 2 (retomada pela dor de cada resposta) ainda não existe: será outro arquivo.
-- Para ir ao ar: no Estúdio de e-mails, abra o modelo, confira a prévia por persona, mande o teste para o seu e-mail, publique (No ar) e ligue o Envio.
--
-- ANTES de ligar o Envio:
--   1. O Worker precisa estar publicado com crmVarsRota (cms-oauth-worker/worker.js). Sem ele o e-mail NÃO sai (falta o link_pagina): falha segura.
--   2. O e-mail de 5 minutos precisa do Cron Trigger "*/5 * * * *" (cms-oauth-worker/README.md, seção 23).
--   3. A página guias/rota-da-secu/ precisa estar no ar (o botão volta para ela).
--   4. As frases em francês precisam de revisão de quem fala francês (casos.js, FRANCES_REVISADO).
-- Não precisa de linha em guias_links: a página não entrega um link do Notion.
--
-- Segurança: só o texto e as regras de um modelo. Nenhuma tabela nem função nova. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave = '${CHAVE_1}' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave = '${CHAVE_1}' and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

-- Confere o pré-requisito antes de criar qualquer coisa.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'modelos_email' and column_name = 'envio_minutos') then
    raise exception 'Falta rodar antes o crm-sequencia-minutos.sql (e, antes dele, o crm-filtro-etapa.sql) neste banco. Depois rode este arquivo de novo.';
  end if;
  if to_regclass('public.modelos_email_versoes') is null then
    raise exception 'Falta rodar antes o crm-estudio-emails-3.sql neste banco. Depois rode este arquivo de novo.';
  end if;
end
$$;

${modelo({ chave: CHAVE_1, nome: 'Saúde · Rota da Sécu (e-mail 1)', objetivo: 'freebie', D: D1, quem: 'se cadastrou na Rota da Sécu', gatilho: 'material', depois: ORIGEM, dias: null, hora: null, minutos: 5, ordem: 562, nota: 'e-mail 1 da Rota da Sécu' })}`;
}

// Para quem já rodou o SQL de criação: troca o desenho da versão 1 enquanto ela ainda é RASCUNHO (nunca mexe no que foi publicado).
export function gerarVisual() {
  const o = ES.objetivo('freebie'), d = JSON.parse(JSON.stringify(D1)); d.v = 1; d.planos = d.planos || {};
  const mt = ES.montar(d, o.tipo), t = CHAVE_1 + '_v';
  return `-- Por Dentro — E-mail 1 da Rota da Sécu: passo a passo visual (${HOJE})
-- Rode no SQL Editor do Supabase (teste primeiro, depois produção). Idempotente.
-- GERADO por admin/crm/db/modelo-rota-da-secu.mjs. O primeiro passo vira uma faixa verde, cada passo ganha o seu número e a frase em francês
-- vira um cartão dentro do passo. O texto dito é o mesmo; só o desenho do HTML muda.
-- Só troca a versão 1 se ela ainda estiver em RASCUNHO. ATENÇÃO: se você editou esse rascunho no Estúdio, as edições dele são substituídas.
-- Depois de rodar, mande um teste novo (a troca zera o "testado") antes de publicar.
update public.modelos_email_versoes
   set assunto = ${dolar(t + '_a', mt.assunto)},
       preheader = ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
       corpo_texto = ${dolar(t + '_t', mt.corpo_texto)},
       corpo_html = ${dolar(t + '_h', mt.corpo_html)},
       blocos = ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
       testado_em = null, testado_por = null
 where chave = ${lit(CHAVE_1)} and versao = 1 and etapa = 'rascunho';
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelos-rota-da-secu.sql'), gerar());
  writeFileSync(path.join(HERE, 'crm-modelos-rota-da-secu-visual.sql'), gerarVisual());
}
