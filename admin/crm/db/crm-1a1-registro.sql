-- O REGISTRO DO 1:1: o que a Ingryd anota durante e depois da conversa (painel "Registro do 1:1" da ficha).
-- Rode DEPOIS de crm-fase2.sql (que cria um_a_um). Pode rodar de novo sem estragar nada.
--
-- Como se liga às outras tabelas: o registro é UM por conversa, então mora na própria linha de um_a_um (coluna `registro`), e não numa
-- tabela à parte. Assim ele herda de graça o que a conversa já tem: a chave para o contato (um_a_um.contato_id -> contatos.id), a RLS "só admin"
-- e o apagamento em cascata (apagar o contato apaga as conversas e, com elas, o registro: direito ao apagamento). Nenhum join novo, nenhuma
-- política nova, nenhuma função security definer.
--
-- Formato (o crm.js grava o documento inteiro de uma vez; `perguntas` guarda o roteiro que valia NAQUELE dia, por isso é um trecho de dados
-- e não uma ligação com outra tabela: se o roteiro mudar depois, o registro antigo continua dizendo o que foi perguntado):
--   origem            'I01'..'I09' (código da página de entrada) ou nulo
--   perguntas         até 40 itens { k, l }: a chave do dado e o rótulo da pergunta
--   identificadas     até 40 chaves já respondidas pela pessoa antes da conversa
--   conclusao         até 1500 caracteres
--   encaminhamento    até 1500 caracteres
--   interesse         'sim' | 'talvez' | 'nao' ou nulo (= ainda não sei)
--   link_enviado      verdadeiro/falso
--   link_enviado_em   data e hora (texto ISO) ou nulo
--   atualizado_em     data e hora (texto ISO)

create or replace function public.um_a_um_registro_ok(p jsonb) returns boolean
language sql immutable
set search_path = pg_catalog, public
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k
      where k <> all (array['origem', 'perguntas', 'identificadas', 'conclusao', 'encaminhamento', 'interesse', 'link_enviado', 'link_enviado_em', 'atualizado_em']))
    and (not p ? 'origem' or jsonb_typeof(p->'origem') = 'null' or (jsonb_typeof(p->'origem') = 'string' and (p->>'origem') ~ '^I0[0-9]$'))
    and (not p ? 'perguntas' or (jsonb_typeof(p->'perguntas') = 'array' and jsonb_array_length(p->'perguntas') <= 40
      and not exists (select 1 from jsonb_array_elements(p->'perguntas') e
        where jsonb_typeof(e) <> 'object'
           or exists (select 1 from jsonb_object_keys(e) k where k <> all (array['k', 'l']))
           or jsonb_typeof(e->'k') <> 'string' or length(e->>'k') not between 1 and 80
           or (e ? 'l' and (jsonb_typeof(e->'l') <> 'string' or length(e->>'l') > 200)))))
    and (not p ? 'identificadas' or (jsonb_typeof(p->'identificadas') = 'array' and jsonb_array_length(p->'identificadas') <= 40
      and not exists (select 1 from jsonb_array_elements(p->'identificadas') e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 80)))
    and (not p ? 'conclusao' or (jsonb_typeof(p->'conclusao') = 'string' and length(p->>'conclusao') <= 1500))
    and (not p ? 'encaminhamento' or (jsonb_typeof(p->'encaminhamento') = 'string' and length(p->>'encaminhamento') <= 1500))
    and (not p ? 'interesse' or jsonb_typeof(p->'interesse') = 'null' or (jsonb_typeof(p->'interesse') = 'string' and (p->>'interesse') in ('sim', 'talvez', 'nao')))
    and (not p ? 'link_enviado' or jsonb_typeof(p->'link_enviado') = 'boolean')
    and (not p ? 'link_enviado_em' or jsonb_typeof(p->'link_enviado_em') = 'null' or (jsonb_typeof(p->'link_enviado_em') = 'string' and length(p->>'link_enviado_em') <= 40))
    and (not p ? 'atualizado_em' or (jsonb_typeof(p->'atualizado_em') = 'string' and length(p->>'atualizado_em') <= 40))
  );
$$;

alter table public.um_a_um add column if not exists registro jsonb;
alter table public.um_a_um drop constraint if exists um_a_um_registro_check;
alter table public.um_a_um add constraint um_a_um_registro_check check (public.um_a_um_registro_ok(registro));
