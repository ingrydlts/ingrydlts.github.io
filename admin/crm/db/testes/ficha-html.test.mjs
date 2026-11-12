// Testa o HTML puro da ficha v2 (admin/crm/ficha-html.js). Dados inventados (o repositório é público).
// Uso: cd admin/crm/db/testes && node ficha-html.test.mjs
import * as FH from '../../ficha-html.js';
import * as FX from '../../ficha.js';

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const h = { esc, fmtDay: (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; } };
const count = (s, re) => (s.match(re) || []).length;
const XSS = '<img src=x onerror=alert(1)>';

console.log('== Task 8: fila, header, abas, guia ==');
{
  const itens = [{ c: { id: 'c1', nome: XSS, urgencia: 'alta' }, novas: 2, proxima: 'Responder Ana', sub: 'Au pair · captação' }, { c: { id: 'c2', nome: 'Bia Lima', urgencia: 'baixa' }, novas: 0, proxima: 'Abrir a ficha' }];
  const f = FH.htmlFila(itens, 'c1', h);
  check('fila: a aberta tem aria-pressed true, a outra false', count(f, /aria-pressed="true"/g) === 1 && count(f, /aria-pressed="false"/g) === 1);
  check('fila: novas e próxima ação', f.includes('2 novas') && f.includes('Responder Ana') && !f.includes('1 nova<'));
  check('fila: HTML do nome sai escapado', f.includes('&lt;img') && !f.includes('<img'));
  check('fila: cartão abre a pessoa', f.includes('data-fx="pessoa"') && f.includes('data-id="c2"'));
  check('fila vazia tem mensagem', FH.htmlFila([], null, h).includes('Ninguém'));
  check('fila: 1 nova no singular', FH.htmlFila([{ c: { id: 'z', nome: 'Z', urgencia: 'media' }, novas: 1, proxima: 'x' }], null, h).includes('1 nova'));

  const base = { c: { id: 'c1', nome: XSS, email: 'ana@example.com', estagio: 'lead', urgencia: 'alta' }, urgLabel: 'Alta', estagioLabel: 'Lead', personaLabel: 'Au pair', cidade: 'Lyon', temConta: true, motivo: 'marcou urgência', etapa: 4,
    estagios: [{ k: 'lead', l: 'Lead' }, { k: 'em_uso', l: 'Em uso' }], chk: { pct: 40, feitos: 2, abertos: 3, vencem3: 1, adicionados: 1 }, ultima: 'hoje às 10:00' };
  const hd = FH.htmlHeader(base, h);
  check('header: 7 segmentos do funil', count(hd, /data-etapa="[1-7]"/g) === 7);
  check('header: aria-current só na etapa atual', count(hd, /aria-current="step"/g) === 1 && /data-etapa="4"[^>]*aria-current="step"|aria-current="step"[^>]*data-etapa="4"/.test(hd));
  check('header: etapa atual em texto', hd.includes('Etapa atual:') && hd.includes(FX.ETAPAS_FUNIL[3]));
  check('header: barra de progresso com o pct', /role="progressbar"[^>]*aria-valuenow="40"|aria-valuenow="40"[^>]*role="progressbar"/.test(hd));
  check('header: nome escapado', hd.includes('&lt;img') && !hd.includes('<img'));
  check('header: botões existentes (e-mail, 1:1, estágio)', hd.includes('data-emailfor="c1"') && hd.includes('data-open1a1="c1"') && hd.includes('id="stage-pick"'));
  const sem = FH.htmlHeader(Object.assign({}, base, { chk: null, temConta: false }), h);
  check('header sem conta: aviso e sem barra', sem.includes('Ela ainda não entrou no app') && !sem.includes('role="progressbar"'));
  check('header: etapa 7 não tem "próxima"', !FH.htmlHeader(Object.assign({}, base, { etapa: 7 }), h).includes('Próxima:'));

  const ab = FH.htmlAbas('plataforma', true, h);
  check('abas: três abas com data-fx', ['conversa', 'plataforma', 'ficha'].every((v) => ab.includes('data-fx="tab" data-v="' + v + '"')) && ab.includes('role="tablist"'));
  check('abas: só Plataforma selecionada', count(ab, /aria-selected="true"/g) === 1 && /data-v="plataforma"[^>]*aria-selected="true"/.test(ab));
  check('abas: selo convertida ou prévia', ab.includes('convertida') && FH.htmlAbas('ficha', false, h).includes('prévia'));
  check('abas: botão do guia', ab.includes('data-fx="tourAbrir"'));
  const tr = FH.htmlTour(true, h);
  check('guia: 4 itens e fechar', count(tr, /<li/g) === 4 && tr.includes('data-fx="tourFechar"') && FH.htmlTour(false, h) === '');
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
