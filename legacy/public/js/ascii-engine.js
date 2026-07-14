/* ==========================================================================
   AsciiFX — engine visual ASCII do TaskForge
   Estetica: cartoon anos 1930 "rubber hose" (Cuphead) via ASCII art.
   - Sem modulos ES, sem dependencias. Define somente window.AsciiFX.
   - Toda animacao roda em requestAnimationFrame com FPS interno e
     retorna { stop() } que cancela tudo (nada vaza apos stop()).
   - Renderizacao 3D real: projecao perspectiva + z-buffer + rampa de
     luminancia em <pre> via textContent (nunca innerHTML dinamico).
   ========================================================================== */
(function () {
  'use strict';

  var DEFAULT_RAMP = '.,-~:;=!*#$@';

  /* ---------------------------------------------------------------------
     Nucleo de animacao: rAF com controle de FPS. Retorna { stop() }.
     --------------------------------------------------------------------- */
  function makeLoop(fps, fn) {
    var alive = true;
    var raf = 0;
    var interval = 1000 / fps;
    var last = -1e9;
    var t0 = -1;
    function tick(ts) {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      if (t0 < 0) t0 = ts;
      if (ts - last < interval - 0.5) return;
      last = ts;
      fn(ts - t0);
    }
    raf = requestAnimationFrame(tick);
    return {
      stop: function () {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(raf);
      }
    };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function centerPad(line, width) {
    var extra = width - line.length;
    if (extra <= 0) return line;
    var left = extra >> 1;
    return repeatChar(' ', left) + line + repeatChar(' ', extra - left);
  }

  function repeatChar(ch, n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ch;
    return s;
  }

  /* Normaliza um conjunto de frames (arrays de linhas) para dimensoes
     identicas — critico para os ciclos nao "pularem". */
  function normalizeFrames(frames) {
    var maxW = 0, maxH = 0, i, j;
    for (i = 0; i < frames.length; i++) {
      maxH = Math.max(maxH, frames[i].length);
      for (j = 0; j < frames[i].length; j++) {
        maxW = Math.max(maxW, frames[i][j].length);
      }
    }
    var out = [];
    for (i = 0; i < frames.length; i++) {
      var lines = [];
      for (j = 0; j < maxH; j++) {
        var ln = frames[i][j] || '';
        while (ln.length < maxW) ln += ' ';
        lines.push(ln);
      }
      out.push(lines.join('\n'));
    }
    return out;
  }

  /* =======================================================================
     FONTE FIGLET (5 linhas, traco grosso) — A-Z, 0-9, ':', 'd', pontuacao.
     Cada glifo e normalizado para largura fixa na carga.
     ======================================================================= */
  var RAW_FONT = {
    'A': [' #### ', '##  ##', '######', '##  ##', '##  ##'],
    'B': ['##### ', '##  ##', '##### ', '##  ##', '##### '],
    'C': [' #####', '##    ', '##    ', '##    ', ' #####'],
    'D': ['##### ', '##  ##', '##  ##', '##  ##', '##### '],
    'E': ['######', '##    ', '##### ', '##    ', '######'],
    'F': ['######', '##    ', '##### ', '##    ', '##    '],
    'G': [' #####', '##    ', '## ###', '##  ##', ' #####'],
    'H': ['##  ##', '##  ##', '######', '##  ##', '##  ##'],
    'I': ['####', ' ## ', ' ## ', ' ## ', '####'],
    'J': [' #####', '    ##', '    ##', '##  ##', ' #### '],
    'K': ['##  ##', '## ## ', '####  ', '## ## ', '##  ##'],
    'L': ['##    ', '##    ', '##    ', '##    ', '######'],
    'M': ['##   ##', '### ###', '## # ##', '##   ##', '##   ##'],
    'N': ['##  ##', '### ##', '######', '## ###', '##  ##'],
    'O': [' #### ', '##  ##', '##  ##', '##  ##', ' #### '],
    'P': ['##### ', '##  ##', '##### ', '##    ', '##    '],
    'Q': [' #### ', '##  ##', '##  ##', '## ## ', ' ## ##'],
    'R': ['##### ', '##  ##', '##### ', '## ## ', '##  ##'],
    'S': [' #####', '##    ', ' #### ', '    ##', '##### '],
    'T': ['######', '  ##  ', '  ##  ', '  ##  ', '  ##  '],
    'U': ['##  ##', '##  ##', '##  ##', '##  ##', ' #### '],
    'V': ['##  ##', '##  ##', '##  ##', ' #### ', '  ##  '],
    'W': ['##   ##', '##   ##', '## # ##', '### ###', '##   ##'],
    'X': ['##  ##', ' #### ', '  ##  ', ' #### ', '##  ##'],
    'Y': ['##  ##', ' #### ', '  ##  ', '  ##  ', '  ##  '],
    'Z': ['######', '   ## ', '  ##  ', ' ##   ', '######'],
    '0': [' #### ', '##  ##', '##  ##', '##  ##', ' #### '],
    '1': [' ## ', '### ', ' ## ', ' ## ', '####'],
    '2': [' #### ', '##  ##', '   ## ', '  ##  ', '######'],
    '3': ['##### ', '    ##', ' #### ', '    ##', '##### '],
    '4': ['##  ##', '##  ##', '######', '    ##', '    ##'],
    '5': ['######', '##    ', '##### ', '    ##', '##### '],
    '6': [' #####', '##    ', '##### ', '##  ##', ' #### '],
    '7': ['######', '    ##', '   ## ', '  ##  ', '  ##  '],
    '8': [' #### ', '##  ##', ' #### ', '##  ##', ' #### '],
    '9': [' #### ', '##  ##', ' #####', '    ##', '##### '],
    'd': ['    ##', '    ##', ' #####', '##  ##', ' #####'],
    ':': ['  ', '##', '  ', '##', '  '],
    '.': ['  ', '  ', '  ', '##', '##'],
    '!': ['##', '##', '##', '  ', '##'],
    '?': [' #### ', '##  ##', '   ## ', '      ', '  ##  '],
    '-': ['      ', '      ', '######', '      ', '      '],
    ' ': ['   ', '   ', '   ', '   ', '   ']
  };

  var FONT = (function () {
    var out = {};
    for (var k in RAW_FONT) {
      if (!Object.prototype.hasOwnProperty.call(RAW_FONT, k)) continue;
      var rows = RAW_FONT[k];
      var w = 0, i;
      for (i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
      var norm = [];
      for (i = 0; i < 5; i++) {
        var ln = rows[i] || '';
        while (ln.length < w) ln += ' ';
        norm.push(ln);
      }
      out[k] = norm;
    }
    return out;
  })();

  /* Retorna array de 5 linhas com o texto em fonte grande. */
  function bigLines(text) {
    text = String(text == null ? '' : text);
    var rows = ['', '', '', '', ''];
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var g = FONT[ch] || FONT[ch.toUpperCase()] || FONT[' '];
      for (var r = 0; r < 5; r++) {
        rows[r] += (i > 0 ? ' ' : '') + g[r];
      }
    }
    return rows;
  }

  /* API: banner figlet — retorna string multilinha, nao toca DOM. */
  function title(text) {
    return bigLines(text).join('\n');
  }

  /* =======================================================================
     MOTOR 3D — nuvens de pontos com normais, rotacao em 2 eixos,
     projecao perspectiva, z-buffer e rampa de luminancia.
     ======================================================================= */
  var TWO_PI = Math.PI * 2;
  var shapeCache = {};

  function pushPt(arr, x, y, z, nx, ny, nz) {
    arr.push(x, y, z, nx, ny, nz);
  }

  function buildDonut() {
    var pts = [];
    var R1 = 1, R2 = 2;
    for (var t = 0; t < TWO_PI; t += 0.12) {
      var ct = Math.cos(t), st = Math.sin(t);
      var cr = R2 + R1 * ct;
      for (var p = 0; p < TWO_PI; p += 0.045) {
        var cp = Math.cos(p), sp = Math.sin(p);
        pushPt(pts, cr * cp, R1 * st, cr * sp, ct * cp, st, ct * sp);
      }
    }
    return { pts: new Float64Array(pts), maxR: R1 + R2 };
  }

  function buildCube() {
    var pts = [];
    var hs = 1.7, steps = 40;
    for (var f = 0; f < 6; f++) {
      var axis = f >> 1;
      var sign = (f & 1) ? 1 : -1;
      var o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
      for (var i = 0; i < steps; i++) {
        for (var j = 0; j < steps; j++) {
          var u = -hs + (2 * hs * i) / (steps - 1);
          var v = -hs + (2 * hs * j) / (steps - 1);
          var p = [0, 0, 0], n = [0, 0, 0];
          p[axis] = sign * hs; p[o1] = u; p[o2] = v;
          n[axis] = sign;
          pushPt(pts, p[0], p[1], p[2], n[0], n[1], n[2]);
        }
      }
    }
    return { pts: new Float64Array(pts), maxR: hs * Math.sqrt(3) };
  }

  function buildDiamond() {
    /* Gema lapidada: mesa plana, coroa e pavilhao com normais facetadas. */
    var pts = [];
    var SEC = 8, secA = TWO_PI / SEC;
    var tableR = 1.0, tableY = 1.0;
    var girdleR = 2.0, girdleY = 0.35;
    var apexY = -2.1;
    var a, r, t, fa, nx, ny, nz, len;
    // mesa (topo plano)
    for (r = 0.12; r <= tableR; r += 0.16) {
      var stepsA = Math.max(8, Math.round(TWO_PI * r / 0.14));
      for (var k = 0; k < stepsA; k++) {
        a = (k / stepsA) * TWO_PI;
        pushPt(pts, r * Math.cos(a), tableY, r * Math.sin(a), 0, 1, 0);
      }
    }
    // coroa (mesa -> cintura), normal por setor (facetas)
    for (t = 0; t <= 1.001; t += 0.09) {
      var cr = tableR + (girdleR - tableR) * t;
      var cy = tableY + (girdleY - tableY) * t;
      for (a = 0; a < TWO_PI; a += 0.07) {
        fa = (Math.floor(a / secA) + 0.5) * secA;
        nx = 0.65 * Math.cos(fa); ny = 1; nz = 0.65 * Math.sin(fa);
        len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        pushPt(pts, cr * Math.cos(a), cy, cr * Math.sin(a), nx / len, ny / len, nz / len);
      }
    }
    // pavilhao (cintura -> ponta), normal por setor
    for (t = 0; t <= 1.001; t += 0.055) {
      var pr = girdleR * (1 - t);
      var py = girdleY + (apexY - girdleY) * t;
      for (a = 0; a < TWO_PI; a += 0.08) {
        fa = (Math.floor(a / secA) + 0.5) * secA;
        nx = 2.45 * Math.cos(fa); ny = -2; nz = 2.45 * Math.sin(fa);
        len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        pushPt(pts, pr * Math.cos(a), py, pr * Math.sin(a), nx / len, ny / len, nz / len);
      }
    }
    return { pts: new Float64Array(pts), maxR: 2.2 };
  }

  function buildStar() {
    /* Estrela de 5 pontas extrudada: 10 arestas x 2 apices = 20 triangulos. */
    var pts = [];
    var outer = 2.2, inner = 0.92, zh = 0.5;
    var verts = [];
    for (var i = 0; i < 10; i++) {
      var ang = Math.PI / 2 + (i * Math.PI) / 5;
      var rad = (i % 2 === 0) ? outer : inner;
      verts.push([rad * Math.cos(ang), rad * Math.sin(ang), 0]);
    }
    function addTri(a, b, c) {
      var u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      var v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      var nx = u[1] * v[2] - u[2] * v[1];
      var ny = u[2] * v[0] - u[0] * v[2];
      var nz = u[0] * v[1] - u[1] * v[0];
      var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;
      var gx = (a[0] + b[0] + c[0]) / 3;
      var gy = (a[1] + b[1] + c[1]) / 3;
      var gz = (a[2] + b[2] + c[2]) / 3;
      if (nx * gx + ny * gy + nz * gz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      var steps = 22;
      for (var p = 0; p <= steps; p++) {
        for (var q = 0; q <= steps - p; q++) {
          var s = p / steps, t = q / steps;
          pushPt(pts,
            a[0] + s * u[0] + t * v[0],
            a[1] + s * u[1] + t * v[1],
            a[2] + s * u[2] + t * v[2],
            nx, ny, nz);
        }
      }
    }
    var front = [0, 0, zh], back = [0, 0, -zh];
    for (i = 0; i < 10; i++) {
      var v1 = verts[i], v2 = verts[(i + 1) % 10];
      addTri(front, v1, v2);
      addTri(back, v1, v2);
    }
    return { pts: new Float64Array(pts), maxR: Math.sqrt(outer * outer + zh * zh) };
  }

  function buildMug() {
    /* Caneca mascote: cilindro oco (parede externa/interna, borda, fundo)
       + alca em meio-toro recortado. Referencia Cuphead. */
    var pts = [];
    var BR = 1.6, BH = 1.8, IR = 1.3;
    var a, y, r, ca, sa;
    // parede externa
    for (a = 0; a < TWO_PI; a += 0.055) {
      ca = Math.cos(a); sa = Math.sin(a);
      for (y = -BH; y <= BH; y += 0.11) {
        pushPt(pts, BR * ca, y, BR * sa, ca, 0, sa);
      }
    }
    // parede interna (caneca aberta)
    for (a = 0; a < TWO_PI; a += 0.075) {
      ca = Math.cos(a); sa = Math.sin(a);
      for (y = -BH + 0.35; y <= BH; y += 0.13) {
        pushPt(pts, IR * ca, y, IR * sa, -ca, 0, -sa);
      }
    }
    // borda superior (anel plano)
    for (a = 0; a < TWO_PI; a += 0.055) {
      ca = Math.cos(a); sa = Math.sin(a);
      for (r = IR; r <= BR; r += 0.075) {
        pushPt(pts, r * ca, BH, r * sa, 0, 1, 0);
      }
    }
    // fundo externo
    for (a = 0; a < TWO_PI; a += 0.07) {
      ca = Math.cos(a); sa = Math.sin(a);
      for (r = 0.1; r <= BR; r += 0.12) {
        pushPt(pts, r * ca, -BH, r * sa, 0, -1, 0);
      }
    }
    // fundo interno ("cafe")
    for (a = 0; a < TWO_PI; a += 0.09) {
      ca = Math.cos(a); sa = Math.sin(a);
      for (r = 0.1; r <= IR; r += 0.15) {
        pushPt(pts, r * ca, -BH + 0.35, r * sa, 0, 1, 0);
      }
    }
    // alca (toro no plano x-y, recortando o que entra no corpo)
    var HC = 2.0, HR = 0.75, HT = 0.19;
    for (var p = 0; p < TWO_PI; p += 0.06) {
      var cp = Math.cos(p), sp = Math.sin(p);
      var rx = HC + HR * cp, ry = HR * sp;
      for (var t = 0; t < TWO_PI; t += 0.34) {
        var nx = Math.cos(t) * cp;
        var ny = Math.cos(t) * sp;
        var nz = Math.sin(t);
        var px = rx + HT * nx, py = ry + HT * ny, pz = HT * nz;
        if (Math.sqrt(px * px + pz * pz) < BR + 0.02 && Math.abs(py) < BH) continue;
        pushPt(pts, px, py, pz, nx, ny, nz);
      }
    }
    return { pts: new Float64Array(pts), maxR: HC + HR + HT };
  }

  function getShape(name) {
    if (shapeCache[name]) return shapeCache[name];
    var s;
    switch (name) {
      case 'cube': s = buildCube(); break;
      case 'star': s = buildStar(); break;
      case 'mug': s = buildMug(); break;
      case 'diamond': s = buildDiamond(); break;
      case 'donut':
      default: s = buildDonut(); break;
    }
    shapeCache[name] = s;
    return s;
  }

  /* API: forma 3D girando em 2 eixos dentro de um <pre>. */
  function spin(el, opts) {
    opts = opts || {};
    var w = opts.width || 60;
    var h = opts.height || 24;
    var speed = (opts.speed == null) ? 1 : opts.speed;
    var ramp = opts.chars || DEFAULT_RAMP;
    var shapeName = opts.shape || 'donut';
    var shape = getShape(shapeName);
    var pts = shape.pts, maxR = shape.maxR;
    var K2 = maxR * 1.8;
    var K1 = Math.min(w, h * 2) * K2 * 3 / (8 * maxR);
    var size = w * h;
    var zb = new Float64Array(size);
    var buf = new Array(size);
    var lx = 0, ly = 0.55, lz = -0.83; // luz de cima, atras do espectador
    var rampMax = ramp.length - 1;
    var isMug = (shapeName === 'mug');
    var halfW = w / 2, halfH = h / 2;

    el.classList.add('asciifx-spin');

    function render(A, B) {
      var cA = Math.cos(A), sA = Math.sin(A);
      var cB = Math.cos(B), sB = Math.sin(B);
      var i;
      for (i = 0; i < size; i++) { zb[i] = 0; buf[i] = ' '; }
      for (i = 0; i < pts.length; i += 6) {
        var x = pts[i], y = pts[i + 1], z = pts[i + 2];
        // gira em torno de Y (B), depois inclina em X (A)
        var x1 = x * cB + z * sB;
        var z1 = z * cB - x * sB;
        var y2 = y * cA - z1 * sA;
        var z2 = y * sA + z1 * cA;
        var ooz = 1 / (z2 + K2);
        var sx = (halfW + K1 * ooz * x1) | 0;
        var sy = (halfH - K1 * ooz * y2 * 0.5) | 0;
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
        var idx = sy * w + sx;
        if (ooz > zb[idx]) {
          zb[idx] = ooz;
          var nx = pts[i + 3], ny = pts[i + 4], nz = pts[i + 5];
          var nx1 = nx * cB + nz * sB;
          var nz1 = nz * cB - nx * sB;
          var ny2 = ny * cA - nz1 * sA;
          var nz2 = ny * sA + nz1 * cA;
          var L = nx1 * lx + ny2 * ly + nz2 * lz;
          var ci = L <= 0 ? 0 : ((L * rampMax + 0.5) | 0);
          if (ci > rampMax) ci = rampMax;
          buf[idx] = ramp.charAt(ci);
        }
      }
      var out = '';
      for (var yy = 0; yy < h; yy++) {
        out += buf.slice(yy * w, (yy + 1) * w).join('');
        if (yy < h - 1) out += '\n';
      }
      el.textContent = out;
    }

    var loop = makeLoop(30, function (t) {
      var ts = t * 0.001 * speed;
      // a caneca fica reconhecivel: gira em Y e balanca a inclinacao em X
      var A = isMug ? 0.45 + 0.5 * Math.sin(ts * 1.1) : ts * 1.0;
      var B = ts * 0.62;
      render(A, B);
    });

    return {
      stop: function () {
        loop.stop();
        el.classList.remove('asciifx-spin');
      }
    };
  }

  /* =======================================================================
     BOIL — moldura de caixa "cel boiling": traco grosso irregular
     redesenhado com jitter a ~8fps num overlay <pre> absoluto.
     ======================================================================= */
  function boil(el, opts) {
    opts = opts || {};
    var boxTitle = opts.title != null ? String(opts.title) : '';
    var prevInlinePos = el.style.position;
    if (window.getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    var ov = document.createElement('pre');
    ov.className = 'asciifx-boil';
    ov.style.cssText =
      'position:absolute;left:0;top:0;right:0;bottom:0;margin:0;padding:0;' +
      'overflow:hidden;pointer-events:none;white-space:pre;' +
      'font-family:inherit;font-size:inherit;line-height:1.1;';
    var meas = document.createElement('pre');
    meas.style.cssText =
      'position:absolute;left:-9999px;top:0;margin:0;padding:0;' +
      'visibility:hidden;white-space:pre;line-height:1.1;' +
      'font-family:inherit;font-size:inherit;';
    var mLines = [];
    for (var mi = 0; mi < 10; mi++) mLines.push('MMMMMMMMMM');
    meas.textContent = mLines.join('\n');
    el.appendChild(meas);
    el.appendChild(ov);

    var THICK = '###==@#%#';
    var CORNERS = '#@+#';

    function bch() { return THICK.charAt((Math.random() * THICK.length) | 0); }

    function redraw() {
      var rect = meas.getBoundingClientRect();
      var cw = rect.width / 10, chh = rect.height / 10;
      if (!cw || !chh) return;
      var cols = Math.max(6, Math.floor(el.clientWidth / cw));
      var rows = Math.max(4, Math.floor(el.clientHeight / chh));
      var g = [], x, y;
      for (y = 0; y < rows; y++) {
        var row = new Array(cols);
        for (x = 0; x < cols; x++) row[x] = ' ';
        g.push(row);
      }
      for (x = 1; x < cols - 1; x++) {
        g[Math.random() < 0.14 ? 1 : 0][x] = bch();
        g[rows - 1 - (Math.random() < 0.14 ? 1 : 0)][x] = bch();
      }
      for (y = 1; y < rows - 1; y++) {
        g[y][Math.random() < 0.14 ? 1 : 0] = bch();
        g[y][cols - 1 - (Math.random() < 0.14 ? 1 : 0)] = bch();
      }
      g[0][0] = CORNERS.charAt((Math.random() * CORNERS.length) | 0);
      g[0][cols - 1] = CORNERS.charAt((Math.random() * CORNERS.length) | 0);
      g[rows - 1][0] = CORNERS.charAt((Math.random() * CORNERS.length) | 0);
      g[rows - 1][cols - 1] = CORNERS.charAt((Math.random() * CORNERS.length) | 0);
      if (boxTitle) {
        var t = '[ ' + boxTitle + ' ]';
        if (t.length > cols - 4) t = t.slice(0, cols - 4);
        var st = 2 + (Math.random() < 0.3 ? 1 : 0);
        for (var i = 0; i < t.length; i++) g[0][st + i] = t.charAt(i);
      }
      var out = [];
      for (y = 0; y < rows; y++) out.push(g[y].join(''));
      ov.textContent = out.join('\n');
    }

    redraw();
    var loop = makeLoop(8, redraw);

    return {
      stop: function () {
        loop.stop();
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        if (meas.parentNode) meas.parentNode.removeChild(meas);
        el.style.position = prevInlinePos;
      }
    };
  }

  /* =======================================================================
     IRIS WIPE — transicao de tela circular estilo cartoon (~700ms).
     ======================================================================= */
  function irisWipe(onMidpoint) {
    return new Promise(function (resolve) {
      var ov = document.createElement('pre');
      ov.className = 'asciifx-iris';
      ov.style.cssText =
        'position:fixed;left:0;top:0;width:100vw;height:100vh;margin:0;' +
        'padding:0;z-index:99999;pointer-events:none;white-space:pre;' +
        'overflow:hidden;font:16px/16px monospace;';
      var meas = document.createElement('pre');
      meas.style.cssText =
        'position:fixed;left:-9999px;top:0;margin:0;padding:0;' +
        'visibility:hidden;white-space:pre;font:16px/16px monospace;';
      var mLines = [];
      for (var mi = 0; mi < 10; mi++) mLines.push('MMMMMMMMMM');
      meas.textContent = mLines.join('\n');
      document.body.appendChild(meas);
      document.body.appendChild(ov);
      var rect = meas.getBoundingClientRect();
      var cw = (rect.width / 10) || 9.6;
      var chh = (rect.height / 10) || 16;
      document.body.removeChild(meas);

      var cols = Math.ceil(window.innerWidth / cw) + 1;
      var rows = Math.ceil(window.innerHeight / chh) + 1;
      var cx = cols / 2, cy = rows / 2;
      var asp = chh / cw;
      var maxR = Math.sqrt(cx * cx + cy * asp * cy * asp) + 2.5;
      var CLOSE = 320, HOLD = 40, OPEN = 320;

      function draw(rr) {
        var out = '';
        for (var y = 0; y < rows; y++) {
          var dy = (y + 0.5 - cy) * asp;
          var dy2 = dy * dy;
          var line = '';
          for (var x = 0; x < cols; x++) {
            var dx = x + 0.5 - cx;
            var d = Math.sqrt(dx * dx + dy2);
            if (d > rr + 1.4) line += '█';
            else if (d > rr) line += '#';
            else if (d > rr - 1.2) line += '.';
            else line += ' ';
          }
          out += line + (y < rows - 1 ? '\n' : '');
        }
        ov.textContent = out;
      }

      function cleanup() {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
      }

      var phase = 'close';
      var start = -1;
      var raf = 0;

      function step(ts) {
        if (start < 0) start = ts;
        var t = ts - start;
        if (phase === 'close') {
          var r = maxR * (1 - t / CLOSE);
          if (r <= 0) {
            draw(-2);
            phase = 'mid';
            Promise.resolve()
              .then(function () { return onMidpoint ? onMidpoint() : undefined; })
              .then(afterMid, afterMid);
            return;
          }
          draw(r);
          raf = requestAnimationFrame(step);
        } else if (phase === 'open') {
          var t2 = ts - start;
          if (t2 < HOLD) {
            draw(-2);
            raf = requestAnimationFrame(step);
            return;
          }
          var t3 = t2 - HOLD;
          if (t3 >= OPEN) {
            cleanup();
            resolve();
            return;
          }
          draw(maxR * (t3 / OPEN));
          raf = requestAnimationFrame(step);
        }
      }

      function afterMid() {
        phase = 'open';
        start = -1;
        raf = requestAnimationFrame(step);
      }

      raf = requestAnimationFrame(step);
    });
  }

  /* =======================================================================
     SLOT METER — vagas do squad como fichas de personagem ASCII.
     ======================================================================= */
  var SLOT_W = 11;
  var SLOT_FILLED = [
    ' (o)   (o) ',
    '   \\   /   ',
    '   (^o^)   ',
    '    | |    ',
    '   _/ \\_   '
  ];
  var SLOT_EMPTY = [
    ' . - - - . ',
    ' .       . ',
    ' :   ?   : ',
    ' .       . ',
    ' . _ _ _ . '
  ];

  function slotMeter(el, filled, total, roleNames) {
    roleNames = roleNames || [];
    filled = Math.max(0, Math.min(filled | 0, total | 0));
    total = Math.max(0, total | 0);
    var GAP = '  ';
    var rows = ['', '', '', '', ''];
    var names = '';
    var tags = '';
    for (var i = 0; i < total; i++) {
      var art = i < filled ? SLOT_FILLED : SLOT_EMPTY;
      for (var r = 0; r < 5; r++) {
        rows[r] += (i > 0 ? GAP : '') + art[r];
      }
      var nm = String(roleNames[i] == null ? '' : roleNames[i]).toUpperCase();
      if (nm.length > SLOT_W) nm = nm.slice(0, SLOT_W);
      names += (i > 0 ? GAP : '') + centerPad(nm, SLOT_W);
      tags += (i > 0 ? GAP : '') +
        centerPad(i < filled ? '\\o/ A BORDO' : '. . vaga . .'.slice(0, SLOT_W), SLOT_W);
    }
    var bar = '[' + repeatChar('#', filled) + repeatChar('.', total - filled) + ']';
    var header = '== SQUAD ' + bar + ' ' + filled + '/' + total + ' ==';
    var width = Math.max(header.length, rows[0].length);
    var out = [centerPad(header, width), ''];
    for (r = 0; r < 5; r++) out.push(rows[r]);
    out.push(names);
    out.push(tags);
    el.classList.add('asciifx-slotmeter');
    el.textContent = out.join('\n');
  }

  /* =======================================================================
     COUNTDOWN — relogio regressivo em digitos ASCII grandes.
     ======================================================================= */
  function countdown(el, endsAtMs) {
    el.classList.add('asciifx-countdown');

    // blocos do estado "estourado", pre-computados com largura comum
    var expClock = bigLines('00d 00:00:00');
    var expTop = bigLines('PRAZO');
    var expBottom = bigLines('ESTOURADO');
    var expW = Math.max(expClock[0].length, expTop[0].length, expBottom[0].length);

    function blockA() { // relogio zerado, centralizado em 11 linhas
      var out = ['', '', ''];
      for (var i = 0; i < 5; i++) out.push(centerPad(expClock[i], expW));
      out.push('', '', '');
      for (i = 0; i < 3; i++) out[i] = centerPad('', expW);
      out[8] = centerPad('', expW); out[9] = centerPad('', expW); out[10] = centerPad('', expW);
      return out;
    }
    function blockB() { // PRAZO / ESTOURADO em fonte grande
      var out = [];
      for (var i = 0; i < 5; i++) out.push(centerPad(expTop[i], expW));
      out.push(centerPad('', expW));
      for (i = 0; i < 5; i++) out.push(centerPad(expBottom[i], expW));
      return out;
    }
    var expA = blockA().join('\n');
    var expB = blockB().join('\n');

    function render(t) {
      var rem = endsAtMs - Date.now();
      if (rem > 0) {
        var s = Math.floor(rem / 1000);
        var d = Math.floor(s / 86400); s -= d * 86400;
        var hh = Math.floor(s / 3600); s -= hh * 3600;
        var mm = Math.floor(s / 60);
        var ss = s - mm * 60;
        if (d > 99) d = 99;
        el.textContent =
          bigLines(pad2(d) + 'd ' + pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss)).join('\n');
      } else {
        var on = Math.floor(t / 650) % 2 === 0;
        el.textContent = on ? expA : expB;
      }
    }

    var loop = makeLoop(4, render);

    return {
      stop: function () {
        loop.stop();
        el.classList.remove('asciifx-countdown');
      }
    };
  }

  /* =======================================================================
     MASCOTE — Chico Caneca, personagem rubber-hose do TaskForge.
     Frames desenhados a mao; cada ciclo e normalizado para as mesmas
     dimensoes (nada pula entre frames).
     ======================================================================= */
  var MASCOT = {
    idle: {
      ms: 450,
      frames: normalizeFrames([
        [
          "       ( (",
          "        ) )",
          "    .=========.",
          "    |  0   0  |=,",
          "    |    ,    | |",
          "  ,=|  \\___/  |='",
          " (o)|         |",
          "    |         |",
          "    '========='",
          "      |     |",
          "     _|     |_",
          "    (__)   (__)"
        ],
        [
          "        ) )",
          "       ( (",
          "    .=========.",
          "  ,=|  0   0  |=,",
          " (o)|    ,    | |",
          "    |  \\___/  |='",
          "    |         |",
          "    |         |",
          "    '========='",
          "      |     |",
          "     _|     |_",
          "    (__)   (__)"
        ]
      ])
    },
    cheer: {
      ms: 280,
      frames: normalizeFrames([
        [
          " (o)         (o)",
          "   \\         /",
          "    .=========.",
          "    |  ^   ^  |=,",
          "    |    o    | |",
          "    |  \\___/  |='",
          "    |         |",
          "    |         |",
          "    '========='",
          "      |     |",
          "     _|     |_",
          "    (__)   (__)"
        ],
        [
          "(o)             (o)",
          "  \\_           _/",
          "    .=========.",
          "    |  ^   ^  |=,",
          "    |    O    | |",
          "    |  \\___/  |='",
          "    |         |",
          "    |         |",
          "    '========='",
          "      |     |",
          "     _|     |_",
          "    (__)   (__)"
        ]
      ])
    },
    sad: {
      ms: 500,
      frames: normalizeFrames([
        [
          "",
          "",
          "    .=========.",
          "    |  T   T  |=,",
          "  ,-|      .  | |",
          "  | |   ___   |='",
          "  | |  /   \\  |-,",
          " (o)|         | |",
          "    '========='(o)",
          "      |     |",
          "     _|     |_",
          "    (__)   (__)"
        ],
        [
          "",
          "",
          "    .=========.",
          "    |  T   T  |=,",
          "  ,-|         | |",
          "  | |   ___   |='",
          "  | |  /   \\  |-,",
          " (o)|      o  | |",
          "    '========='(o)",
          "      |     |",
          "     _|     |_",
          "    (__)   (__)"
        ],
        [
          "",
          "",
          "    .=========.",
          "    |  T   T  |=,",
          "  ,-|         | |",
          "  | |   ___   |='",
          "  | |  /   \\  |-,",
          " (o)|         | |",
          "    '========='(o)",
          "      |     |",
          "     _|    o|_",
          "    (__)   (__)"
        ]
      ])
    }
  };

  function mascot(el, mood) {
    var set = MASCOT[mood] || MASCOT.idle;
    var frames = set.frames;
    var frameMs = set.ms;
    el.classList.add('asciifx-mascot');
    var lastFrame = -1;
    var loop = makeLoop(12, function (t) {
      var f = Math.floor(t / frameMs) % frames.length;
      if (f !== lastFrame) {
        lastFrame = f;
        el.textContent = frames[f];
      }
    });
    return {
      stop: function () {
        loop.stop();
        el.classList.remove('asciifx-mascot');
      }
    };
  }

  /* =======================================================================
     TYPEWRITER — texto letra a letra com cursor █ piscando.
     ======================================================================= */
  function typewriter(el, text, opts) {
    opts = opts || {};
    var cps = opts.cps || 40;
    text = String(text == null ? '' : text);
    el.classList.add('asciifx-typewriter');
    var lastShown = 0;
    var loop = makeLoop(30, function (t) {
      lastShown = Math.min(text.length, Math.floor((t / 1000) * cps));
      var cursor = (Math.floor(t / 380) % 2 === 0) ? '█' : ' ';
      el.textContent = text.slice(0, lastShown) + cursor;
    });
    return {
      stop: function () {
        loop.stop();
        el.textContent = text.slice(0, lastShown);
        el.classList.remove('asciifx-typewriter');
      }
    };
  }

  /* ======================= API publica ======================= */
  window.AsciiFX = {
    spin: spin,
    boil: boil,
    irisWipe: irisWipe,
    slotMeter: slotMeter,
    countdown: countdown,
    mascot: mascot,
    title: title,
    typewriter: typewriter
  };
})();
