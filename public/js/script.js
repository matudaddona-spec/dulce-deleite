(() => {
  'use strict';
  const config = window.PASTELERIA;
  const products = [...window.PRODUCTOS];
  const byId = new Map();
  const categories = { tortas:'TORTAS Y TARTAS', dulces:'DULCES POR PESO', salados:'SALADOS', ofertas:'OFERTA' };
  const money = value => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(value);
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const grid = document.querySelector('#product-grid');
  const search = document.querySelector('#search');
  const filters = [...document.querySelectorAll('[data-category]')];
  const notesInput = document.querySelector('#order-notes');
  const cartSection = document.querySelector('#carrito');
  const sendOrder = document.querySelector('#send-order');
  const mobileCart = document.querySelector('#mobile-cart');
  const toast = document.querySelector('#toast');
  let category = 'destacados';
  let cart = [];
  let notes = '';
  let cartInView = false;
  let toastTimer;
  let loaded = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class','icon');
    svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.append(use);
    return svg;
  }
  function key(item) { return [item.id, item.variantId, item.flavor || ''].join('|'); }
  function save() {
    if (!loaded) return;
    try { localStorage.setItem(config.storageKey, JSON.stringify({ items:cart, notes })); } catch { /* El pedido sigue disponible en esta visita. */ }
  }
  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(config.storageKey) || '{}');
      if (!stored || typeof stored !== 'object' || !Array.isArray(stored.items)) return;
      const merged = new Map();
      for (const item of [...stored.items.slice(0,200),...cart]) {
        if (!item || typeof item !== 'object') continue;
        const product = byId.get(item.id);
        if (!product || !product.variantes.some(variant => variant.id === item.variantId)) continue;
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) continue;
        if (product.sabores && !product.sabores.includes(item.flavor)) continue;
        const clean = { id:product.id, variantId:item.variantId, flavor:product.sabores ? item.flavor : '', quantity:item.quantity };
        const itemKey = key(clean);
        if (merged.has(itemKey)) merged.get(itemKey).quantity = Math.min(99,merged.get(itemKey).quantity + clean.quantity);
        else merged.set(itemKey,clean);
      }
      cart = [...merged.values()];
      if (typeof stored.notes === 'string') notes = stored.notes.slice(0,500);
    } catch { /* Ignorar un pedido guardado inválido. */ }
  }
  function announce(message) {
    clearTimeout(toastTimer);
    document.querySelector('#toast-text').textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; },4500);
  }
  function picture(product, thumbnail = false) {
    if (product.foto) {
      const img = element('img', thumbnail ? 'cart-thumb' : '');
      img.src = product.fotoUrl || 'img/productos/' + product.foto;
      img.alt = thumbnail ? '' : product.nombre;
      img.loading = 'lazy';
      if (!thumbnail) { img.width = 560; img.height = 400; }
      return img;
    }
    const placeholder = element('div',thumbnail ? 'cart-thumb cart-thumb-placeholder' : 'photo-placeholder');
    placeholder.setAttribute('aria-hidden','true');
    placeholder.append(icon('tart'));
    if (!thumbnail) placeholder.append(element('span','','Pastelería artesanal'));
    return placeholder;
  }
  function chooseCategory(next) {
    category = next;
    filters.forEach(button => {
      const active = button.dataset.category === category;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    renderProducts();
  }
  function renderProducts() {
    const query = normalize(search.value);
    const visible = products.filter(product => {
      if (product.categoria === 'ofertas') return false;
      const categoryMatches = category === 'todos' || (category === 'destacados' ? product.favorito : product.categoria === category);
      const haystack = normalize(product.nombre + ' ' + categories[product.categoria] + ' ' + (product.sabores || []).join(' '));
      return categoryMatches && (!query || haystack.includes(query));
    });
    grid.replaceChildren();
    document.querySelector('#catalog-count').textContent = `${visible.length} ${visible.length === 1 ? 'producto para elegir' : 'productos para elegir'}`;
    document.querySelector('#show-all').hidden = category === 'todos';
    if (!visible.length) {
      const empty = element('div','search-empty');
      empty.append(element('h3','','No encontramos ese antojo.'),element('p','','Probá con otro nombre o mirá todo el catálogo.'));
      const reset = element('button','button button-outline','Ver todos los productos');
      reset.type = 'button';
      reset.addEventListener('click',() => { search.value = ''; chooseCategory('todos'); });
      empty.append(reset); grid.append(empty); return;
    }
    visible.forEach(product => {
      const article = element('article','product-card');
      article.dataset.product = product.id;
      const photo = element('div','product-photo');
      photo.append(picture(product));
      if (product.favorito) photo.append(element('span','product-photo-tag','PARA TENTARSE'));
      const body = element('div','product-body');
      const title = element('h3','',product.nombre);
      title.id = 'title-' + product.id;
      article.setAttribute('aria-labelledby',title.id);
      body.append(element('p','product-category',categories[product.categoria]),title);
      const options = element('div','product-options');
      let selected = product.variantes[0];
      let flavor = product.sabores ? product.sabores[0] : '';
      const price = element('strong','product-price');
      const add = element('button','add-button');
      add.type = 'button';
      add.append(icon('bag'),document.createTextNode('Agregar'));
      function updatePrice() {
        price.textContent = selected.precio === null ? 'A consultar' : money(selected.precio);
        price.classList.toggle('price-consult',selected.precio === null);
        add.setAttribute('aria-label',`Agregar ${product.nombre}, ${selected.etiqueta}${flavor ? ', ' + flavor : ''}`);
      }
      if (product.variantes.length > 1) {
        const label = element('label','',product.categoria === 'tortas' ? 'Tamaño' : 'Presentación');
        label.htmlFor = 'variant-' + product.id;
        const select = element('select'); select.id = label.htmlFor;
        product.variantes.forEach(variant => {
          const option = element('option','',variant.etiqueta); option.value = variant.id; select.append(option);
        });
        select.addEventListener('change',() => { selected = product.variantes.find(variant => variant.id === select.value); updatePrice(); });
        label.append(select); options.append(label);
      } else options.append(element('p','single-variant',selected.etiqueta === 'docena' ? '1 docena' : selected.etiqueta));
      if (product.sabores) {
        const label = element('label','','Sabor'); label.htmlFor = 'flavor-' + product.id;
        const select = element('select'); select.id = label.htmlFor;
        product.sabores.forEach(value => { const option = element('option','',value); option.value = value; select.append(option); });
        select.addEventListener('change',() => { flavor = select.value; updatePrice(); });
        label.append(select); options.append(label);
      }
      const bottom = element('div','product-bottom'); bottom.append(price,add);
      add.addEventListener('click',() => addToCart(product,selected,flavor));
      updatePrice(); body.append(options,bottom); article.append(photo,body); grid.append(article);
    });
  }
  function addToCart(product, selected, flavor = '') {
    const next = { id:product.id, variantId:selected.id, flavor, quantity:1 };
    const existing = cart.find(item => key(item) === key(next));
    if (existing && existing.quantity >= 99) { announce('Ya tenés 99 de esta presentación en el carrito.'); return; }
    if (existing) existing.quantity += 1; else cart.push(next);
    save(); renderCart();
    announce(`${product.nombre} · ${selected.etiqueta}${flavor ? ' · ' + flavor : ''} agregado al carrito.`);
  }
  // Productos y ofertas cargados desde el panel de administración (/admin).
  // Si no responde, la web usa js/productos.js y se muestra sin ofertas.
  async function fetchData(path) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(),4000);
      const response = await fetch(path,{ signal:controller.signal });
      clearTimeout(timer);
      return response.ok ? await response.json() : {};
    } catch { return {}; }
  }
  const imageUrl = id => '/api/imagen/' + encodeURIComponent(id);
  function setProducts(list) {
    const items = [...list]; // copia: list puede ser el mismo arreglo products
    products.length = 0;
    items.forEach(product => {
      if (product.imagen) product.fotoUrl = imageUrl(product.imagen);
      if (product.imagen && !product.foto) product.foto = product.imagen;
      products.push(product);
    });
    byId.clear();
    products.forEach(product => byId.set(product.id,product));
  }
  // Fotos de una oferta: la subida, o las de los productos que incluye (hasta 3).
  function offerPhotos(offer) {
    if (offer.imagen) return [{ foto:offer.imagen, fotoUrl:imageUrl(offer.imagen) }];
    const ids = Array.isArray(offer.fotos) && offer.fotos.length ? offer.fotos : [offer.productoId];
    return ids.map(id => byId.get(id)).filter(base => base && base.foto).slice(0,3).map(base => ({ foto:base.foto, fotoUrl:base.fotoUrl || '' }));
  }
  const offerLines = offer => String(offer.descripcion || '').split('\n').map(line => line.trim()).filter(Boolean);
  function offerProduct(offer) {
    const photos = offerPhotos(offer);
    const lines = offerLines(offer);
    return {
      id:'oferta-' + offer.id,
      nombre:'Oferta: ' + offer.titulo,
      categoria:'ofertas',
      foto:photos.length ? photos[0].foto : '',
      fotoUrl:photos.length ? photos[0].fotoUrl : '',
      fotos:photos,
      variantes:[{ id:'oferta', etiqueta:lines.length ? lines.join(' + ').slice(0,160) : 'Oferta', precio:Number.isInteger(offer.precio) ? offer.precio : null }],
      oferta:offer
    };
  }
  function renderOffers(offerProducts) {
    const section = document.querySelector('#ofertas');
    const list = document.querySelector('#offers-grid');
    section.hidden = !offerProducts.length;
    document.querySelectorAll('[data-offers-link]').forEach(link => { link.hidden = !offerProducts.length; });
    list.replaceChildren();
    offerProducts.forEach(product => {
      const offer = product.oferta;
      const variant = product.variantes[0];
      const card = element('article','offer-card');
      const title = element('h3','',offer.titulo);
      title.id = 'title-' + product.id;
      card.setAttribute('aria-labelledby',title.id);
      const photo = element('div','offer-photo' + (product.fotos.length > 1 ? ' offer-collage collage-' + product.fotos.length : ''));
      if (product.fotos.length > 1) product.fotos.forEach(item => photo.append(picture({ ...item, nombre:offer.titulo })));
      else photo.append(picture(product));
      const off = offer.precio && offer.precioAnterior && offer.precioAnterior > offer.precio ? Math.round((1 - offer.precio / offer.precioAnterior) * 100) : 0;
      photo.append(element('span','offer-tag',off ? `−${off}%` : 'OFERTA'));
      const body = element('div','offer-body');
      body.append(title);
      const lines = offerLines(offer);
      if (lines.length > 1) {
        const includes = element('ul','offer-includes');
        lines.forEach(line => includes.append(element('li','',line)));
        body.append(includes);
      } else if (lines.length) body.append(element('p','offer-description',lines[0]));
      if (offer.hasta) {
        const [y,m,d] = offer.hasta.split('-');
        body.append(element('p','offer-until',`Válida hasta el ${d}/${m}/${y}`));
      }
      const prices = element('div','offer-prices');
      if (off) {
        const before = element('s','offer-before',money(offer.precioAnterior));
        before.setAttribute('aria-label','Antes ' + money(offer.precioAnterior));
        prices.append(before);
      }
      prices.append(element('strong',variant.precio === null ? 'product-price price-consult' : 'product-price',variant.precio === null ? 'A consultar' : money(variant.precio)));
      const add = element('button','add-button');
      add.type = 'button';
      add.append(icon('bag'),document.createTextNode('Agregar'));
      add.setAttribute('aria-label','Agregar ' + product.nombre);
      add.addEventListener('click',() => addToCart(product,variant));
      const bottom = element('div','product-bottom'); bottom.append(prices,add);
      body.append(bottom); card.append(photo,body); list.append(card);
    });
  }
  function totals() {
    let amount = 0, pending = 0, quantity = 0;
    cart.forEach(item => {
      const product = byId.get(item.id);
      const variant = product.variantes.find(value => value.id === item.variantId);
      quantity += item.quantity;
      if (variant.precio === null) pending += item.quantity;
      else amount += variant.precio * item.quantity;
    });
    return { amount,pending,quantity };
  }
  function updateFloatingCart() { mobileCart.hidden = !cart.length || cartInView; }
  function message() {
    const lines = [`¡Hola, ${config.contacto}! Quiero hacer este pedido de ${config.nombre}:`, ''];
    cart.forEach(item => {
      const product = byId.get(item.id);
      const variant = product.variantes.find(value => value.id === item.variantId);
      lines.push(`• ${item.quantity} × ${product.nombre} · ${variant.etiqueta}${item.flavor ? ' · ' + item.flavor : ''} — ${variant.precio === null ? 'precio a consultar' : money(variant.precio * item.quantity)}`);
    });
    const total = totals();
    lines.push('');
    if (total.pending) {
      if (total.amount) lines.push(`Subtotal de productos con precio: ${money(total.amount)}.`);
      lines.push('Quedan productos con precio a consultar.');
    } else lines.push(`Total estimado: ${money(total.amount)}.`);
    if (notes.trim()) lines.push('',`Comentario: ${notes.trim()}`);
    lines.push('','¿Me confirmás disponibilidad, precio final y cómo coordinamos el pago y la entrega?');
    return lines.join('\n');
  }
  function updateWhatsApp() { sendOrder.href = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message())}`; }
  function changeQuantity(item, delta) {
    item.quantity = Math.min(99,item.quantity + delta);
    if (item.quantity <= 0) cart = cart.filter(value => key(value) !== key(item));
    save(); renderCart();
  }
  function renderCart() {
    const total = totals();
    document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = total.quantity; });
    document.querySelector('.nav-cart').setAttribute('aria-label',`Ver carrito, ${total.quantity} presentaciones`);
    document.querySelector('#cart-empty').hidden = cart.length > 0;
    document.querySelector('#cart-layout').hidden = cart.length === 0;
    document.querySelector('#clear-cart').hidden = cart.length === 0;
    document.body.classList.toggle('has-cart',cart.length > 0);
    updateFloatingCart();
    const list = document.querySelector('#cart-items'); list.replaceChildren();
    cart.forEach(item => {
      const product = byId.get(item.id);
      const variant = product.variantes.find(value => value.id === item.variantId);
      const row = element('article','cart-row');
      row.dataset.cartKey = key(item);
      const info = element('div','cart-item-info');
      info.append(element('h3','',product.nombre),element('p','cart-details',variant.etiqueta + (item.flavor ? ' · ' + item.flavor : '')));
      const actions = element('div','cart-actions');
      const controls = element('div','quantity-controls');
      function quantityButton(text, label, delta) {
        const button = element('button','',text); button.type = 'button';
        button.setAttribute('aria-label',`${label} ${product.nombre}, ${variant.etiqueta}${item.flavor ? ', ' + item.flavor : ''}`);
        if (delta === 1) button.disabled = item.quantity >= 99;
        button.addEventListener('click',() => {
          const nextQuantity = item.quantity + delta;
          changeQuantity(item,delta);
          const nextRow = [...list.querySelectorAll('[data-cart-key]')].find(candidate => candidate.dataset.cartKey === key(item));
          if (nextRow) nextRow.querySelector(delta === 1 ? '.quantity-controls button:last-child' : '.quantity-controls button:first-child').focus({preventScroll:true});
          else document.querySelector('#cart-empty').hidden ? document.querySelector('#clear-cart').focus({preventScroll:true}) : document.querySelector('#cart-empty a').focus({preventScroll:true});
          announce(nextQuantity > 0 ? `Cantidad actualizada: ${nextQuantity} × ${product.nombre}.` : `${product.nombre} eliminado del carrito.`);
        });
        controls.append(button);
      }
      quantityButton('−','Quitar una presentación de',-1);
      controls.append(element('span','',String(item.quantity)));
      quantityButton('+','Agregar una presentación de',1);
      const remove = element('button','remove-button','Eliminar'); remove.type = 'button';
      remove.setAttribute('aria-label',`Eliminar ${product.nombre}, ${variant.etiqueta}${item.flavor ? ', ' + item.flavor : ''}`);
      remove.addEventListener('click',() => {
        cart = cart.filter(value => key(value) !== key(item)); save(); renderCart();
        const focusTarget = cart.length ? document.querySelector('#clear-cart') : document.querySelector('#cart-empty a');
        focusTarget.focus({preventScroll:true}); announce(`${product.nombre} eliminado del carrito.`);
      });
      actions.append(controls,remove); info.append(actions);
      const subtotal = element('strong',variant.precio === null ? 'row-total is-pending' : 'row-total',variant.precio === null ? 'A consultar' : money(variant.precio * item.quantity));
      row.append(picture(product,true),info,subtotal); list.append(row);
    });
    document.querySelector('#summary-count').textContent = total.quantity;
    document.querySelector('#total-label').textContent = total.pending ? 'Subtotal con precio' : 'Total estimado';
    document.querySelector('#order-total').textContent = total.pending && !total.amount ? 'A consultar' : money(total.amount);
    const pending = document.querySelector('#pending-prices');
    pending.hidden = !total.pending;
    pending.textContent = `${total.pending} ${total.pending === 1 ? 'presentación tiene precio pendiente' : 'presentaciones tienen precio pendiente'}. El total se confirma por WhatsApp.`;
    updateWhatsApp();
  }

  filters.forEach(button => button.addEventListener('click',() => { search.value = ''; chooseCategory(button.dataset.category); }));
  search.addEventListener('input',() => {
    if (category === 'destacados' && search.value.trim()) chooseCategory('todos');
    else renderProducts();
  });
  document.querySelector('#show-all').addEventListener('click',() => {
    search.value = ''; chooseCategory('todos');
    document.querySelector('.catalog-toolbar').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
    filters.find(button => button.dataset.category === 'todos').focus({preventScroll:true});
  });
  notesInput.addEventListener('input',() => { notes = notesInput.value.slice(0,500); save(); updateWhatsApp(); });
  document.querySelector('#clear-cart').addEventListener('click',() => {
    cart = []; notes = ''; notesInput.value = ''; save(); renderCart();
    document.querySelector('#cart-empty a').focus({preventScroll:true}); announce('Vaciaste tu carrito.');
  });
  sendOrder.addEventListener('click',event => { if (!cart.length) event.preventDefault(); });
  toast.querySelector('a').addEventListener('click',() => { toast.hidden = true; });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { cartInView = entries[0].isIntersecting; updateFloatingCart(); },{threshold:0});
    observer.observe(cartSection);
  }
  setProducts(products);
  Promise.all([fetchData('/api/productos'),fetchData('/api/ofertas')]).then(([catalog,offerData]) => {
    setProducts(Array.isArray(catalog.productos) ? catalog.productos.filter(product => product && product.id && Array.isArray(product.variantes) && product.variantes.length) : products);
    renderProducts();
    const offers = Array.isArray(offerData.ofertas) ? offerData.ofertas.slice(0,30) : [];
    const offerProducts = offers.filter(offer => offer && typeof offer.id === 'string' && offer.titulo).map(offerProduct);
    offerProducts.forEach(product => { products.push(product); byId.set(product.id,product); });
    renderOffers(offerProducts);
    load(); loaded = true; save(); notesInput.value = notes; renderCart();
  });
})();
