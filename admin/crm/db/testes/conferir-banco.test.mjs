// Confere que toda tabela e função criada pelos SQL do CRM (admin/crm/db/*.sql) está em conferir-banco.sql, a consulta
// que diz se o banco (de teste ou de produção) tem tudo o que o código espera. Esse arquivo mora no repositório do app
// (db/conferir-banco.sql); SQL novo aqui com tabela ou função precisa entrar lá.
// Uso: cd admin/crm/db/testes && APP_DB_DIR=<POR-DENTRO-APP>/db node conferir-banco.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DB = process.env.APP_DB_DIR || path.resolve(HERE, '../../../../../../por-dentro-app/db');
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

const conferir = readFileSync(path.join(APP_DB, 'conferir-banco.sql'), 'utf8');
const lista = new Map([...conferir.matchAll(/\('(tabela|função)', '(\w+)', '([^']+)'\)/g)].map((m) => [m[1] + ':' + m[2], m[3]]));
const DIR = path.resolve(HERE, '..');
const faltando = [], arquivoErrado = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.sql'))) {
  const s = readFileSync(path.join(DIR, f), 'utf8');
  const objetos = [...s.matchAll(/create table if not exists\s+(?:public\.)?(\w+)/gi)].map((m) => 'tabela:' + m[1])
    .concat([...s.matchAll(/create or replace function\s+(?:public\.)?(\w+)\s*\(/gi)].map((m) => 'função:' + m[1]));
  for (const k of objetos) {
    if (!lista.has(k)) faltando.push(f + ': ' + k);
    else if (!/^db\//.test(lista.get(k)) && !lista.get(k).startsWith('admin/crm/db/')) arquivoErrado.push(k + ' → ' + lista.get(k));
  }
}
check('toda tabela e função dos SQL do CRM está em conferir-banco.sql (do app): ' + faltando.join(', '), faltando.length === 0);
check('cada item aponta um arquivo que existe em um dos dois repositórios: ' + arquivoErrado.join(', '), arquivoErrado.length === 0);
check('a lista não está vazia', lista.size > 50);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
