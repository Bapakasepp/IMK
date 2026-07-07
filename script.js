const appHistory = [];
let currentScreen = 'splash';
let qty = 1;
let selectedSize = 'S';
let selectedPay = 'gopay';
let wishItems = ['Earphone TWS Pro', 'Batik Tulis Premium'];
let cartItems = [];
let checkoutItems = null;
let checkoutSource = 'default';

const CART_STORAGE_KEY = 'pasarkita_cart_v1';
const USER_STORAGE_KEY = 'pasarkita_user_name_v1';
const CHAT_STORAGE_KEY = 'pasarkita_chat_slots_v1';
const NOTIF_STORAGE_KEY = 'pasarkita_notifications_v1';
const ORDER_STORAGE_KEY = 'pasarkita_orders_v1';
let currentUserName = 'Rina Dewi';
let chatSlots = [];
let activeChatId = null;
let notificationItems = [];
let orderHistory = [];
let notifFilter = 'all';
let flashSaleEndsAt = Date.now() + (3 * 60 * 60 + 24 * 60) * 1000;
let flashSaleSeed = 0;
let callInterval = null;
let callStartedAt = 0;
let callMuted = false;
const productCatalog = {
  batik: {
    id: 'batik',
    name: 'Batik Tulis Premium Motif Parang',
    shop: 'Toko Batik Adi',
    emoji: '👘',
    bg: '#e8f0fd',
    price: 185000
  }
};
const defaultCheckoutItem = { ...productCatalog.batik, key: 'batik-L', variant: 'L', qty: 1 };
let selectedProduct = { ...productCatalog.batik };

function $(id) { return document.getElementById(id); }
function $all(selector) { return Array.from(document.querySelectorAll(selector)); }

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function sanitizeUserName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 40);
}

function updateUserUI() {
  $all('[data-user-name]').forEach(el => { el.textContent = currentUserName; });
  const input = $('user-fullname');
  if (input && !input.value.trim()) input.value = currentUserName === 'Rina Dewi' ? '' : currentUserName;
}

function saveUserName(name) {
  const clean = sanitizeUserName(name) || 'Pengguna PasarKita';
  currentUserName = clean;
  try { localStorage.setItem(USER_STORAGE_KEY, clean); } catch (_) {}
  updateUserUI();
  return clean;
}

function loadUserName() {
  try {
    const saved = sanitizeUserName(localStorage.getItem(USER_STORAGE_KEY));
    if (saved) currentUserName = saved;
  } catch (_) {}
  updateUserUI();
}

function loginUser(useGoogle = false) {
  const nameInput = $('user-fullname');
  const usernameInput = $('user-username');
  const typedName = sanitizeUserName(nameInput?.value);
  const typedUsername = sanitizeUserName(usernameInput?.value);
  const name = typedName || typedUsername || (useGoogle ? 'Pengguna Google' : 'Pengguna PasarKita');
  saveUserName(name);
  showToast('👋 Selamat datang, ' + currentUserName + '!');
  goTo('home');
}

function editUserName() {
  const nextName = sanitizeUserName(window.prompt('Masukkan nama baru:', currentUserName));
  if (!nextName) {
    showToast('Nama tidak diubah');
    return;
  }
  saveUserName(nextName);
  showToast('✅ Nama profil diperbarui');
}

function logoutUser() {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(NOTIF_STORAGE_KEY);
    localStorage.removeItem(ORDER_STORAGE_KEY);
  } catch (_) {}
  currentUserName = 'Rina Dewi';
  cartItems = [];
  checkoutItems = null;
  checkoutSource = 'default';
  selectedPay = 'gopay';
  chatSlots = [];
  activeChatId = null;
  notificationItems = [];
  orderHistory = [];
  ['user-fullname', 'user-username'].forEach(id => { const el = $(id); if (el) el.value = ''; });
  document.querySelectorAll('#screen-signup input').forEach(input => { input.value = ''; });
  updateUserUI();
  updateCartUI();
  updateCheckoutUI();
  appHistory.length = 0;

  const cur = $('screen-' + currentScreen) || document.querySelector('.screen.active');
  const login = $('screen-signup');
  if (cur && login && cur !== login) cur.classList.remove('active');
  if (login) {
    login.classList.remove('prev');
    login.classList.add('active');
    currentScreen = 'signup';
  } else {
    goTo('signup');
  }
  showToast('🚪 Berhasil logout. Silakan buat/masuk akun lagi.');
}

function showToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function parsePrice(text) {
  const num = String(text || '').replace(/[^0-9]/g, '');
  return Number.parseInt(num, 10) || 0;
}

function makeProductId(name) {
  const base = String(name || 'produk')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'produk';
  return base;
}

function normalizeCartItem(raw) {
  if (!raw) return null;
  const fallback = productCatalog[raw.id] || raw;
  const id = String(fallback.id || raw.id || makeProductId(fallback.name));
  const name = String(fallback.name || 'Produk');
  const price = Number(fallback.price || raw.price || 0);
  if (!price) return null;
  const product = {
    id,
    name,
    shop: String(fallback.shop || raw.shop || 'Toko Lokal'),
    emoji: String(fallback.emoji || raw.emoji || '🛍️'),
    bg: String(fallback.bg || raw.bg || 'var(--surface-2)'),
    price
  };
  productCatalog[id] = product;
  const variant = String(raw.variant || '').slice(0, 10);
  const qtyVal = Math.max(1, Math.min(99, Number.parseInt(raw.qty, 10) || 1));
  return {
    ...product,
    key: `${id}-${variant || 'default'}`,
    variant,
    qty: qtyVal
  };
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems.map(item => ({
      id: item.id,
      name: item.name,
      shop: item.shop,
      emoji: item.emoji,
      bg: item.bg,
      price: item.price,
      variant: item.variant,
      qty: item.qty
    }))));
  } catch (_) {}
}

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    cartItems = Array.isArray(raw) ? raw.map(normalizeCartItem).filter(Boolean) : [];
  } catch (_) {
    cartItems = [];
  }
}

function getUnitPrice(item) {
  const amount = Number(item?.qty || 1);
  if (item?.id === 'batik' || item?.id === 'batik-tulis-premium-motif-parang') {
    if (amount >= 21) return 130000;
    if (amount >= 6) return 155000;
  }
  return Number(item?.price || 0);
}

function getCartTotals(items = cartItems) {
  return items.reduce((acc, item) => {
    const cleanQty = Math.max(0, Number(item.qty) || 0);
    acc.qty += cleanQty;
    acc.total += cleanQty * getUnitPrice(item);
    return acc;
  }, { qty: 0, total: 0 });
}

function getCheckoutItems() {
  if (Array.isArray(checkoutItems) && checkoutItems.length) return checkoutItems;
  if (cartItems.length) return cartItems;
  return [defaultCheckoutItem];
}

function getShopForProduct(category, name = '') {
  const n = String(name).toLowerCase();
  if (n.includes('batik')) return 'Toko Batik Adi';
  const shops = {
    fashion: 'Butik Nusantara',
    elektronik: 'Gadget Semarang',
    kuliner: 'Dapur Nusantara',
    kerajinan: 'Kriya Handmade',
    kecantikan: 'Beauty Lokal'
  };
  return shops[category] || 'Toko Lokal PasarKita';
}

function getCategoryLabel(category) {
  return ({
    fashion: 'fashion/pakaian',
    elektronik: 'elektronik/gadget',
    kuliner: 'kuliner/makanan',
    kerajinan: 'kerajinan handmade',
    kecantikan: 'kecantikan/perawatan'
  })[category] || 'produk toko ini';
}

function detectQuestionCategory(q) {
  const text = String(q || '').toLowerCase();
  const checks = [
    ['elektronik', ['earphone','tws','speaker','bluetooth','power bank','smartwatch','charger','kabel','usb','hp','gadget','garansi elektronik']],
    ['kuliner', ['makanan','mie','ayam','keripik','tempe','kopi','rendang','kue','lapis','minum','halal','pedas','rasa','porsi']],
    ['kecantikan', ['serum','masker','wajah','lipstik','lulur','sabun','skincare','bpom','jerawat','kulit','makeup','kosmetik']],
    ['kerajinan', ['vas','keramik','anyaman','rotan','ukiran','kayu','wayang','tas anyaman','handmade','pajangan','dekorasi']],
    ['fashion', ['baju','batik','kaos','hijab','sepatu','sneakers','tas','kain','pakaian','fashion']]
  ];
  const found = checks.find(([, words]) => words.some(word => text.includes(word)));
  return found ? found[0] : '';
}

function isQuestionRelevantToStore(question, product) {
  const askedCategory = detectQuestionCategory(question);
  if (!askedCategory) return true;
  return askedCategory === (product?.category || 'produk') || (askedCategory === 'fashion' && String(product?.name || '').toLowerCase().includes('batik'));
}

function extractProductFromCard(card) {
  if (!card) return { ...selectedProduct };
  const name = card.querySelector('.product-name')?.textContent?.trim() || 'Produk';
  const priceText = card.querySelector('.product-price')?.textContent || '0';
  const oldPriceText = card.querySelector('.product-old-price')?.textContent || '';
  const img = card.querySelector('.product-img');
  const imgClone = img ? img.cloneNode(true) : null;
  if (imgClone) imgClone.querySelectorAll('button, div').forEach(el => el.remove());
  const emoji = imgClone?.textContent?.trim() || '🛍️';
  const id = makeProductId(name);
  const product = {
    id,
    name,
    shop: getShopForProduct(card.dataset.cat || 'produk', name),
    emoji,
    bg: img?.style?.background || 'var(--surface-2)',
    price: parsePrice(priceText),
    oldPrice: parsePrice(oldPriceText),
    category: card.dataset.cat || 'produk'
  };
  productCatalog[id] = product;
  return product;
}

function setSelectedProduct(product) {
  if (!product || !product.price) product = productCatalog.batik;
  selectedProduct = { ...product };
  productCatalog[selectedProduct.id] = { ...selectedProduct };
  populateDetail(selectedProduct);
}

function renderDetailDots() {
  return '<div class="detail-dots"><div class="detail-dot on"></div><div class="detail-dot"></div><div class="detail-dot"></div><div class="detail-dot"></div></div>';
}

function populateDetail(product = selectedProduct) {
  const detailImg = document.querySelector('#screen-detail .detail-imgs');
  if (detailImg) {
    detailImg.style.background = product.bg || 'var(--surface-2)';
    detailImg.innerHTML = `${escapeHTML(product.emoji || '🛍️')}${renderDetailDots()}`;
  }
  const nameEl = document.querySelector('#screen-detail .detail-name');
  if (nameEl) nameEl.textContent = `${product.name} — ${product.shop || 'Toko Lokal'}`;
  const priceEl = document.querySelector('#screen-detail .detail-price');
  if (priceEl) priceEl.textContent = formatRupiah(product.price);
  const oldEl = document.querySelector('#screen-detail .detail-old');
  if (oldEl) {
    oldEl.textContent = product.oldPrice ? formatRupiah(product.oldPrice) : '';
    oldEl.style.display = product.oldPrice ? '' : 'none';
  }
  const discEl = document.querySelector('#screen-detail .detail-disc');
  if (discEl) {
    const discount = product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;
    discEl.textContent = discount ? `-${discount}%` : 'Best';
    discEl.style.display = discount ? '' : 'none';
  }
  const shopEl = Array.from(document.querySelectorAll('#screen-detail .detail-body div'))
    .find(el => el.textContent === 'Toko Batik Adi');
  if (shopEl) shopEl.textContent = product.shop || 'Toko Lokal';
  const isBatik = product.id === 'batik-tulis-premium-motif-parang' || product.id === 'batik';
  const showSize = isBatik || product.category === 'fashion';
  const sectionTitles = Array.from(document.querySelectorAll('#screen-detail .detail-section-title'));
  const sizeTitle = sectionTitles.find(el => el.textContent.includes('Pilih Ukuran'));
  if (sizeTitle) {
    sizeTitle.style.display = showSize ? '' : 'none';
    if (sizeTitle.nextElementSibling) sizeTitle.nextElementSibling.style.display = showSize ? '' : 'none';
  }
  const qtyTitle = sectionTitles.find(el => el.textContent.includes('Jumlah'));
  if (qtyTitle) qtyTitle.textContent = isBatik ? 'Jumlah & Harga Grosir' : 'Jumlah';
  const tierTable = document.querySelector('#screen-detail .tier-table');
  if (tierTable) tierTable.style.display = isBatik ? '' : 'none';
}

function openProductFromCard(card) {
  setSelectedProduct(extractProductFromCard(card));
  goTo('detail');
}

function openDefaultDetail() {
  setSelectedProduct(selectedProduct || productCatalog.batik);
  goTo('detail');
}

function addSelectedToCart(amount = 1) {
  if (!selectedProduct?.id) selectedProduct = { ...productCatalog.batik };
  productCatalog[selectedProduct.id] = { ...selectedProduct };
  addToCart(selectedProduct.id, amount);
}

function buySelectedNow(amount = 1) {
  if (!selectedProduct?.id) selectedProduct = { ...productCatalog.batik };
  productCatalog[selectedProduct.id] = { ...selectedProduct };
  buyNow(selectedProduct.id, amount);
}

function setNav(i) {
  $all('.bottom-nav').forEach(nav => {
    Array.from(nav.querySelectorAll('.nav-item')).forEach((item, idx) => {
      item.classList.toggle('active', idx === i);
    });
  });
}

function updateNavByScreen(screenId) {
  const map = { home: 0, wishlist: 1, chat: 2, profile: 3 };
  if (Object.prototype.hasOwnProperty.call(map, screenId)) setNav(map[screenId]);
}

function goTo(id) {
  const next = $('screen-' + id);
  if (!next || id === currentScreen) return false;

  const cur = $('screen-' + currentScreen) || document.querySelector('.screen.active');
  if (cur) {
    appHistory.push(currentScreen);
    cur.classList.remove('active');
    cur.classList.add('prev');
    setTimeout(() => cur.classList.remove('prev'), 320);
  }

  next.classList.remove('prev');
  next.classList.add('active');
  currentScreen = id;
  updateNavByScreen(id);
  updateCartUI();
  if (id === 'checkout') updateCheckoutUI();
  if (id === 'notifications') renderNotifications();
  if (id === 'flash') { renderFlashSale(); updateFlashCountdown(); }
  if (id === 'chat') {
    if (activeChatId) { setChatView('conversation'); renderChatMessages(); updateSellerChatUI(); }
    else openChatInbox();
  }
  return true;
}

function goBack() {
  while (appHistory.length) {
    const prev = appHistory.pop();
    const prevEl = $('screen-' + prev);
    if (!prevEl || prev === currentScreen) continue;

    const cur = $('screen-' + currentScreen);
    if (cur) cur.classList.remove('active');
    prevEl.classList.remove('prev');
    prevEl.classList.add('active');
    currentScreen = prev;
    updateNavByScreen(prev);
    updateCartUI();
    if (prev === 'checkout') updateCheckoutUI();
    return true;
  }
  return false;
}

function setRole(role) {
  ['buyer', 'seller', 'reseller'].forEach(r => $('role-' + r)?.classList.remove('active'));
  $('role-' + role)?.classList.add('active');
}

function filterCat(el, name, key) {
  $all('.cat-chip').forEach(c => c.classList.remove('active'));
  el?.classList.add('active');

  const cards = $all('#products-grid .product-card');
  let visibleCount = 0;
  cards.forEach(card => {
    const match = key === 'semua' || card.dataset.cat === key;
    card.style.display = match ? '' : 'none';
    if (match) visibleCount++;
  });

  const empty = $('empty-cat');
  if (empty) empty.style.display = visibleCount === 0 ? 'block' : 'none';
  showToast('📂 Kategori: ' + name + (visibleCount ? ' · ' + visibleCount + ' produk' : ''));
}

function toggleWish(id, name) {
  const btn = $(id);
  if (!btn) return;
  const liked = btn.classList.toggle('liked');
  btn.textContent = liked ? '❤️' : '🤍';
  showToast(liked ? '❤️ ' + name + ' disimpan ke wishlist!' : '💔 Dihapus dari wishlist');
}

function removeWish(id) {
  const el = $(id);
  if (!el) return;
  el.style.transition = 'all 0.3s';
  el.style.opacity = '0';
  el.style.transform = 'translateX(100%)';
  setTimeout(() => {
    el.style.display = 'none';
    showToast('🗑️ Dihapus dari wishlist');
  }, 300);
}

function changeQty(delta) {
  qty = Math.max(1, Math.min(99, qty + Number(delta || 0)));
  const qtyEl = $('qty-num');
  if (qtyEl) qtyEl.textContent = qty;
  const price = getUnitPrice({ id: 'batik', price: productCatalog.batik.price, qty });
  if (qty >= 6) showToast('💰 Harga grosir berlaku! ' + formatRupiah(price) + '/pcs');
}

function selectSize(size) {
  const normalized = String(size || 'S').toUpperCase();
  ['S', 'M', 'L', 'XL'].forEach(sz => $('sz-' + sz.toLowerCase())?.classList.remove('selected'));
  $('sz-' + normalized.toLowerCase())?.classList.add('selected');
  selectedSize = normalized;
  showToast('📏 Ukuran ' + normalized + ' dipilih');
}

function selectPay(method) {
  ['gopay', 'bca', 'cod', 'qris'].forEach(m => {
    const el = $('pay-' + m);
    if (!el) return;
    el.classList.remove('selected');
    const check = el.querySelector('.payment-opt-check');
    if (check) {
      check.textContent = '';
      check.style.background = '';
      check.style.borderColor = 'var(--border)';
    }
  });

  const selected = $('pay-' + method);
  if (!selected) return;
  selected.classList.add('selected');
  const check = selected.querySelector('.payment-opt-check');
  if (check) {
    check.textContent = '✓';
    check.style.background = 'var(--primary)';
    check.style.borderColor = 'var(--primary)';
  }
  selectedPay = method;
  const qrisPanel = $('qris-panel');
  if (qrisPanel) qrisPanel.classList.toggle('show', method === 'qris');
  if (method === 'qris') renderFakeQRIS();
}

function chatIdForProduct(product = selectedProduct) {
  return makeProductId(product?.shop || 'toko-lokal');
}

function makeWelcomeMessage(product = selectedProduct) {
  return `Halo kak ${currentUserName}! Selamat datang di ${product.shop}. Saya asisten toko untuk produk ${product.name}. Silakan tanya harga, stok, pengiriman, pembayaran, atau detail produk ya 😊`;
}

function saveChatSlots() {
  try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatSlots)); } catch (_) {}
}

function loadChatSlots() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    chatSlots = Array.isArray(raw) ? raw.filter(slot => slot && slot.id && slot.shop && Array.isArray(slot.messages)) : [];
  } catch (_) { chatSlots = []; }
}

function ensureChatSlot(product = selectedProduct) {
  if (!product?.id) product = productCatalog.batik;
  const id = chatIdForProduct(product);
  let slot = chatSlots.find(item => item.id === id);
  if (!slot) {
    slot = {
      id,
      shop: product.shop || 'Toko Lokal PasarKita',
      avatar: product.emoji || '🏪',
      product: { ...product },
      messages: [{ from: 'them', text: makeWelcomeMessage(product), time: 'Sekarang' }],
      unread: 0,
      updatedAt: Date.now()
    };
    chatSlots.unshift(slot);
  } else {
    slot.product = { ...slot.product, ...product };
    slot.avatar = product.emoji || slot.avatar || '🏪';
    slot.updatedAt = Date.now();
  }
  saveChatSlots();
  return slot;
}

function saveNotifications() {
  try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notificationItems.slice(0, 40))); } catch (_) {}
}

function loadNotifications() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]');
    notificationItems = Array.isArray(raw) ? raw.filter(Boolean) : [];
  } catch (_) { notificationItems = []; }
}

function saveOrderHistory() {
  try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orderHistory.slice(0, 30))); } catch (_) {}
}

function loadOrderHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || '[]');
    orderHistory = Array.isArray(raw) ? raw.filter(Boolean) : [];
  } catch (_) { orderHistory = []; }
}

function addNotification(type, icon, title, text, time = 'Baru saja') {
  notificationItems.unshift({ type, icon, title, text, time, id: Date.now() + '-' + Math.random().toString(16).slice(2) });
  notificationItems = notificationItems.slice(0, 40);
  saveNotifications();
  renderNotifications();
  const dot = $('notif-dot');
  if (dot) dot.style.display = '';
}

function getActiveChatSlot() {
  return chatSlots.find(slot => slot.id === activeChatId) || null;
}

function setChatView(mode) {
  const list = $('chat-list-view');
  const body = $('chat-body');
  const quick = $('quick-replies');
  const input = $('chat-input-bar');
  const isList = mode === 'list';
  list?.classList.toggle('show', isList);
  body?.classList.toggle('chat-view-hidden', isList);
  quick?.classList.toggle('chat-view-hidden', isList);
  input?.classList.toggle('chat-view-hidden', isList);
  const nameEl = document.querySelector('.chat-name');
  const statusEl = document.querySelector('.chat-status');
  const avatarEl = document.querySelector('.chat-avatar');
  if (isList) {
    if (nameEl) nameEl.textContent = 'Chat Saya';
    if (statusEl) statusEl.textContent = chatSlots.length ? `${chatSlots.length} toko pernah dihubungi` : 'Mulai obrolan dari detail produk';
    if (avatarEl) avatarEl.textContent = '💬';
  }
}

function renderChatSlots() {
  const wrap = $('chat-slots');
  const empty = $('chat-empty-state');
  if (!wrap || !empty) return;
  const sorted = [...chatSlots].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  empty.style.display = sorted.length ? 'none' : 'flex';
  wrap.innerHTML = sorted.map(slot => {
    const last = slot.messages[slot.messages.length - 1]?.text || 'Belum ada pesan';
    return `<div class="chat-slot" onclick="openChatSlot('${escapeHTML(slot.id)}')">
      <div class="chat-slot-avatar">${escapeHTML(slot.avatar || '🏪')}</div>
      <div class="chat-slot-info">
        <div class="chat-slot-name">${escapeHTML(slot.shop)}</div>
        <div class="chat-slot-product">${escapeHTML(slot.product?.name || 'Produk toko')}</div>
        <div class="chat-slot-last">${escapeHTML(last)}</div>
      </div>
      <div class="chat-slot-meta">
        <div class="chat-slot-time">${slot.messages[slot.messages.length - 1]?.time || 'Sekarang'}</div>
        ${slot.unread ? `<div class="chat-unread">${slot.unread}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderChatMessages() {
  const body = $('chat-body');
  const slot = getActiveChatSlot();
  if (!body || !slot) return;
  body.innerHTML = '<div style="text-align:center; font-size:11px; color:var(--text-3); padding:4px 0;">Hari ini</div>' +
    slot.messages.map(msg => `<div class="msg ${msg.from === 'me' ? 'me' : 'them'}"><div class="bubble">${escapeHTML(msg.text)}</div><div class="msg-time">${escapeHTML(msg.time || 'Sekarang')}</div></div>`).join('');
  body.scrollTop = body.scrollHeight;
}

function openChatInbox() {
  activeChatId = null;
  renderChatSlots();
  if (currentScreen !== 'chat') goTo('chat');
  setChatView('list');
  updateSellerChatUI();
}

function chatBack() {
  if (activeChatId) {
    openChatInbox();
    return;
  }
  goBack();
}

function openChatSlot(id) {
  const slot = chatSlots.find(item => item.id === id);
  if (!slot) return openChatInbox();
  activeChatId = id;
  slot.unread = 0;
  selectedProduct = { ...slot.product };
  productCatalog[selectedProduct.id] = { ...selectedProduct };
  saveChatSlots();
  setChatView('conversation');
  updateSellerChatUI();
  renderChatMessages();
}

function startChatWithSelectedProduct() {
  const slot = ensureChatSlot(selectedProduct);
  activeChatId = slot.id;
  if (currentScreen !== 'chat') goTo('chat');
  openChatSlot(slot.id);
}

function addMessageToActiveChat(from, text) {
  let slot = getActiveChatSlot();
  if (!slot) {
    slot = ensureChatSlot(selectedProduct);
    activeChatId = slot.id;
  }
  slot.messages.push({ from, text, time: 'Sekarang' });
  slot.updatedAt = Date.now();
  saveChatSlots();
  if (from === 'them') addNotification('chat', '💬', 'Balasan dari ' + slot.shop, text, 'Baru saja');
  renderChatMessages();
  renderChatSlots();
}

function getCurrentSellerName() {
  return selectedProduct?.shop || 'Toko Lokal PasarKita';
}

function updateSellerChatUI() {
  const slot = getActiveChatSlot();
  if (!slot) {
    setChatView('list');
    renderChatSlots();
    return;
  }
  const sellerName = slot.shop || getCurrentSellerName();
  const product = slot.product || selectedProduct;
  document.querySelectorAll('.chat-name').forEach(el => { el.textContent = sellerName; });
  document.querySelectorAll('.chat-avatar').forEach(el => { el.textContent = slot.avatar || product.emoji || '🏪'; });
  const statusEl = document.querySelector('.chat-status');
  if (statusEl) statusEl.textContent = `🟢 Online · Membahas ${product.name || 'produk toko'}`;
}

function generateSellerReply(question) {
  const q = String(question || '').toLowerCase();
  const product = selectedProduct || productCatalog.batik;
  const productName = product.name || 'produk ini';
  const seller = product.shop || getCurrentSellerName();
  const price = formatRupiah(product.price || 0);
  const isBatik = product.id === 'batik' || product.id === 'batik-tulis-premium-motif-parang' || productName.toLowerCase().includes('batik');
  const has = (...words) => words.some(word => q.includes(word));
  if (!isQuestionRelevantToStore(question, product)) {
    const askedCategory = detectQuestionCategory(question);
    return `Mohon maaf kak, ${seller} tidak menjual produk ${getCategoryLabel(askedCategory)}. Toko ini fokus pada ${getCategoryLabel(product.category)} seperti ${productName}. Saya bisa bantu jawab seputar stok, harga, varian, pengiriman, dan pembayaran untuk produk toko ini ya.`;
  }

  if (has('hai', 'halo', 'hello', 'pagi', 'siang', 'sore', 'malam')) {
    return `Halo kak ${currentUserName}! Saya asisten ${seller}. Mau tanya tentang ${productName} atau produk lain? 😊`;
  }
  if (has('harga', 'berapa', 'price', 'biaya')) {
    return `Harga ${productName} saat ini ${price}. ${isBatik ? 'Untuk pembelian grosir: 6–20 pcs Rp 155.000/pcs, 21+ pcs Rp 130.000/pcs.' : 'Kalau kakak beli lebih dari satu, kami bisa bantu cek promo yang tersedia.'}`;
  }
  if (has('stok', 'ready', 'tersedia', 'ada barang', 'habis')) {
    return `Stok ${productName} masih tersedia kak. Untuk pesanan banyak, sebutkan jumlah yang dibutuhkan agar saya bantu cek ketersediaannya lebih akurat.`;
  }
  if (has('ukuran', 'size', 's ', ' m ', ' l ', 'xl')) {
    return isBatik || product.category === 'fashion'
      ? `Untuk ${productName}, pilihan ukuran tersedia S, M, L, dan XL. Kakak mau saya bantu pilihkan ukuran berdasarkan tinggi/berat badan?`
      : `${productName} tidak memakai pilihan ukuran kak, jadi bisa langsung checkout sesuai jumlah yang diinginkan.`;
  }
  if (has('warna', 'motif', 'varian')) {
    return isBatik
      ? 'Motif utama yang tersedia adalah Parang. Warna bisa kami bantu cek: biru dongker, coklat, dan merah hati. Kakak minat warna apa?'
      : `Untuk varian ${productName}, kami bisa bantu cek pilihan yang tersedia. Kakak ingin warna/model tertentu?`;
  }
  if (has('bahan', 'material', 'kualitas', 'asli', 'original')) {
    return `${productName} kami cek kualitasnya sebelum dikirim. Produk dikemas aman dan sesuai deskripsi etalase. Jika kakak butuh detail bahan/spesifikasi, sebutkan bagian yang ingin dicek ya.`;
  }
  if (has('ongkir', 'pengiriman', 'kirim', 'sampai', 'estimasi', 'berapa hari')) {
    return 'Estimasi pengiriman ke Semarang sekitar 2–3 hari kerja. Ongkir mengikuti alamat dan kurir, tetapi untuk banyak produk tersedia promo gratis ongkir di aplikasi.';
  }
  if (has('cod', 'bayar di tempat')) {
    return 'COD bisa dipilih jika area dan kurir mendukung. Jika opsi COD tidak muncul saat checkout, kakak bisa memakai GoPay, Transfer BCA, atau QRIS.';
  }
  if (has('qris', 'qr', 'scan')) {
    return 'Bisa kak, pembayaran QRIS tersedia di halaman checkout. Pilih metode QRIS, lalu scan kode QR yang tampil menggunakan e-wallet atau mobile banking.';
  }
  if (has('bayar', 'pembayaran', 'transfer', 'gopay', 'bca', 'metode')) {
    return 'Metode pembayaran yang tersedia: GoPay, Transfer BCA, COD jika didukung area, dan QRIS. Semua bisa dipilih di halaman checkout.';
  }
  if (has('diskon', 'promo', 'voucher', 'murah', 'nego')) {
    return `Untuk ${productName}, promo bisa berubah sesuai periode. Kakak bisa pakai voucher di checkout. Kalau beli banyak, kami bantu pilih opsi paling hemat.`;
  }
  if (has('grosir', 'reseller', 'partai', 'banyak', 'lusin')) {
    return isBatik
      ? 'Harga grosir tersedia kak: 6–20 pcs Rp 155.000/pcs dan 21+ pcs Rp 130.000/pcs. Cocok untuk reseller.'
      : 'Untuk pembelian banyak/reseller bisa kak. Sebutkan jumlah yang diinginkan, nanti kami bantu hitungkan estimasi total dan promo terbaik.';
  }
  if (has('retur', 'refund', 'kembali', 'garansi', 'rusak', 'komplain')) {
    return 'Jika produk rusak/tidak sesuai, kakak bisa ajukan komplain/retur melalui aplikasi dengan foto/video unboxing. Tim kami akan bantu proses sesuai kebijakan garansi PasarKita.';
  }
  if (has('alamat', 'lokasi', 'toko dimana', 'dimana toko')) {
    return `${seller} melayani pengiriman ke berbagai kota. Alamat pengiriman kakak bisa diatur saat checkout sebelum pembayaran.`;
  }
  if (has('cara beli', 'checkout', 'pesan', 'order', 'beli')) {
    return `Cara membeli: buka detail ${productName}, pilih jumlah/varian jika ada, tekan “Beli Langsung” atau “+ Keranjang”, lalu lanjutkan pembayaran di checkout.`;
  }
  if (has('invoice', 'nota', 'struk')) {
    return 'Bisa kak, setelah pembayaran berhasil sistem akan membuat ringkasan pesanan/struk. Untuk kebutuhan invoice, tuliskan nama penerima atau catatan pesanan.';
  }
  if (has('cepat', 'hari ini', 'express', 'instan')) {
    return 'Kami bisa bantu proses secepat mungkin. Untuk pengiriman instan/same day tergantung jarak toko, stok, dan kurir yang tersedia di halaman checkout.';
  }
  if (has('terima kasih', 'makasih', 'thanks')) {
    return `Sama-sama kak ${currentUserName}! Kalau ada pertanyaan lain tentang ${productName}, langsung tulis saja ya 😊`;
  }

  return `Baik kak, saya bantu jawab sebagai asisten ${seller}. Untuk permintaan “${question}”, informasi paling aman: ${productName} tersedia di etalase dengan harga ${price}. Jika kakak butuh detail khusus, tuliskan jumlah, varian/ukuran, alamat tujuan, atau metode pembayaran yang diinginkan agar saya bantu arahkan sampai checkout.`;
}

function sendMsg(text) {
  const clean = String(text || '').trim();
  if (!clean) return;
  if (!getActiveChatSlot()) startChatWithSelectedProduct();
  addMessageToActiveChat('me', clean);
  setTimeout(() => {
    addMessageToActiveChat('them', generateSellerReply(clean));
  }, 650);
}

function sendChatMsg() {
  const inp = $('chat-input');
  const text = inp?.value.trim();
  if (!text) return;
  inp.value = '';
  sendMsg(text);
}

function addToCart(productId, amount = 1) {
  const product = productCatalog[productId] || selectedProduct;
  if (!product || !product.id) return;
  const addQty = Math.max(1, Math.min(99, Number.parseInt(amount, 10) || 1));
  const variant = (product.id === 'batik' || product.id === 'batik-tulis-premium-motif-parang') ? selectedSize : '';
  const key = `${product.id}-${variant || 'default'}`;
  const existing = cartItems.find(item => item.key === key);

  if (existing) existing.qty = Math.min(99, existing.qty + addQty);
  else cartItems.push({ ...product, key, variant, qty: addQty });

  saveCart();
  updateCartUI();
  const totals = getCartTotals();
  showToast('🛒 ' + addQty + ' barang masuk keranjang · Total ' + formatRupiah(totals.total));
}

function changeCartItemQty(key, delta) {
  const item = cartItems.find(i => i.key === key);
  if (!item) return;
  item.qty = Math.max(0, Math.min(99, item.qty + Number(delta || 0)));
  if (item.qty === 0) cartItems = cartItems.filter(i => i.key !== key);
  saveCart();
  updateCartUI();
}

function removeCartItem(key) {
  cartItems = cartItems.filter(i => i.key !== key);
  saveCart();
  updateCartUI();
  showToast('🗑️ Produk dihapus dari keranjang');
}

function clearCart() {
  if (!cartItems.length) {
    showToast('🛒 Keranjang sudah kosong');
    return;
  }
  cartItems = [];
  checkoutItems = null;
  saveCart();
  setSelectedProduct(selectedProduct);
  updateCartUI();
  updateCheckoutUI();
  showToast('🗑️ Keranjang dikosongkan');
}

function renderCartItems() {
  const wrap = $('cart-items');
  const empty = $('cart-empty');
  if (!wrap || !empty) return;

  if (!cartItems.length) {
    wrap.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  wrap.innerHTML = cartItems.map(item => {
    const unitPrice = getUnitPrice(item);
    const tierNote = unitPrice < item.price ? ' · Harga grosir aktif' : '';
    return `
      <div class="cart-item">
        <div class="cart-item-img" style="background:${escapeHTML(item.bg)};">${escapeHTML(item.emoji)}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHTML(item.name)}</div>
          <div class="cart-item-meta">${escapeHTML(item.shop)}${item.variant ? ' · Ukuran ' + escapeHTML(item.variant) : ''}${tierNote}</div>
          <div class="cart-item-price">${formatRupiah(unitPrice)} / pcs</div>
        </div>
        <div class="cart-item-actions">
          <div class="cart-mini-qty">
            <button class="cart-mini-btn" type="button" onclick="changeCartItemQty('${escapeHTML(item.key)}', -1)">−</button>
            <div class="cart-mini-num">${item.qty}</div>
            <button class="cart-mini-btn" type="button" onclick="changeCartItemQty('${escapeHTML(item.key)}', 1)">+</button>
          </div>
          <button class="cart-remove" type="button" onclick="removeCartItem('${escapeHTML(item.key)}')">Hapus</button>
        </div>
      </div>`;
  }).join('');
}

function updateCartUI() {
  const totals = getCartTotals();
  const countText = totals.qty + ' barang';
  const totalText = formatRupiah(totals.total);

  const targets = {
    'home-cart-count': countText,
    'home-cart-total': totalText,
    'cart-screen-count': countText,
    'cart-screen-total': totalText,
    'cart-bottom-total': totalText
  };
  Object.entries(targets).forEach(([id, value]) => { const el = $(id); if (el) el.textContent = value; });

  const badge = $('home-cart-badge');
  if (badge) {
    badge.textContent = totals.qty > 99 ? '99+' : String(totals.qty);
    badge.classList.toggle('is-empty', totals.qty === 0);
  }
  const checkoutBtn = $('cart-checkout-btn');
  if (checkoutBtn) checkoutBtn.disabled = totals.qty === 0;
  renderCartItems();
}

function cloneItems(items) {
  return items.map(item => ({ ...item }));
}

function checkoutCart() {
  const totals = getCartTotals();
  if (!totals.qty) {
    showToast('🛒 Keranjang masih kosong');
    return;
  }
  checkoutItems = cloneItems(cartItems);
  checkoutSource = 'cart';
  showToast('✅ Checkout ' + totals.qty + ' barang · ' + formatRupiah(totals.total));
  goTo('checkout');
}

function buyNow(productId, amount = 1) {
  const product = productCatalog[productId] || selectedProduct;
  if (!product || !product.id) return;
  const buyQty = Math.max(1, Math.min(99, Number.parseInt(amount, 10) || 1));
  const variant = (product.id === 'batik' || product.id === 'batik-tulis-premium-motif-parang') ? selectedSize : '';
  checkoutItems = [{ ...product, key: `${product.id}-${variant || 'default'}`, variant, qty: buyQty }];
  checkoutSource = 'direct';
  goTo('checkout');
}

function renderFakeQRIS() {
  const box = $('fake-qris-code');
  if (!box) return;
  const size = 21;
  const cells = [];
  const isFinder = (x, y, ox, oy) => {
    const dx = x - ox;
    const dy = y - oy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder = isFinder(x, y, 0, 0) || isFinder(x, y, 14, 0) || isFinder(x, y, 0, 14);
      const data = ((x * 7 + y * 11 + x * y + 13) % 5 === 0) || ((x + y * 3) % 7 === 0);
      const quiet = (x === 7 && y < 8) || (y === 7 && x < 8) || (x === 13 && y < 8) || (y === 7 && x > 12) || (x === 7 && y > 12) || (y === 13 && x < 8);
      cells.push(`<span class="qris-pixel ${(finder || (data && !quiet)) ? 'on' : ''}"></span>`);
    }
  }
  box.innerHTML = cells.join('');
}

function updateCheckoutUI() {
  const items = getCheckoutItems();
  const wrap = $('checkout-products');
  if (wrap) {
    wrap.innerHTML = items.map(item => {
      const unitPrice = getUnitPrice(item);
      return `
        <div class="product-row" style="margin:0 0 8px; border-radius:var(--radius-md); border-color:var(--border);">
          <div class="product-row-img" style="background:${escapeHTML(item.bg)};">${escapeHTML(item.emoji)}</div>
          <div class="product-row-info">
            <div class="product-row-name">${escapeHTML(item.name)}${item.variant ? ' — Ukuran ' + escapeHTML(item.variant) : ''}</div>
            <div class="product-row-price">${formatRupiah(unitPrice)}</div>
            <div class="product-row-meta">Qty: ${item.qty} · ${escapeHTML(item.shop)}</div>
          </div>
        </div>`;
    }).join('');
  }

  const totals = getCartTotals(items);
  const discount = totals.total > 0 ? Math.min(10000, totals.total) : 0;
  const platformFee = totals.total > 0 ? 1000 : 0;
  const grandTotal = Math.max(0, totals.total - discount + platformFee);

  const values = {
    'checkout-subtotal': formatRupiah(totals.total),
    'checkout-discount': '- ' + formatRupiah(discount),
    'checkout-fee': formatRupiah(platformFee),
    'checkout-total': formatRupiah(grandTotal)
  };
  Object.entries(values).forEach(([id, value]) => { const el = $(id); if (el) el.textContent = value; });

  const qrisAmount = $('qris-amount');
  if (qrisAmount) qrisAmount.textContent = formatRupiah(grandTotal);
  if (selectedPay === 'qris') renderFakeQRIS();

  const payBtn = $('checkout-pay-btn');
  if (payBtn) {
    payBtn.disabled = grandTotal <= 0;
    payBtn.textContent = 'Bayar Sekarang · ' + formatRupiah(grandTotal);
  }
}

function placeOrder() {
  const items = getCheckoutItems();
  const totals = getCartTotals(items);
  if (!totals.qty) {
    showToast('🛒 Tidak ada produk untuk dibayar');
    return;
  }
  if (checkoutSource === 'cart') {
    cartItems = [];
    saveCart();
  }
  checkoutItems = null;
  checkoutSource = 'default';
  updateCartUI();
  showToast('🎉 Pesanan berhasil! Terimakasih, Rina!');
  setTimeout(() => goTo('home'), 600);
}

function getGreetingText() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'Selamat pagi 👋';
  if (hour >= 11 && hour < 15) return 'Selamat siang ☀️';
  if (hour >= 15 && hour < 18) return 'Selamat sore 🌤️';
  return 'Selamat malam 🌙';
}

function updateRealtimeGreeting() {
  const el = $('home-greeting');
  if (el) el.textContent = getGreetingText();
}

function openNotifications() {
  notifFilter = 'all';
  renderNotifications();
  goTo('notifications');
}

function buildNotifications() {
  const list = [...notificationItems];
  orderHistory.forEach(order => {
    list.push({ type:'order', icon:'🛍️', title:'Hasil pembelian #' + order.id, text:`${order.qty} barang · ${formatRupiah(order.total)} · ${order.status}`, time:order.time || 'Riwayat' });
  });
  chatSlots.forEach(slot => {
    const last = slot.messages[slot.messages.length - 1];
    if (last) list.push({ type:'chat', icon:'💬', title:'Chat penjual: ' + slot.shop, text:`${slot.product?.name || 'Produk'} — ${last.text}`, time:last.time || 'Baru saja' });
  });
  if (checkoutItems?.length) list.push({ type:'payment', icon:'⏳', title:'Pembayaran tertunda', text:'Ada checkout yang belum diselesaikan. Lanjutkan pembayaran agar pesanan diproses.', time:'Menunggu pembayaran' });
  list.push({ type:'discount', icon:'🏷️', title:'Diskon dari penjual', text:'Flash sale dan voucher penjual tersedia untuk beberapa produk hari ini.', time:'Hari ini' });
  if (!orderHistory.length && !notificationItems.some(n => n.type === 'order')) list.push({ type:'order', icon:'🛍️', title:'Hasil pembelian', text:'Belum ada pembelian baru. Setelah checkout berhasil, detail pembelian akan muncul di sini.', time:'Status' });
  return list;
}

function renderNotifications() {
  const wrap = $('notif-list');
  if (!wrap) return;
  const items = buildNotifications().filter(n => notifFilter === 'all' || n.type === notifFilter);
  wrap.innerHTML = items.length ? items.map(n => `<div class="notif-item">
    <div class="notif-icon">${escapeHTML(n.icon)}</div>
    <div class="notif-content"><div class="notif-title">${escapeHTML(n.title)}</div><div class="notif-text">${escapeHTML(n.text)}</div><div class="notif-time">${escapeHTML(n.time || 'Baru saja')}</div></div>
  </div>`).join('') : '<div class="notif-empty">Tidak ada notifikasi di kategori ini.</div>';
  const dot = $('notif-dot');
  if (dot) dot.style.display = buildNotifications().length ? '' : 'none';
}

function filterNotifications(type, btn) {
  notifFilter = type;
  document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  renderNotifications();
}

function markNotificationsRead() {
  const dot = $('notif-dot');
  if (dot) dot.style.display = 'none';
  showToast('✅ Notifikasi ditandai dibaca');
}

function getAllProductCards() {
  return $all('#products-grid .product-card').map(card => extractProductFromCard(card)).filter(p => p.price);
}

function getFlashProducts() {
  const cards = $all('#products-grid .product-card');
  const products = cards.map((card, i) => {
    const product = extractProductFromCard(card);
    const hasBadge = !!card.querySelector('.product-badge');
    const old = product.oldPrice || Math.round(product.price * (1.12 + ((i + flashSaleSeed) % 5) * 0.04));
    const discount = Math.max(8, Math.min(45, Math.round((1 - product.price / old) * 100)));
    return { ...product, oldPrice: old, discount, rank: (hasBadge ? 0 : 1) + ((i + flashSaleSeed) % 7) / 10 };
  });
  const sorted = products.sort((a,b) => a.rank - b.rank);
  const offset = flashSaleSeed % Math.max(1, sorted.length);
  return sorted.slice(offset).concat(sorted.slice(0, offset)).slice(0, 8);
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}j ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}d`;
}

function updateFlashCountdown() {
  if (Date.now() >= flashSaleEndsAt) {
    flashSaleEndsAt = Date.now() + (2 * 60 * 60 + 45 * 60) * 1000;
    flashSaleSeed++;
    renderFlashSale();
  }
  const text = 'Berakhir dalam ' + formatDuration(flashSaleEndsAt - Date.now());
  const home = $('flash-countdown-home');
  const screen = $('flash-countdown-screen');
  if (home) home.textContent = text;
  if (screen) screen.textContent = text;
}

function renderFlashSale() {
  const grid = $('flash-grid');
  const products = getFlashProducts();
  const count = $('flash-product-count');
  if (count) count.textContent = products.length + ' produk';
  if (!grid) return;
  grid.innerHTML = products.map((p, i) => `<div class="flash-card" onclick="openFlashProduct('${escapeHTML(p.id)}')">
    <div class="flash-img" style="background:${escapeHTML(p.bg)};"><span>${escapeHTML(p.emoji)}</span><div class="flash-badge">-${p.discount}%</div></div>
    <div class="flash-info"><div class="flash-name">${escapeHTML(p.name)}</div><div><span class="flash-price">${formatRupiah(p.price)}</span><span class="flash-old">${formatRupiah(p.oldPrice)}</span></div><div class="flash-stock"><div class="flash-stock-fill" style="width:${88 - (i * 7)}%"></div></div></div>
  </div>`).join('');
}

function openFlashSale() {
  flashSaleSeed++;
  renderFlashSale();
  updateFlashCountdown();
  goTo('flash');
}

function refreshFlashSale() {
  flashSaleSeed++;
  flashSaleEndsAt = Date.now() + (2 * 60 * 60 + (20 + flashSaleSeed % 40) * 60) * 1000;
  renderFlashSale();
  updateFlashCountdown();
  showToast('⚡ Produk flash sale diperbarui');
}

function openFlashProduct(id) {
  const product = productCatalog[id] || getAllProductCards().find(p => p.id === id) || productCatalog.batik;
  setSelectedProduct(product);
  goTo('detail');
}

function openProfileCatalog(type) {
  const lastOrders = orderHistory.length
    ? orderHistory.map(o => ['🧾', 'Pesanan #' + o.id, `${o.qty} barang · ${formatRupiah(o.total)} · ${o.status}`])
    : [['🛍️','Belum ada pembelian','Checkout berhasil akan tampil di katalog ini']];
  const chatItems = chatSlots.length
    ? chatSlots.map(c => ['💬', c.shop, `${c.product?.name || 'Produk'} · ${c.messages.length} pesan`])
    : [['💬','Belum ada chat','Mulai chat dari detail produk']];
  const data = {
    activeOrders: { title:'Pesanan Aktif', items: orderHistory.filter(o => o.status !== 'Selesai').map(o => ['📦','Pesanan #' + o.id, `${o.qty} barang · ${formatRupiah(o.total)} · ${o.status}`]).concat(orderHistory.length ? [] : [['📦','Belum ada pesanan aktif','Pesanan yang sedang diproses akan tampil di sini']]) },
    repeatOrder: { title:'Repeat Order', items: lastOrders.map(([i,n,t]) => ['🔄', n.replace('Pesanan','Beli ulang pesanan'), t]) },
    history: { title:'Riwayat Pesanan', items: lastOrders },
    addresses: { title:'Alamat Pengiriman', items:[['📍','Alamat utama','Jl. Pemuda No. 12, Semarang Tengah'],['🏠','Rumah','Semarang, Jawa Tengah'],['➕','Tambah alamat','Fitur demo: daftar alamat tersedia untuk dilihat']] },
    payments: { title:'Metode Pembayaran', items:[['💚','GoPay','Tersedia'],['🏦','Transfer BCA','Tersedia'],['📲','QRIS','Tersedia dengan kode QR simulasi'],['💵','COD','Tersedia jika area mendukung']] },
    chats: { title:'Chat Penjual', items: chatItems },
    discounts: { title:'Diskon & Voucher', items:[['⚡','Flash Sale','Produk promo berubah setiap klik banner'],['🏷️','Voucher Penjual','Diskon toko tersedia hari ini'],['🚚','Gratis Ongkir','Tersedia untuk produk tertentu']] }
  }[type] || { title:'Katalog Profil', items:[['ℹ️','Belum tersedia','Katalog ini belum memiliki data']] };
  const title = $('profile-catalog-title');
  const list = $('profile-catalog-list');
  if (title) title.textContent = data.title;
  if (list) list.innerHTML = data.items.map(([icon, name, text]) => `<div class="catalog-card"><div class="catalog-icon">${icon}</div><div class="catalog-content"><div class="catalog-title">${escapeHTML(name)}</div><div class="catalog-text">${escapeHTML(text)}</div><div class="catalog-meta">Dapat diakses · mode lihat saja</div></div></div>`).join('');
  goTo('profile-catalog');
}

function startCallActiveSeller() {
  const slot = getActiveChatSlot();
  const seller = slot?.shop || getCurrentSellerName();
  const avatar = slot?.avatar || selectedProduct?.emoji || '🏪';
  const nameEl = $('call-name');
  const avatarEl = $('call-avatar');
  const statusEl = $('call-status');
  const timerEl = $('call-timer');
  if (nameEl) nameEl.textContent = seller;
  if (avatarEl) avatarEl.textContent = avatar;
  if (statusEl) statusEl.textContent = 'Memanggil...';
  if (timerEl) timerEl.textContent = '00:00';
  callStartedAt = Date.now();
  clearInterval(callInterval);
  callInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartedAt) / 1000);
    if (statusEl && elapsed >= 2) statusEl.textContent = 'Terhubung';
    if (timerEl) timerEl.textContent = `${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
  }, 1000);
  goTo('call');
}

function toggleMute() {
  callMuted = !callMuted;
  const btn = $('call-mute');
  if (btn) btn.innerHTML = `${callMuted ? '🔇' : '🎙️'}<span>${callMuted ? 'Unmute' : 'Mute'}</span>`;
  showToast(callMuted ? '🔇 Mikrofon dimatikan' : '🎙️ Mikrofon aktif');
}

function endCall() {
  clearInterval(callInterval);
  callInterval = null;
  showToast('📞 Panggilan berakhir');
  if (activeChatId) goTo('chat');
  else goBack();
}

function initApp() {
  const active = document.querySelector('.screen.active');
  if (active?.id?.startsWith('screen-')) currentScreen = active.id.replace('screen-', '');
  loadUserName();
  loadCart();
  loadChatSlots();
  loadNotifications();
  loadOrderHistory();
  updateCartUI();
  updateCheckoutUI();
  updateNavByScreen(currentScreen);
  updateRealtimeGreeting();
  updateFlashCountdown();
  renderFlashSale();
  renderNotifications();
  setInterval(updateRealtimeGreeting, 60000);
  setInterval(updateFlashCountdown, 1000);
  updateSellerChatUI();
  const chatBody = $('chat-body');
  if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();