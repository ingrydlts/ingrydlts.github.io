// Por Dentro — gera content/campus-france-ciclo.json a partir do template do app.
//
// Por quê: o /checklist-preview/ precisa do prazo, do nº de escolhas, dos 12 passos e dos documentos
// de cada nível da candidatura ao Campus France. A fonte é o app (content/datas-oficiais.json e
// content/checklist-templates.json, persona campus_france). O app vive em outro domínio
// (plataforma.imigrantepordentro.com), então o navegador não lê o JSON dele direto; em vez de manter
// uma cópia à mão, este script lê o app e escreve a cópia. Quem edita é o app, nunca o arquivo daqui.
//
// Uso (Node 18+, sem dependência):
//   node scripts/gerar-campus-france-ciclo.mjs                  lê a branch main do app pelo `gh`
//   node scripts/gerar-campus-france-ciclo.mjs --app <pasta>    lê <pasta>/content/*.json (checkout local do app)
//   node scripts/gerar-campus-france-ciclo.mjs --check          não escreve; sai com erro se a cópia estiver velha
//
// O que NÃO vem do app e fica aqui: o nome de cada nível em português (`NIVEIS`) e o ciclo do
// tecnólogo, que o app trata por cfNivel=tecnologo mas não tem data própria (usa as de l2l3).

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = path.join(ROOT, "content", "campus-france-ciclo.json");
const REPO_APP = "ingrydlts/POR-DENTRO-APP";
const BLOCO_CICLO = "etudes_en_france_2027_28";

const NIVEIS = {
  l1: "1º ano de Licence ou BUT",
  arq: "Arquitetura (ENSA)",
  l2l3: "2º ou 3º ano de Licence",
  lpro: "Licence Pro",
  master: "Master",
  escola: "Escola de engenharia ou de comércio",
  tecnologo: "Tecnólogo: nível a confirmar com os cursos",
};
// O ano da escola só é perguntado no painel; no preview o documento é um só, em texto livre.
const DOC_ESCOLA_ANO = "Documentos da graduação, conforme o ano de entrada";

function lerDoApp(arquivo) {
  const i = process.argv.indexOf("--app");
  if (i !== -1) {
    return JSON.parse(fs.readFileSync(path.resolve(process.argv[i + 1], "content", arquivo), "utf8"));
  }
  const bruto = execFileSync(
    "gh",
    ["api", "-H", "Accept: application/vnd.github.raw", `repos/${REPO_APP}/contents/content/${arquivo}?ref=main`],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return JSON.parse(bruto);
}

function falhar(msg) {
  console.error("gerar-campus-france-ciclo: " + msg);
  process.exit(1);
}

const datas = lerDoApp("datas-oficiais.json");
const templates = lerDoApp("checklist-templates.json");

const ciclo = datas.eventos && datas.eventos[BLOCO_CICLO];
if (!ciclo) falhar(`o app não tem eventos.${BLOCO_CICLO} em datas-oficiais.json`);
const itens = templates.campus_france;
if (!Array.isArray(itens)) falhar("o app não tem a persona campus_france em checklist-templates.json");

// Tecnólogo: o app não tem data própria; vale a mesma de l2l3 (decisão da proposta, seção 2.3b).
const dossieAte = { ...ciclo.dossie_ate, tecnologo: ciclo.dossie_ate.l2l3 };
const escolhasMax = { ...ciclo.escolhas_max, tecnologo: ciclo.escolhas_max.l2l3 };

// Os 12 passos: o item de cada `passo` que vale para todo mundo (sem somenteSe, fora de Documentos).
const passos = [];
for (let n = 1; n <= 12; n++) {
  const it = itens.find((x) => x.fase === "candidatura" && x.passo === n && !x.somenteSe && x.category !== "Documentos");
  if (!it) falhar(`falta o passo ${n} da fase candidatura no template do app`);
  passos.push({ n, grupo: it.category, label: it.label });
}

// Documentos: "comum" para quem não tem somenteSe.cfNivel; o resto por nível. O prefixo
// "Documento: " é do painel e sai aqui.
const tirarPrefixo = (s) => s.replace(/^Documento:\s*/, "").replace(/^./, (c) => c.toUpperCase());
const documentos = { comum: [] };
Object.keys(NIVEIS).forEach((k) => (documentos[k] = []));
for (const it of itens.filter((x) => x.fase === "candidatura" && x.category === "Documentos")) {
  const nivel = it.somenteSe && it.somenteSe.cfNivel;
  const texto = tirarPrefixo(it.label);
  if (!nivel) {
    documentos.comum.push(texto);
    continue;
  }
  const niveis = Array.isArray(nivel) ? nivel : [nivel];
  const porAno = it.somenteSe.cfEscolaAno;
  for (const k of niveis) {
    if (!documentos[k]) falhar(`documento ${it.key} aponta para o nível desconhecido ${k}`);
    // Os dois documentos de escola por ano viram uma linha só.
    if (k === "escola" && porAno) {
      if (!documentos.escola.includes(DOC_ESCOLA_ANO)) documentos.escola.push(DOC_ESCOLA_ANO);
    } else {
      documentos[k].push(texto);
    }
  }
}

const saida = {
  _comentario:
    "GERADO por scripts/gerar-campus-france-ciclo.mjs a partir de content/datas-oficiais.json (eventos." +
    BLOCO_CICLO +
    ") e content/checklist-templates.json (persona campus_france) do app POR-DENTRO-APP. Não edite à mão: mude o app e rode o script. Usado só pelo /checklist-preview/ (revelação da candidatura).",
  ciclo: ciclo.ciclo,
  abertura: ciclo.abertura,
  dossie_ate: dossieAte,
  escolhas_max: escolhasMax,
  teste_validade: ciclo.teste_validade,
  teste_resultado_ate: ciclo.teste_resultado_ate,
  respostas_ate: ciclo.respostas_ate,
  escolha_definitiva_ate: ciclo.escolha_definitiva_ate,
  fonte: ciclo.fonte,
  niveis: NIVEIS,
  passos,
  documentos,
};
const texto = JSON.stringify(saida, null, 2) + "\n";

if (process.argv.includes("--check")) {
  const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, "utf8") : "";
  if (atual !== texto) falhar("content/campus-france-ciclo.json está diferente do app. Rode: node scripts/gerar-campus-france-ciclo.mjs");
  console.log("campus-france-ciclo.json está em dia com o app.");
} else {
  fs.writeFileSync(SAIDA, texto);
  console.log("Escrito " + path.relative(ROOT, SAIDA));
}
