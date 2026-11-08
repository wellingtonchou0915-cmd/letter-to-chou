/* ==========================================================
   給裕傑的情書 · CHOU 2026（參照水色燈塔官網結構）
   頂欄導航 / Hero 信封自動開合 / 專案條帶 / 燈箱 / 滾動聯動
   ========================================================== */

const hero = document.getElementById('hero');
const heroPhoto = document.getElementById('heroPhoto');
const enterHint = document.getElementById('enterHint');
const projNav = document.getElementById('projNav');
const projCol = document.getElementById('projCol');
const brandBtn = document.getElementById('brandBtn');
const backTop = document.getElementById('backTop');

const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCounter = document.getElementById('lbCounter');
const lbPrev = document.getElementById('lbPrev');
const lbNext = document.getElementById('lbNext');
const lbClose = document.getElementById('lbClose');

const qs = new URLSearchParams(location.search);
const state = { data: null, lb: { open: false, cat: 0, idx: 0 } };

/* 開發輔助：?flat 禁用平滑滾動與漸顯動畫（截圖/除錯用） */
const FLAT = qs.has('flat');
if (FLAT) document.documentElement.style.scrollBehavior = 'auto';

/* Hero 任意點選 → 進入畫廊 */
hero.addEventListener('click', () => scrollToSection('gallery'));

/* ================= 構建畫廊 ================= */

function buildGallery() {
  const cats = state.data.categories.filter((c) => c.photos.length);
  projNav.innerHTML = '';
  projCol.innerHTML = '';

  cats.forEach((cat, i) => {
    const num = String(i + 1).padStart(2, '0');

    /* 左側列表項 */
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'proj-link';
    link.dataset.target = 'p-' + cat.id;
    link.innerHTML = `<span class="num">${num}</span><span>${cat.name}</span>`;
    link.addEventListener('click', () => {
      document.getElementById('p-' + cat.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    projNav.appendChild(link);

    /* 專案塊 */
    const art = document.createElement('article');
    art.className = 'project';
    art.id = 'p-' + cat.id;
    art.dataset.cat = cat.id;

    const head = document.createElement('div');
    head.className = 'proj-head';
    head.innerHTML = `
      <h3>${cat.name}</h3>
      ${cat.intro && cat.intro.trim() ? `<div class="proj-desc">${cat.intro}</div>` : ''}`;
    art.appendChild(head);

    const strip = document.createElement('div');
    strip.className = 'strip';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'strip-btn strip-prev is-edge';
    prev.setAttribute('aria-label', '向左');
    prev.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 L7.5 12 L14.5 19"/></svg>';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'strip-btn strip-next';
    next.setAttribute('aria-label', '向右');
    next.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5 L16.5 12 L9.5 19"/></svg>';

    const track = document.createElement('div');
    track.className = 'track';

    cat.photos.forEach((photo, pi) => {
      const fig = document.createElement('figure');
      fig.className = 'shot ' + (photo.w >= photo.h ? 'shot--l' : 'shot--p');
      fig.dataset.pi = pi;

      const frame = document.createElement('div');
      frame.className = 'shot-frame';

      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.note || cat.name;
      img.loading = i === 0 && pi < 3 ? 'eager' : 'lazy';
      img.decoding = 'async';

      frame.appendChild(img);
      fig.appendChild(frame);

      track.appendChild(fig);
    });

    strip.appendChild(prev);
    strip.appendChild(next);
    strip.appendChild(track);
    art.appendChild(strip);
    projCol.appendChild(art);
    if (FLAT) art.classList.add('is-in');

    /* 條帶按鈕：滾動一格 + 邊緣隱藏 */
    const step = () => {
      const first = track.querySelector('.shot');
      const gap = parseFloat(getComputedStyle(track).columnGap || 24);
      return first ? first.getBoundingClientRect().width + gap : 620;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', () => {
      const max = track.scrollWidth - track.clientWidth - 4;
      prev.classList.toggle('is-edge', track.scrollLeft <= 4);
      next.classList.toggle('is-edge', track.scrollLeft >= max);
    }, { passive: true });

    /* 滑鼠拖拽橫向滾動 */
    let drag = null;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: 0 };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      drag.moved = Math.max(drag.moved, Math.abs(dx));
      if (drag.moved > 6) {
        track.classList.add('is-grabbing');
        track.scrollLeft = drag.left - dx;
      }
    }, { passive: true });
    window.addEventListener('pointerup', () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      track.classList.remove('is-grabbing');
      if (moved > 6) track.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true });
    });

    /* 點照片 → 燈箱 */
    track.addEventListener('click', (e) => {
      const shot = e.target.closest('.shot');
      if (!shot) return;
      openLightbox(cats.indexOf(cat), +shot.dataset.pi);
    });

    revealObserver.observe(art);
  });
}

/* 專案進入視口時淡入 */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) {
      en.target.classList.add('is-in');
      revealObserver.unobserve(en.target);
    }
  });
}, { threshold: 0.06 });

/* 滾動 → 左側列表高亮當前專案（按滾動位置取「已越過分界線」的最後一個專案） */
function updateActive() {
  const blocks = [...projCol.querySelectorAll('.project')];
  const links = [...projNav.querySelectorAll('.proj-link')];
  if (!blocks.length || blocks.length !== links.length) return;
  const line = window.scrollY + window.innerHeight * 0.38;
  let idx = 0;
  blocks.forEach((b, i) => { if (b.offsetTop - 100 <= line) idx = i; });
  /* 滾過最後一個專案底部後，保持最後一個高亮 */
  const last = blocks[blocks.length - 1];
  if (window.scrollY + window.innerHeight * 0.38 > last.offsetTop + last.offsetHeight) idx = blocks.length - 1;
  links.forEach((b, i) => b.classList.toggle('is-active', i === idx));
}
let activeT = null;
function onScrollActive() {
  if (activeT) return;
  updateActive();
  /* 補一次尾呼叫，保證滾動停止後一定收斂到正確項 */
  activeT = setTimeout(() => { activeT = null; updateActive(); }, 80);
}
window.addEventListener('scroll', onScrollActive, { passive: true });
window.addEventListener('resize', onScrollActive);

/* ================= 導航 ================= */
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}
document.querySelectorAll('[data-goto]').forEach((b) =>
  b.addEventListener('click', () => scrollToSection(b.dataset.goto)));
brandBtn.addEventListener('click', () => scrollToSection('hero'));
backTop.addEventListener('click', () => scrollToSection('hero'));

/* ================= 燈箱 ================= */
function openLightbox(ci, pi) {
  state.lb = { open: true, cat: ci, idx: pi };
  renderLightbox();
  lightbox.hidden = false;
  lightbox.offsetHeight;
  lightbox.classList.add('is-in');
}
function closeLightbox() {
  state.lb.open = false;
  lightbox.classList.remove('is-in');
  setTimeout(() => { lightbox.hidden = true; }, 400);
}
function lbStep(dir) {
  const cats = state.data.categories.filter((c) => c.photos.length);
  const photos = cats[state.lb.cat].photos;
  const next = Math.max(0, Math.min(photos.length - 1, state.lb.idx + dir));
  if (next === state.lb.idx) return;
  state.lb.idx = next;
  renderLightbox();
}
function renderLightbox() {
  const cats = state.data.categories.filter((c) => c.photos.length);
  const cat = cats[state.lb.cat];
  const p = cat.photos[state.lb.idx];
  lbImg.src = p.src;
  lbImg.alt = p.note || cat.name;
  lbCounter.textContent = `${String(state.lb.idx + 1).padStart(2, '0')} / ${String(cat.photos.length).padStart(2, '0')}`;
  lbPrev.classList.toggle('is-edge', state.lb.idx <= 0);
  lbNext.classList.toggle('is-edge', state.lb.idx >= cat.photos.length - 1);
}
lbPrev.addEventListener('click', () => lbStep(-1));
lbNext.addEventListener('click', () => lbStep(1));
lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

window.addEventListener('keydown', (e) => {
  if (!state.lb.open) return;
  if (e.key === 'ArrowLeft') lbStep(-1);
  if (e.key === 'ArrowRight') lbStep(1);
  if (e.key === 'Escape') closeLightbox();
});

/* ================= 啟動 ================= */
fetch('photos.json?t=' + Date.now())
  .then((r) => r.json())
  .then((data) => {
    state.data = data;
    if (data.cover) heroPhoto.src = data.cover;
    buildGallery();
    updateActive();
    /* 關於區也走漸顯 */
    const aboutBody = document.querySelector('.about-body');
    if (aboutBody) {
      if (FLAT) aboutBody.classList.add('is-in');
      else revealObserver.observe(aboutBody);
    }

    /* 開發輔助：?p=N 直接滾到第 N 個專案，?lb=N 開第 N 張大圖 */
    const cats = data.categories.filter((c) => c.photos.length);
    const pN = parseInt(qs.get('p') || '', 10);
    if (!isNaN(pN) && cats[pN]) {
      setTimeout(() => {
        const el = document.getElementById('p-' + cats[pN].id);
        if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'instant' });
      }, 300);
    }
    const lbN = parseInt(qs.get('lb') || '', 10);
    if (!isNaN(lbN) && cats.length) setTimeout(() => openLightbox(0, lbN), 300);
  })
  .catch(() => {
    projNav.innerHTML = '<p class="list-label">photos.json 載入失敗</p>';
  });
