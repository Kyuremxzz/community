# TaskForge — Brief de Design (v2, aprovado pelo dono do produto)

## Direção

**Dark minimal + terminal Apple + traços cartoon sutis.**
O site deixa de ser "papel de cartaz anos 1930" e vira um produto moderno, escuro e
minimalista, onde as animações ASCII rodam **dentro de janelas de terminal estilo macOS**
— esse é o elemento de identidade. ASCII é tempero, não matéria-prima: nada de moldura
"boiling" em todo card nem logo em ASCII gigante. Poucos pontos focais, bem executados.

## Tokens (CSS custom properties em `src/app/globals.css`)

```css
:root {
  /* superfícies */
  --bg: #0e0e11;            /* fundo da página, grafite profundo */
  --bg-elevated: #16161a;   /* cards, seções */
  --terminal-bg: #1c1c21;   /* corpo das janelas de terminal */
  --terminal-header: #2a2a30;
  --border: #2c2c33;        /* bordas 1px sutis */
  --border-strong: #3f3f48;

  /* texto */
  --text: #ececf1;
  --text-secondary: #a0a0ab;
  --text-tertiary: #6e6e78;

  /* accent — vermelho-coral (herda o DNA do #b8321f antigo) */
  --accent: #ff6b57;
  --accent-hover: #ff8271;
  --accent-muted: rgba(255, 107, 87, 0.14);

  /* apoio (usados com parcimônia em carimbos/status) */
  --teal: #4fd8c2;
  --gold: #e8b04a;
  --green: #38d977;

  /* traffic lights macOS */
  --tl-red: #ff5f57;
  --tl-yellow: #febc2e;
  --tl-green: #28c840;

  /* tipografia */
  --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  --font-mono: "SF Mono", ui-monospace, "Cascadia Mono", Menlo, monospace;

  /* geometria */
  --radius: 10px;           /* cantos arredondados padrão */
  --radius-lg: 14px;        /* janelas de terminal */
  --space: 8px;             /* escala de espaçamento: múltiplos de 8 */
  --container: 1100px;
}
```

## A janela de terminal (componente-chave: `<TerminalWindow>`)

Réplica minimalista do Terminal.app:
- Cantos arredondados `--radius-lg`, borda 1px `--border`, sombra suave difusa
  (`0 16px 48px rgba(0,0,0,.5)`) — **nada de sombra dura de cartoon aqui**.
- Barra de título: fundo `--terminal-header`, 3 traffic lights (12px, cores `--tl-*`)
  à esquerda, título centralizado em mono 11px `--text-tertiary`
  (ex.: `chico@taskforge — zsh`).
- Corpo: `--terminal-bg`, padding 16px, conteúdo `<pre>` mono. As formas 3D ASCII,
  o mascote, o countdown e o slot meter vivem AQUI dentro.
- Variação de cor do texto ASCII por contexto: coral (prazo), teal (entregue),
  âmbar (aguardando), texto padrão (neutro).

## Onde o ASCII aparece (e onde NÃO aparece)

APARECE (dosado):
1. **Hero do login/landing**: um TerminalWindow com a forma 3D girando + tagline em
   typewriter. É o momento "uau".
2. **Vitrine de dificuldades** no catálogo: 3 terminais pequenos com donut/cubo/diamante.
3. **Countdown do prazo** na tela do squad: dígitos figlet dentro de terminal (coral).
4. **Slot meter do squad**: fichas ASCII dentro de terminal.
5. **Mascote Chico Caneca**: empty states, paywall e celebração de entrega.
6. Detalhes tipográficos discretos: prompt `❯` ou `$` antes de títulos de seção,
   glifo `▓▒░` pequeno ao lado do wordmark.

NÃO APARECE MAIS:
- Logo figlet gigante no topbar → vira wordmark de texto "TaskForge" (font-ui, bold)
  com sufixo mono `_` piscando ou glifo pequeno.
- Banners figlet de título de página → viram `<h1>` modernos com prompt mono discreto.
- Molduras boiling em cards/formulários → cards com borda 1px e radius.
- Iris wipe em toda navegação → transição de fade rápida e sutil (CSS). O iris wipe
  fica preservado na engine (usado só na rota /demo).

## Componentes de UI (estilo)

- **Botões**: radius 8px, sem sombra dura. Primário = fundo coral, texto quase preto
  (#16120f) para contraste, hover `--accent-hover` + translateY(-1px). Secundário =
  fundo transparente, borda 1px `--border-strong`. Ghost = só texto. O "traço cartoon"
  sobrevive numa micro-rotação (-0.4deg) no hover e no active "afunda" (translateY(1px)).
- **Cards** (catálogo): fundo `--bg-elevated`, borda 1px, radius, padding 24px,
  hover: borda `--accent` + leve elevação. Transições 150ms ease.
- **Carimbos (stamps)**: mantêm rotação leve (-2deg) e borda de 1.5px na cor do status
  — é o traço cartoon que fica. Fundo `--accent-muted`-like da cor correspondente.
- **Formulários**: inputs fundo `--bg-elevated`, borda 1px, radius 8px, focus ring
  coral 2px. Labels pequenos uppercase tracking largo em `--text-secondary`.
- **Modal**: overlay rgba(0,0,0,.6) + blur(8px); caixa `--bg-elevated`, radius-lg,
  focus trap, fecha com Esc.
- **Toast**: canto inferior direito, fundo `--bg-elevated`, borda esquerda coral 3px,
  radius, entra com slide-up, empilhável.
- **Topbar**: sticky, fundo `rgba(14,14,17,.8)` + backdrop-blur(12px), borda inferior
  1px `--border`, altura 60px, wordmark à esquerda, ações à direita.
- **Skeleton loaders**: blocos com shimmer sutil OU linha mono `▓▒░ carregando…` —
  usar a versão mono só dentro de terminais.

## Layout e espaçamento (corrigir a queixa do usuário)

- Container `--container` centralizado, padding lateral 24px (16px no mobile).
- Escala de espaçamento consistente: 8 / 16 / 24 / 32 / 48 / 64. Nada de margens
  soltas em style inline.
- Seções da página separadas por 48–64px. Título de seção + descrição + conteúdo
  com 16/24px entre si.
- Grid do catálogo: `repeat(auto-fill, minmax(320px, 1fr))`, gap 20px.
- Mobile-first: os `<pre>` ASCII escalam com `clamp()` de font-size e os terminais
  têm `overflow-x: auto` com fade lateral; nada estoura a viewport.

## Movimento

- Micro-interações: 150ms ease-out (hover), 250ms (modais/toasts).
- Animações ASCII: manter rAF/FPS da engine, sempre com cleanup.
- `@media (prefers-reduced-motion: reduce)`: formas 3D viram frame estático,
  typewriter mostra texto completo, transições viram instantâneas.

## Acessibilidade

- Contraste AA no mínimo (texto secundário ≥ 4.5:1 sobre --bg).
- `<pre>` decorativos com `aria-hidden="true"`; countdown com `aria-live="polite"`
  em texto alternativo legível.
- Foco visível em tudo (ring coral). Navegação completa por teclado no modal.
