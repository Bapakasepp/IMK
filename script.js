let history = [];
let currentScreen = 'splash';
let qty = 1;
let selectedSize = 'S';
let selectedPay = 'gopay';
let wishItems = ['Earphone TWS Pro', 'Batik Tulis Premium'];

function goTo(id) {
  const cur = document.getElementById('screen-' + currentScreen);
  const next = document.getElementById('screen-' + id);
  if (!next || id === currentScreen) return;
  history.push(currentScreen);
  cur.classList.remove('active');
  cur.classList.add('prev');
  next.classList.add('active');
  currentScreen = id;
  setTimeout(() => cur.classList.remove('prev'), 300);
}

function goBack() {
  if (history.length === 0) return;
  const prev = history.pop();
  const cur = document.getElementById('screen-' + currentScreen);
  const prevEl = document.getElementById('screen-' + prev);
  cur.classList.remove('active');
  prevEl.classList.remove('prev');
  prevEl.classList.add('active');
  currentScreen = prev;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function setRole(role) {
  ['buyer','seller','reseller'].forEach(r => {
    document.getElementById('role-'+r).classList.remove('active');
  });
  document.getElementById('role-'+role).classList.add('active');
}

function filterCat(el, name) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  showToast('📂 Kategori: ' + name);
}

function setNav(i) {
  const items = document.querySelectorAll('#nav-home .nav-item, .bottom-nav .nav-item');
  items.forEach((item, idx) => {
    if (idx % 4 === i) item.classList.add('active');
    else item.classList.remove('active');
  });
}

function toggleWish(id, name) {
  const btn = document.getElementById(id);
  const liked = btn.classList.contains('liked');
  if (liked) {
    btn.classList.remove('liked');
    btn.textContent = '🤍';
    showToast('💔 Dihapus dari wishlist');
  } else {
    btn.classList.add('liked');
    btn.textContent = '❤️';
    showToast('❤️ ' + name + ' disimpan ke wishlist!');
  }
}

function removeWish(id) {
  const el = document.getElementById(id);
  el.style.transition = 'all 0.3s';
  el.style.opacity = '0';
  el.style.transform = 'translateX(100%)';
  setTimeout(() => { el.style.display = 'none'; showToast('🗑️ Dihapus dari wishlist'); }, 300);
}

function changeQty(d) {
  qty = Math.max(1, Math.min(99, qty + d));
  document.getElementById('qty-num').textContent = qty;
  const price = qty >= 21 ? 130000 : qty >= 6 ? 155000 : 185000;
  if (qty >= 6) showToast('💰 Harga grosir berlaku! Rp ' + price.toLocaleString('id') + '/pcs');
}

function selectSize(s) {
  ['S','M','L','XL'].forEach(sz => {
    document.getElementById('sz-'+sz).classList.remove('selected');
  });
  document.getElementById('sz-'+s).classList.add('selected');
  selectedSize = s;
  showToast('📏 Ukuran ' + s + ' dipilih');
}

function selectPay(method) {
  ['gopay','bca','cod','qris'].forEach(m => {
    const el = document.getElementById('pay-'+m);
    el.classList.remove('selected');
    el.querySelector('.payment-opt-check').innerHTML = '';
    el.querySelector('.payment-opt-check').style.background = '';
    el.querySelector('.payment-opt-check').style.borderColor = 'var(--border)';
  });
  const el = document.getElementById('pay-'+method);
  el.classList.add('selected');
  const chk = el.querySelector('.payment-opt-check');
  chk.innerHTML = '✓';
  chk.style.background = 'var(--primary)';
  chk.style.borderColor = 'var(--primary)';
  selectedPay = method;
}

function sendMsg(text) {
  const body = document.getElementById('chat-body');
  const msg = document.createElement('div');
  msg.className = 'msg me';
  msg.innerHTML = '<div class="bubble">'+text+'</div><div class="msg-time">Sekarang</div>';
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
  setTimeout(() => {
    const replies = {
      'Stok tersedia?': 'Masih ada kak! Stok kami lengkap 😊',
      'Harga grosir?': 'Ada! Beli 6+ pcs = Rp 155.000/pcs. Beli 21+ pcs = Rp 130.000/pcs 🎉',
      'Estimasi pengiriman?': 'Estimasi 2-3 hari kerja ke Semarang kak. Kami kirim via SiCepat 🚚',
      'Bisa COD?': 'Untuk sementara belum bisa COD kak, tapi bisa transfer BCA atau GoPay 💳',
      'Ada promo?': 'Ada promo hari ini! Beli 2 produk gratis ongkir + diskon 15% 🎁'
    };
    const rep = document.createElement('div');
    rep.className = 'msg them';
    rep.innerHTML = '<div class="bubble">'+(replies[text]||'Terima kasih kak! Ada lagi yang bisa kami bantu? 😊')+'</div><div class="msg-time">Sekarang</div>';
    body.appendChild(rep);
    body.scrollTop = body.scrollHeight;
  }, 900);
}

function sendChatMsg() {
  const inp = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  sendMsg(text);
}

// Auto-scroll chat
setTimeout(() => {
  const b = document.getElementById('chat-body');
  if (b) b.scrollTop = b.scrollHeight;
}, 100);
