// Os e-mails do guia do tecnólogo, um para cada uma das 4 opções que a pessoa marca no formulário, em blocos, prontos para
// revisão no Estúdio de e-mails. Gera crm-modelos-tecnologo-etapas.sql (rode: node admin/crm/db/modelos-tecnologo.mjs).
// O SQL só cria RASCUNHOS com o Envio DESLIGADO: quem revisa, testa, publica (No ar) e liga é você, pelo estúdio.
//   1. tec_recap_30min ganha uma versão nova em rascunho: o mesmo recap, com um parágrafo só para a etapa que a pessoa marcou.
//   2. tec_d3_nao_sei, tec_d3_juntando, tec_d3_escrevi e tec_d3_resposta: 3 dias depois do recap, um e-mail por etapa, com
//      assunto, abertura, o passo e a pergunta daquele momento (novidades: só para quem aceitou).
// O assunto, a prévia, o texto puro e o HTML saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';
import { D as RECAP_V1, CHAVE as RECAP, NOTION } from './modelo-tecnologo-recap.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '04/11/2026';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const DUVIDA = { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' };
const ORIGEM = 'guia-tecnologo';
const RODAPE = 'pediu o guia do tecnólogo no Por Dentro com {email}';
const oi = (resto, alt) => ({ tipo: 'texto', texto: 'Oi {nome}! ' + resto, alt: 'Oi! ' + (alt || resto) });
const responda = (pergunta, ajuda) => ({ tipo: 'pergunta', texto: pergunta, ajuda: ajuda || 'É só responder este e-mail. Eu leio cada resposta.' });
const NAO_E_REGRA = 'Pelos casos que eu acompanhei, tecnólogo de 2 anos costuma ser aceito no L3 e de 3 anos no M1. Isso **não é regra**: cada escola decide.';

// Quem tem tecnólogo e se candidata do Brasil também passa pelo Campus France: o e-mail de cada etapa diz isso, antes da pergunta final.
const CAMPUS = { tipo: 'texto', texto: 'E lembre: se você vai se candidatar do Brasil, o seu dossiê também passa pelo **Campus France**. Por isso a resposta da escola, **por escrito**, vale ouro: ela entra no dossiê e sustenta o nível que você pede. Confirme os prazos e as taxas no site do Campus France Brasil.' };

// A frase do recap para cada etapa (o que ela marcou, e o próximo passo do checklist).
export const ETAPAS = {
  'tec-nao-sei': { chave: 'tec_d3_nao_sei', nome: 'Tecnólogo · D+3 · ainda não sei o nível', var: 'etapa_nao_sei',
    recap: 'Você marcou que ainda não sabe em que nível entraria. É normal: nem a França tem uma tabela para isso. Comece pelo passo 1 do checklist: juntar histórico, diploma e a carga horária total do curso.',
    d3: { assunto: '{nome}, o número que a escola vai pedir primeiro', assunto_alt: 'O número que a escola vai pedir primeiro', pre: 'Você já tem esse número.', itens: [
      { tipo: 'titulo', texto: 'O que decide o seu nível começa por um número' },
      oi('Você me disse que ainda não sabe em que nível entraria. Quase sempre a primeira pergunta da escola é a mesma: quantas horas tem o seu curso, e quantos anos?'),
      { tipo: 'destaque', rotulo: 'O número que ajuda', valor: 'Carga horária total do curso', nota: 'Está no histórico ou no projeto pedagógico. Com ela e a duração (2 ou 3 anos), a escola decide entre L3 e M1.' },
      { tipo: 'texto', texto: NAO_E_REGRA },
      responda('Seu tecnólogo tem 2 ou 3 anos?', 'Responda só com o número. Eu leio cada resposta e ela me ajuda a escrever os próximos e-mails.'), ASS] } },
  'tec-juntando': { chave: 'tec_d3_juntando', nome: 'Tecnólogo · D+3 · juntando documentos', var: 'etapa_juntando',
    recap: 'Você marcou que está juntando histórico, diploma e carga horária. Então vá direto ao passo 2 do checklist: comparar a carga horária do seu curso com a de cada ano da licence.',
    d3: { assunto: '{nome}, a tabela que falta no seu dossiê', assunto_alt: 'A tabela que falta no seu dossiê', pre: 'Uma tabela simples muda a conversa com a escola.', itens: [
      { tipo: 'titulo', texto: 'Compare por ano, não pelo diploma inteiro' },
      oi('Você me disse que está juntando histórico, diploma e carga horária. Falta o passo que quase todo mundo pula: colocar os seus semestres ao lado dos anos da licence.'),
      { tipo: 'destaque', rotulo: 'O passo 2 do checklist', valor: 'L1, L2 e L3 ao lado dos seus semestres', nota: 'A IA da sua preferência ajuda a montar a tabela. Mande ela junto com o e-mail para a escola.' },
      { tipo: 'texto', texto: NAO_E_REGRA },
      responda('Qual documento está demorando mais para chegar?', 'Responda com uma palavra: **histórico**, **diploma**, **ementas** ou **tradução**.'), ASS] } },
  'tec-escrevi': { chave: 'tec_d3_escrevi', nome: 'Tecnólogo · D+3 · já escrevi e espero', var: 'etapa_escrevi',
    recap: 'Você marcou que já escreveu para escolas e está esperando. Enquanto elas respondem, guarde tudo por escrito e releia o passo 4: só pague taxa ou tradução depois de ter resposta.',
    d3: { assunto: '{nome}, enquanto a escola não responde', assunto_alt: 'Enquanto a escola não responde', pre: 'O que dá para adiantar sem gastar nada.', itens: [
      { tipo: 'titulo', texto: 'Esperar não precisa ser ficar parada' },
      oi('Você me disse que já escreveu para escolas e está esperando a resposta. Em vez de esperar de braços cruzados, vale adiantar a segunda rodada.'),
      { tipo: 'destaque', rotulo: 'Enquanto espera', valor: 'Escreva para mais 1 ou 2 cursos', nota: 'Quanto mais respostas por escrito, mais fácil comparar. Taxa e tradução juramentada só depois da resposta.' },
      { tipo: 'texto', texto: 'E já deixe anotado: ser aceita em L3 não quer dizer que dá para assinar contrato de alternância na hora. Pela leitura mais segura da ficha F2713 do Service-Public, é preciso mais de 1 ano na França, com exceção para inscrição direta em Master.' },
      responda('Alguma escola já respondeu?', 'Me conta o que disseram, sem dados pessoais. Eu leio cada resposta.'), ASS] } },
  'tec-resposta': { chave: 'tec_d3_resposta', nome: 'Tecnólogo · D+3 · já tenho resposta', var: 'etapa_resposta',
    recap: 'Você marcou que já tem resposta de uma escola. O que importa agora é comparar com a resposta de outras 2 ou 3 escolas e confirmar por escrito quando o contrato pode ser assinado (passo 5).',
    d3: { assunto: '{nome}, o que fazer com a resposta da escola', assunto_alt: 'O que fazer com a resposta da escola', pre: 'Duas coisas antes de decidir ou pagar qualquer taxa.', itens: [
      { tipo: 'titulo', texto: 'A resposta chegou. E agora?' },
      oi('Você me disse que já tem resposta de uma escola. Antes de decidir ou pagar qualquer taxa, duas coisas.'),
      { tipo: 'destaque', rotulo: 'Antes de pagar a taxa', valor: 'Resposta por escrito, de 2 ou 3 escolas', nota: 'Comparar o nível que cada uma aceita evita pagar por um caminho que outra escola faria melhor.' },
      { tipo: 'texto', texto: 'E confirme quando o contrato de alternância pode ser assinado. Pela leitura mais segura da ficha F2713 do Service-Public, é preciso mais de 1 ano na França, com exceção para inscrição direta em Master (no apprentissage). Confirme com a escola e a préfecture, por escrito.' },
      responda('O que a escola respondeu?', 'Me conta a resposta, sem dados pessoais, e eu te digo o que olharia primeiro. Eu leio cada resposta.'), ASS] } }
};

// O recap v2: igual à v1, com o parágrafo da etapa logo depois da abertura (só um aparece para cada pessoa).
for (const e of Object.values(ETAPAS)) { const i = e.d3.itens.findIndex((b) => b.tipo === 'pergunta'); e.d3.itens.splice(i, 0, CAMPUS); }

export function recapV2() {
  const d = JSON.parse(JSON.stringify(RECAP_V1));
  const i = d.itens.findIndex((b) => b.tipo === 'botao');
  const etapas = Object.values(ETAPAS).map((e) => ({ tipo: 'etapa', se: '#' + e.var, texto: e.recap }));
  d.itens.splice(i, 0, ...etapas);
  return d;
}

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const jsonb = (o) => lit(JSON.stringify(o)) + '::jsonb';
const completo = (d) => { d = JSON.parse(JSON.stringify(d)); d.v = 1; d.planos = d.planos || {}; return d; };
function variaveis(chave, para, tipo) {
  const m = { chave, criado_no_estudio: true, tipo, para_quem: para };
  return ES.varsDoModelo(chave, m).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
}

export function gerar() {
  const o = ES.objetivo('freebie'), out = [];
  out.push(`-- Por Dentro — Estúdio de e-mails: os e-mails do guia do tecnólogo, um para cada etapa (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-sequencia-minutos.sql e crm-modelo-tecnologo-recap.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelos-tecnologo.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria rascunhos, com o Envio DESLIGADO. Não publica nada e não muda nenhuma versão No ar:
--   1. ${RECAP}: uma versão nova em rascunho, com um parágrafo só para a etapa que a pessoa marcou (4 opções).
--   2. Quatro e-mails de 3 dias depois do recap, um por etapa (novidades: só quem aceitou), cada um com a regra "Etapa do guia":
${Object.entries(ETAPAS).map(([k, e]) => `--        ${e.chave}  (${k})`).join('\n')}
-- Para ir ao ar: no estúdio, abra cada modelo, confira a prévia, mande o teste, publique e ligue o Envio.
-- Quem não marcou nenhuma etapa não recebe os e-mails de 3 dias (regra do filtro por etapa).
--
-- Segurança: só textos e regras de modelos. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho; o que você publicou fica):
--   delete from public.modelos_email_versoes where nota like 'tecnólogo por etapa ${HOJE}%' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave in (${Object.values(ETAPAS).map((e) => lit(e.chave)).join(', ')})
--      and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);
`);

  // 1. recap v2
  const d2 = completo(recapV2()), mt2 = ES.montar(d2, o.tipo), t0 = RECAP + '_v2';
  out.push(`-- ---------- 1. ${RECAP}: versão nova em rascunho, com o parágrafo da etapa ----------
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(RECAP)}, (select coalesce(max(versao), 0) + 1 from public.modelos_email_versoes where chave = ${lit(RECAP)}), 'rascunho',
  ${dolar(t0 + '_a', mt2.assunto)},
  ${mt2.preheader == null ? 'null' : dolar(t0 + '_p', mt2.preheader)},
  ${dolar(t0 + '_t', mt2.corpo_texto)},
  ${dolar(t0 + '_h', mt2.corpo_html)},
  ${dolar(t0 + '_b', JSON.stringify(d2))}::jsonb,
  'tecnólogo por etapa ${HOJE}: recap com o parágrafo da etapa'
where exists (select 1 from public.modelos_email where chave = ${lit(RECAP)} and criado_no_estudio)
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(RECAP)} and nota like 'tecnólogo por etapa ${HOJE}%');
`);

  // 2. os 4 e-mails de D+3
  out.push('-- ---------- 2. Um e-mail de 3 dias depois, para cada etapa ----------');
  for (const [k, e] of Object.entries(ETAPAS)) {
    const para = { materiais: [ORIGEM], etapas: [k] };
    const d = completo({ ...e.d3, rodape: RODAPE }), mt = ES.montar(d, 'novidades'), t = e.chave;
    out.push(`insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values (${lit(e.chave)}, ${lit(e.nome)}, ${lit('Aquecimento: ' + e.d3.pre)}, 'novidades',
  'Sozinho, pela parte Envio (sequência).', ${lit('pegou Guia tecnólogo · etapa ' + k + ' · aceitou novidades')},
  ${jsonb(variaveis(e.chave, para, 'novidades'))}, 541, true, 'aquecimento', ${jsonb(para)},
  'email', ${lit(RECAP)}, 3, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(e.chave)}, 1, 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  'tecnólogo por etapa ${HOJE}: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = ${lit(e.chave)} and criado_no_estudio and objetivo_chave = 'aquecimento')
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(e.chave)});
`);
  }
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelos-tecnologo-etapas.sql'), gerar());
}
