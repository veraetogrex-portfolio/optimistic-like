// Optimistic Like — github.com/veraetogrex-portfolio · zero dependencies
// Two identical like buttons on the same 800 ms server.
// Left: waits for the answer before showing anything. Right: shows the like at once,
// sends the request in the background, retries a failed one, and rolls back only if it can't save.

const root  = document.querySelector('#likes');
const score = root.querySelector('.op-score');
const LATENCY = 800, RETRIES = 2;

let failsLeft = 1;                                       // the first optimistic request gets a 500
const cards = [...root.querySelectorAll('.op-card')].map(el => ({
  el, optimistic: el.classList.contains('is-opt'),
  btn: el.querySelector('.op-like'), count: el.querySelector('.op-count'),
  felt: el.querySelector('.op-felt b'), ball: el.querySelector('.op-ball'),
  track: el.querySelector('.op-track'), code: el.querySelector('.op-code'),
  liked: false, busy: false, n: 128, t0: 0, felt0: null,
}));

const wait = ms => new Promise(r => setTimeout(r, ms));

// fake API: half the latency there, half back; can fail
function api(c, color = '#a69bff') {
  return new Promise(async resolve => {
    const ok = !(c.optimistic && failsLeft > 0);
    if (!ok) failsLeft--;
    await fly(c, 0, 1, LATENCY / 2, color);
    await fly(c, 1, 0, LATENCY / 2, ok ? '#3fe0d0' : '#ff7a45');
    resolve(ok);
  });
}
function fly(c, a, b, ms, color) {
  return new Promise(res => {
    const w = c.track.offsetWidth, t0 = performance.now();
    c.ball.style.setProperty('--c', color); c.ball.style.opacity = 1;
    const tick = now => {
      const p = Math.min(1, (now - t0) / ms), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      c.ball.style.transform = `translateX(${(a + (b - a) * e) * w}px)`;
      if (p < 1) requestAnimationFrame(tick); else { if (b === 0) c.ball.style.opacity = 0; res(); }
    };
    requestAnimationFrame(tick);
  });
}

function show(c, liked, pop) {
  c.liked = liked; c.n = liked ? 129 : 128;
  c.btn.classList.toggle('is-on', liked); c.btn.setAttribute('aria-pressed', liked);
  c.count.textContent = c.n;
  if (pop) { c.btn.classList.remove('is-pop'); void c.btn.offsetWidth; c.btn.classList.add('is-pop'); }
}
function burst(c) {
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.random() * .4, d = 46 + Math.random() * 30;
    const s = document.createElement('i'); s.className = 'op-burst';
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    c.btn.appendChild(s); setTimeout(() => s.remove(), 700);
  }
}
function code(c, text, tone) { c.code.textContent = text; c.code.className = 'op-code is-' + tone; }

// the felt delay counter: runs from the click until the heart is on screen
function startFelt(c) {
  c.t0 = performance.now(); c.felt0 = null; c.felt.className = '';
  const tick = now => {
    if (c.felt0 !== null) return;
    c.felt.textContent = `${Math.round(now - c.t0)} ms`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function stopFelt(c) {
  c.felt0 = Math.round(performance.now() - c.t0);
  const shown = c.optimistic ? 0 : Math.round(c.felt0 / 100) * 100;   // round to the server's 800
  c.felt.textContent = `${shown} ms`; c.felt.className = shown < 50 ? 'is-fast' : 'is-slow';
  return shown;
}

async function like(c) {
  if (c.busy) return;
  if (c.liked) { show(c, false); c.felt.textContent = '— ms'; c.felt.className = ''; c.code.className = 'op-code'; return; }
  c.busy = true;
  if (!c.optimistic) {                                   // pessimistic: spinner until the server says yes
    c.btn.classList.add('is-wait'); startFelt(c);
    const ok = await api(c);
    c.btn.classList.remove('is-wait');
    if (ok) { show(c, true, true); stopFelt(c); code(c, '200', 'ok'); }
  } else {                                               // optimistic: the like is on screen right away
    startFelt(c); show(c, true, true); burst(c); stopFelt(c);
    let ok = false;
    for (let k = 0; k <= RETRIES && !ok; k++) {
      ok = await api(c);
      if (!ok) { code(c, k < RETRIES ? '500 · retry' : '500', 'bad'); }
    }
    if (ok) code(c, '200 · saved', 'ok');
    else { show(c, false); code(c, 'rolled back', 'bad'); }           // honest rollback if it never saves
  }
  c.busy = false;
  verdict();
}

function verdict() {
  const [a, b] = cards;
  if (a.liked && b.liked && !a.busy && !b.busy) {
    score.innerHTML = `Felt <span class="r">${a.felt.textContent}</span><span class="a">→</span><span class="g">${b.felt.textContent}</span>`;
    root.classList.add('is-done');
  }
}

function reset() {
  failsLeft = 1;
  cards.forEach(c => { c.busy = false; show(c, false); c.btn.classList.remove('is-wait', 'is-pop'); c.felt.textContent = '— ms'; c.felt.className = ''; c.felt0 = 0;
    c.code.className = 'op-code'; c.ball.style.opacity = 0; });
  root.classList.remove('is-done');
}

// unlike both and fade the verdict (used when a demo loops)
function clear() {
  root.classList.remove('is-done');
  cards.forEach(c => { show(c, false); c.felt.textContent = '— ms'; c.felt.className = ''; c.code.className = 'op-code'; });
  failsLeft = 1;
}

cards.forEach(c => c.btn.addEventListener('click', () => like(c)));
reset();
root.likes = { reset, clear, buttons: cards.map(c => c.btn) };   // for scripted demos
