/* ================================================
   BANDEJA PADEL SPIJKERS — Main JS
   ================================================ */

// ── NAV SCROLL ──
const nav = document.getElementById('site-nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── MOBILE MENU ──
const burger  = document.querySelector('.nav-burger');
const mobileNav = document.querySelector('.nav-mobile');
if (burger && mobileNav) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    mobileNav.classList.toggle('open');
    document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
  });
  // Close on link click
  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      burger.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// ── SCROLL REVEAL ──
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => observer.observe(el));
}

// ── ACTIVE NAV LINK ──
const page = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(link => {
  if (link.getAttribute('href') === page) link.classList.add('active');
});

// ── FILTER CARDS ──
document.querySelectorAll('.filter-bar').forEach(bar => {
  bar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    const container = bar.nextElementSibling;
    if (!container) return;
    container.querySelectorAll('[data-level]').forEach(card => {
      const show = filter === 'all' || card.dataset.level === filter;
      card.style.display = show ? '' : 'none';
      if (show) card.style.animation = 'fadeIn 0.3s ease forwards';
    });
  });
});

// ── REGISTRATION LEVEL TABS ──
document.querySelectorAll('.level-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const group = tab.closest('.level-tabs');
    group.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const price = document.getElementById('selected-level');
    if (price) price.textContent = tab.dataset.level;
  });
});

// ── QUANTITY COUNTER ──
const qMinus = document.getElementById('qty-minus');
const qPlus  = document.getElementById('qty-plus');
const qInput = document.getElementById('qty-input');
if (qMinus && qPlus && qInput) {
  qMinus.addEventListener('click', () => {
    const v = parseInt(qInput.value);
    if (v > 1) qInput.value = v - 1;
  });
  qPlus.addEventListener('click', () => {
    qInput.value = parseInt(qInput.value) + 1;
  });
}
