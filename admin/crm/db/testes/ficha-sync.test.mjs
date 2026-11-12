// Garante que admin/crm/processos.json (cópia do catálogo de démarches do app) não saiu de sincronia.
// Com APP_DIR apontando para o repositório do app, compara com <APP_DIR>/content/checklist-templates.json (.processos).
// Sem APP_DIR, ignora e sai com sucesso (mesmo padrão do APP_DB_DIR).
//
// Uso: APP_DIR=/caminho/do/por-dentro-app node ficha-sync.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const copia = JSON.parse(readFileSync(path.resolve(HERE, '../../processos.json'), 'utf8'));
let passed = 0, failed = 0;
function check(label, cond) { if (cond) passed++; else { failed++; console.log('  FALHOU:', label); } }

check('processos.json tem as chaves do catálogo', ['definicoes', 'porCategoria', 'porItem', 'abas'].every((k) => copia[k] && typeof copia[k] === 'object'));
const dir = process.env.APP_DIR;
if (!dir) console.log('  ignorado: defina APP_DIR para comparar com o catálogo do app');
else {
  const f = path.join(dir, 'content/checklist-templates.json');
  if (!existsSync(f)) { failed++; console.log('  FALHOU: não achei', f); }
  else check('processos.json igual ao bloco processos do app', isDeepStrictEqual(copia, JSON.parse(readFileSync(f, 'utf8')).processos));
}
console.log(passed + ' passaram, ' + failed + ' falharam');
if (failed) process.exit(1);
