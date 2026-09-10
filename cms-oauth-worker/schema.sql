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

-- Questionário de vagas limitadas (link do Drive) — POST/GET /api/quiz/*
-- em worker.js. quiz_counters tem 1 linha fixa ("default") com quantas
-- vagas já foram liberadas; a trava na 10ª resposta (ou no valor de
-- QUIZ_LIMIT) depende do UPDATE em worker.js ser uma única instrução SQL
-- condicional — não crie outro jeito de incrementar essa coluna.
CREATE TABLE IF NOT EXISTS quiz_counters (
  id TEXT PRIMARY KEY,
  liberadas INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO quiz_counters (id, liberadas) VALUES ('default', 0);

CREATE TABLE IF NOT EXISTS quiz_submissions (
  id TEXT PRIMARY KEY,
  name TEXT,
  instagram TEXT,
  email TEXT,
  ref TEXT,                     -- identificador do ManyChat, se veio no link (?ref=)
  answers TEXT,                  -- JSON livre com as respostas do questionário
  liberado INTEGER NOT NULL,     -- 1 = ficou entre as vagas liberadas, 0 = vagas já tinham encerrado
  posicao INTEGER,               -- em qual posição (1..QUIZ_LIMIT) essa resposta ficou, null se não liberada
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_email ON quiz_submissions(email);
CREATE INDEX IF NOT EXISTS idx_quiz_ref ON quiz_submissions(ref);
