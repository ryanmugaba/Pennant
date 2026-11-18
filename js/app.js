/* Pennant storefront logic. No build step: plain script, globals from
   /vendor (Lenis, gsap, ScrollTrigger). The 3D hero lives in scene.js. */
(function () {
  'use strict';

  const WA = '263778206149';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = n => 'USD ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = '') => `<svg class="i ${cls}"><use href="#${id}"/></svg>`;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.classList.add('reduced');

  const FALLBACK = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
  const photo = (p, w) => (p.img && p.img.trim()) ? p.img.trim() : `https://loremflickr.com/${w}/${w}/${encodeURIComponent(p.tags || 'tool')}?lock=${p.lock || 1}`;

  let products = [];
  let bag = store.get('pennant-bag', []);      // [{ id, qty }]
  let filter = 'All';
  let user = null;
  let config = { googleClientId: null };
  let notes = store.get('pennant-notes', []);  // [{ id, title, body, at, read }]

  /* ------------------------------------------------------------------ toast */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 2600);
  }

  /* ------------------------------------------------------------------ theme */
  $('#themeBtn').onclick = () => {
    const root = document.documentElement;
    const now = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = now === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('pennant-theme', next); } catch (e) {}
    $('meta[name="theme-color"]').setAttribute('content', next === 'dark' ? '#121212' : '#F3EFE7');
  };

  /* ------------------------------------------------------------------ smooth scroll + story */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    if (window.gsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToEl(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  const nav = $('#nav');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 20), { passive: true });
  $('#burger').onclick = () => $('#menu').classList.toggle('open');

  const storyState = (window.PENNANT_STORY = window.PENNANT_STORY || { p: 0 });
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const chapterRanges = [[-1, -1, 0.06, 0.12], [0.12, 0.18, 0.34, 0.4], [0.42, 0.48, 0.62, 0.68], [0.7, 0.76, 0.94, 1.01]];
  const chapters = $$('.chapter');
  const dots = $$('.rail-dots i');
  const cue = $('.cue');

  function paintStory(p) {
    storyState.p = p;
    chapters.forEach((el, i) => {
      const [a, b, c, d] = chapterRanges[i];
      const vis = ss(a, b, p) * (1 - ss(c, d, p));
      const enter = 1 - ss(a, b, p), leave = ss(c, d, p);
      const y = (enter * 40) - (leave * 40);
      el.style.opacity = i === 0 ? 1 - ss(0.06, 0.12, p) : vis;
      el.style.translate = `0 ${i === 0 ? -leave * 40 : y}px`;
      el.style.pointerEvents = (i === 0 ? p < 0.08 : vis > 0.5) ? 'auto' : 'none';
    });
    let active = 0;
    chapterRanges.forEach(([a, , , d], i) => { if (p >= Math.max(0, a) && p < d) active = i; });
    dots.forEach((d, i) => d.classList.toggle('on', i === active));
    if (cue) cue.style.opacity = 1 - ss(0.01, 0.05, p);
  }

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      trigger: '.story', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: self => paintStory(self.progress)
    });
  } else {
    const story = $('.story');
    addEventListener('scroll', () => {
      const max = story.offsetHeight - innerHeight;
      paintStory(Math.min(1, Math.max(0, (scrollY - story.offsetTop) / max)));
    }, { passive: true });
  }
  paintStory(0);

  function reveal(scope = document) {
    const els = $$('.reveal:not(.shown)', scope);
    if (reduce || !window.gsap) { els.forEach(e => { e.classList.add('shown'); e.style.opacity = 1; e.style.transform = 'none'; }); return; }
    ScrollTrigger.batch(els, {
      start: 'top 88%', once: true,
      onEnter: batch => {
        batch.forEach(e => e.classList.add('shown'));
        gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 });
      }
    });
  }

  /* ------------------------------------------------------------------ routing */
  function show(view) {
    $$('.view').forEach(v => v.classList.toggle('live', v.id === 'view-' + view));
    $('#menu').classList.remove('open');
    if (view === 'checkout') { orderDone = false; renderCheckout(); }
    window.scrollTo(0, 0);
    if (lenis) lenis.scrollTo(0, { immediate: true });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  function route() {
    if (location.hash === '#checkout') show('checkout');
    else if ($('#view-checkout').classList.contains('live')) show('home');
  }
  addEventListener('hashchange', route);

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (hash === '#checkout') return;
    e.preventDefault();
    closeAll();
    if (!$('#view-home').classList.contains('live')) {
      history.pushState(null, '', location.pathname);
      show('home');
      setTimeout(() => scrollToEl(hash === '#top' ? '#top' : hash), 60);
    } else {
      scrollToEl(hash);
    }
  });

  /* ------------------------------------------------------------------ overlays */
  const veil = $('#veil');
  let openEl = null;
  function openLayer(el) {
    closeAll();
    openEl = el;
    el.classList.add('on');
    el.setAttribute('aria-hidden', 'false');
    if (!el.classList.contains('pop')) {
      veil.classList.add('on');
      if (lenis) lenis.stop();
      document.body.style.overflow = 'hidden';
    }
  }
  function closeAll() {
    $$('.drawer.on, .sheet.on, .pop.on').forEach(el => { el.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); });
    veil.classList.remove('on');
    if (lenis) lenis.start();
    document.body.style.overflow = '';
    openEl = null;
  }
  veil.onclick = closeAll;
  $$('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s) closeAll(); }));
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeAll();
    const pop = $('#notes');
    if (pop.classList.contains('on') && !pop.contains(e.target) && !e.target.closest('#bellBtn')) closeAll();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  /* ------------------------------------------------------------------ products */
  async function loadProducts() {
    $('#grid').innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
    const res = await fetch('/api/products', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('products');
    products = await res.json();
    bag = bag.filter(l => products.some(p => p.id === l.id && p.stock > 0))
             .map(l => ({ id: l.id, qty: Math.min(l.qty, find(l.id).stock) }));
  }
  const find = id => products.find(p => p.id === id);

  function renderFilters() {
    const cats = ['All', ...new Set(products.map(p => p.cat))];
    if (!cats.includes(filter)) filter = 'All';
    $('#filters').innerHTML = cats.map(c => `<button class="chip ${c === filter ? 'on' : ''}" role="tab" aria-selected="${c === filter}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  }
  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    filter = b.dataset.cat;
    renderFilters();
    renderGrid(true);
  });

  function stockLabel(p) {
    if (p.stock <= 0) return '<span class="p-stock out">Out of stock</span>';
    if (p.stock <= 5) return `<span class="p-stock low">Only ${p.stock} left</span>`;
    return '<span class="p-stock">In stock</span>';
  }

  function renderGrid(animate) {
    const list = filter === 'All' ? products : products.filter(p => p.cat === filter);
    if (!list.length) { $('#grid').innerHTML = '<p class="empty">Nothing here yet. Ask us and we will source it.</p>'; return; }
    $('#grid').innerHTML = list.map(p => `
      <article class="product" data-id="${esc(p.id)}" tabindex="0" aria-label="${esc(p.name)}">
        <div class="plinth"><img src="${esc(photo(p, 800))}" alt="${esc(p.name)}" loading="lazy" onerror="this.src='${FALLBACK}'"></div>
        <div class="p-body">
          <div class="p-cat">${esc(p.cat)}</div>
          <h3 class="p-name">${esc(p.name)}</h3>
          <div class="p-row">
            <div><div class="p-price">${money(p.price)}</div>${stockLabel(p)}</div>
            <button class="add" data-add="${esc(p.id)}" aria-label="Add ${esc(p.name)} to bag" ${p.stock > 0 ? '' : 'disabled'}>${icon('i-plus')}</button>
          </div>
        </div>
      </article>`).join('');
    if (animate && window.gsap && !reduce) gsap.from('#grid .product', { opacity: 0, y: 30, duration: 0.8, ease: 'expo.out', stagger: 0.05 });
    else if (window.gsap && !reduce) {
      gsap.set('#grid .product', { opacity: 0, y: 40 });
      ScrollTrigger.batch('#grid .product', { start: 'top 90%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.07 }) });
    }
  }

  const grid = $('#grid');
  grid.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { e.stopPropagation(); addToBag(add.dataset.add, 1, add); return; }
    const card = e.target.closest('.product');
    if (card) openQuick(card.dataset.id);
  });
  grid.addEventListener('keydown', e => {
    const card = e.target.closest('.product');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openQuick(card.dataset.id); }
  });

  // pointer tilt with a travelling highlight
  if (!reduce && matchMedia('(hover: hover)').matches) {
    grid.addEventListener('pointermove', e => {
      const card = e.target.closest('.product');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.classList.add('tilting');
      card.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    grid.addEventListener('pointerout', e => {
      const card = e.target.closest('.product');
      if (!card || card.contains(e.relatedTarget)) return;
      card.classList.remove('tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  /* ------------------------------------------------------------------ quick view */
  function openQuick(id) {
    const p = find(id);
    if (!p) return;
    let qty = 1;
    const inBag = (bag.find(l => l.id === id) || {}).qty || 0;
    const room = Math.max(0, p.stock - inBag);
    const card = $('#quickCard');
    card.innerHTML = `
      <button class="icon-btn sheet-close" data-close aria-label="Close">${icon('i-close')}</button>
      <div class="plinth"><img src="${esc(photo(p, 1000))}" alt="${esc(p.name)}" onerror="this.src='${FALLBACK}'"></div>
      <div class="quick-info">
        <div class="p-cat">${esc(p.cat)}</div>
        <h2>${esc(p.name)}</h2>
        <p class="desc">${esc(p.desc)}</p>
        <div class="price">${money(p.price)}</div>
        ${stockLabel(p)}
        <div class="qty-row">
          <div class="stepper lg">
            <button data-q="-1" aria-label="One fewer">${icon('i-minus')}</button>
            <output id="qOut">1</output>
            <button data-q="1" aria-label="One more">${icon('i-plus')}</button>
          </div>
          <span class="muted" id="qNote">${inBag ? inBag + ' already in your bag' : ''}</span>
        </div>
        <button class="btn btn-solid btn-block btn-lg" id="qAdd" ${room > 0 ? '' : 'disabled'}>${room > 0 ? 'Add to bag' : (p.stock > 0 ? 'All in your bag' : 'Out of stock')}</button>
      </div>`;
    const sync = () => {
      $('#qOut').textContent = qty;
      $('[data-q="-1"]', card).disabled = qty <= 1;
      $('[data-q="1"]', card).disabled = qty >= room;
      $('#qAdd').textContent = room > 0 ? `Add ${qty} to bag  ·  ${money(qty * p.price)}` : $('#qAdd').textContent;
    };
    card.onclick = e => {
      const q = e.target.closest('[data-q]');
      if (q) { qty = Math.min(room, Math.max(1, qty + Number(q.dataset.q))); sync(); }
      if (e.target.closest('#qAdd')) { addToBag(id, qty); closeAll(); }
    };
    sync();
    openLayer($('#quick'));
  }

  /* ------------------------------------------------------------------ bag */
  function bagCount() { return bag.reduce((n, l) => n + l.qty, 0); }
  function subtotal() { return bag.reduce((n, l) => { const p = find(l.id); return n + (p ? p.price * l.qty : 0); }, 0); }

  function addToBag(id, qty = 1, fromBtn) {
    const p = find(id);
    if (!p || p.stock <= 0) return;
    const line = bag.find(l => l.id === id);
    const have = line ? line.qty : 0;
    const take = Math.min(qty, p.stock - have);
    if (take <= 0) { toast('That is all we have of that one'); return; }
    if (line) line.qty += take; else bag.push({ id, qty: take });
    saveBag();
    toast(`${take} × ${p.name} added`);
    const btn = $('#bagBtn');
    if (window.gsap && !reduce) gsap.fromTo(btn, { scale: 1 }, { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
    if (fromBtn && window.gsap && !reduce) gsap.fromTo(fromBtn, { rotate: 0 }, { rotate: 90, duration: 0.4, ease: 'back.out(3)', clearProps: 'rotate' });
  }

  function setQty(id, qty) {
    const p = find(id);
    const line = bag.find(l => l.id === id);
    if (!p || !line) return;
    if (qty > p.stock) { toast('That is all we have of that one'); qty = p.stock; }
    line.qty = qty;
    bag = bag.filter(l => l.qty > 0);
    saveBag();
  }

  function saveBag() {
    store.set('pennant-bag', bag);
    const n = bagCount();
    $('#bagCount').textContent = n;
    $('#bagCount').hidden = n === 0;
    renderBag();
    if ($('#view-checkout').classList.contains('live')) renderCheckout();
  }

  function lineHTML(l) {
    const p = find(l.id);
    if (!p) return '';
    return `
      <div class="line">
        <div class="thumb"><img src="${esc(photo(p, 200))}" alt="" onerror="this.src='${FALLBACK}'"></div>
        <div>
          <h4>${esc(p.name)}</h4>
          <div class="each">${money(p.price)} each</div>
          <div class="stepper">
            <button data-step="-1" data-id="${esc(p.id)}" aria-label="One fewer">${icon('i-minus', 'i-sm')}</button>
            <output>${l.qty}</output>
            <button data-step="1" data-id="${esc(p.id)}" aria-label="One more" ${l.qty >= p.stock ? 'disabled' : ''}>${icon('i-plus', 'i-sm')}</button>
          </div>
        </div>
        <div><div class="amt">${money(p.price * l.qty)}</div><button class="remove" data-remove="${esc(p.id)}">Remove</button></div>
      </div>`;
  }

  function renderBag() {
    $('#bagBody').innerHTML = bag.length ? bag.map(lineHTML).join('') : '<p class="empty">Your bag is empty.</p>';
    $('#bagTotal').textContent = money(subtotal());
    $('#toCheckout').disabled = !bag.length;
  }

  function onLineClick(e) {
    const s = e.target.closest('[data-step]');
    const r = e.target.closest('[data-remove]');
    if (s) { const l = bag.find(x => x.id === s.dataset.id); if (l) setQty(l.id, l.qty + Number(s.dataset.step)); }
    if (r) setQty(r.dataset.remove, 0);
  }
  $('#bagBody').addEventListener('click', onLineClick);
  $('#coLines').addEventListener('click', onLineClick);
  $('#bagBtn').onclick = () => openLayer($('#bag'));
  $('#toCheckout').onclick = () => { closeAll(); location.hash = 'checkout'; };

  /* ------------------------------------------------------------------ checkout */
  const DETAILS_KEY = 'pennant-details';

  function method() { return ($('input[name="method"]:checked') || {}).value || 'harare'; }
  function pay() { return ($('input[name="pay"]:checked') || {}).value || 'cash'; }

  let orderDone = false;
  function renderCheckout() {
    if (orderDone) return;
    $('#coDone').hidden = true;
    $('#coGrid').hidden = false;
    $('.co-title').hidden = false;
    $('#coLines').innerHTML = bag.length ? bag.map(lineHTML).join('') : '<p class="empty" style="padding:30px 0">Your bag is empty. <a class="text-btn" href="#collection">Browse the collection</a></p>';
    const sub = subtotal();
    $('#coSub').textContent = money(sub);
    $('#coShip').textContent = { harare: 'Included', country: 'Quoted', collect: 'Free' }[method()];
    $('#coTotal').textContent = money(sub) + (method() === 'country' ? ' + delivery' : '');
    $('#placeOrder').disabled = !bag.length;
    const collect = method() === 'collect';
    $('#addrFields').hidden = collect;
    $('#addrLine').hidden = collect;
    $('#coSignHint').hidden = !!user;
  }
  $('#coMethod').addEventListener('change', renderCheckout);

  function fillDetails() {
    const d = store.get(DETAILS_KEY, {});
    const set = (id, v) => { const el = $(id); if (el && !el.value && v) el.value = v; };
    set('#coName', (user && user.name) || d.name);
    set('#coEmail', (user && user.email) || d.email);
    set('#coPhone', d.phone);
    if (d.city) $('#coCity').value = d.city;
    set('#coSuburb', d.suburb);
    set('#coAddress', d.address);
  }

  $('#placeOrder').onclick = async () => {
    if (!bag.length) return;
    const v = id => $(id).value.trim();
    const need = ['#coName', '#coPhone'].concat(method() === 'collect' ? [] : ['#coCity', '#coAddress']);
    let bad = null;
    need.forEach(id => { const f = $(id).closest('.field'); const empty = !v(id); f.classList.toggle('bad', empty); if (empty && !bad) bad = $(id); });
    if (bad) { toast('A few details are missing'); bad.focus(); return; }

    const customer = {
      name: v('#coName'), phone: v('#coPhone'), email: v('#coEmail'),
      method: method(), payment: pay(),
      city: method() === 'collect' ? '' : v('#coCity'),
      suburb: method() === 'collect' ? '' : v('#coSuburb'),
      address: method() === 'collect' ? '' : v('#coAddress'),
      notes: v('#coNotes')
    };
    store.set(DETAILS_KEY, customer);

    const btn = $('#placeOrder');
    btn.disabled = true; btn.textContent = 'Placing order';
    let order = null;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: bag, customer })
      });
      if (res.ok) order = await res.json();
    } catch (e) { /* WhatsApp still works if the log fails */ }
    btn.disabled = false; btn.textContent = 'Place order';

    const methodText = { harare: 'Harare delivery', country: 'Countrywide delivery', collect: 'Collect in Harare' }[customer.method];
    const payText = { cash: 'Cash on delivery', ecocash: 'EcoCash', bank: 'Bank transfer' }[customer.payment];
    const lines = bag.map(l => { const p = find(l.id); return `${l.qty} x ${p.name} at ${money(p.price)}`; }).join('\n');
    const ref = order ? `Order #${order.id}` : 'New order';
    const text = `Hello Pennant, ${ref}.\n\n${lines}\n\nSubtotal: ${money(subtotal())}\n${methodText}${customer.address ? ': ' + [customer.address, customer.suburb, customer.city].filter(Boolean).join(', ') : ''}\nPayment: ${payText}\n\nName: ${customer.name}\nPhone: ${customer.phone}${customer.notes ? '\nNotes: ' + customer.notes : ''}`;
    const wa = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);

    $('#doneWa').href = wa;
    $('#doneText').textContent = (order ? `Your reference is #${order.id}. ` : '') + 'Tap below to send it to us on WhatsApp. We reply with stock, total and a delivery date before you pay anything.';
    orderDone = true;
    $('#coGrid').hidden = true;
    $('.co-title').hidden = true;
    $('#coDone').hidden = false;
    window.scrollTo(0, 0);
    if (lenis) lenis.scrollTo(0, { immediate: true });
    if (window.gsap && !reduce) gsap.from('#coDone', { opacity: 0, y: 40, scale: 0.98, duration: 1, ease: 'expo.out' });

    notify(order ? `Order #${order.id} received` : 'Order ready to send', `${bagCount()} item${bagCount() === 1 ? '' : 's'}, ${money(subtotal())}. Confirm on WhatsApp to lock it in.`);
    bag = [];
    saveBag();
    if (user) loadOrders();
  };

  /* ------------------------------------------------------------------ notifications */
  function renderNotes() {
    const unread = notes.some(n => !n.read);
    $('#bellDot').hidden = !unread;
    $('#notesBody').innerHTML = notes.length
      ? notes.map(n => `<div class="note ${n.read ? '' : 'unread'}"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><time>${new Date(n.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div>`).join('')
      : '<p class="muted" style="padding:18px 4px;font-size:15px">Nothing yet. Order updates and account news show up here.</p>';
    const canAsk = 'Notification' in window && Notification.permission === 'default';
    $('#notesEnable').hidden = !canAsk;
  }
  async function notify(title, body) {
    notes.unshift({ id: Date.now(), title, body, at: new Date().toISOString(), read: false });
    notes = notes.slice(0, 30);
    store.set('pennant-notes', notes);
    renderNotes();
    if (window.gsap && !reduce) gsap.fromTo('#bellBtn', { rotate: 0 }, { keyframes: [{ rotate: 14 }, { rotate: -12 }, { rotate: 8 }, { rotate: 0 }], duration: 0.6 });
    if ('Notification' in window && Notification.permission === 'granted' && store.get('pennant-alerts', true)) {
      try {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) reg.showNotification(title, { body, icon: '/pennant-mark.png', badge: '/pennant-mark.png' });
        else new Notification(title, { body, icon: '/pennant-mark.png' });
      } catch (e) {}
    }
  }
  async function askPermission() {
    if (!('Notification' in window)) { toast('This browser does not support alerts'); return false; }
    const r = await Notification.requestPermission();
    renderNotes();
    if (r === 'granted') { store.set('pennant-alerts', true); toast('Alerts are on'); return true; }
    toast('Alerts stay off. You can still see them here.');
    return false;
  }
  $('#bellBtn').onclick = e => {
    e.stopPropagation();
    const pop = $('#notes');
    if (pop.classList.contains('on')) { closeAll(); return; }
    openLayer(pop);
    setTimeout(() => { notes.forEach(n => (n.read = true)); store.set('pennant-notes', notes); $('#bellDot').hidden = true; }, 1200);
  };
  $('#notesClear').onclick = () => { notes = []; store.set('pennant-notes', notes); renderNotes(); };
  $('#notesEnable').onclick = askPermission;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  /* ------------------------------------------------------------------ account */
  let myOrders = [];
  async function api(action, body) {
    const res = await fetch('/api/account?action=' + action, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  function setUser(u) {
    user = u;
    const av = $('#avatar');
    av.hidden = !u;
    av.textContent = u ? (u.name || u.email || '?').trim().charAt(0).toUpperCase() : '';
    $('#userBtn svg').style.opacity = u ? 0 : 1;
    if (u) fillDetails();
    if ($('#view-checkout').classList.contains('live')) renderCheckout();
  }

  async function loadOrders() {
    try { myOrders = (await api('orders')).orders || []; } catch (e) { myOrders = []; }
    if ($('#account').classList.contains('on')) renderAccount('signed');
  }

  function renderAccount(mode) {
    const card = $('#accountCard');
    const close = `<button class="icon-btn sheet-close" data-close aria-label="Close">${icon('i-close')}</button>`;
    if (user) {
      const alertsOn = 'Notification' in window && Notification.permission === 'granted' && store.get('pennant-alerts', true);
      card.innerHTML = `${close}
        <span class="numeral" style="font-size:28px">Salve,</span>
        <h2>${esc(user.name || 'there')}.</h2>
        <p class="sub">${esc(user.email)}</p>
        <h3 style="font-size:17px;margin-bottom:10px">Your orders</h3>
        <div class="orders">${myOrders.length ? myOrders.map(o => `
          <div class="order"><b>#${o.id} · ${money(o.total)}</b>
          <small>${new Date(o.created_at).toLocaleDateString([], { dateStyle: 'medium' })} · ${o.items.reduce((n, i) => n + i.qty, 0)} items · ${esc(o.status || 'received')}</small></div>`).join('')
          : '<p class="muted" style="font-size:15px">No orders yet.</p>'}</div>
        <label class="switch">Order alerts on this device<input type="checkbox" id="alertSwitch" ${alertsOn ? 'checked' : ''}></label>
        <button class="btn btn-ghost btn-block" id="signOut" style="margin-top:12px">Sign out</button>`;
      $('#alertSwitch').onchange = async e => {
        if (e.target.checked) { const ok = Notification.permission === 'granted' || await askPermission(); store.set('pennant-alerts', ok); e.target.checked = ok; }
        else store.set('pennant-alerts', false);
      };
      $('#signOut').onclick = async () => {
        try { await api('logout', {}); } catch (e) {}
        setUser(null); myOrders = []; closeAll(); toast('Signed out');
      };
      return;
    }

    const isUp = mode === 'up';
    card.innerHTML = `${close}
      <span class="numeral" style="font-size:28px">${isUp ? 'Benvenuto.' : 'Bentornato.'}</span>
      <h2>${isUp ? 'Create an account.' : 'Sign in.'}</h2>
      <p class="sub">Keep your orders and details in one place. Optional, you can always check out as a guest.</p>
      <div class="tabs"><button data-mode="in" class="${isUp ? '' : 'on'}">Sign in</button><button data-mode="up" class="${isUp ? 'on' : ''}">Create account</button></div>
      <form id="authForm" novalidate>
        ${isUp ? '<label class="field"><span>Name</span><input id="auName" autocomplete="name" required></label>' : ''}
        <label class="field"><span>Email or username</span><input id="auId" autocomplete="${isUp ? 'email' : 'username'}" required></label>
        <label class="field"><span>Password</span><input id="auPw" type="password" autocomplete="${isUp ? 'new-password' : 'current-password'}" minlength="8" required></label>
        <p class="err" id="auErr"></p>
        <button class="btn btn-solid btn-block btn-lg" type="submit">${isUp ? 'Create account' : 'Sign in'}</button>
      </form>
      ${config.googleClientId ? '<div class="or">or</div><div class="gbtn" id="gbtn"></div>' : ''}`;
    $$('[data-mode]', card).forEach(b => (b.onclick = () => renderAccount(b.dataset.mode)));
    $('#authForm').onsubmit = async e => {
      e.preventDefault();
      const id = $('#auId').value.trim(), pw = $('#auPw').value;
      const name = isUp ? $('#auName').value.trim() : undefined;
      if (!id || !pw || (isUp && !name)) { $('#auErr').textContent = 'Fill in every field.'; return; }
      if (isUp && pw.length < 8) { $('#auErr').textContent = 'Use at least 8 characters for the password.'; return; }
      const btn = $('#authForm button[type="submit"]');
      btn.disabled = true;
      try {
        const data = await api(isUp ? 'signup' : 'login', { id, password: pw, name });
        signedIn(data.user, isUp);
      } catch (err) { $('#auErr').textContent = err.message; }
      btn.disabled = false;
    };
    if (config.googleClientId) mountGoogle();
  }

  function signedIn(u, isNew) {
    setUser(u);
    closeAll();
    toast(isNew ? 'Welcome to Pennant' : 'Signed in');
    if (isNew) notify('Welcome to Pennant', 'Your orders will now be saved to your account.');
    loadOrders();
  }

  function mountGoogle() {
    const go = () => {
      if (!window.google || !google.accounts) return;
      google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async r => {
          try { const data = await api('google', { credential: r.credential }); signedIn(data.user, data.created); }
          catch (err) { const e = $('#auErr'); if (e) e.textContent = err.message; }
        }
      });
      const dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
      google.accounts.id.renderButton($('#gbtn'), { theme: dark ? 'filled_black' : 'outline', shape: 'pill', size: 'large', text: 'continue_with', width: 320 });
    };
    if (window.google && google.accounts) return go();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = go;
    document.head.appendChild(s);
  }

  function openAccount() { renderAccount(user ? 'signed' : 'in'); openLayer($('#account')); }
  $('#userBtn').onclick = openAccount;
  document.addEventListener('click', e => { if (e.target.closest('[data-open-account]')) openAccount(); });

  /* ------------------------------------------------------------------ request form */
  $('#requestForm').onsubmit = e => {
    e.preventDefault();
    const need = $('#rqNeed').value.trim();
    if (!need) { toast('Tell us what you need first'); $('#rqNeed').focus(); return; }
    const text = `Hello Pennant.\n\nName: ${$('#rqName').value.trim() || 'Not given'}\nCompany: ${$('#rqCompany').value.trim() || 'Not given'}\n\nRequest: ${need}`;
    window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  };

  /* ------------------------------------------------------------------ boot */
  $('#year').textContent = '© ' + new Date().getFullYear() + ' Pennant';
  renderNotes();

  (async () => {
    try { await loadProducts(); }
    catch (e) { toast('Could not load products. Check your connection and refresh.'); products = []; }
    renderFilters();
    renderGrid();
    saveBag();
    reveal();
    route();
    fillDetails();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  })();

  api('me').then(d => { config.googleClientId = d.googleClientId || null; setUser(d.user || null); if (d.user) loadOrders(); }).catch(() => {});
})();
