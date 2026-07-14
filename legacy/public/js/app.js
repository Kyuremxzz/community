'use strict';
/* TaskForge — SPA (vanilla JS). Consome window.Api e window.AsciiFX. */
(function () {
  const state = {
    user: null,
    pendingJoinSlot: null, // retomar entrada na vaga após assinar
  };

  /* ---------------- utilidades DOM ---------------- */

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k === 'onclick') el.addEventListener('click', v);
        else if (k === 'onsubmit') el.addEventListener('submit', v);
        else if (k === 'onchange') el.addEventListener('change', v);
        else if (k === 'html') el.innerHTML = v; // usar SÓ com strings estáticas
        else el.setAttribute(k, v);
      }
    }
    for (const c of children) {
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  const $screen = () => document.getElementById('screen');
  const $topbar = () => document.getElementById('topbar');

  /* animações vivas da tela atual — sempre paradas antes de re-renderizar */
  let anims = [];
  function track(handle) {
    if (handle && typeof handle.stop === 'function') anims.push(handle);
    return handle;
  }
  function stopAnims() {
    for (const a of anims) { try { a.stop(); } catch {} }
    anims = [];
  }

  function toast(msg, ms = 3200) {
    const root = document.getElementById('toast-root');
    root.textContent = '';
    const t = h('div', { class: 'toast' }, msg);
    root.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, ms);
  }

  function openModal(contentEl, { onClose } = {}) {
    const root = document.getElementById('modal-root');
    root.textContent = '';
    const close = () => { root.textContent = ''; if (onClose) onClose(); };
    const modal = h('div', { class: 'modal' },
      h('button', { class: 'modal-close', onclick: close, 'aria-label': 'Fechar' }, '✕'),
      contentEl
    );
    const backdrop = h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, modal);
    root.appendChild(backdrop);
    return { close };
  }

  /* navegação com transição de iris (cartoon) */
  let navigating = false;
  function go(hash) {
    if (location.hash === hash) { render(); return; }
    if (navigating) { location.hash = hash; return; }
    navigating = true;
    AsciiFX.irisWipe(() => { location.hash = hash; }).finally(() => { navigating = false; });
  }

  /* ---------------- formatação ---------------- */

  const DIFF_SHAPE = { iniciante: 'donut', intermediario: 'cube', avancado: 'diamond' };
  const DIFF_CRT = { iniciante: 'crt-teal', intermediario: 'crt-amber', avancado: 'crt-red' };

  function fmtWeeks(n) { return n === 1 ? '1 semana' : `${n} semanas`; }

  function fmtRemaining(endsAt) {
    const ms = endsAt - Date.now();
    if (ms <= 0) return 'prazo estourado';
    const d = Math.floor(ms / 86400000);
    const hh = Math.floor((ms % 86400000) / 3600000);
    const mm = Math.floor((ms % 3600000) / 60000);
    return `${d}d ${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m restantes`;
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function statusStamp(squad) {
    const map = {
      forming: ['forming', 'FORMANDO'],
      active: ['active', 'PRAZO CORRENDO'],
      delivered: ['delivered', squad.deliveredLate ? 'ENTREGUE (ATRASADO)' : 'ENTREGUE'],
    };
    const [cls, label] = map[squad.status] || ['forming', squad.status];
    return h('span', { class: `stamp stamp-status stamp-${cls}` }, label);
  }

  function diffStamp(p) {
    return h('span', { class: `stamp stamp-${p.difficulty}` }, `${p.difficultyLabel} · ${fmtWeeks(p.deadlineWeeks)}`);
  }

  /* ---------------- topbar ---------------- */

  function renderTopbar() {
    const bar = $topbar();
    bar.textContent = '';
    const logo = h('pre', { class: 'logo', onclick: () => go('#/catalogo') },
      '╔═══════════════════════════╗\n║ ▓▒░  T A S K F O R G E ░▒▓ ║\n╚═══════════════════════════╝');
    const right = h('div', { class: 'topbar-right' });

    if (state.user) {
      const badge = state.user.subscribed
        ? h('span', { class: 'sub-badge' }, ' ★ assinante')
        : h('span', { class: 'free-badge' }, state.user.freeProjectUsed ? ' · grátis usado' : ' · 1 projeto grátis');
      right.append(
        h('span', { class: 'userchip' }, `☺ ${state.user.name}`, badge),
        h('button', { class: 'btn btn-sm', onclick: () => go('#/meus-squads') }, 'Meus squads'),
        h('button', { class: 'btn btn-sm btn-gold', onclick: () => go('#/criar') }, 'Criar projeto'),
      );
      if (!state.user.subscribed) {
        right.append(h('button', { class: 'btn btn-sm btn-teal', onclick: () => showPaywall(null) }, 'Assinar'));
      }
      right.append(h('button', {
        class: 'btn btn-sm btn-ghost',
        onclick: async () => {
          try { await Api.logout(); } catch {}
          Api.clearToken();
          state.user = null;
          renderTopbar();
          go('#/entrar');
        },
      }, 'Sair'));
    } else {
      right.append(h('button', { class: 'btn btn-sm btn-red', onclick: () => go('#/entrar') }, 'Entrar'));
    }
    bar.append(logo, right);
  }

  /* ---------------- paywall / assinatura ---------------- */

  function showPaywall(slotIdToRetry) {
    state.pendingJoinSlot = slotIdToRetry;
    const mascotEl = h('pre', { class: 'mascot-pre' });
    const content = h('div', null,
      h('h2', null, 'Fim do projeto grátis!'),
      h('div', { class: 'split' },
        h('div', { class: 'crt crt-amber' }, mascotEl),
        h('div', null,
          h('p', null, 'Seu primeiro projeto foi por conta da casa. Para continuar entrando em novos projetos — quantos quiser — assine o TaskForge.'),
          h('p', { class: 'muted', style: 'margin-top:8px' }, 'R$ 19/mês · cancele quando quiser'),
          h('p', { class: 'small muted', style: 'margin-top:4px' }, '(pagamento simulado neste protótipo — nenhuma cobrança real)'),
          h('div', { style: 'margin-top:14px' },
            h('button', {
              class: 'btn btn-red',
              onclick: async (e) => {
                e.target.disabled = true;
                try {
                  const r = await Api.subscribe();
                  state.user = r.user;
                  renderTopbar();
                  modal.close();
                  toast('★ Assinatura ativada! Bem-vindo ao clube.');
                  if (state.pendingJoinSlot) {
                    const slotId = state.pendingJoinSlot;
                    state.pendingJoinSlot = null;
                    await joinSlot(slotId);
                  }
                } catch (err) {
                  toast('Erro: ' + err.message);
                  e.target.disabled = false;
                }
              },
            }, 'Assinar agora'),
          ),
        ),
      ),
    );
    const modal = openModal(content, { onClose: () => { state.pendingJoinSlot = null; } });
    track(AsciiFX.mascot(mascotEl, 'sad'));
  }

  /* ---------------- ações de negócio ---------------- */

  async function joinSlot(slotId) {
    if (!state.user) { toast('Entre na sua conta para ocupar uma vaga.'); go('#/entrar'); return; }
    try {
      const r = await Api.joinSlot(slotId);
      const me = await Api.me();
      state.user = me.user;
      renderTopbar();
      if (r.deadlineStarted) {
        toast('⚑ SQUAD COMPLETO! O prazo começou a contar AGORA.');
      } else {
        toast('Vaga ocupada! O prazo começa quando o squad fechar.');
      }
      go('#/squad/' + r.squad.id);
    } catch (err) {
      if (err.status === 402) showPaywall(slotId);
      else if (err.status === 401) { toast('Sessão expirada — entre de novo.'); Api.clearToken(); state.user = null; renderTopbar(); go('#/entrar'); }
      else toast('Erro: ' + err.message);
    }
  }

  /* ---------------- telas ---------------- */

  function screenLogin() {
    const scr = $screen();
    let mode = 'login';

    const mascotEl = h('pre', { class: 'mascot-pre' });
    const spinEl = h('pre', null);
    const tag = h('p', { class: 'tagline' });

    const errBox = h('div');
    function setErr(msg) {
      errBox.textContent = '';
      if (msg) errBox.appendChild(h('div', { class: 'error-note' }, msg));
    }

    const nameField = h('div', { class: 'field', style: 'display:none' },
      h('label', null, 'Nome'),
      h('input', { type: 'text', id: 'f-name', autocomplete: 'name', placeholder: 'Como te chamam' }));
    const form = h('form', {
      class: 'form-narrow',
      onsubmit: async (e) => {
        e.preventDefault();
        setErr(null);
        const email = document.getElementById('f-email').value.trim();
        const pass = document.getElementById('f-pass').value;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          let r;
          if (mode === 'login') r = await Api.login(email, pass);
          else r = await Api.register(document.getElementById('f-name').value.trim(), email, pass);
          Api.setToken(r.token);
          state.user = r.user;
          renderTopbar();
          toast(`Salve, ${r.user.name}! ☺`);
          go('#/catalogo');
        } catch (err) {
          setErr(err.message);
          btn.disabled = false;
        }
      },
    },
      nameField,
      h('div', { class: 'field' },
        h('label', null, 'E-mail'),
        h('input', { type: 'email', id: 'f-email', autocomplete: 'email', placeholder: 'voce@exemplo.dev', required: '' })),
      h('div', { class: 'field' },
        h('label', null, 'Senha'),
        h('input', { type: 'password', id: 'f-pass', autocomplete: 'current-password', placeholder: '••••••', required: '' })),
      errBox,
      h('button', { class: 'btn btn-red', type: 'submit' }, 'Entrar'),
      h('p', { class: 'small muted', style: 'margin-top:12px' }, 'Conta demo: demo@taskforge.dev / demo123'),
    );

    const toggle = h('a', {
      href: '#',
      onclick: (e) => {
        e.preventDefault();
        mode = mode === 'login' ? 'register' : 'login';
        nameField.style.display = mode === 'register' ? '' : 'none';
        form.querySelector('button[type=submit]').textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
        toggleWrap.firstChild.textContent = mode === 'login' ? 'Primeira vez por aqui? ' : 'Já tem conta? ';
        toggle.textContent = mode === 'login' ? 'Crie sua conta' : 'Faça login';
        setErr(null);
      },
    }, 'Crie sua conta');
    const toggleWrap = h('p', { style: 'margin-top:10px' }, 'Primeira vez por aqui? ', toggle);

    const formBox = h('div', { class: 'boilbox' }, h('h2', null, 'Bilheteria'), form, toggleWrap);

    scr.append(
      h('pre', { class: 'ascii-banner' }, AsciiFX.title('TASKFORGE')),
      tag,
      h('div', { class: 'split' },
        h('div', null,
          h('div', { class: 'crt crt-amber', style: 'margin-bottom:12px' }, mascotEl),
          h('div', { class: 'crt' }, spinEl),
        ),
        formBox,
      ),
    );

    track(AsciiFX.mascot(mascotEl, 'idle'));
    track(AsciiFX.spin(spinEl, { shape: 'mug', width: 56, height: 20 }));
    track(AsciiFX.boil(formBox, { title: 'ENTRADA' }));
    track(AsciiFX.typewriter(tag, 'Entre num squad. Encare um prazo de verdade. Entregue como num estágio — sem precisar de um.', { cps: 45 }));
  }

  async function screenCatalog() {
    const scr = $screen();
    const tag = h('p', { class: 'tagline' });
    scr.append(h('pre', { class: 'ascii-banner' }, AsciiFX.title('PROJETOS')), tag);
    track(AsciiFX.typewriter(tag, 'Escolha um cartaz, ocupe uma vaga e o espetáculo começa quando o squad fechar.', { cps: 50 }));

    // vitrine das dificuldades com formas 3D girando
    const legend = h('div', { class: 'cards-grid', style: 'margin-bottom:18px' });
    for (const [diff, shape] of Object.entries(DIFF_SHAPE)) {
      const pre = h('pre', null);
      const label = { iniciante: 'INICIANTE · 1 SEMANA', intermediario: 'INTERMEDIÁRIO · 2 SEMANAS', avancado: 'AVANÇADO · 3–4 SEMANAS' }[diff];
      legend.append(h('div', { class: `crt ${DIFF_CRT[diff]}` },
        h('div', { class: 'small', style: 'text-align:center;opacity:.8' }, label), pre));
      track(AsciiFX.spin(pre, { shape, width: 44, height: 15, speed: diff === 'avancado' ? 1.6 : 1 }));
    }
    scr.append(legend);

    const grid = h('div', { class: 'cards-grid' });
    scr.append(grid);

    let projects;
    try {
      ({ projects } = await Api.projects());
    } catch (err) {
      grid.append(h('div', { class: 'error-note' }, 'Erro carregando projetos: ' + err.message));
      return;
    }

    for (const p of projects) {
      const card = h('div', { class: 'card', onclick: () => go('#/projeto/' + p.id) },
        h('h3', null, p.title),
        h('div', { style: 'margin-bottom:8px' }, diffStamp(p)),
        h('p', { class: 'small', style: 'margin-bottom:8px' }, p.description),
        h('p', { class: 'small muted' }, 'Funções: ' + p.roles.join(' · ')),
        h('p', { class: 'small', style: 'margin-top:6px;font-weight:bold' },
          p.openSlots > 0 ? `▸ ${p.openSlots} vaga(s) aberta(s) em ${p.squadCount} squad(s)` : '▸ nenhuma vaga aberta agora',
          p.isMember ? '  ☺ você está nesse projeto' : ''),
      );
      grid.append(card);
      track(AsciiFX.boil(card));
    }
  }

  async function screenProject(id) {
    const scr = $screen();
    let data;
    try {
      data = await Api.project(id);
    } catch (err) {
      scr.append(h('div', { class: 'error-note' }, err.message));
      return;
    }
    const p = data.project;

    const spinEl = h('pre', null);
    const header = h('div', { class: 'boilbox' },
      h('div', { class: 'split' },
        h('div', null,
          h('h2', null, p.title),
          h('div', { style: 'margin:6px 0 10px' }, diffStamp(p)),
          h('p', null, p.description),
          h('p', { class: 'small muted', style: 'margin-top:10px' },
            `Funções deste projeto (definidas por quem o criou): ${p.roles.join(' · ')}`),
          h('p', { class: 'small muted' }, `Prazo após fechar o squad: ${fmtWeeks(p.deadlineWeeks)}`),
        ),
        h('div', { class: `crt ${DIFF_CRT[p.difficulty]}` }, spinEl),
      ),
    );
    scr.append(header);
    track(AsciiFX.boil(header, { title: 'CARTAZ DO PROJETO' }));
    track(AsciiFX.spin(spinEl, { shape: DIFF_SHAPE[p.difficulty], width: 50, height: 18 }));

    scr.append(h('h2', null, 'Squads'));

    for (const s of p.squads) {
      const meter = h('pre', { class: 'meter-pre' });
      const row = h('div', { class: 'squad-row' },
        h('h3', null, `${s.name} `, statusStamp(s)),
        meter,
      );
      AsciiFX.slotMeter(meter, s.slotsFilled, s.slotsTotal, s.slots.map((x) => x.role));

      const info = h('p', { class: 'small muted', style: 'margin-top:6px' });
      if (s.status === 'forming') {
        info.textContent = `${s.slotsFilled}/${s.slotsTotal} vagas ocupadas — o prazo só começa quando fechar.`;
      } else if (s.status === 'active') {
        info.textContent = `Prazo: ${fmtRemaining(s.deadlineEndsAt)} (até ${fmtDate(s.deadlineEndsAt)})`;
      } else {
        info.textContent = `Entregue em ${fmtDate(s.deliveredAt)} → ${s.repoUrl}`;
      }
      row.append(info);

      const actions = h('div', { class: 'slot-actions' });
      actions.append(h('button', { class: 'btn btn-sm', onclick: () => go('#/squad/' + s.id) }, 'Ver squad'));
      if (s.status === 'forming' && !s.isMember) {
        for (const slot of s.slots.filter((x) => x.userId == null)) {
          actions.append(h('button', {
            class: 'btn btn-sm btn-red',
            onclick: () => joinSlot(slot.id),
          }, `Ocupar vaga · ${slot.role}`));
        }
      }
      row.append(actions);
      scr.append(row);
    }

    const foot = h('div', { style: 'margin-top:16px' },
      h('button', {
        class: 'btn btn-gold btn-sm',
        onclick: async () => {
          if (!state.user) { toast('Entre para abrir um squad.'); go('#/entrar'); return; }
          try {
            const r = await Api.addSquad(p.id, '');
            toast(`Novo squad aberto: ${r.squad.name}`);
            render(); // recarrega a tela
          } catch (err) { toast('Erro: ' + err.message); }
        },
      }, '+ Abrir novo squad neste projeto'),
      h('button', { class: 'btn btn-sm btn-ghost', style: 'margin-left:10px', onclick: () => go('#/catalogo') }, '← Catálogo'),
    );
    scr.append(foot);
  }

  const GITHUB_TUTORIAL = [
    ['Abra o repositório entregue no GitHub', 'Vá até a página do repositório que o squad enviou.'],
    ['Settings → Collaborators', 'No menu do repositório, clique em Settings e depois em Collaborators (peça ao dono do repo se você não tiver acesso).'],
    ['Add people', 'Clique no botão Add people e digite o usuário do GitHub de cada colega de squad.'],
    ['Escolha a permissão Write', 'Assim todo mundo pode dar push direto, abrir branches e revisar PRs.'],
    ['Cada colega aceita o convite', 'O GitHub envia um e-mail/notificação; o convite expira em 7 dias.'],
    ['Bônus: proteja a branch main', 'Em Settings → Branches, exija pull request para main — como num time de verdade.'],
  ];

  async function screenSquad(id) {
    const scr = $screen();
    let data;
    try {
      data = await Api.squad(id);
    } catch (err) {
      scr.append(h('div', { class: 'error-note' }, err.message));
      return;
    }
    const s = data.squad;
    const p = data.project;

    scr.append(
      h('p', { class: 'small' }, h('a', { href: '#/projeto/' + p.id }, '← ' + p.title), ' · ', diffStamp(p)),
      h('h2', { style: 'margin-top:8px' }, `${s.name} `, statusStamp(s)),
    );

    const meter = h('pre', { class: 'meter-pre', style: 'margin:10px 0' });
    AsciiFX.slotMeter(meter, s.slotsFilled, s.slotsTotal, s.slots.map((x) => x.role));
    const meterBox = h('div', { class: 'boilbox' }, meter);
    scr.append(meterBox);
    track(AsciiFX.boil(meterBox, { title: 'ELENCO DO SQUAD' }));

    // lista nominal
    const list = h('div', { style: 'margin-bottom:16px' });
    for (const slot of s.slots) {
      list.append(h('p', { class: 'small' },
        h('b', null, slot.role + ': '),
        slot.userName ? `${slot.userName}${slot.mine ? ' (você)' : ''}` : '— vaga aberta —',
        slot.userId == null && s.status === 'forming' && !s.isMember
          ? h('button', { class: 'btn btn-sm btn-red', style: 'margin-left:10px', onclick: () => joinSlot(slot.id) }, 'Ocupar')
          : null,
        slot.mine && s.status === 'forming'
          ? h('button', {
              class: 'btn btn-sm btn-ghost', style: 'margin-left:10px',
              onclick: async () => {
                try { await Api.leaveSlot(slot.id); const me = await Api.me(); state.user = me.user; renderTopbar(); toast('Você saiu da vaga.'); render(); }
                catch (err) { toast('Erro: ' + err.message); }
              },
            }, 'Sair da vaga')
          : null,
      ));
    }
    scr.append(list);

    const mascotEl = h('pre', { class: 'mascot-pre' });

    if (s.status === 'forming') {
      scr.append(h('div', { class: 'split' },
        h('div', { class: 'crt crt-amber' }, mascotEl),
        h('div', null,
          h('h3', null, 'Aguardando o squad fechar'),
          h('p', { class: 'small' }, `Faltam ${s.slotsTotal - s.slotsFilled} pessoa(s). Quando a última vaga for ocupada, o cronômetro de ${fmtWeeks(p.deadlineWeeks)} dispara automaticamente — como o primeiro dia de um estágio.`),
        ),
      ));
      track(AsciiFX.mascot(mascotEl, 'idle'));
    }

    if (s.status === 'active') {
      const cd = h('pre', { class: 'countdown-pre' });
      const cdBox = h('div', { class: 'boilbox' },
        h('div', { class: 'crt crt-red' }, cd),
        h('p', { class: 'small muted', style: 'margin-top:8px' },
          `Começou em ${fmtDate(s.deadlineStartedAt)} · entrega até ${fmtDate(s.deadlineEndsAt)}`),
      );
      scr.append(cdBox);
      track(AsciiFX.boil(cdBox, { title: 'PRAZO' }));
      track(AsciiFX.countdown(cd, s.deadlineEndsAt));

      if (s.isMember) {
        const errBox = h('div');
        const form = h('form', {
          class: 'form-narrow',
          onsubmit: async (e) => {
            e.preventDefault();
            errBox.textContent = '';
            const url = document.getElementById('f-repo').value.trim();
            try {
              const r = await Api.deliver(s.id, url);
              toast(r.message);
              render();
            } catch (err) {
              errBox.appendChild(h('div', { class: 'error-note' }, err.message));
            }
          },
        },
          h('div', { class: 'field' },
            h('label', null, 'Link do repositório (GitHub)'),
            h('input', { type: 'url', id: 'f-repo', placeholder: 'https://github.com/seu-squad/projeto', required: '' })),
          errBox,
          h('button', { class: 'btn btn-teal', type: 'submit' }, 'Entregar projeto'),
        );
        const box = h('div', { class: 'boilbox' }, h('h3', null, 'Entrega'), form);
        scr.append(box);
        track(AsciiFX.boil(box, { title: 'HORA DO SHOW' }));
      }
    }

    if (s.status === 'delivered') {
      const cheer = h('div', { class: 'split' },
        h('div', { class: 'crt crt-teal' }, mascotEl),
        h('div', null,
          h('h3', null, s.deliveredLate ? 'Entregue (fora do prazo, mas entregue!)' : 'Entregue dentro do prazo!'),
          h('p', null, 'Repositório: ', h('a', { href: s.repoUrl, target: '_blank', rel: 'noopener noreferrer' }, s.repoUrl)),
          h('p', { class: 'small muted' }, `Entrega registrada em ${fmtDate(s.deliveredAt)}.`),
        ),
      );
      scr.append(cheer);
      track(AsciiFX.mascot(mascotEl, 'cheer'));

      const tut = h('div', { class: 'tutorial' },
        h('p', null, 'Agora transforme a entrega em portfólio de todo mundo — adicione o squad como colaborador do repositório:'),
        h('ol', null, ...GITHUB_TUTORIAL.map(([t, d]) =>
          h('li', null, h('b', null, t + ' — '), d))),
        h('p', { class: 'small muted' }, 'Dica: cada commit dos colegas passa a contar no gráfico de contribuições deles no GitHub.'),
      );
      const tutBox = h('div', { class: 'boilbox' }, h('h3', null, '☞ Tutorial: colaboradores no GitHub'), tut);
      scr.append(tutBox);
      track(AsciiFX.boil(tutBox, { title: 'PRÓXIMO PASSO' }));
    }
  }

  function screenCreate() {
    const scr = $screen();
    if (!state.user) {
      scr.append(h('div', { class: 'error-note' }, 'Entre na sua conta para criar um projeto.'));
      go('#/entrar');
      return;
    }

    const errBox = h('div');
    const rolesWrap = h('div');
    const roles = ['Frontend', 'Backend'];

    function renderRoles() {
      rolesWrap.textContent = '';
      roles.forEach((r, i) => {
        rolesWrap.append(h('div', { style: 'display:flex;gap:8px;margin-bottom:6px' },
          h('input', {
            type: 'text', value: r, maxlength: '14', style: 'flex:1',
            onchange: (e) => { roles[i] = e.target.value; },
          }),
          roles.length > 2 ? h('button', {
            class: 'btn btn-sm btn-ghost', type: 'button',
            onclick: () => { roles.splice(i, 1); renderRoles(); },
          }, '✕') : null,
        ));
      });
      if (roles.length < 6) {
        rolesWrap.append(h('button', {
          class: 'btn btn-sm', type: 'button',
          onclick: () => { roles.push(''); renderRoles(); },
        }, '+ função'));
      }
    }
    renderRoles();

    const weeksField = h('div', { class: 'field', style: 'display:none' },
      h('label', null, 'Prazo (avançado: 3 ou 4 semanas)'),
      h('select', { id: 'f-weeks' },
        h('option', { value: '3' }, '3 semanas'),
        h('option', { value: '4' }, '4 semanas')));

    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.textContent = '';
        const difficulty = document.getElementById('f-diff').value;
        const weeksByDiff = { iniciante: 1, intermediario: 2 };
        const deadlineWeeks = difficulty === 'avancado'
          ? Number(document.getElementById('f-weeks').value)
          : weeksByDiff[difficulty];
        try {
          const r = await Api.createProject({
            title: document.getElementById('f-title').value.trim(),
            description: document.getElementById('f-desc').value.trim(),
            difficulty,
            deadlineWeeks,
            roles: roles.map((x) => x.trim()).filter(Boolean),
          });
          toast('Projeto no ar! Squad Alpha aberto para inscrições.');
          go('#/projeto/' + r.project.id);
        } catch (err) {
          errBox.appendChild(h('div', { class: 'error-note' }, err.message));
        }
      },
    },
      h('div', { class: 'field' },
        h('label', null, 'Título'),
        h('input', { type: 'text', id: 'f-title', required: '', placeholder: 'Ex: Clone do Trello para estudos' })),
      h('div', { class: 'field' },
        h('label', null, 'Descrição (o que o squad vai construir)'),
        h('textarea', { id: 'f-desc', rows: '3', required: '', placeholder: 'Escopo, tecnologias sugeridas, o que é uma entrega boa…' })),
      h('div', { class: 'field' },
        h('label', null, 'Dificuldade'),
        h('select', {
          id: 'f-diff',
          onchange: (e) => { weeksField.style.display = e.target.value === 'avancado' ? '' : 'none'; },
        },
          h('option', { value: 'iniciante' }, 'Iniciante — 1 semana de prazo'),
          h('option', { value: 'intermediario' }, 'Intermediário — 2 semanas'),
          h('option', { value: 'avancado' }, 'Avançado — 3 a 4 semanas'))),
      weeksField,
      h('div', { class: 'field' },
        h('label', null, 'Funções do squad (você define — 2 a 6)'),
        rolesWrap),
      errBox,
      h('button', { class: 'btn btn-red', type: 'submit' }, 'Publicar projeto'),
    );

    const spinEl = h('pre', null);
    const box = h('div', { class: 'boilbox' }, h('h2', null, 'Novo projeto'), form);
    scr.append(
      h('pre', { class: 'ascii-banner' }, AsciiFX.title('CRIAR')),
      h('div', { class: 'split' },
        box,
        h('div', { class: 'crt' }, spinEl),
      ),
    );
    track(AsciiFX.boil(box, { title: 'PRANCHETA' }));
    track(AsciiFX.spin(spinEl, { shape: 'star', width: 54, height: 22 }));
  }

  async function screenMySquads() {
    const scr = $screen();
    if (!state.user) { go('#/entrar'); return; }
    scr.append(h('pre', { class: 'ascii-banner' }, AsciiFX.title('MEUS SQUADS')));

    let data;
    try {
      data = await Api.mySquads();
    } catch (err) {
      scr.append(h('div', { class: 'error-note' }, err.message));
      return;
    }

    if (data.squads.length === 0) {
      const mascotEl = h('pre', { class: 'mascot-pre' });
      scr.append(h('div', { class: 'split' },
        h('div', { class: 'crt crt-amber' }, mascotEl),
        h('div', null,
          h('h3', null, 'Nenhum squad ainda'),
          h('p', null, 'Seu primeiro projeto é grátis — vá ao catálogo e ocupe uma vaga!'),
          h('button', { class: 'btn btn-red', style: 'margin-top:10px', onclick: () => go('#/catalogo') }, 'Ver projetos'),
        ),
      ));
      track(AsciiFX.mascot(mascotEl, 'idle'));
      return;
    }

    for (const { squad: s, project: p } of data.squads) {
      const meter = h('pre', { class: 'meter-pre' });
      AsciiFX.slotMeter(meter, s.slotsFilled, s.slotsTotal, s.slots.map((x) => x.role));
      const info = s.status === 'active'
        ? `⏱ ${fmtRemaining(s.deadlineEndsAt)}`
        : s.status === 'delivered' ? `✔ entregue em ${fmtDate(s.deliveredAt)}` : `${s.slotsFilled}/${s.slotsTotal} vagas — formando`;
      const row = h('div', { class: 'squad-row' },
        h('h3', null, `${p.title} · ${s.name} `, statusStamp(s)),
        meter,
        h('p', { class: 'small', style: 'margin-top:4px;font-weight:bold' }, info),
        h('div', { class: 'slot-actions' },
          h('button', { class: 'btn btn-sm', onclick: () => go('#/squad/' + s.id) }, 'Abrir squad')),
      );
      scr.append(row);
    }
  }

  /* ---------------- roteador ---------------- */

  async function render() {
    stopAnims();
    const scr = $screen();
    scr.textContent = '';
    const hash = location.hash || '#/catalogo';
    const [, route, arg] = /^#\/([a-z-]*)\/?(\d+)?/.exec(hash) || [null, 'catalogo', null];

    if (!state.user && Api.hasToken()) {
      try { state.user = (await Api.me()).user; } catch { Api.clearToken(); }
      renderTopbar();
    }

    switch (route) {
      case 'entrar': screenLogin(); break;
      case 'projeto': await screenProject(Number(arg)); break;
      case 'squad': await screenSquad(Number(arg)); break;
      case 'criar': screenCreate(); break;
      case 'meus-squads': await screenMySquads(); break;
      case 'catalogo':
      default:
        if (!state.user && !Api.hasToken()) { screenLogin(); }
        else await screenCatalog();
        break;
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', async () => {
    renderTopbar();
    await render();
  });
})();
