# TaskForge — Brief de Arquitetura (refatoração Next.js)

## Contexto

O projeto original (vanilla JS + servidor Node artesanal) está preservado em `legacy/`
como referência de comportamento. A versão nova é **Next.js 15 (App Router) + React 19 +
TypeScript estrito**, tudo num único app. Idioma do produto e dos comentários: **pt-BR**.

## Regras gerais

- TypeScript estrito, sem `any` gratuito. Imports com alias `@/` (= `src/`).
- Nada de dependências novas sem necessidade real — o projeto é zero-dep por filosofia
  (exceto next/react/react-dom). CSS puro com custom properties (sem Tailwind).
- Server Components por padrão; `"use client"` só onde há interação/animação.
- A UI e mensagens de erro em pt-BR, mesmo tom informal do legado.

## Estrutura

```
src/
  app/
    layout.tsx            # root layout, Topbar, Footer, fontes, metadata
    globals.css           # tokens + estilos globais (ver docs/DESIGN.md)
    page.tsx              # catálogo (rota /) — redireciona p/ /entrar se não logado
    entrar/page.tsx       # login/registro
    criar/page.tsx        # criar projeto
    meus-squads/page.tsx
    projetos/[id]/page.tsx
    squads/[id]/page.tsx
    demo/page.tsx         # playground da engine (porta o legacy/public/demo-engine.html)
    api/
      auth/register/route.ts, auth/login/route.ts, auth/logout/route.ts
      me/route.ts, me/subscribe/route.ts, me/squads/route.ts
      projects/route.ts, projects/[id]/route.ts, projects/[id]/squads/route.ts
      squads/[id]/route.ts, squads/[id]/deliver/route.ts
      slots/[id]/join/route.ts, slots/[id]/leave/route.ts
  components/
    ascii/                # client components de animação (AsciiSpin, Mascot, …)
    ui/                   # TerminalWindow, Button, Card, Stamp, Modal, Toast, Field…
    …                     # Topbar, Footer, telas compostas
  hooks/                  # useAsciiAnimation etc.
  lib/
    ascii-engine/         # porte TS PURO da engine (zero DOM/React) — ver abaixo
    db/                   # node:sqlite, schema, seed, queries
    auth/                 # sessões, hash de senha, cookie
    api-client.ts         # fetch tipado usado pelos client components
    types.ts              # tipos de domínio compartilhados (User, Project, Squad, Slot)
```

## Domínio (idêntico ao legado — NÃO mudar regras de negócio)

- Usuário se registra/loga; 1º projeto grátis; depois precisa "assinar" (simulado,
  `POST /api/me/subscribe`). Erro 402 no join dispara o paywall no front.
- Projeto tem dificuldade (`iniciante`=1 semana, `intermediario`=2, `avancado`=3–4),
  funções (roles, 2–6) e squads. Squad tem 1 slot por função.
- Squad `forming` → quando o último slot é ocupado vira `active` e o prazo dispara
  (`deadlineWeeks` semanas). `deliver` com URL de repo → `delivered`
  (com flag `deliveredLate` se após o prazo).
- Sair de vaga só em `forming`. Histórico `project_entries` decide o "grátis usado".
- Conta demo: `demo@taskforge.dev` / `demo123`. Seed do banco igual ao legado.

## Banco e auth

- `node:sqlite` (`DatabaseSync`) — Node 26 no ambiente, é estável. Caminho:
  `data/taskforge.db` na raiz (mesmo do legado; respeitar env `TASKFORGE_DB`).
- Singleton do db por processo (cachear em `globalThis` p/ sobreviver ao HMR do dev).
- Sessões: token aleatório em tabela `sessions` (como no legado), MAS entregue em
  **cookie httpOnly** (`taskforge_token`, sameSite=lax, path=/) em vez de localStorage.
  Route handlers leem o cookie via `cookies()` do `next/headers`.
- Senhas: scrypt + salt, `timingSafeEqual` (copiar abordagem do legado).
- Formato de resposta da API: manter o shape do legado (`{ user }`, `{ projects }`,
  `{ error: { code, message } }` com status HTTP corretos) — o front novo é o único
  consumidor, mas o shape já é bom.

## Engine ASCII (`src/lib/ascii-engine/`)

Porte fiel de `legacy/public/js/ascii-engine.js`, decomposto em módulos TS **puros**
(zero DOM, zero React — recebem/retornam strings e números):

- `loop.ts` — makeLoop(fps, fn) usando rAF, retorna { stop }  (este pode tocar rAF,
  mas nada de DOM).
- `font.ts` — fonte figlet + bigLines/title.
- `shapes.ts` — buildDonut/Cube/Diamond/Star/Mug + cache.
- `render3d.ts` — projeção/z-buffer/luz: `renderFrame(shape, A, B, w, h, ramp): string`.
- `mascot.ts` — frames do Chico Caneca (idle/cheer/sad) + normalizeFrames.
- `meters.ts` — slotMeter(filled, total, roles): string; countdown helpers.
- `index.ts` — re-exports.

A camada React (hooks/componentes) consome esses módulos e escreve em
`ref.current.textContent` num rAF com cleanup — nunca innerHTML.

## O que cada fase entrega (contratos entre agentes)

- Fase 1A entrega `lib/ascii-engine` com as assinaturas acima.
- Fase 1B entrega `lib/db`, `lib/auth`, rotas em `app/api`, `lib/types.ts`.
- Fase 2A entrega `hooks/` + `components/ascii/` consumindo 1A.
- Fase 2B entrega `globals.css` + `components/ui/` (sem depender de 1A/1B).
- Fase 3 monta as telas em `app/` consumindo tudo + `lib/api-client.ts`.

## Verificação local

- `npm run dev` (porta 3000). Build de sanidade: `npx tsc --noEmit` e `npm run build`.
