// Testa POST /api/cal/webhook: o 1:1 marcado no Cal.com vira uma linha em um_a_um (Agenda, Funil e Jornada pelo gatilho do banco).
// Tudo com fetch falso e um "banco" em memória: não chama o Supabase. Pessoas fictícias. O SQL tem teste próprio (npm run test:1a1-cal).
// Uso: node cms-oauth-worker/testes/crm-cal-webhook.test.mjs   (Node 20+, sem dependências)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'crm-cal-'));
const arq = path.join(dir, 'worker.mjs');
writeFileSync(arq, readFileSync(path.resolve(HERE, '../worker.js'), 'utf8'));
const mod = await import(pathToFileURL(arq).href);
rmSync(dir, { recursive: true, force: true });
const worker = mod.default;

let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }
const SEGREDO = 'segredo-de-teste-do-cal';
const env = { CAL_WEBHOOK_SECRET: SEGREDO, SUPABASE_SERVICE_ROLE_KEY: 'srv', REVIEWS_KV: { get: async () => null, put: async () => {} } };
console.error = () => {};

// ---- "banco" em memória ----
let contatos, um, chamadas, falhar;
function zerar() { contatos = [{ id: 'c-ana', email: 'ana@example.com', nome: 'Ana Souza' }]; um = []; chamadas = []; falhar = null; }
function instalar() {
  globalThis.fetch = async (url, opt = {}) => {
    const u = new URL(String(url)), metodo = opt.method || 'GET', body = typeof opt.body === 'string' ? JSON.parse(opt.body) : null;
    chamadas.push({ url: String(url), metodo, body, headers: opt.headers || {} });
    const r = (status, b) => new Response(status === 204 ? null : JSON.stringify(b ?? {}), { status });
    if (falhar && falhar(u, metodo)) return r(500, { msg: 'falha de teste' });
    if (u.pathname.endsWith('/rest/v1/contatos')) {
      if (metodo === 'GET') { const e = (u.searchParams.get('email') || '').replace(/^eq\./, ''); return r(200, contatos.filter((c) => c.email === e).map((c) => ({ id: c.id }))); }
      if (metodo === 'POST') {
        if (contatos.some((c) => c.email === body.email)) return r(201, []);   // ignore-duplicates
        const c = { id: 'c-' + (contatos.length + 1), ...body }; contatos.push(c); return r(201, [{ id: c.id }]);
      }
    }
    if (u.pathname.endsWith('/rest/v1/um_a_um')) {
      if (metodo === 'GET') {
        const cods = (u.searchParams.get('cal_uid') || '').replace(/^in\.\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, ''));
        return r(200, um.filter((x) => cods.includes(x.cal_uid)).slice(0, 1).map((x) => ({ id: x.id, status: x.status })));
      }
      if (metodo === 'POST') {
        if (um.some((x) => x.cal_uid && x.cal_uid === body.cal_uid)) return r(409, { code: '23505' });
        um.push({ id: um.length + 1, ...body }); return r(201, null);
      }
      if (metodo === 'PATCH') {
        const id = (u.searchParams.get('id') || '').replace(/^eq\./, ''), uid = (u.searchParams.get('cal_uid') || '').replace(/^eq\./, ''), st = (u.searchParams.get('status') || '').replace(/^eq\./, '');
        const alvo = um.filter((x) => (id ? String(x.id) === id : x.cal_uid === uid) && (!st || x.status === st));
        alvo.forEach((x) => Object.assign(x, body));
        return r(200, alvo.map((x) => ({ id: x.id })));
      }
    }
    return r(404, {});
  };
}

const assina = (corpo, seg = SEGREDO) => createHmac('sha256', seg).update(corpo).digest('hex');
const enviar = (obj, o = {}) => {
  const corpo = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const h = { 'Content-Type': 'application/json', 'X-Cal-Signature-256': o.assinatura ?? assina(corpo) };
  if (o.semAssinatura) delete h['X-Cal-Signature-256'];
  return worker.fetch(new Request('https://w.example/api/cal/webhook', { method: o.metodo || 'POST', headers: h, ...(o.metodo === 'GET' ? {} : { body: corpo }) }), o.env || env, { waitUntil() {} });
};
const reserva = (extra = {}, gatilho = 'BOOKING_CREATED') => ({
  triggerEvent: gatilho, createdAt: '2026-11-20T15:30:00.000Z',
  payload: {
    type: '1-1', title: '1:1 (20 min) between Ingryd Silva and Wellington Souza', uid: 'uid-1', startTime: '2026-11-23T14:40:00.000Z', endTime: '2026-11-23T15:00:00.000Z',
    additionalNotes: 'Preciso ligar na CPAM\ne meu francês não é fluente.',
    organizer: { name: 'Ingryd Silva', email: 'organizadora@example.com' },
    attendees: [{ name: 'Wellington Souza', email: 'Wellington@Example.com ' }], ...extra,
  },
});
const postsUm = () => chamadas.filter((c) => c.metodo === 'POST' && c.url.endsWith('/rest/v1/um_a_um'));
const contatosCriados = () => chamadas.filter((c) => c.metodo === 'POST' && c.url.includes('/rest/v1/contatos'));

console.log('== Assinatura e configuração ==');
zerar(); instalar();
let res = await enviar(reserva(), { env: { ...env, CAL_WEBHOOK_SECRET: undefined } });
check('sem CAL_WEBHOOK_SECRET no Worker: 500 e nada gravado', res.status === 500 && !chamadas.length);
res = await enviar(reserva(), { env: { ...env, SUPABASE_SERVICE_ROLE_KEY: undefined } });
check('sem a chave do Supabase: 500 e nada gravado', res.status === 500 && !chamadas.length);
res = await enviar(reserva(), { semAssinatura: true });
check('sem cabeçalho de assinatura: 400 e nada gravado', res.status === 400 && !chamadas.length);
res = await enviar(reserva(), { assinatura: assina(JSON.stringify(reserva()), 'outro-segredo') });
check('assinatura de outro segredo: 400 e nada gravado', res.status === 400 && !chamadas.length);
res = await enviar(reserva(), { assinatura: 'a'.repeat(64) });
check('assinatura do tamanho certo mas errada: 400', res.status === 400 && !chamadas.length);
const corpoAlterado = JSON.stringify(reserva());
res = await enviar(corpoAlterado.replace('uid-1', 'uid-2'), { assinatura: assina(corpoAlterado) });
check('corpo mexido depois de assinado: 400', res.status === 400 && !chamadas.length);
res = await enviar(reserva(), { assinatura: assina(JSON.stringify(reserva())).toUpperCase() });
check('assinatura em maiúsculas vale (o hexadecimal não diferencia)', res.status === 200);
zerar();
res = await enviar('isto não é json');
check('corpo que não é JSON (mesmo assinado): 400', res.status === 400 && !chamadas.length);
res = await enviar(reserva(), { metodo: 'GET' });
check('GET não chega ao webhook (só POST)', res.status !== 200 || !chamadas.length);

console.log('\n== Gatilhos e tipos de evento que não são nossos ==');
zerar(); instalar();
res = await enviar({ triggerEvent: 'PING', createdAt: '2026-11-20T15:30:00.000Z', payload: {} });
check('PING (botão de teste do Cal.com): 200, nada gravado', res.status === 200 && !chamadas.length);
res = await enviar(reserva({}, 'MEETING_ENDED'));
check('outro gatilho: 200 ignorado, nada gravado', res.status === 200 && (await res.json()).ignorado === true && !chamadas.length);
res = await enviar(reserva({ type: 'bate-papo-30', title: 'Bate-papo de 30 min' }));
check('outro tipo de evento do Cal.com: 200 ignorado, nada gravado', res.status === 200 && (await res.json()).ignorado === true && !chamadas.length);
res = await enviar(reserva({ type: undefined, title: '1:1 (40 min) between Ingryd Silva and Ana' }));
check('sem slug mas com título "1:1 (…)": vale como 1:1', res.status === 200 && um.length === 1);
zerar();
res = await enviar(reserva({ uid: undefined }));
check('reserva sem código: 400', res.status === 400 && !chamadas.length);
res = await enviar(reserva({ uid: 'x'.repeat(101) }));
check('código com mais de 100 caracteres: 400', res.status === 400 && !chamadas.length);
res = await enviar(reserva({ startTime: 'ontem' }));
check('data inválida: 400', res.status === 400 && !postsUm().length);
res = await enviar(reserva({ attendees: [{ name: 'Ingryd', email: 'Organizadora@example.com' }] }));
check('só a organizadora na reserva (sem convidado): 200 ignorado, nada gravado', res.status === 200 && (await res.json()).ignorado === true && !um.length && !contatosCriados().length);
res = await enviar(reserva({ attendees: [{ name: 'Sem e-mail', email: 'não-é-email' }] }));
check('convidado sem e-mail válido: 200 ignorado, nada gravado', res.status === 200 && !um.length);

console.log('\n== Marcou: ficha nova ==');
zerar(); instalar();
res = await enviar(reserva());
let j = await res.json();
check('200 e { ok, criado }, sem devolver nada da ficha', res.status === 200 && j.ok === true && j.criado === true && !('contato_id' in j));
check('abriu a ficha pelo e-mail da reserva, em minúsculas e sem espaço, com origem "cal"', contatos.length === 2 && contatos[1].email === 'wellington@example.com' && contatos[1].origem === 'cal' && contatos[1].nome === 'Wellington Souza');
check('gravou um_a_um agendado, com a data certa em UTC e o código da reserva', um.length === 1 && um[0].status === 'agendado' && um[0].quando === '2026-11-23T14:40:00.000Z' && um[0].cal_uid === 'uid-1' && um[0].contato_id === contatos[1].id);
check('a nota diz que veio do Cal.com, com os minutos e o que ela escreveu (sem quebra de linha)', um[0].nota === 'Marcado pelo Cal.com (20 min). Nota dela: Preciso ligar na CPAM e meu francês não é fluente.');
check('as chamadas ao Supabase vão com a chave de serviço', chamadas.every((c) => c.headers.Authorization === 'Bearer srv'));

console.log('\n== Marcou: ficha que já existe ==');
zerar(); instalar();
res = await enviar(reserva({ attendees: [{ name: 'Ana S.', email: 'ANA@example.com' }], uid: 'uid-ana' }));
check('usa a ficha da Ana, sem abrir outra', res.status === 200 && contatos.length === 1 && !contatosCriados().length && um[0].contato_id === 'c-ana');
check('o nome do Cal.com não sobrescreve o da ficha', contatos[0].nome === 'Ana Souza');

console.log('\n== Reenvio do mesmo aviso ==');
zerar(); instalar();
await enviar(reserva()); res = await enviar(reserva()); j = await res.json();
check('o 2º aviso da mesma reserva atualiza, não duplica', res.status === 200 && j.atualizado === true && um.length === 1 && contatos.length === 2);
check('duas chamadas ao mesmo tempo: a segunda cai no 409 e só atualiza', await (async () => {
  zerar(); instalar();
  // faz a leitura inicial da 2ª chamada achar "nada", como se a 1ª ainda não tivesse gravado
  const base = globalThis.fetch; let primeiraLeitura = true;
  globalThis.fetch = async (url, opt = {}) => {
    const u = new URL(String(url));
    if (u.pathname.endsWith('/rest/v1/um_a_um') && (opt.method || 'GET') === 'GET' && primeiraLeitura) { primeiraLeitura = false; return new Response('[]', { status: 200 }); }
    return base(url, opt);
  };
  um.push({ id: 1, contato_id: 'c-ana', cal_uid: 'uid-1', status: 'agendado', quando: '2026-11-22T10:00:00.000Z' });
  const r = await enviar(reserva()); const b = await r.json();
  return r.status === 200 && b.atualizado === true && um.length === 1 && um[0].quando === '2026-11-23T14:40:00.000Z';
})());

console.log('\n== Remarcou ==');
zerar(); instalar();
await enviar(reserva());
res = await enviar(reserva({ uid: 'uid-2', rescheduleUid: 'uid-1', startTime: '2026-11-25T09:00:00.000Z', endTime: '2026-11-25T09:20:00.000Z' }, 'BOOKING_RESCHEDULED'));
j = await res.json();
check('acha a linha pelo código da reserva antiga e troca data e código', res.status === 200 && j.atualizado === true && um.length === 1 && um[0].cal_uid === 'uid-2' && um[0].quando === '2026-11-25T09:00:00.000Z' && um[0].status === 'agendado');
check('remarcar não abre ficha nem linha nova', contatos.length === 2 && postsUm().length === 1);
zerar(); instalar();
res = await enviar(reserva({ uid: 'uid-9', rescheduleUid: 'uid-que-nao-conheco' }, 'BOOKING_RESCHEDULED'));
check('remarcação de uma reserva que o CRM nunca viu entra como 1:1 novo', res.status === 200 && um.length === 1 && um[0].cal_uid === 'uid-9');
zerar(); instalar();
um.push({ id: 1, contato_id: 'c-ana', cal_uid: 'uid-1', status: 'cancelado', quando: '2026-11-22T10:00:00.000Z' });
await enviar(reserva({ uid: 'uid-1', startTime: '2026-11-26T09:00:00.000Z' }));
check('reserva cancelada que volta a ser marcada fica agendada de novo', um[0].status === 'agendado' && um[0].quando === '2026-11-26T09:00:00.000Z');
zerar(); instalar();
um.push({ id: 1, contato_id: 'c-ana', cal_uid: 'uid-1', status: 'feito', quando: '2026-11-22T10:00:00.000Z' });
await enviar(reserva({ uid: 'uid-1', startTime: '2026-11-26T09:00:00.000Z' }));
check('um 1:1 já feito não volta a agendado nem muda de data por aviso atrasado', um[0].status === 'feito' && um[0].quando === '2026-11-22T10:00:00.000Z');

console.log('\n== Cancelou ==');
zerar(); instalar();
await enviar(reserva());
res = await enviar(reserva({}, 'BOOKING_CANCELLED')); j = await res.json();
check('marca a linha da reserva como cancelada', res.status === 200 && j.cancelado === 1 && um[0].status === 'cancelado');
res = await enviar(reserva({}, 'BOOKING_CANCELLED')); j = await res.json();
check('cancelar de novo não faz nada (e não dá erro)', res.status === 200 && j.cancelado === 0);
zerar(); instalar();
um.push({ id: 1, contato_id: 'c-ana', cal_uid: 'uid-1', status: 'feito', quando: '2026-11-22T10:00:00.000Z' });
await enviar(reserva({}, 'BOOKING_CANCELLED'));
check('um 1:1 já feito nunca é cancelado por um aviso', um[0].status === 'feito');
zerar(); instalar();
res = await enviar(reserva({ uid: 'uid-que-nao-conheco' }, 'BOOKING_CANCELLED'));
check('cancelar uma reserva que o CRM nunca viu: 200, nada criado', res.status === 200 && !um.length && !contatosCriados().length);

console.log('\n== Falhas do Supabase viram 500 (o Cal.com pode tentar de novo) ==');
zerar(); instalar(); falhar = (u, m) => u.pathname.endsWith('/um_a_um') && m === 'POST';
res = await enviar(reserva());
check('não conseguiu gravar o 1:1: 500 e mensagem sem detalhe interno', res.status === 500 && JSON.stringify(await res.json()) === '{"error":"Não consegui gravar o 1:1."}');
zerar(); instalar(); falhar = (u, m) => u.pathname.endsWith('/contatos') && m === 'POST';
res = await enviar(reserva({ attendees: [{ name: 'Novo', email: 'novo@example.com' }] }));
check('não conseguiu abrir a ficha: 500 e nada em um_a_um', res.status === 500 && !um.length);
zerar(); instalar(); falhar = (u, m) => u.pathname.endsWith('/um_a_um') && m === 'GET';
res = await enviar(reserva());
check('não conseguiu ler um_a_um: 500 e nada duplicado', res.status === 500 && !um.length);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
