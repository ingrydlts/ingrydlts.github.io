// Uso da plataforma por pessoa, calculado sobre os cliques que a ficha já carrega (plataforma_cliques, os 300 mais recentes).
// Módulo puro, sem DOM e sem Supabase. Testado em db/testes/ficha-uso.test.mjs.
export const JANELA_DIAS = 30;
export const PAUSA_MIN = 30;   // mais que isto entre dois cliques do mesmo id = outra sessão (aba/PWA aberta por dias)
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
  const limite = agora - JANELA_DIAS * DIA, porId = new Map();
  validos.forEach((c) => {
    if (c.ms < limite) return;
    if (!c.sessao) { semSessao++; return; }
    (porId.get(c.sessao) || porId.set(c.sessao, []).get(c.sessao)).push(c.ms);
  });
  // O id vem do sessionStorage do app: uma aba que fica aberta dias mantém o mesmo id. Quebra onde há pausa longa.
  const grupos = [];
  porId.forEach((tempos) => {
    tempos.sort((a, b) => a - b);
    let g = null;
    tempos.forEach((ms) => {
      if (g && ms - g.fim <= PAUSA_MIN * 60e3) { g.n++; g.fim = ms; } else { g = { n: 1, ini: ms, fim: ms }; grupos.push(g); }
    });
  });
  const sessoes = grupos.length, lista = grupos, suficiente = sessoes >= 3;
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
