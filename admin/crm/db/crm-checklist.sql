-- Por Dentro — CRM: o checklist de cada pessoa dentro do dossiê
-- Rode no SQL Editor do Supabase, DEPOIS de crm-fase2.sql e do schema do app (usa checklist_items e eh_admin()).
-- Idempotente e só acrescenta: não apaga nem reescreve dado nenhum.
--
-- O checklist de cada pessoa mora em checklist_items, que só o dono lê (RLS do app). Esta política deixa VOCÊ
-- (admin) ler as linhas de todas, para o dossiê mostrar o andamento. É só leitura: quem marca ou desmarca
-- continua sendo a própria pessoa. Os cliques dela no checklist já vêm de plataforma_cliques (crm-plataforma.sql).

drop policy if exists "checklist_items: admin lê" on public.checklist_items;
create policy "checklist_items: admin lê" on public.checklist_items
  for select using (public.eh_admin());
