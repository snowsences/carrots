// Motion and gestures: route transitions, shared photo hero, article swipes and photo-viewer drag-to-dismiss.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const parse = key => { const [kind = 'trip', id, day, attraction] = (key.slice(1) || '/trip').split('/').filter(Boolean); return { kind, id, day, attraction }; };
const depth = r => r.kind === 'attraction' ? 2 : r.kind === 'day' ? 1 : 0;
const inView = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.right > 0 && b.top < innerHeight && b.left < innerWidth; };
const linkImage = (main, key) => { const a = [...main.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === key); const img = a?.querySelector('img'); return img && inView(img) ? img : null; };
const articleImage = main => { const img = main.querySelector('.article .photo-tile img'); return img && inView(img) ? img : null; };

// Runs `update` (which renders the new screen) inside a view transition. `fallback` is the plain, instant path.
export function transition(main, oldKey, newKey, update, fallback) {
  if (typeof document.startViewTransition !== 'function' || reduce.matches) return fallback();
  const from = parse(oldKey), to = parse(newKey), root = document.documentElement;
  let direction = 'fade';
  if (depth(to) !== depth(from)) direction = depth(to) > depth(from) ? 'forward' : 'back';
  else if (from.kind === 'attraction' && to.kind === 'attraction') {
    const previous = [...main.querySelectorAll('.article-navigation a')].find(a => a.getAttribute('href') === newKey && a.textContent.trim().startsWith('←'));
    direction = previous ? 'back' : 'forward';
  }
  // A photo that exists on both screens morphs between them.
  const named = [];
  const name = el => { el.style.viewTransitionName = 'hero'; named.push(el); };
  let heroOld = null;
  if (direction === 'forward') heroOld = linkImage(main, newKey);
  else if (direction === 'back' && from.kind === 'attraction' && to.kind !== 'attraction') heroOld = articleImage(main);
  if (heroOld) name(heroOld);
  root.dataset.nav = direction;
  const clear = () => { named.forEach(el => { el.style.viewTransitionName = ''; }); root.removeAttribute('data-nav'); };
  const run = document.startViewTransition(async () => {
    if (heroOld) heroOld.style.viewTransitionName = '';
    await update();
    if (heroOld) {
      const heroNew = direction === 'forward' ? (to.kind === 'attraction' ? articleImage(main) : null) : linkImage(main, oldKey);
      if (heroNew) name(heroNew);
    }
  });
  run.finished.then(clear, clear);
  run.ready.catch(() => {});
  return run.updateCallbackDone;
}

// Horizontal swipe on an attraction page goes to the previous or next attraction.
export function initSwipeNav(main) {
  const blocked = '.photo-gallery,.thumb-strip,.history-timeline,.segmented,.glossary-word,input,select,textarea,dialog,pre,table';
  let start = null;
  document.addEventListener('touchstart', e => {
    start = null;
    if (e.touches.length !== 1 || !main.querySelector('.article') || document.querySelector('dialog[open]') || e.target.closest(blocked)) return;
    const t = e.touches[0];
    if (t.clientX < 28 || t.clientX > innerWidth - 28) return; // leave screen edges to the system back gesture
    start = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const s = start; start = null;
    if (!s) return;
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s.time > 700 || getSelection()?.toString()) return;
    const links = [...main.querySelectorAll('.article-navigation a')];
    (dx > 0 ? links.find(a => a.textContent.trim().startsWith('←')) : links.find(a => a.textContent.trim().endsWith('→')))?.click();
  }, { passive: true });
}

// Pull the full-screen photo down to dismiss it; the photo follows the finger.
export function initPhotoDismiss(dialog) {
  const inner = dialog.querySelector('.photo-inner'), stage = dialog.querySelector('.photo-stage');
  let g = null;
  const set = (dy, ease) => {
    const p = Math.min(Math.max(dy, 0), 400);
    inner.style.transition = ease || 'none';
    inner.style.transform = dy ? `translateY(${Math.max(dy, 0)}px) scale(${1 - p / 2400})` : '';
    inner.style.opacity = dy ? String(1 - Math.min(p, 300) / 500) : '';
    dialog.style.background = dy ? `rgba(6,6,6,${1 - Math.min(p, 300) / 330})` : '';
  };
  stage.addEventListener('touchstart', e => { g = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, active: false, dy: 0 } : null; }, { passive: true });
  stage.addEventListener('touchmove', e => {
    if (!g || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - g.y, dx = e.touches[0].clientX - g.x;
    if (!g.active) { if (stage.scrollTop <= 0 && dy > 12 && dy > Math.abs(dx) * 1.5) g.active = true; else return; }
    e.preventDefault();
    g.dy = dy; set(dy);
  }, { passive: false });
  const finish = () => {
    const s = g; g = null;
    if (!s?.active) return;
    if (s.dy > 120) {
      if (reduce.matches) dialog.close();
      else { set(innerHeight, 'transform .18s ease-in, opacity .18s ease-in'); setTimeout(() => dialog.close(), 170); }
      return;
    }
    set(0, 'transform .2s ease, opacity .2s ease');
  };
  stage.addEventListener('touchend', finish, { passive: true });
  stage.addEventListener('touchcancel', () => { g = null; set(0); }, { passive: true });
  dialog.addEventListener('close', () => set(0));
}
