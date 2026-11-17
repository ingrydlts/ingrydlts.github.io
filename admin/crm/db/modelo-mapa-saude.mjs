// Os 2 e-mails do guia "Mapa da saúde na França" (jornada S2: Saúde 1), em blocos, prontos para revisão no Estúdio de e-mails.
// Um modelo por e-mail serve às 20 personas (porta.ponto): cada bloco entra só para quem tem o dado da condição ("só se…").
// Gera crm-modelos-mapa-saude.sql (rode: node admin/crm/db/modelo-mapa-saude.mjs). O SQL só cria os modelos e a versão 1
// em RASCUNHO, com o Envio DESLIGADO: quem revisa, testa, publica (No ar) e liga é você, pelo estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '17/11/2026';
export const SLUG = 'mapa-saude-franca';
export const ORIGEM = 'guia-' + SLUG; // a origem que a página grava no cadastro (identificacaoCrm do Estúdio)
export const CHAVE_1 = 'saude_mapa_1';
export const CHAVE_2 = 'saude_mapa_2';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const PROTECAO = { tipo: 'texto', texto: 'Organizo e confiro com base em fontes públicas. Não sou advogada e isto não é consulta jurídica.' };
const PORTAS = ['estudante', 'trabalho', 'aupair', 'outro'];
const CONFERIDA = '14/11/2026';
const AJUDA = 'É só responder este e-mail. Eu leio cada resposta.';

const ENTREGA = { estudante: 'Comece pela seção {secao} 😉', trabalho: 'Comece pela seção {secao} 😉', aupair: 'Comece pela seção {secao} 😉',
  outro: 'Comece pelo tronco, com as camadas do sistema e a ordem dos passos.' };
const PERGUNTA = {
  estudante: 'Para eu orientar melhor: você já se inscreveu no ameli e quando chega (ou chegou) à França?',
  trabalho: 'Para eu orientar melhor: desde quando você tem contrato e quando chegou à França?',
  aupair: 'Para eu orientar melhor: qual é o seu visto, a família já enviou a declaração à Urssaf e quando você chegou?',
  outro: 'Para eu orientar melhor: qual é o seu visto hoje, você exerce atividade profissional e quando chegou?' };
const GANCHO = {
  estudante: 'Passando para retomar o cadastro de estudante no ameli: a inscrição se faz em previsão da chegada. Posso ajudar a organizar os documentos.',
  trabalho: 'Passando para retomar uma pergunta sobre o seu contrato: desde quando ele vale? A resposta mostra por qual passo o seu caso começa.',
  aupair: 'Passando para retomar a declaração da família na Urssaf, por onde o número de sécu é pedido. Posso olhar o seu caso.',
  outro: 'Passando para retomar uma pergunta só: qual é o seu visto hoje?' };

// E-mail 1: a entrega do mapa e o convite ao 1:1. Não fala do app beta. O assunto vem do Worker (assunto_persona), com plano B para lead antigo.
export const D1 = {
  assunto: '{assunto_persona}',
  assunto_alt: 'O seu mapa da saúde na França, na ordem',
  pre: 'Comece pela seção da sua porta e siga a ordem dos cinco passos.',
  rodape: 'pediu o mapa da saúde na França no Por Dentro com {email}',
  itens: [
    { tipo: 'titulo', texto: 'O mapa da saúde está no botão abaixo.' },
    { tipo: 'texto', texto: 'Oi, {nome},', alt: 'Oi,' },
    ...PORTAS.map((p) => ({ tipo: 'texto', se: '#porta_' + p, texto: ENTREGA[p] })),
    { tipo: 'botao', rotulo: 'Abrir o mapa', link: 'link_checklist' },
    { tipo: 'astucia', se: '#astucia_a0007', codigo: 'A-0007', conferida_em: CONFERIDA,
      texto: 'O ameli indica se inscrever em etudiant-etranger.ameli.fr antes de chegar. A inscrição já gera um número provisório.', fonte: 'ameli, estudante estrangeiro (19/01/2026)' },
    { tipo: 'astucia', se: '#astucia_a0008', codigo: 'A-0008', conferida_em: CONFERIDA,
      texto: 'Pela Puma, quem exerce atividade profissional é afiliado de imediato. Sem atividade profissional, a espera é de 3 meses.', fonte: 'service-public F34308 (13/05/2026)' },
    { tipo: 'astucia', se: '#astucia_a0009', codigo: 'A-0009', conferida_em: CONFERIDA,
      texto: 'A família declara a contratação na Urssaf em até 8 dias, e o mesmo formulário pede o número de sécu. É a regra do salarié au pair, distinto do jeune au pair.', fonte: 'service-public F473 (06/06/2025)' },
    ...PORTAS.map((p) => ({ tipo: 'pergunta', se: '#porta_' + p, texto: PERGUNTA[p], ajuda: AJUDA })),
    { tipo: 'texto', texto: 'Prefere conversar? Responda este e-mail ou escolha um horário no botão abaixo.' },
    { tipo: 'botao', rotulo: 'Marcar uma conversa', link: 'link_agenda' },
    PROTECAO, ASS
  ]
};

// E-mail 2: a retomada, de duas frases. Quem ainda não tem a carte vitale volta pelo gancho da porta; quem já está adiante, pelo do ponto.
export const D2 = {
  assunto: '{assunto_retomada}',
  assunto_alt: 'Uma pergunta sobre o seu mapa da saúde',
  pre: 'Se fizer sentido, escolha um horário.',
  rodape: 'pediu o mapa da saúde na França no Por Dentro com {email}',
  itens: [
    { tipo: 'texto', texto: 'Oi, {nome},', alt: 'Oi,' },
    ...PORTAS.map((p) => ({ tipo: 'texto', se: '#retomada_' + p, texto: GANCHO[p] })),
    { tipo: 'texto', se: '#ponto_sem_vitale', texto: 'Passando para retomar o passo da carte vitale. Conto como ele funciona no Reel da semana 3.' },
    { tipo: 'texto', se: '#ponto_completo', texto: 'Passando para retomar o que vem depois da carte vitale: médecin traitant e reembolso. Conto cada um no Reel da semana 4.' },
    { tipo: 'texto', texto: 'Se fizer sentido, escolha um horário abaixo.' },
    { tipo: 'botao', rotulo: 'Marcar uma conversa', link: 'link_agenda' },
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
  return `-- Por Dentro — Estúdio de e-mails: os 2 e-mails do guia "Mapa da saúde na França" (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-mapa-saude.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
-- Rode primeiro no Supabase de TESTE e só depois no de produção.
--
-- Só cria os modelos e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Saúde · mapa (e-mail 1)      serviço, sai 5 minutos depois de pegar o guia (origem ${ORIGEM}).
--       Um modelo para as 20 personas: seção, astúcia, pergunta e assunto mudam por porta e ponto. NÃO fala do app beta.
--   Saúde · retomada (e-mail 2)  novidades (só quem aceitou), sai 3 dias depois do e-mail 1, às 10h.
--       Duas frases e o botão da conversa. Proposta de prazo: ajuste no estúdio se decidir outro.
-- Para ir ao ar: no Estúdio de e-mails, abra cada modelo, confira a prévia por persona, mande o teste, publique (No ar) e ligue o Envio.
--
-- ANTES de publicar o e-mail 1:
--   1. Publique o mapa no Notion (notion.site) e rode crm-guia-mapa-saude-link.sql com o endereço dele (é o botão "Abrir o mapa").
--   2. O formulário precisa gravar porta e ponto em contatos.respostas (hoje capturar_lead_guia só grava o cfNivel). Sem isso o Worker
--      trata todo lead como "outro" e o assunto cai no plano B. Esse SQL é um passo à parte (testes de isolamento, teste antes de produção).
--   3. O Worker precisa estar publicado com crmVarsSaude (cms-oauth-worker/worker.js).
--   4. O e-mail de 5 minutos precisa do Cron Trigger "*/5 * * * *" (cms-oauth-worker/README.md, seção 23).
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave in ('${CHAVE_1}', '${CHAVE_2}') and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave in ('${CHAVE_1}', '${CHAVE_2}') and m.criado_no_estudio and not m.envio_ligado
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

${modelo({ chave: CHAVE_1, nome: 'Saúde · mapa (e-mail 1)', objetivo: 'freebie', D: D1, quem: 'pegou o mapa da saúde na França', gatilho: 'material', depois: ORIGEM, dias: null, hora: null, minutos: 5, ordem: 560, nota: 'e-mail 1 do mapa da saúde' })}
${modelo({ chave: CHAVE_2, nome: 'Saúde · retomada (e-mail 2)', objetivo: 'conversa', D: D2, quem: 'pegou o mapa da saúde na França e aceitou novidades', gatilho: 'email', depois: CHAVE_1, dias: 3, hora: 10, minutos: null, ordem: 561, nota: 'e-mail 2 do mapa da saúde' })}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelos-mapa-saude.sql'), gerar());
}
