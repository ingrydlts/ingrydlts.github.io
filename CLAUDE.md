# Por Dentro — Website & Bot

@~/por-dentro/SHARED.md

> As regras acima (papéis Scrum, Definition of Done, fonte de verdade no Notion, o
> que nunca decidir sozinho) valem para este repositório. O que segue é só o que é
> específico do `website`/`bot`.
>
> **Nota sobre o import acima:** o caminho `@~/por-dentro/SHARED.md` é o mesmo usado
> no `CLAUDE.md` do repositório App — mantido igual aqui por consistência. Se esse
> caminho estiver errado (ver tarefa "Criar CLAUDE.md em app, site e bot importando
> o SHARED.md e corrigir o caminho" no Notion), corrigir nos dois repositórios juntos.

## Rodar localmente

```
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Este repositório

Metade pública da jornada (sem login): o bot de classificação (`assistente-de-vistos/`)
e o funil/preview por persona (`checklist-preview/`). A outra metade — onboarding →
percurso → dashboard, depois do login — vive no repositório **App**.

Dentro deste repositório, os dois papéis não são simétricos:
- `assistente-de-vistos/` é só client-side — não chama Supabase, só gera links
  (WhatsApp, Cal.com, ou o próprio `checklist-preview` com a persona na query string).
- `checklist-preview/` já é o ponto real de integração com o backend: chama
  `supabase.rpc('capturar_lead', ...)` para gravar o lead no CRM (schema em
  `db/crm-fase1b-minha-ficha.sql`, no repositório App) e `supabase.auth.signInWithOtp(...)`
  para criar a conta e disparar o magic link — usando o MESMO projeto Supabase do App,
  não um banco separado.

Ver a seção "A jornada completa" no `README.md` do App antes de mexer em qualquer
uma das duas metades — uma mudança aqui quase sempre tem espelho lá.

Repositório: `Website` ou `Bot`, dependendo da pasta (campo `Repositório` no Notion).
