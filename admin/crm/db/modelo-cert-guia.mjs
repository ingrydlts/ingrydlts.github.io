// O e-mail do guia gratuito Painel do Certificado (cert_guia_1), em blocos, como os outros modelos do Estúdio de e-mails.
// Gera crm-cert-guia-modelo.sql (rode: node admin/crm/db/modelo-cert-guia.mjs). O texto sai de ES.INICIAIS.cert_guia_1
// (estudio.js), o mesmo que o Worker usa de reserva (certGuia1 em cms-oauth-worker/worker.js).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ES from '../estudio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHAVE = 'cert_guia_1';
const TIPO = 'servico';
const dolar = (tag, s) => { if (String(s).includes('$' + tag + '$')) throw new Error('marca $' + tag + '$ dentro do texto'); return '$' + tag + '$' + s + '$' + tag + '$'; };
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

export function gerar() {
  const d = ES.iniciais(CHAVE), mt = ES.montar(d, TIPO), t = CHAVE;
  const variaveis = ES.varsDoModelo(CHAVE, null).map((x) => {
    const c = ES.CAT[x] || {};
    return { nome: x, o_que_e: c.o || x, se_faltar: c.t === 'link' ? 'sem link, o e-mail não sai' : c.t === 'sim' ? 'não' : c.plano == null ? 'o bloco some' : c.plano || 'fica vazio' };
  });
  return `-- Por Dentro — o modelo do e-mail do guia Painel do Certificado (cert_guia_1)
-- Rode no SQL Editor do Supabase, DEPOIS de crm-estudio-emails-3.sql e de crm-cert-guia-email.sql. Idempotente (pode rodar de novo).
-- GERADO por admin/crm/db/modelo-cert-guia.mjs, a partir de estudio.js (ES.montar). Para mudar o texto, mude lá e gere de novo,
-- ou edite pelo Estúdio de e-mails (versão nova). O Worker também tem o mesmo texto no código (certGuia1), de reserva.
--
-- Só acrescenta: o modelo (tipo serviço, sai sozinho, como o cf_guia_1) e a versão 1 No ar, em blocos. Não mexe em nenhum
-- outro modelo e não manda nada: o e-mail só sai depois que os segredos do Vault existirem (README do Worker, seção 17).
-- Nenhum link nem dado de pessoa aqui: o link do Notion vem de guias_links na hora do envio.
--
-- Como desfazer (só enquanto nenhum e-mail saiu com ele):
--   delete from public.modelos_email_versoes where chave = 'cert_guia_1';
--   delete from public.modelos_email where chave = 'cert_guia_1';

insert into public.modelos_email (chave, nome, objetivo, tipo, como_sai, quem_recebe, automatico, variaveis, ordem)
values (${lit(CHAVE)}, 'Guia Painel do Certificado · e-mail 1', 'Entregar o painel que ela pediu e dizer por onde começar na prova dela', ${lit(TIPO)},
  'Sozinho, na hora do cadastro no guia (o banco chama o Worker).', 'Todos que pediram o guia', true,
  ${lit(JSON.stringify(variaveis))}::jsonb, 110)
on conflict (chave) do nothing;

insert into public.modelos_email_versoes (chave, versao, etapa, assunto, preheader, corpo_texto, corpo_html, blocos, nota, publicado_em)
select ${lit(CHAVE)}, 1, 'no_ar',
  ${dolar(t + '_a', mt.assunto)},
  ${mt.preheader == null ? 'null' : dolar(t + '_p', mt.preheader)},
  ${dolar(t + '_t', mt.corpo_texto)},
  ${dolar(t + '_h', mt.corpo_html)},
  ${dolar(t + '_b', JSON.stringify(d))}::jsonb,
  'painel do certificado: texto aprovado em rascunho, em blocos', now()
where exists (select 1 from public.modelos_email where chave = ${lit(CHAVE)})
  and not exists (select 1 from public.modelos_email_versoes where chave = ${lit(CHAVE)});
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(HERE, 'crm-cert-guia-modelo.sql'), gerar());
  console.log('crm-cert-guia-modelo.sql gerado.');
}
