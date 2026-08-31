// Por Dentro — acordeão embutido no artigo sobre profissões regulamentadas na
// França: para cada profissão, quem se aplica, como funciona o reconhecimento
// de diploma, quem decide e se a restrição é da atividade inteira ou só de
// atos específicos. Fica num módulo à parte (mesmo padrão de vae-2026.js e
// exame-civico.js) porque o corpo do artigo é editado como markdown puro pelo
// /admin, e o parser (assets/js/markdown.js) escapa HTML de propósito.
//
// Marcador "[[DIPLOMA-DOSSIE]]" no corpo do artigo vira o mount point (ver
// TOOL_TOKENS em /artigos/post/index.html).

function ensureCss() {
  if (document.getElementById("prd-tool-css")) return;
  const style = document.createElement("style");
  style.id = "prd-tool-css";
  style.textContent = `
.prd-tool{margin:28px 0;}
.prd-group{margin-bottom:22px;}
.prd-group-title{font-family:var(--font-display);font-size:16px;font-weight:600;color:var(--downtown-brown);margin:0 0 4px;}
.prd-group-note{font-size:13px;color:var(--texto-secundario);margin:0 0 12px;max-width:60ch;}
.prd-item{background:#fff;border:1px solid var(--borda);border-radius:var(--radius-md);box-shadow:var(--shadow-card);margin-bottom:10px;overflow:hidden;}
.prd-item summary{list-style:none;cursor:pointer;padding:14px 16px;display:flex;align-items:center;gap:12px;}
.prd-item summary::-webkit-details-marker{display:none;}
.prd-mono{flex:none;width:36px;height:36px;border-radius:50%;border:1.5px solid var(--downtown-brown);color:var(--downtown-brown);display:flex;align-items:center;justify-content:center;font-family:var(--font-body);font-weight:700;font-size:12px;}
.prd-titles{flex:1;min-width:0;}
.prd-name{font-family:var(--font-display);font-weight:600;font-size:15.5px;color:var(--grafite);display:block;}
.prd-fr{font-size:11.5px;color:var(--texto-secundario);font-style:italic;}
.prd-tag{flex:none;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:5px 9px;border-radius:2px;white-space:nowrap;}
.prd-tag.pae{background:#F1E4DF;color:var(--downtown-brown);}
.prd-tag.dreets{background:#EEF4FB;color:var(--placid-blue-text);}
.prd-tag.exame{background:#FBF1DE;color:var(--beje-paris-text);}
.prd-tag.comissao{background:#EFF3E7;color:var(--verde-moss);}
.prd-tag.ordre{background:#F1E4DF;color:var(--downtown-brown);}
.prd-tag.estagio{background:#FBF1DE;color:var(--beje-paris-text);}
.prd-tag.misto{background:#EEF4FB;color:var(--placid-blue-text);}
.prd-tag.livre{background:var(--borda-suave);color:var(--texto-secundario);}
.prd-arrow{flex:none;font-size:12px;color:var(--texto-secundario);transition:transform .2s ease;}
.prd-item[open] .prd-arrow{transform:rotate(180deg);}
.prd-body{padding:0 16px 18px;border-top:1px solid var(--borda-suave);margin-top:2px;}
.prd-h{font-family:var(--font-body);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--texto-secundario);font-weight:700;margin:16px 0 6px;}
.prd-h:first-child{margin-top:14px;}
.prd-body p{margin:0 0 8px;font-size:13.5px;color:var(--grafite);line-height:1.6;max-width:62ch;}
.prd-body ul{margin:0 0 8px;padding-left:1.1em;}
.prd-body li{font-size:13.5px;margin-bottom:5px;line-height:1.55;max-width:58ch;}
.prd-body li::marker{color:var(--beje-paris-text);}
.prd-links{list-style:none;margin:4px 0 0;padding:0;}
.prd-links li{margin-bottom:4px;}
.prd-links a{font-size:12.5px;word-break:break-word;}
.prd-callout{font-size:12.5px;color:var(--grafite);background:#FBF1DE;border-left:3px solid var(--beje-paris-text);padding:8px 12px;border-radius:0 4px 4px 0;margin:8px 0;}
`;
  document.head.appendChild(style);
}

const GROUPS = [
  {
    title: "Saúde · regime PAE (CNG)",
    note: "As únicas 4 profissões que passam pela Procédure d'Autorisation d'Exercice — prova escrita (EVC), estágio remunerado (PCC) e comissão final (CAE).",
    items: [
      {
        abbr: "Md", name: "Médico", fr: "médecin", tag: "pae", tagLabel: "PAE · PCC 2 anos",
        quem: "Diploma emitido fora da UE/EEE que permita exercer no país de origem (via externa), ou PADHUE já em exercício sob attestation provisoire na França (via interna, com prova única de 2h).",
        mecanismo: [
          "Inscrição online no CNG durante o período de abertura anual.",
          "Prova escrita (EVC) — QCM de conhecimentos fundamentais, a partir de novembro. Até 3 tentativas.",
          "Se aprovado: PCC de 2 anos (reduzido de 3 pela reforma de 2025) como praticien associé em hospital ou clínica credenciada.",
          "Dossiê final enviado à CAE; depois, inscrição no Ordre des Médecins.",
        ],
        decide: "CAE (Commission d'Autorisation d'Exercice), a partir da afetação feita pelo CNG.",
        tudo: "Tudo — sem a autorização da CAE não se pode exercer medicina na França, nem como liberal nem assalariado.",
        extra: "Datas 2026: inscrição EVC 17 jun → 21 jul (prazo prorrogado por arrêté de 15 jul). Provas a partir de nov/2026, em Rungis.",
        links: [
          { l: "CNG · Médecin", h: "https://www.cng.sante.fr/procedures-dautorisation-dexercice/obtenir-autorisation-dexercice" },
          { l: "CNG · Sessão EVC 2026", h: "https://www.cng.sante.fr/session-evc-2026" },
          { l: "Légifrance · Arrêté de abertura", h: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054245644" },
        ],
      },
      {
        abbr: "Cd", name: "Dentista", fr: "chirurgien-dentiste", tag: "pae", tagLabel: "PAE · PCC 1 ano",
        quem: "Diploma fora da UE/EEE. Sem ser laureado da EVC (ou enquadrado nas exceções do decreto de 7 ago 2020), não é possível pedir autorização à CAE.",
        mecanismo: [
          "Inscrição online no CNG no período de abertura anual.",
          "Prova escrita (EVC) — QCM único. Máximo de 3 tentativas.",
          "Se aprovado: PCC de 1 ano como praticien associé em serviço odontológico credenciado.",
          "Dossiê enviado à CAE — comissões costumam se reunir entre setembro e outubro.",
        ],
        decide: "CAE, após o estágio; inscrição depois no Conseil de l'Ordre des Chirurgiens-Dentistes.",
        tudo: "Tudo — mesma lógica do médico: sem autorização final, não se exerce.",
        extra: "Datas 2026: inscrição EVC 17 jun → 21 jul (prorrogado). Provas a partir de nov/2026.",
        links: [
          { l: "CNG · Chirurgien-dentiste", h: "https://www.cng.sante.fr/procedures-dautorisation-dexercice/obtenir-autorisation-dexercice/chirurgien-dentiste" },
          { l: "CNG · Modelo de dossiê (PDF)", h: "https://www.cng.sante.fr/sites/default/files/media/2022-03/modele_PAE%20dossier%20EVC.pdf" },
        ],
      },
      {
        abbr: "Ph", name: "Farmacêutico", fr: "pharmacien", tag: "pae", tagLabel: "PAE · PCC 2 anos",
        quem: "Diploma fora da UE/EEE. O pedido à CAE só é possível sendo laureado da EVC (ou enquadrado nas exceções de nacionalidade europeia / decreto de 7 ago 2020).",
        mecanismo: [
          "Inscrição online no CNG no período de abertura anual.",
          "Prova escrita (EVC) — QCM de conhecimentos fundamentais.",
          "Se aprovado: PCC de 2 anos como praticien associé em farmácia hospitalar ou officine credenciada.",
          "Dossiê enviado à CAE ao final do estágio; depois, inscrição no Ordre des Pharmaciens.",
        ],
        decide: "CAE, a partir da afetação do CNG.",
        tudo: "Tudo — mesma lógica das outras 3 profissões da PAE.",
        extra: "Datas 2026: inscrição EVC 17 jun → 21 jul (prorrogado). Provas a partir de nov/2026.",
        links: [
          { l: "CNG · Pharmacien", h: "https://www.cng.sante.fr/procedures-dautorisation-dexercice/obtenir-autorisation-dexercice/pharmacien" },
          { l: "CNG · Comissão de autorização (CAE)", h: "https://www.cng.sante.fr/procedures-dautorisation-dexercice/obtenir-autorisation-dexercice/commission-dautorisation-dexercice-cae" },
        ],
      },
      {
        abbr: "Sf", name: "Parteira", fr: "sage-femme", tag: "pae", tagLabel: "PAE · PCC 1 ano",
        quem: "Diploma fora da UE/EEE. Elegível à CAE sendo laureada da EVC, ou enquadrada nas exceções de nacionalidade europeia / decreto de 7 ago 2020.",
        mecanismo: [
          "Inscrição online no CNG no período de abertura anual.",
          "Prova escrita (EVC) — QCM de conhecimentos fundamentais.",
          "Se aprovada: PCC de 1 ano como praticienne associée em maternidade ou serviço credenciado.",
          "Dossiê enviado à CAE ao final do estágio; depois, inscrição no Ordre des Sages-Femmes.",
        ],
        decide: "CAE, a partir da afetação do CNG.",
        tudo: "Tudo — mesma lógica das outras 3 profissões da PAE.",
        extra: "Datas 2026: inscrição EVC 17 jun → 21 jul (prorrogado). Provas a partir de nov/2026.",
        links: [
          { l: "CNG · Sage-femme", h: "https://www.cng.sante.fr/procedures-dautorisation-dexercice/obtenir-autorisation-dexercice/sage-femme" },
        ],
      },
    ],
  },
  {
    title: "Saúde · autorização direta (DREETS)",
    note: "Enfermeiros e fisioterapeutas não passam pela PAE — o caminho é diferente e mais curto, mas continua sendo obrigatório.",
    items: [
      {
        abbr: "If", name: "Enfermeiro", fr: "infirmier", tag: "dreets", tagLabel: "DREETS",
        quem: "Diploma fora da UE/EEE. O Code de Santé Publique (art. L4311-12) só considera o diploma na medida em que ele também daria acesso à profissão no país onde foi obtido — não é automático.",
        mecanismo: [
          "Pedido de autorização de exercício junto à DREETS/DRIEETS da região onde pretende atuar.",
          "Comissão avalia a comparabilidade da formação (arrêtés de 24/03/2010 e 30/03/2010, atualizados por arrêté de 7/02/2025).",
          "Pode exigir uma mesure de compensation: estágio de adaptação OU prova de aptidão.",
        ],
        decide: "DREETS/DRIEETS da região de exercício.",
        tudo: "Dá acesso à profissão como um todo, nas mesmas condições de quem tem diploma francês — mas especializações (anestesista, bloco cirúrgico, puericultor) pedem reconhecimento à parte.",
        extra: "Um prazo médio de 12–18 meses aparece em fontes especializadas, mas não está confirmado em texto legal — trate como estimativa, não como dado oficial.",
        links: [
          { l: "Légifrance · Art. L4311-12 CSP", h: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038923558" },
          { l: "DRIEETS Île-de-France · Pedido de autorização", h: "https://idf.drieets.gouv.fr/Demande-d-autorisation-d-exercice-pour-les-professions-paramedicales-en-Ile-de" },
        ],
      },
      {
        abbr: "Kn", name: "Fisioterapeuta", fr: "masseur-kinésithérapeute", tag: "dreets", tagLabel: "DREETS + Ordre",
        quem: "Diploma fora da UE/EEE.",
        mecanismo: [
          "Mesmo regime da DREETS, com mesure de compensation quando há diferença relevante de formação.",
          "Se o diploma for reconhecido por um país da UE E houver 3 anos de exercício comprovado nesse país, segue o caminho \"europeu\", mais simples.",
          "Sem esse reconhecimento intermediário, o caminho é bem mais restrito — pode ser necessário cursar o diploma de Estado francês num dos 47 IFMK, via processo seletivo próprio.",
        ],
        decide: "DREETS decide a autorização; inscrição obrigatória depois no conselho departamental da Ordem dos Masseurs-Kinésithérapeutes.",
        tudo: "Tudo — atos de fisioterapia são reservados a quem está inscrito na Ordem.",
        links: [
          { l: "Ordre des Masseurs-Kinésithérapeutes", h: "https://www.ordremk.fr/ordre/diplomes/" },
        ],
      },
    ],
  },
  {
    title: "Fora da saúde",
    note: "Cada profissão tem seu próprio mecanismo — comissão, exame ou estágio, sem um sistema unificado como a PAE.",
    items: [
      {
        abbr: "Ps", name: "Psicólogo", fr: "psychologue", tag: "comissao", tagLabel: "Comissão consultiva",
        quem: "Diploma de psicologia fora da UE/EEE, com pelo menos 3 anos de estudo comprovado.",
        mecanismo: [
          "Pedido de reconhecimento avaliado por uma comissão consultiva (acadêmicos + representantes da profissão).",
          "Sem exame nem estágio formal — é análise de dossiê, caso a caso, sem automatismo.",
        ],
        decide: "Ministro do Ensino Superior, após parecer da comissão.",
        tudo: "O título \"psychologue\" é protegido — sem reconhecimento, não se pode usá-lo. Depois de reconhecido, é obrigatório o registro ADELI (junto à ARS) antes de começar a atuar.",
        extra: "Não encontramos confirmação de uma via alternativa tipo \"prova de aptidão\" — as fontes indicam só o caminho da comissão. Confirme diretamente antes de descartar outra rota.",
        links: [
          { l: "enseignementsup-recherche.gouv.fr", h: "https://www.enseignementsup-recherche.gouv.fr/fr/psychologue-une-profession-reglementee-en-france-46456" },
          { l: "Légifrance · Décret n°90-255", h: "https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006075598" },
        ],
      },
      {
        abbr: "Ar", name: "Arquiteto", fr: "architecte", tag: "ordre", tagLabel: "Ordre + Préfet",
        quem: "Diploma completo de arquitetura fora da UE/EEE.",
        mecanismo: [
          "Reconhecimento do diploma avaliado por comissão ligada às ENSA (escolas nacionais de arquitetura).",
          "Caminho reservado, na prática, a nacionais de países com convênios/reciprocidade — não está aberto a qualquer nacionalidade de fora da UE.",
          "Dossiê de autorização de exercício, com inscrição no tableau da Ordem.",
        ],
        decide: "Préfet de région decide a autorização final, após parecer do Conselho Nacional da Ordem dos Arquitetos (CNOA).",
        tudo: "O título \"architecte\" é penalmente protegido (usurpação: até 1 ano de prisão + 15.000€). Só quem está inscrito na Ordem pode assinar projetos e pedidos de permis de construire — mas atuar como \"architecte d'intérieur\" (decoração, título não protegido) ou como colaborador sob supervisão de um arquiteto inscrito não exige essa autorização.",
        extra: "Não localizamos o decreto específico de aplicação (só a referência genérica à Lei de 1977), nem confirmamos regra própria para restauro de patrimônio histórico (architecte du patrimoine) — trate como ponto a confirmar direto com a Ordem antes de planejar essa rota.",
        links: [
          { l: "Ordre des architectes · diplômes hors UE", h: "https://www.architectes.org/les-diplomes-de-pays-hors-union-europeenne-91483" },
          { l: "culture.gouv.fr · autorisation d'exercer (hors UE/EEE)", h: "https://www.culture.gouv.fr/catalogue-des-demarches-et-subventions/autorisation/autorisation-d-exercer-la-profession-d-architecte-en-france-avec-inscription-au-tableau-de-l-ordre-des-architectes-ressortissants-hors-ue-et-eee" },
        ],
      },
      {
        abbr: "Av", name: "Advogado", fr: "avocat", tag: "exame", tagLabel: "Exame · CNB",
        quem: "Diploma de direito fora da UE/EEE.",
        mecanismo: [
          "Pedido junto à Commission d'admission des avocats étrangers do CNB.",
          "Exame de controle de conhecimentos (art. 100 do décret n°91-1197): 2 provas escritas (consulta jurídica de 3h) + 2 orais (procedimento + deontologia).",
          "Na prática, só o EFB de Paris e o HEDAC de Versailles organizam esse exame.",
        ],
        decide: "CNB (Conseil National des Barreaux); inscrição final no barreau local escolhido.",
        tudo: "Tudo — sem aprovação no exame e sem inscrição no barreau, não se pode usar o título nem exercer.",
        links: [
          { l: "CNB · Admission des avocats étrangers", h: "https://cnb.avocat.fr/admission-des-avocats-etrangers" },
        ],
      },
      {
        abbr: "Ec", name: "Contador", fr: "expert-comptable", tag: "exame", tagLabel: "Exame de aptidão",
        quem: "Diploma fora da UE/EEE.",
        mecanismo: [
          "Exame de aptidão via art. 27 da Ordonnance n°45-2138: prova escrita (direito empresarial/trabalho/fiscal) + prova oral de deontologia.",
          "Alternativas: VAE, ou revalidação por unidades do DSCG + estágio de 3 anos + exame do DEC.",
          "Exceção parcial: profissionais do Quebec/New Brunswick têm dispensa parcial (só prova escrita + e-learning de 3 dias).",
        ],
        decide: "Conselho Nacional da Ordre des Experts-Comptables.",
        tudo: "Só quem está inscrito na Ordem pode assinar como expert-comptable — trabalhar em contabilidade interna de uma empresa, sem assinar como profissional liberal certificado, não exige essa inscrição.",
        links: [
          { l: "Ordre des Experts-Comptables · reconnaissance des qualifications", h: "https://www.experts-comptables.fr/devenir-expert-comptable/la-reconnaissance-des-qualifications" },
        ],
      },
      {
        abbr: "Vt", name: "Veterinário", fr: "vétérinaire", tag: "exame", tagLabel: "Exame anual · Nantes",
        quem: "Diploma fora da lista do arrêté de 19/07/2019 (reconhecida automaticamente só pra nacionais da UE/EEE/Suíça, ou diplomas específicos dessa lista).",
        mecanismo: [
          "Exame de controle de conhecimentos organizado uma vez por ano pela ONIRIS-VetAgroBio Nantes: provas escritas de admissibilidade + orais/práticas.",
        ],
        decide: "Aprovação no exame + autorização concedida pelo Ministro da Agricultura; inscrição obrigatória depois no Conselho Regional da Ordem dos Veterinários.",
        tudo: "Tudo — sem autorização e inscrição, não se pratica medicina/cirurgia veterinária na França.",
        extra: "Além do diploma, há restrição de nacionalidade (art. L241-1 do Code Rural) — vale confirmar seu caso específico direto com a Ordem.",
        links: [
          { l: "Ordre National des Vétérinaires · diplôme hors UE", h: "https://www.veterinaire.fr/je-suis-veterinaire/les-conditions-dexercice-en-france/avec-un-diplome-obtenu-hors-de-lunion-europeenne-pays-tiers" },
        ],
      },
      {
        abbr: "As", name: "Assistente social", fr: "assistant de service social", tag: "estagio", tagLabel: "Estágio de adaptação",
        quem: "Diploma de serviço social fora da UE/EEE.",
        mecanismo: [
          "Estágio de adaptação obrigatório: 250h de curso + 12 semanas de estágio profissional, com prazo de até 5 anos pra concluir.",
          "Sem alternativa de \"prova de aptidão\" — diferente de diplomados da UE, que podem escolher entre estágio ou prova.",
        ],
        decide: "Directeur régional (DREETS) propõe a decisão, após avaliação por um estabelecimento de formação escolhido pelo candidato.",
        tudo: "Tudo — só depois de validar o estágio é emitido o Diploma de Estado (DEASS), necessário pra exercer.",
        links: [
          { l: "Légifrance · Arrêté de 31/03/2009", h: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000020506757/2024-02-20" },
        ],
      },
      {
        abbr: "En", name: "Professor / docente", fr: "enseignant", tag: "misto", tagLabel: "Depende do vínculo",
        quem: "Diploma fora da UE/EEE, com pelo menos 3 anos pós-secundário.",
        mecanismo: [
          "Concurso público de titularização (fonctionnaire): fechado pra quem não é da UE/EEE/Suíça/Mônaco/Andorra — exceção: ensino superior (professor-pesquisador), aberto a qualquer nacionalidade.",
          "Rede privada sob contrato: concurso próprio de recrutamento, com atestado de comparabilidade emitido pelo ENIC-NARIC France.",
        ],
        decide: "ENIC-NARIC France emite o atestado de comparabilidade; o recrutamento em si é do Ministério da Educação ou do estabelecimento.",
        tudo: "Depende do vínculo — cargo contratual está aberto (rede privada, cursos de idiomas etc.), titularização no serviço público está fechada pra fora da UE, exceto ensino superior.",
        links: [
          { l: "devenirenseignant.gouv.fr", h: "https://www.devenirenseignant.gouv.fr/enseigner-dans-une-ecole-privee-sous-contrat-le-concours-d-acces-l-echelle-de-remuneration-des-1406" },
        ],
      },
    ],
  },
  {
    title: "Título protegido, mas profissão livre",
    note: "Nem toda restrição é da atividade inteira — às vezes é só do nome que você pode usar.",
    items: [
      {
        abbr: "Ig", name: "Engenheiro", fr: "ingénieur", tag: "livre", tagLabel: "Não regulamentado",
        quem: "Qualquer pessoa pode trabalhar como engenheiro na França — não existe Ordre nem autorização de exercício pra essa atividade.",
        mecanismo: [
          "Só o título \"ingénieur diplômé [+ nome da escola]\" é protegido por lei (desde 1934), reservado a quem se formou numa escola credenciada pela Commission des Titres d'Ingénieur (CTI).",
          "A CTI credencia formações, não indivíduos — não existe um caminho de reconhecimento de diploma estrangeiro pra \"virar\" ingénieur diplômé.",
        ],
        decide: "CTI, mas só decide credenciamento de escolas — não avalia pedidos individuais.",
        tudo: "Não se aplica pra atividade em si — só o uso do título específico é restrito. Exceção real: géomètre-expert (agrimensor) é totalmente regulamentado (Lei de 7/05/1946), com comissão própria de reconhecimento e inscrição obrigatória na Ordem dos Géomètres-Experts.",
        links: [
          { l: "ESILV · titre d'ingénieur protégé", h: "https://www.esilv.fr/titre-ingenieur-protege-cti/" },
          { l: "Légifrance · reconnaissance géomètre-experts", h: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000021309475" },
        ],
      },
    ],
  },
];

function renderItem(it) {
  const extra = it.extra ? '<div class="prd-callout">' + it.extra + "</div>" : "";
  const links = it.links.map((lk) => '<li><a href="' + lk.h + '" target="_blank" rel="noopener">' + lk.l + "</a></li>").join("");
  return (
    '<details class="prd-item">' +
    "<summary>" +
    '<span class="prd-mono">' + it.abbr + "</span>" +
    '<span class="prd-titles"><span class="prd-name">' + it.name + '</span><span class="prd-fr">' + it.fr + "</span></span>" +
    '<span class="prd-tag ' + it.tag + '">' + it.tagLabel + "</span>" +
    '<span class="prd-arrow">▾</span>' +
    "</summary>" +
    '<div class="prd-body">' +
    '<div class="prd-h">Quem se aplica</div><p>' + it.quem + "</p>" +
    '<div class="prd-h">Como funciona</div><ul>' + it.mecanismo.map((m) => "<li>" + m + "</li>").join("") + "</ul>" +
    '<div class="prd-h">Quem decide</div><p>' + it.decide + "</p>" +
    '<div class="prd-h">Vale pra atividade inteira, ou só parte dela?</div><p>' + it.tudo + "</p>" +
    extra +
    '<div class="prd-h">Fontes oficiais</div><ul class="prd-links">' + links + "</ul>" +
    "</div>" +
    "</details>"
  );
}

export function mount(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  ensureCss();

  root.innerHTML =
    '<div class="prd-tool">' +
    GROUPS.map(
      (g) =>
        '<div class="prd-group">' +
        '<h4 class="prd-group-title">' + g.title + "</h4>" +
        '<p class="prd-group-note">' + g.note + "</p>" +
        g.items.map(renderItem).join("") +
        "</div>"
    ).join("") +
    "</div>";

  root.querySelectorAll(".prd-item").forEach((det) => {
    det.addEventListener("toggle", () => {
      if (det.open && typeof window.gtag === "function") {
        const name = det.querySelector(".prd-name");
        window.gtag("event", "select_content", { content_type: "dossie_profissao", item_id: name ? name.textContent : "" });
      }
    });
  });
}
