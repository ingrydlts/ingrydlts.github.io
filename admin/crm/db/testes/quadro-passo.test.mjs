// O quadro do passo do CRM mostra o que o app mostra: para que serve, atenção, passo a passo e links. Dados inventados.
// Uso: cd admin/crm/db/testes && node quadro-passo.test.mjs   (com APP_DB_DIR=<app>/db confere também se guias-detalhe.json está em dia)
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as FH from '../../ficha-html.js';
import { extrairDetalhe } from '../../gerar-guias-detalhe.mjs';
let ok = 0, bad = 0; const check = (l, c) => { if (c) ok++; else { bad++; console.log('  FALHOU:', l); } };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const h = { esc: (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), fmtDay: (s) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) };
const GUIA = { c: 'Licence', l: 'Fazer o teste', q: 'Antes de se candidatar', p: 'Sem o resultado a universidade nem analisa. Edição {ciclo}.', t: 'Para o 1º ano, o teste é o TCF DAP.', s: ['Confirme a página do curso.', 'Inscreva-se <b>já</b>.'],
  k: [{ l: 'TCF DAP', u: 'https://exemplo.org/tcf' }, { l: 'Golpe', u: 'javascript:alert(1)' }, { l: 'Guia novo', f: 1 }] };
const ITEM = { step_key: 'lic_tcf', label: 'Fazer o teste de francês', titulo_custom: null, nota_custom: null, status: 'pendente', due_date: null, category: 'Licence' };

console.log('== Conteúdo ==');
{
  const q = FH.htmlQuadroPasso({ item: ITEM, guia: GUIA, hoje: '2026-11-17' }, h);
  check('é um diálogo com título, categoria e botão de fechar', /role="dialog"/.test(q) && /aria-modal="true"/.test(q) && /class="qd-kick">Licence/.test(q) && /Fazer o teste de francês/.test(q) && /data-fx="qdFechar"/.test(q));
  check('sem prazo marcado, mostra o "quando" do guia; status Pendente', /qd-chip prazo[^>]*>[\s\S]*?Antes de se candidatar/.test(q) && />Pendente</.test(q));
  check('"Por que importa" e "Atenção" aparecem, e o marcador {ciclo} do app não aparece solto', /Por que importa/.test(q) && /Atenção/.test(q) && !/\{ciclo\}/.test(q) && /Edição\./.test(q));
  check('passo a passo numerado e texto escapado (nada de HTML vivo)', (q.match(/<li><span>/g) || []).length === 2 && q.includes('&lt;b&gt;já&lt;/b&gt;') && !q.includes('<b>já</b>'));
  check('só link https vira link (com noopener); javascript: some; "em breve" não é link', /href="https:\/\/exemplo\.org\/tcf"[^>]*rel="noopener noreferrer"/.test(q) && !/javascript:/.test(q) && /Guia novo · em breve/.test(q) && !/Golpe/.test(q));
  check('rodapé: avisa que é o que ela vê e oferece Editar texto', /É isto que ela vê no app/.test(q) && /data-fx="ckEditar" data-id="lic_tcf"/.test(q));
}
console.log('== Estados ==');
{
  const feito = FH.htmlQuadroPasso({ item: Object.assign({}, ITEM, { status: 'concluido', due_date: '2026-11-01' }), guia: GUIA, hoje: '2026-11-17' }, h);
  check('concluído: chip verde e o prazo vencido não vira "atrasado"', /qd-chip ok/.test(feito) && !/atraso/.test(feito) && /até 01\/11\/2026/.test(feito));
  const atr = FH.htmlQuadroPasso({ item: Object.assign({}, ITEM, { due_date: '2026-11-10' }), guia: GUIA, hoje: '2026-11-17' }, h);
  check('pendente com prazo vencido: "atrasado · data" em vermelho', /qd-chip prazo atraso[^>]*>[\s\S]*?atrasado · 10\/11\/2026/.test(atr));
  const arq = FH.htmlQuadroPasso({ item: Object.assign({}, ITEM, { status: 'arquivado' }), guia: GUIA, hoje: '2026-11-17' }, h);
  check('arquivado por ela', /Arquivado por ela/.test(arq));
  const sem = FH.htmlQuadroPasso({ item: Object.assign({}, ITEM, { titulo_custom: 'Meu texto', nota_custom: 'Ligar antes <b>x</b>' }), guia: null, hoje: '2026-11-17' }, h);
  check('sem guia no app: vazio honesto; usa o texto editado e a observação (escapada)', /Este passo não tem guia no app/.test(sem) && /Meu texto/.test(sem) && /Ligar antes &lt;b&gt;x&lt;\/b&gt;/.test(sem) && !/Por que importa/.test(sem) && /e a observação/.test(sem));
}
console.log('== Gerador ==');
{
  const t = { campus_france: [{ key: 'a', category: 'Preparar', label: 'A', quando: 'Agora', paraQueServe: 'P', tip: 'T', steps: ['1', '2'], links: [{ label: 'L', url: 'https://x.org' }, { label: 'Futuro', futuro: true }, { label: 'Sem url' }] }, { key: 'a', label: 'Repetida' }, { key: 'b', label: 'B' }], profissao_regulamentada: { x: [{ key: 'c', label: 'C', steps: ['z'] }] } };
  const d = extrairDetalhe(t);
  check('primeira ocorrência da chave vence; vem de listas e de profissao_regulamentada', Object.keys(d).join() === 'a,b,c' && d.a.l === 'A');
  check('campos curtos (c,l,q,p,t,s,k) e links válidos; passo sem guia fica só com categoria e rótulo', d.a.q === 'Agora' && d.a.p === 'P' && d.a.t === 'T' && d.a.s.length === 2 && d.a.k.length === 2 && d.a.k[1].f === 1 && !('s' in d.b) && !('k' in d.b));
  const app = path.resolve(process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db'), '..', 'content/checklist-templates.json');
  if (existsSync(app)) check('guias-detalhe.json está em dia com o app (rode node admin/crm/gerar-guias-detalhe.mjs <app>)', JSON.stringify(extrairDetalhe(JSON.parse(readFileSync(app, 'utf8')))) === readFileSync(path.resolve(HERE, '../../guias-detalhe.json'), 'utf8'));
  else console.log('  (app não encontrado: conferência de guias-detalhe.json pulada)');
}
console.log('\n' + (bad ? 'FALHOU' : 'ok') + ': ' + ok + ' verificações' + (bad ? ', ' + bad + ' falhas' : ''));
process.exit(bad ? 1 : 0);
