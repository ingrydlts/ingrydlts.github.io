// Registro de funis (admin/crm/funis.js): paridade das etapas com o Worker e com o Estúdio, e o "próximo e-mail" de quem chegou por um guia.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = await import(pathToFileURL(path.resolve(HERE, '../../funis.js')).href);
const worker = fs.readFileSync(path.resolve(HERE, '../../../../cms-oauth-worker/worker.js'), 'utf8');
const estudio = fs.readFileSync(path.resolve(HERE, '../../estudio.js'), 'utf8');
let ok = 0; const t = (n, f) => { f(); ok++; console.log('ok -', n); };

t('toda etapa do registro existe no Worker (CRM_ETAPAS_GUIA) e no Estúdio', () => {
  for (const f of Object.values(F.FUNIS)) for (const k of Object.keys(f.etapas)) {
    assert.ok(worker.includes("'" + k + "'") || worker.includes('"' + k + '"'), 'Worker não conhece ' + k);
    const base = k.slice(k.indexOf('-') + 1).replace(/-/g, '_');
    assert.ok(estudio.includes(base), 'Estúdio não conhece ' + k);
  }
});
t('etapas do tecnólogo: 4, com prefixo tec- e uma trilha por etapa', () => {
  const f = F.funilDe('guia-tecnologo'); assert.equal(Object.keys(f.etapas).length, 4);
  for (const k of Object.keys(f.etapas)) { assert.ok(k.startsWith('tec-')); assert.equal(f.trilha[k].length, 1); }
});
t('origem desconhecida ou propriedade herdada não vira funil', () => { assert.equal(F.funilDe('bot'), null); assert.equal(F.funilDe('constructor'), null); });
const f = F.funilDe('guia-tecnologo'), on = { envio_ligado: true, no_ar: true, nome: 'x' };
t('modelo do guia não existe: avisa e não manda boas-vindas', () => {
  const p = F.proximoDoFunil(f, 'tec-nao-sei', [], {}); assert.equal(p.quando, 'nao'); assert.match(p.angulo, /link da plataforma/);
});
t('desligado: manda ligar', () => {
  const p = F.proximoDoFunil(f, '', [], { tec_recap_30min: { ...on, envio_ligado: false } }); assert.equal(p.quando, 'nao'); assert.match(p.titulo, /desligado/);
});
t('ligado e recém-chegada: espera o e-mail sair sozinho e cita a etapa', () => {
  const p = F.proximoDoFunil(f, 'tec-escrevi', [], { tec_recap_30min: on }); assert.equal(p.quando, 'esperar'); assert.match(p.angulo, /já escreveu para escolas/);
});
t('depois do recap, a trilha é a da etapa dela', () => {
  const m = { tec_recap_30min: on, tec_d3_resposta: { ...on, nome: 'D3 resposta' }, tec_d3_nao_sei: on };
  const p = F.proximoDoFunil(f, 'tec-resposta', ['tec_recap_30min'], m); assert.match(p.angulo, /D3 resposta/); assert.equal(p.quando, 'esperar');
});
t('sem etapa: só o primeiro e-mail, pede conversa', () => {
  const p = F.proximoDoFunil(f, '', ['tec_recap_30min'], { tec_recap_30min: on }); assert.match(p.titulo, /não marcou a etapa/);
});
t('trilha concluída: devolve null (regras normais da ficha)', () => {
  assert.equal(F.proximoDoFunil(f, 'tec-resposta', ['tec_recap_30min', 'tec_d3_resposta'], { tec_recap_30min: on }), null);
});
t('funil manual (VLS-TS) não é tratado como automático', () => { assert.equal(F.proximoDoFunil(F.funilDe('guia-vls-ts'), '', [], {}), null); });
console.log(ok + ' passaram');
