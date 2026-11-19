// Rota da Sécu: o texto dos 20 casos (4 portas × 5 pontos). É a única fonte do texto: a página (index.html) e o e-mail 1
// (admin/crm/db/modelo-rota-da-secu.mjs) leem este arquivo, para dizerem a mesma coisa.
// Módulo ES, sem dependências, roda no navegador e no Node. Sem dado pessoal (o site é público).
//
// Regras do texto: só afirma o que tem fonte oficial datada (FONTES); o que não tem vira pergunta ("confirme com o 3646").
// Sem travessão, sem marca de gênero, sem colchetes (o Worker recusa e-mail com [trecho]; use "(data)").
// As frases em francês (fr) são APOIO e precisam de revisão de quem fala francês antes de ir ao ar.

export const OFICIAL = 'https://www.service-public.gouv.fr/particuliers/vosdroits/R45084';

export const PORTAS = [
  { id: 'estudante', rot: 'Estudo', desc: 'Vim ou vou estudar na França' },
  { id: 'trabalho', rot: 'Trabalho', desc: 'Tenho contrato de trabalho' },
  { id: 'aupair', rot: 'Au pair', desc: 'Vim ou vou como au pair' },
  { id: 'outro', rot: 'Outra situação', desc: 'Visto de família, PVT ou outro' }
];

export const PONTOS = [
  { id: 'nao_cheguei', rot: 'Ainda não cheguei à França', curto: 'não cheguei' },
  { id: 'sem_numero', rot: 'Cheguei e ainda não pedi o meu número de sécu', curto: 'sem número' },
  { id: 'esperando', rot: 'Já pedi e estou esperando resposta', curto: 'esperando' },
  { id: 'sem_vitale', rot: 'Tenho o número, mas ainda não a carte vitale', curto: 'sem carte vitale' },
  { id: 'completo', rot: 'Já tenho a carte vitale', curto: 'completo' }
];

// data = a data da página oficial que a Ingryd conferiu. url = o endereço exato dessa página; null enquanto ela não o passar (a página mostra só o texto da fonte, sem link).
export const FONTES = {
  est: { rot: 'Ameli, estudante estrangeiro', data: '19/01/2026', url: 'https://www.ameli.fr/assure/droits-demarches/europe-international/protection-sociale-france/vous-venez-etudier-en-france' },
  cpam: { rot: 'Ameli, nascido no exterior', data: '02/10/2026', url: null },
  urs: { rot: 'Urssaf', data: '13/10/2026', url: 'https://www.urssaf.fr/accueil/particulier/particulier-employeur/embaucher-un-salarie/emploi-pair-stagiaire-aidant-fam.html' },
  puma: { rot: 'Service Public, Puma', data: '13/05/2026', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F34308' },
  tel: { rot: 'Ameli, contato com a CPAM pelo 3646', data: '30/09/2026', url: null },
  vit: { rot: 'Ameli, carte Vitale', data: '14/10/2026', url: 'https://www.ameli.fr/assure/remboursements/etre-bien-rembourse/carte-vitale/carte-vitale-application/demander-sa-carte-vitale-conditions-et-demarches' },
  tra: { rot: 'Ameli, médecin traitant, e Cerfa 12485*03', data: '23/04/2026', url: 'https://www.ameli.fr/assure/remboursements/etre-bien-rembourse/medecin-traitant-parcours-soins-coordonnes' },
  c2s: { rot: 'Ameli, C2S', data: '18/09/2026', url: 'https://www.ameli.fr/assure/droits-demarches/difficultes-acces-droits-soins/complementaire-sante/complementaire-sante-solidaire' }
};

// As frases em francês são apoio e só perdem o aviso "em revisão" quando quem fala francês as revisar: trocar para true.
export const FRANCES_REVISADO = false;
export function rotuloFrances(revisado = FRANCES_REVISADO) {
  return revisado ? 'Em francês' : 'Em francês (frase de apoio, em revisão)';
}

const FR_DIGA = 'Bonjour, j’ai envoyé ma demande d’ouverture des droits à l’assurance maladie le (date). Je voudrais savoir où en est mon dossier.';
const FR_PERG = 'Ma demande a-t-elle bien été reçue ? Manque-t-il un document ? Quelle est la prochaine étape, et sous quel délai ?';
const FR_ANOTE = 'Pouvez-vous me donner votre prénom et un numéro de suivi pour cet appel ?';
const FR_VIT = 'Mon numéro de sécurité sociale est-il définitif ? Puis-je demander ma carte Vitale ?';

function estadoCivil(estudante) {
  return estudante
    ? 'Estado civil: a cópia integral da certidão de nascimento, o extrato com filiação, o livret de famille ou a certidão de casamento.'
    : 'Estado civil: a cópia integral da certidão de nascimento ou o extrato com filiação. Se for estrangeira, conforme o país ela precisa estar legalizada ou apostilada e traduzida por tradutor juramentado, com o original anexado.';
}

// caso(porta, ponto) → { tipo, primeiro, passos: [{ t, x, fr? }], fontes: [chave de FONTES] }
// Lança Error para valor fora das listas (o chamador decide o que mostrar).
export function caso(porta, ponto) {
  if (!PORTAS.some((p) => p.id === porta)) throw new Error('porta desconhecida: ' + porta);
  if (!PONTOS.some((q) => q.id === ponto)) throw new Error('ponto desconhecido: ' + ponto);
  const est = porta === 'estudante';
  const r = { tipo: '', primeiro: '', passos: [], fontes: [] };
  const add = (t, x, fr) => { const s = { t, x }; if (fr) s.fr = fr; r.passos.push(s); };

  if (ponto === 'nao_cheguei') {
    r.tipo = 'Faça isto antes de chegar';
    r.primeiro = {
      estudante: 'Inscreva-se em etudiant-etranger.ameli.fr antes de chegar. O número provisório sai no próprio site.',
      trabalho: 'Guarde o contrato e pergunte ao RH quem faz o seu pedido de filiação.',
      aupair: 'Peça à família que te acolhe para declarar a sua contratação à Urssaf.',
      outro: 'Deixe o formulário oficial e o estado civil prontos. Sem atividade profissional, os direitos só abrem depois de 3 meses morando na França.'
    }[porta];
    add('Abra o formulário oficial', est
      ? 'No etudiant-etranger.ameli.fr você informa nome, nascimento, e-mail, endereço na França, telefone e a data de início das aulas.'
      : 'No link oficial você baixa o formulário de abertura de direitos (Cerfa S1106) e encontra a CPAM do lugar onde vai morar.');
    add('O que muda no seu caso', {
      estudante: 'A cobertura começa na data de início das aulas. Tenha em mãos identidade ou passaporte, título de séjour, atestado de matrícula e IBAN.',
      trabalho: 'A filiação é imediata assim que o pedido é aceito. Pergunte ao RH se o pedido já foi feito.',
      aupair: 'A família declara à Urssaf em até 8 dias. Confirme com o 3646 se você também precisa fazer o seu pedido na CPAM.',
      outro: 'Quem trabalha tem afiliação imediata. Com visto de família e sem trabalho, o pedido é por residência e os direitos abrem após 3 meses.'
    }[porta]);
    add('Prepare o estado civil', estadoCivil(est));
    r.fontes = est ? ['est'] : porta === 'aupair' ? ['urs', 'cpam'] : ['puma', 'cpam'];
  }

  if (ponto === 'sem_numero') {
    r.tipo = 'Como pedir o seu número de sécu';
    r.primeiro = {
      estudante: 'O seu pedido é no etudiant-etranger.ameli.fr, e não pelo formulário em papel.',
      trabalho: 'Antes de enviar qualquer coisa, pergunte ao RH se o pedido já foi feito.',
      aupair: 'Confirme com a família que a declaração à Urssaf foi enviada. Confirme com o 3646 se o seu registro na CPAM é um passo à parte.',
      outro: 'Baixe o formulário oficial, ache a CPAM do seu endereço e monte o dossiê.'
    }[porta];
    add(est ? 'Faça a inscrição' : 'Baixe o formulário', est
      ? 'Preencha o cadastro no etudiant-etranger.ameli.fr. O site gera o número provisório na hora e você baixa a attestation provisória.'
      : 'No link oficial você baixa o Cerfa S1106 e descobre a sua CPAM.');
    add('Junte os documentos', est
      ? 'Identidade ou passaporte, título de séjour, atestado de matrícula do ano, IBAN e o estado civil.'
      : 'Identidade ou título de séjour válido e o documento que prova a sua situação (em atividade ou sem emprego).');
    add('Prepare o estado civil', estadoCivil(est));
    add('Envie e espere o NIA', est
      ? 'Se faltar documento, você reenvia pelo seu espaço pessoal no site.'
      : {
        trabalho: 'Envie à CPAM do seu endereço. O NIA chega por correio e, com ele, você ainda não abre conta Ameli nem pede a carte vitale.',
        aupair: 'Se o 3646 confirmar que o seu pedido na CPAM é necessário, envie à CPAM do seu endereço. A declaração da família à Urssaf é outra etapa. O NIA chega por correio e ainda não dá conta Ameli nem carte vitale.',
        outro: 'Envie à CPAM do seu endereço. Sem atividade profissional, os direitos só abrem depois de 3 meses morando na França. O NIA chega por correio.'
      }[porta]);
    r.fontes = est ? ['est'] : porta === 'aupair' ? ['urs', 'cpam'] : ['puma', 'cpam'];
  }

  if (ponto === 'esperando') {
    r.tipo = 'Roteiro de ligação';
    r.primeiro = {
      estudante: 'Entre no seu espaço pessoal do site do estudante. Se faltar documento ou ele estiver fora do formato, você reenvia por lá.',
      trabalho: 'Antes de ligar, pergunte ao RH quem fez o pedido e peça o comprovante.',
      aupair: 'Pergunte à família se a declaração à Urssaf foi enviada e ligue para a CPAM por causa do seu registro.',
      outro: 'Ligue para a CPAM e pergunte se o seu pedido foi recebido. O NIA chega por correio.'
    }[porta];
    add('Ligue', '3646. O serviço é gratuito e você paga só o custo da ligação.');
    add('Diga', {
      estudante: 'Seu nome, que fez a inscrição no site do estudante em (data) e para qual CPAM.',
      trabalho: 'Seu nome, que o pedido de abertura de direitos foi feito em (data), por você ou pelo RH, e para qual CPAM.',
      aupair: 'Seu nome, que a família declarou à Urssaf em (data), que você fez o seu pedido na CPAM em (data) e qual é a CPAM.',
      outro: 'Seu nome, que enviou o formulário S1106 em (data) e para qual CPAM.'
    }[porta], FR_DIGA);
    add('Pergunte', '1. Receberam o meu pedido? 2. Falta algum documento? 3. Qual é o próximo passo e em que prazo?', FR_PERG);
    add('Anote', 'A data, o nome de quem atendeu e o número de protocolo, se houver. Peça para repetir o que não entender.', FR_ANOTE);
    r.fontes = ['tel', est ? 'est' : porta === 'aupair' ? 'urs' : 'cpam'];
  }

  if (ponto === 'sem_vitale') {
    r.tipo = 'Como chegar à carte vitale';
    r.primeiro = est
      ? 'Depois que o número é certificado, o site do estudante libera o certificado definitivo. Aí você abre a conta Ameli e pede a carte vitale.'
      : 'A carte vitale exige o número de sécu. Com o NIA você ainda não pode pedi-la nem abrir conta Ameli. Confirme com a CPAM se o seu número já é o definitivo.';
    if (est) add('Veja o certificado', 'Entre no espaço pessoal do site do estudante e confira se o certificado definitivo já está liberado.');
    else add('Confirme o número', 'Ligue 3646 e pergunte se o seu número já é definitivo e se falta algum documento de estado civil.', FR_VIT);
    add('Peça a carte vitale', 'Ela é gratuita. Pela conta Ameli chega em 2 semanas; por formulário em papel, telefone ou guichê, em 3 semanas.');
    add('Enquanto espera', 'Baixe a attestation de droits na conta Ameli e apresente aos profissionais de saúde.');
    if (!est) add('Anote', 'A data, o nome de quem atendeu e o número de protocolo, se houver.', FR_ANOTE);
    r.fontes = est ? ['est', 'vit'] : ['cpam', 'vit', 'tel'];
  }

  if (ponto === 'completo') {
    r.tipo = 'Os próximos passos';
    r.primeiro = 'Você já tem o essencial. Faltam o médecin traitant e a complementar.';
    add('Declare um médecin traitant', 'Preencha com o médico, na consulta, o formulário de declaração (Cerfa 12485*03) e envie à CPAM. No exemplo do Ameli, numa consulta de 30 € você recebe 19 € com ele e 8,40 € sem ele.');
    add('Confira a complementar', 'Mutuelle ou complementar solidária (C2S). A C2S custa de 0 a 30 € por mês, conforme renda e idade'
      + (est ? ', e estudantes entram entre os públicos.' : '.')
      + (porta === 'trabalho' ? ' Pergunte também ao RH sobre a mutuelle da empresa.' : ''));
    add('Se precisar ligar', '3646, gratuito mais o custo da ligação.');
    r.fontes = ['tra', 'c2s', 'tel'];
  }
  return r;
}
