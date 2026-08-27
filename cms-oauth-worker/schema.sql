-- Por Dentro — banco D1 de eventos (feedback dos artigos, interações do
-- bot, blocos interativos). Usado pela rota POST /api/events em worker.js
-- e, futuramente, pelo painel /admin/dashboard/.
--
-- Como rodar: painel Cloudflare → Workers & Pages → D1 → seu banco →
-- aba "Console" → cole tudo abaixo → Execute. Ver README.md, seção
-- "Criar o banco D1 de eventos".

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,     -- 'feedback' | 'bot' | 'block' — ver ALLOWED_EVENT_TYPES em worker.js
  article_slug TEXT,            -- slug do artigo, quando aplicável (null pro assistente de vistos, que não é um artigo)
  payload TEXT,                 -- JSON livre por tipo de evento (ex.: {"vote":"up"}, {"step":"objetivo","answer":"trabalho"})
  session_id TEXT,               -- id anônimo gerado no navegador (localStorage), agrupa eventos da mesma visita sem identificar a pessoa
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(article_slug);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
