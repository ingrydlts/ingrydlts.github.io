// Página inicial da ficha: sessões fixadas no topo, com toggle. Lógica pura + HTML. Uso: node ficha-home.test.mjs
import * as FX from '../../ficha.js';
import * as FH from '../../ficha-html.js';
let ok = 0, bad = 0; const check = (l, c) => { if (c) ok++; else { bad++; console.log('  FALHOU:', l); } };
const h = { esc: (x) => String(x) };
const mapa = Object.fromEntries(['chat', 'inicio', 'checklist', 'espaco', 'guias', 'perfil', 'eu', 'bilan', 'trouxe', 'sinais', 'hist', 'mais'].map((id) => [id, { titulo: 'T-' + id, sub: '', corpo: '<i>corpo-' + id + '</i>', aberto: id === 'checklist' }]));
const ord = FX.SESSOES_PADRAO;

console.log('== Lógica ==');
check('padrão: Checklist primeiro, depois Conversa e Perguntas da equipe', FX.HOME_PADRAO.join() === 'checklist,chat,inicio');
check('alternar põe no fim e tira', FX.alternarHome(['checklist'], 'perfil').join() === 'checklist,perfil' && FX.alternarHome(['checklist', 'perfil'], 'checklist').join() === 'perfil');
check('id inválido não entra; duplicata some; entrada ruim vira lista vazia', FX.alternarHome(['checklist'], 'xpto').join() === 'checklist' && FX.normalizarHome(['chat', 'chat', 'x', 3]).join() === 'chat' && FX.normalizarHome(null).length === 0);
check('não muda a lista de entrada', (() => { const a = ['chat']; FX.alternarHome(a, 'perfil'); return a.join() === 'chat'; })());
{
  const mem = {}, st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  check('sem nada guardado: home nulo (usa o padrão)', FX.lerPrefs(st).home === null);
  FX.gravarPrefs(st, { home: ['perfil', 'checklist', 'lixo'] });
  check('grava e lê, descartando o que não existe', FX.lerPrefs(st).home.join() === 'perfil,checklist');
  FX.gravarPrefs(st, { home: [] });
  check('lista vazia é uma escolha válida (nada fixado)', Array.isArray(FX.lerPrefs(st).home) && FX.lerPrefs(st).home.length === 0);
  check('storage quebrado não lança', (() => { try { FX.lerPrefs({ getItem() { throw new Error('x'); } }); FX.gravarPrefs({ setItem() { throw new Error('x'); } }, { home: ['chat'] }); return true; } catch (e) { return false; } })());
}

console.log('\n== HTML ==');
{
  const html = FH.htmlSessoes(ord, mapa, h, {}, ['checklist', 'chat']);
  const iHome = html.indexOf('class="fx-home"'), iApp = html.indexOf('fx-grupo-app'), iCk = html.indexOf('data-sessao="checklist"');
  check('a Página inicial vem antes dos grupos, e o Checklist (primeiro fixado) dentro dela', iHome > -1 && iHome < iApp && iCk > iHome && iCk < iApp);
  check('a ordem dos fixados é a escolhida', html.indexOf('data-sessao="checklist"') < html.indexOf('data-sessao="chat"') && html.indexOf('data-sessao="chat"') < iApp);
  check('cada sessão aparece UMA vez (os ids do corpo não duplicam)', ['checklist', 'chat', 'inicio', 'perfil'].every((id) => html.split('data-sessao="' + id + '"').length === 2));
  check('fixada: botão "Página inicial" ligado; não fixada: desligado', /data-fx="home" data-id="checklist" aria-pressed="true"/.test(html) && /data-fx="home" data-id="perfil" aria-pressed="false"/.test(html));
  check('rótulo escrito (nunca só cor): "Tirar ... da página inicial" / "Pôr ... na página inicial"', /Tirar T-checklist da página inicial/.test(html) && /Pôr T-perfil na página inicial/.test(html));
  check('na Página inicial as setas movem só ali (data-area="home") e não tem alça de arrastar', /data-fx="mover" data-id="checklist" data-area="home"/.test(html) && !/fx-grab[^>]*data-id="checklist"/.test(html));
  check('nos grupos, a alça de arrastar continua', /fx-grab[^>]*data-id="perfil"/.test(html));
  check('o grupo "app" não repete as fixadas: 4 sessões (espaco, guias, perfil, e... )', /fx-grupo-app[\s\S]*?4 sessões/.test(html));
  const vazio = FH.htmlSessoes(ord, mapa, h, {}, []);
  check('nada fixado: a Página inicial explica como fixar e todas as sessões seguem nos grupos', /Nada fixado/.test(vazio) && vazio.split('data-sessao="checklist"').length === 2 && /6 sessões/.test(vazio));
  check('sem o argumento "home" (chamada antiga) nada quebra', typeof FH.htmlSessoes(ord, mapa, h, {}) === 'string');
}
console.log(bad ? `\n${bad} falhou, ${ok} ok` : `\nok: ${ok} verificações`); process.exit(bad ? 1 : 0);
