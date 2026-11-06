// O e-mail do guia do tecnólogo que sai 3 dias depois do recap (tec_recap_30min), com um bloco para cada nível que a pessoa tocou
// no recap (L3, Licence pro, M1). Gera crm-modelo-tecnologo-nivel.sql (rode: node admin/crm/db/modelo-tecnologo-nivel.mjs).
// O SQL só cria o modelo e a versão 1 em RASCUNHO, com o Envio DESLIGADO: quem revisa, testa, publica (No ar) e liga é você, pelo estúdio.
// Rode DEPOIS de crm-modelo-tecnologo-recap.sql (o Envio é "3 dias depois do recap", e o banco confere se o recap existe).
// O assunto, a prévia, o texto puro e o HTML saem de ES.montar, o mesmo código do estúdio.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOJE = '06/11/2026';
export const CHAVE = 'tec_nivel_3dias';
export const DEPOIS_DE = 'tec_recap_30min';
const ASS = { tipo: 'assinatura', texto: 'Ingryd · Por Dentro' };
const DUVIDA = { tipo: 'texto', estilo: 'caixa', texto: '**Ficou com dúvida?** É só responder este e-mail. Chega direto para mim.' };

export const D = {
  assunto: '{nome}, o seu próximo passo no guia do tecnólogo',
  assunto_alt: 'O seu próximo passo no guia do tecnólogo',
  pre: 'O que muda conforme o nível em que você quer entrar.',
  rodape: 'pediu o guia do tecnólogo no Por Dentro com {email} e aceitou receber novidades',
  itens: [
    { tipo: 'titulo', texto: 'O seu próximo passo, conforme o nível' },
    { tipo: 'texto', texto: 'Oi {nome}! Faz uns dias que você pegou o guia do tecnólogo. O passo que mais destrava é escrever a 3 ou 4 cursos e guardar a resposta por escrito. O que vale a pena perguntar depende do nível em que você quer entrar.',
      alt: 'Oi! Faz uns dias que você pegou o guia do tecnólogo. O passo que mais destrava é escrever a 3 ou 4 cursos e guardar a resposta por escrito. O que vale a pena perguntar depende do nível em que você quer entrar.' },
    { tipo: 'etapa', se: '#nivel_l3', rotulo: 'Para quem quer entrar no L3:', titulo: 'O L3 pede 2 anos completos de ensino superior, com histórico escolar.',
      texto: 'É onde costuma cair o tecnólogo de 2 anos, mas não é regra: cada escola decide. Peça a confirmação do nível por escrito antes de pagar taxa ou tradução. E lembre que, no L3, o contrato de alternância só vem depois de mais de 1 ano na França (ficha F2713 do Service-Public).' },
    { tipo: 'etapa', se: '#nivel_licence_pro', rotulo: 'Para quem quer entrar na Licence pro:', titulo: 'Na Licence pro, o prazo do Études en France é 17 de janeiro de 2027.',
      texto: 'Pergunte à escola se o curso exige contrato de alternância e se ela aceita o seu histórico. Peça as duas respostas por escrito. Se o curso exigir contrato, lembre que ele só vem depois de mais de 1 ano na França (ficha F2713 do Service-Public).' },
    { tipo: 'etapa', se: '#nivel_m1', rotulo: 'Para quem quer entrar no M1:', titulo: 'O M1 pede 180 ECTS ou licence de 3 anos, e cada escola fixa seus critérios.',
      texto: 'É onde costuma cair o tecnólogo de 3 anos, mas não é regra. Na inscrição direta em Master, o apprentissage tem exceção à regra de 1 ano na França (ficha F2713 do Service-Public). Confirme com a escola e a préfecture, por escrito.' },
    { tipo: 'pergunta', texto: 'Em que nível você quer entrar?', ajuda: 'Se ainda não respondeu ou mudou de ideia, toque de novo. Leva dois segundos e muda o que eu te mando a seguir.' },
    { tipo: 'toques', var: 'botoes_nivel_tec' },
    { tipo: 'botao', rotulo: 'Abrir o checklist e o modelo de e-mail', url: 'https://topordentroviagens.notion.site/Modelo-de-e-mail-para-a-escola-tecn-logo-do-Brasil-e-n-vel-de-entrada-em-franc-s-40dd602254ce81ddb077edd3a306f3e1' },
    DUVIDA, ASS
  ]
};

const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const jsonb = (o) => lit(JSON.stringify(o)) + '::jsonb';
const PARA = { materiais: ['guia-tecnologo'] };

export function gerar() {
  const o = ES.objetivo('aquecimento'), m = { chave: CHAVE, criado_no_estudio: true, tipo: o.tipo, para_quem: PARA };
  const d = JSON.parse(JSON.stringify(D)); d.v = 1; d.planos = d.planos || {};
  const mt = ES.montar(d, o.tipo);
  const vars = ES.varsDoModelo(CHAVE, m).map((x) => { const c = ES.CAT[x] || {}; return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'não sai' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' }; });
  const t = CHAVE;
  return `-- Por Dentro — Estúdio de e-mails: guia do tecnólogo, 3 dias depois do recap, com um bloco por nível (${HOJE})
-- Rode no SQL Editor do Supabase, DEPOIS de crm-modelo-tecnologo-recap.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-tecnologo-nivel.mjs, a partir de estudio.js (ES.montar). Para mudar um texto, mude lá e gere de novo.
--
-- Só cria o modelo e a versão 1 em RASCUNHO, com o Envio DESLIGADO:
--   Tecnólogo · próximo passo por nível (3 dias)   tipo novidades (só sai para quem aceitou receber), 3 dias depois do ${DEPOIS_DE}, às 10h.
-- Para ir ao ar: no Estúdio de e-mails, abra o modelo, confira a prévia, mande o teste, publique (No ar) e ligue o Envio.
--
-- Segurança: só o texto e as regras de um modelo. Nenhum dado de pessoa. Só admin lê e muda (RLS das entregas 1 a 3).
--
-- Como desfazer (só apaga o que este arquivo criou e ainda está em rascunho ou revisão; o que você publicou fica):
--   delete from public.modelos_email_versoes where chave = '${CHAVE}' and etapa in ('rascunho', 'revisao');
--   delete from public.modelos_email m where m.chave = '${CHAVE}' and m.criado_no_estudio and not m.envio_ligado
--      and not exists (select 1 from public.modelos_email_versoes v where v.chave = m.chave)
--      and not exists (select 1 from public.emails_enviados e where e.modelo = m.chave);

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, variaveis, ordem, criado_no_estudio, objetivo_chave,
  para_quem, envio_gatilho, envio_depois_de, envio_dias, envio_hora, envio_minutos, envio_ligado)
values (${lit(CHAVE)}, ${lit('Tecnólogo · próximo passo por nível (3 dias)')}, ${lit(o.nome + ': ' + o.d)}, ${lit(o.tipo)},
  'Sozinho, pela parte Envio (sequência).', 'pegou Guia tecnólogo',
  ${jsonb(vars)}, 542, true, ${lit(o.k)}, ${jsonb(PARA)},
  'email', ${lit(DEPOIS_DE)}, 3, 10, null, false)
on conflict (chave) do nothing;
insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota)
select ${lit(CHAVE)}, 1, 'rascunho',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  'tecnólogo por nível ${HOJE}: escrita para revisão'
where exists (select 1 from public.modelos_email where chave = ${lit(CHAVE)} and criado_no_estudio and objetivo_chave = ${lit(o.k)})
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(CHAVE)});
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-modelo-tecnologo-nivel.sql'), gerar());
}
