// Registro de funis: para cada página que leva o lead ao CRM (a origem que o formulário grava), quem é o público, quais são
// as etapas que a pessoa marca e quais e-mails ela recebe. A ficha (crm.js) lê daqui para sugerir o e-mail certo e nunca mandar o
// link da plataforma para quem acabou de chegar. As etapas e os modelos do Estúdio têm as mesmas chaves daqui; o Worker conhece as
// etapas em CRM_ETAPAS_GUIA (worker.js) e o teste db/testes/crm-funis.test.mjs confere que os dois estão iguais.
// Desenho: admin/crm/MAPA-EMAILS.md.
//
// Campos de cada funil:
//   rotulo   o nome na ficha            prefixo  o começo das chaves de etapa (cf-, alt-, tec-)
//   etapas   { chave: como aparece }    manual   o modelo antigo (TPLS) que a ficha sugere para você enviar
//   auto     true = os e-mails saem sozinhos pelo Estúdio (recap + trilha); a ficha mostra o estado, não manda enviar
//   recap    { modelo, minutos }        o 1º e-mail, depois do cadastro (modelo do Estúdio)
//   trilha   { etapa: [modelos] }       os e-mails seguintes, na ordem, para quem marcou aquela etapa
export var FUNIS = {
  'guia-tecnologo': {
    rotulo: 'Guia tecnólogo', publico: 'Tecnólogo do Brasil querendo estudar ou fazer alternância na França', prefixo: 'tec-', manual: null, auto: true,
    etapas: { 'tec-nao-sei': 'Ainda não sabe em que nível entraria', 'tec-juntando': 'Juntando histórico, diploma e carga horária',
      'tec-escrevi': 'Já escreveu para escolas e está esperando', 'tec-resposta': 'Já tem resposta de uma escola' },
    recap: { modelo: 'tec_recap_30min', minutos: 30 },
    trilha: { 'tec-nao-sei': ['tec_d3_nao_sei'], 'tec-juntando': ['tec_d3_juntando'], 'tec-escrevi': ['tec_d3_escrevi'], 'tec-resposta': ['tec_d3_resposta'] }
  },
  'guia-etudes-en-france-2027': {
    rotulo: 'Guia Campus France', publico: 'Quem quer estudar na França pelo Campus France', prefixo: 'cf-', manual: null, auto: false,
    etapas: { 'cf-nao-comecei': 'Ainda não começou', 'cf-escolhendo-curso': 'Escolhendo o curso', 'cf-juntando-documentos': 'Juntando documentos, traduções e o teste',
      'cf-dossie-enviado': 'Já enviou o dossiê', 'cf-entrevista-resposta': 'Esperando a entrevista ou a resposta' },
    recap: null, trilha: {}
  },
  'guia-vls-ts': {
    rotulo: 'Guia VLS-TS', publico: 'Já está na França e o VLS-TS travou (prazo de 3 meses)', prefixo: '', manual: 'guia_chamada', auto: false,
    etapas: {}, recap: null, trilha: {}
  },
  'guia-email-alt30': {
    rotulo: 'Guia alternância 30+', publico: 'Quer alternância depois dos 29 anos', prefixo: 'alt-', manual: 'guia_alternancia', auto: false,
    etapas: { 'alt-pesquisando': 'Pesquisando se pode fazer alternância depois dos 29', 'alt-escolhendo-escola': 'Escolhendo escola e curso',
      'alt-recusa-idade': 'Ouviu "só até 29" de uma escola', 'alt-buscando-empresa': 'Tem escola, falta a empresa', 'alt-montando-contrato': 'Tem empresa, montando o contrato' },
    recap: null, trilha: {}
  }
};

export function funilDe(origem) { return Object.prototype.hasOwnProperty.call(FUNIS, origem) ? FUNIS[origem] : null; }
// O rótulo de uma etapa em qualquer funil (ou a própria chave, se não conhecer).
export function etapaRotulo(chave) {
  var ks = Object.keys(FUNIS);
  for (var i = 0; i < ks.length; i++) { var e = FUNIS[ks[i]].etapas; if (e && Object.prototype.hasOwnProperty.call(e, chave)) return e[chave]; }
  return null;
}

// O que a ficha mostra como "próximo e-mail" de quem chegou por um funil automático. Função pura (testada em db/testes/crm-funis.test.mjs).
//   enviados: as chaves dos modelos que já saíram para ela; modelos: { chave: { envio_ligado, no_ar, nome } } (os do Estúdio).
// Devolve null quando não há nada especial (a ficha segue com as regras de sempre), ou { quando, titulo, angulo }.
export function proximoDoFunil(funil, etapa, enviados, modelos) {
  if (!funil || !funil.auto || !funil.recap) return null;
  var jaSaiu = function (k) { return (enviados || []).indexOf(k) >= 0; };
  var info = function (k) { return (modelos || {})[k] || null; };
  var nome = function (k) { var m = info(k); return (m && m.nome) || k; };
  var pronto = function (k) { var m = info(k); return !!(m && m.no_ar && m.envio_ligado); };
  var etapaTxt = etapa && funil.etapas[etapa] ? funil.etapas[etapa].toLowerCase() : '';
  var semPlataforma = 'Ela ainda não é lead qualificada: não mande o link da plataforma agora.';
  if (!jaSaiu(funil.recap.modelo)) {
    if (!info(funil.recap.modelo))
      return { quando: 'nao', titulo: 'O e-mail do guia ainda não existe no estúdio',
        angulo: 'Falta criar o modelo “' + funil.recap.modelo + '” (README do Worker, seção 26). ' + semPlataforma };
    if (!pronto(funil.recap.modelo))
      return { quando: 'nao', titulo: 'O e-mail automático deste guia está desligado',
        angulo: 'Publique e ligue o Envio de “' + nome(funil.recap.modelo) + '” no Estúdio de e-mails: é ele que entrega o guia a quem acabou de chegar. Enquanto isso, não mande boas-vindas. ' + semPlataforma };
    return { quando: 'esperar', espera: '', titulo: 'Espere: o e-mail do guia sai sozinho',
      angulo: 'Ela acabou de chegar pelo ' + funil.rotulo + '. O primeiro e-mail (“' + nome(funil.recap.modelo) + '”) sai sozinho ' + funil.recap.minutos +
        ' minutos depois do cadastro' + (etapaTxt ? ' e já fala da etapa que ela marcou (' + etapaTxt + ')' : '') + '. ' + semPlataforma };
  }
  var trilha = (etapa && funil.trilha[etapa]) || [];
  var proximo = trilha.filter(function (k) { return !jaSaiu(k); })[0];
  if (!etapa)
    return { quando: 'nao', titulo: 'Ela não marcou a etapa: só recebeu o primeiro e-mail',
      angulo: 'Sem etapa, a trilha personalizada não sai. Se ela responder ou voltar a pedir material, escreva você, com uma pergunta sobre o momento dela. ' + semPlataforma };
  if (!proximo) return null;
  if (!pronto(proximo))
    return { quando: 'nao', titulo: 'O próximo e-mail da trilha está desligado',
      angulo: 'Para quem está na etapa “' + etapaTxt + '” o próximo é “' + nome(proximo) + '”. Publique e ligue o Envio dele no estúdio. ' + semPlataforma };
  return { quando: 'esperar', espera: '', titulo: 'Espere: o próximo e-mail da trilha sai sozinho',
    angulo: 'Ela marcou a etapa “' + etapaTxt + '”. O próximo e-mail é “' + nome(proximo) + '” (3 dias depois do primeiro, às 10h de Brasília, só se aceitou novidades). ' + semPlataforma };
}
