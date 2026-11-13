// Uso da plataforma por pessoa, calculado sobre os cliques que a ficha já carrega (plataforma_cliques, os 300 mais recentes).
// Módulo puro, sem DOM e sem Supabase. Testado em db/testes/ficha-uso.test.mjs.
export const JANELA_DIAS = 30;
const DIA = 864e5;

// cliques: { sessao: string|null, criado_em: string }[]; agora: ms.
// Duração é ESTIMADA: do primeiro ao último clique de cada sessão (não é o tempo real de leitura).
export function calcularUso(cliques, agora) {
  const validos = [];
  let semSessao = 0;
  (cliques || []).forEach((c) => {
    const ms = Date.parse(c && c.criado_em);
    if (!Number.isFinite(ms) || ms > agora) return;   // data inválida ou no futuro: ignora
    validos.push({ ms, sessao: c.sessao ? String(c.sessao) : '' });
  });
  const ultimoMs = validos.reduce((m, c) => Math.max(m, c.ms), 0);
  const limite = agora - JANELA_DIAS * DIA, grupos = new Map();
  validos.forEach((c) => {
    if (c.ms < limite) return;
    if (!c.sessao) { semSessao++; return; }
    const g = grupos.get(c.sessao) || { n: 0, ini: c.ms, fim: c.ms };
    g.n++; g.ini = Math.min(g.ini, c.ms); g.fim = Math.max(g.fim, c.ms);
    grupos.set(c.sessao, g);
  });
  const sessoes = grupos.size, lista = [...grupos.values()], suficiente = sessoes >= 3;
  const longas = lista.filter((g) => g.n >= 2);
  const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    sessoes, semSessao,
    cliquesPorSessao: suficiente ? Math.round(media(lista.map((g) => g.n)) * 10) / 10 : null,
    duracaoSeg: suficiente && longas.length ? Math.round(media(longas.map((g) => (g.fim - g.ini) / 1000))) : null,
    ultimaEm: ultimoMs ? new Date(ultimoMs).toISOString() : null,
    diasDesdeUltima: ultimoMs ? Math.floor((agora - ultimoMs) / DIA) : null,
    suficiente
  };
}
