(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(value);
  const CATEGORIES = { tortas:'Tortas y tartas', dulces:'Dulces por peso', salados:'Salados' };
  const SESSION_KEY = 'dd-admin-clave';
  const ORIGINAL = JSON.parse(JSON.stringify(window.PRODUCTOS || []));
  // Fotos que ya están en la carpeta de la web (img/productos), con el nombre del producto que la usa.
  const WEB_PHOTOS = [...new Map([
    ...ORIGINAL.filter(p => p.foto).map(p => [p.foto, p.nombre]),
    ['torta-brownie.jpg', 'Torta brownie con frutos rojos (foto de portada)'],
    ['bandeja-brownies.jpg', 'Bandeja de brownies']
  ]).entries()];

  let password = '';
  let products = [];
  let offers = [];
  let today = '';
  let priceEdits = new Map(); // "productoId|varianteId" -> precio (número o null)

  // ---------- Utilidades ----------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function setStatus(id, text, error = false) {
    const status = $(id);
    status.textContent = text;
    status.classList.toggle('is-error', error);
  }
  const slug = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  const randomId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function uniqueId(base, used) {
    let id = slug(base), n = 2;
    while (used.has(id)) id = slug(base).slice(0, 36) + '-' + n++;
    return id;
  }
  function parsePrice(value) {
    const clean = String(value).replace(/[$.\s]/g, '').replace(/,\d*$/, '');
    if (!clean) return null;
    const number = Number(clean);
    return Number.isInteger(number) && number > 0 && number < 100000000 ? number : NaN;
  }
  const imageUrl = id => '/api/imagen/' + encodeURIComponent(id);
  function productPhoto(product) {
    if (!product) return '';
    if (product.imagen) return imageUrl(product.imagen);
    return product.foto ? '../img/productos/' + product.foto : '';
  }
  function thumb(url, className = 'admin-thumb') {
    const box = el('div', className);
    if (url) { const img = el('img'); img.src = url; img.alt = ''; img.loading = 'lazy'; box.append(img); }
    return box;
  }
  async function api(path, options = {}) {
    const response = await fetch(path, { cache:'no-store', ...options, headers: { ...(options.headers || {}), authorization: 'Bearer ' + password } });
    let data = {};
    try { data = await response.json(); } catch { /* respuesta sin JSON */ }
    if (response.status === 401) {
      const message = 'Esa cuenta de Google no tiene acceso, o la sesión venció. Volvé a entrar.';
      logout(message); throw new Error(message);
    }
    if (!response.ok) throw new Error(data.error || 'No se pudo conectar. Probá de nuevo.');
    return data;
  }

  // ---------- Entrar / salir / pestañas ----------
  async function login(clave) {
    password = clave;
    const [catalog, offerData] = await Promise.all([api('/api/productos'), api('/api/ofertas')]);
    $('#catalog-notice').hidden = Array.isArray(catalog.productos);
    products = Array.isArray(catalog.productos) ? catalog.productos : JSON.parse(JSON.stringify(ORIGINAL));
    offers = offerData.ofertas || [];
    today = offerData.hoy || '';
    try { sessionStorage.setItem(SESSION_KEY, clave); } catch { /* sin almacenamiento */ }
    $('#login-view').hidden = true;
    $('#logout').hidden = false;
    $('#tabs').hidden = false;
    let tab = 'productos';
    try { tab = sessionStorage.getItem('dd-admin-tab') || tab; } catch { /* sin almacenamiento */ }
    showTab(tab);
    renderProducts();
    renderOffers();
  }
  function logout(message = '') {
    password = '';
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ }
    $('#login-view').hidden = false;
    $('#productos-view').hidden = true;
    $('#ofertas-view').hidden = true;
    $('#tabs').hidden = true;
    $('#logout').hidden = true;
    $('#price-bar').hidden = true;
    $('#login-error').hidden = !message;
    $('#login-error').textContent = message;
  }
  function showTab(name) {
    if (!['productos', 'ofertas'].includes(name)) name = 'productos';
    $$('[data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
    $('#productos-view').hidden = name !== 'productos';
    $('#ofertas-view').hidden = name !== 'ofertas';
    updatePriceBar();
    try { sessionStorage.setItem('dd-admin-tab', name); } catch { /* sin almacenamiento */ }
  }
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  // Ingreso con Google
  async function setupLogin() {
    let config = {};
    try { config = await (await fetch('/api/config', { cache:'no-store' })).json(); } catch { /* sin conexión */ }
    if (!config.googleClientId) {
      $('#login-error').textContent = 'El acceso con Google todavía no está configurado en Cloudflare.';
      $('#login-error').hidden = false;
      return;
    }
    $('#google-box').hidden = false;
    $('#login-intro').textContent = 'Entrá con tu cuenta de Google para administrar la web.';
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async ({ credential }) => {
          $('#login-error').hidden = true;
          try { await login(credential); }
          catch (error) { $('#login-error').textContent = error.message; $('#login-error').hidden = false; }
        }
      });
      google.accounts.id.renderButton($('#google-button'), { theme:'outline', size:'large', text:'signin_with', shape:'pill', locale:'es' });
    };
    script.onerror = () => { $('#login-error').textContent = 'No se pudo cargar el botón de Google. Revisá la conexión.'; $('#login-error').hidden = false; };
    document.head.append(script);
  }
  setupLogin();
  $('#logout').addEventListener('click', () => { if (window.google) google.accounts.id.disableAutoSelect(); logout(); });
  window.addEventListener('beforeunload', event => { if (priceEdits.size) event.preventDefault(); });

  // ---------- Guardar ----------
  async function saveProducts(next, message) {
    setStatus('#products-status', 'Guardando…');
    try {
      const data = await api('/api/productos', { method:'PUT', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ productos:next }) });
      products = data.productos;
      priceEdits.clear();
      $('#catalog-notice').hidden = true;
      renderProducts();
      refreshOfferProductSelect();
      setStatus('#products-status', message);
      return true;
    } catch (error) {
      setStatus('#products-status', error.message, true);
      return false;
    }
  }
  async function saveOffers(next, message) {
    setStatus('#offers-status', 'Guardando…');
    try {
      const data = await api('/api/ofertas', { method:'PUT', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ ofertas:next }) });
      offers = data.ofertas;
      renderOffers();
      setStatus('#offers-status', message);
      return true;
    } catch (error) {
      setStatus('#offers-status', error.message, true);
      return false;
    }
  }

  // ---------- Fotos (compartido por los dos formularios) ----------
  let photoTarget = null;
  $('#photo-file').addEventListener('change', async () => {
    const file = $('#photo-file').files[0];
    $('#photo-file').value = '';
    if (!file || !photoTarget) return;
    try { photoTarget.pending = await shrink(file); photoTarget.update(); }
    catch { photoTarget.error('No se pudo leer esa foto. Probá con otra (JPG o PNG).'); }
  });
  // Achica la foto en el navegador para que cargue rápido en la web.
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
      const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      return { blob, preview: canvas.toDataURL('image/jpeg', 0.7) };
    } finally { URL.revokeObjectURL(url); }
  }
  async function uploadPending(photo, statusId) {
    if (!photo.pending) return photo.uploaded;
    setStatus(statusId, 'Subiendo la foto…');
    const { id } = await api('/api/imagen', { method:'POST', headers:{ 'content-type':photo.pending.blob.type }, body:photo.pending.blob });
    photo.uploaded = id;
    photo.pending = null;
    return id;
  }
  // Maneja el bloque "Foto" de un formulario. sourceSrc(select) devuelve la url de la opción elegida.
  function photoControl(form, select, sourceMode, sourceSrc, emptyText, sourceBox = select) {
    const photo = { pending:null, uploaded:'' };
    const mode = () => $('[name=fotoTipo]:checked', form).value;
    photo.mode = mode;
    photo.error = text => { const e = $('[data-form-error]', form); e.textContent = text; e.hidden = !text; };
    photo.update = () => {
      const m = mode();
      sourceBox.hidden = m !== sourceMode;
      $('[data-pick]', form).hidden = m !== 'subir';
      const hint = $('[data-upload-hint]', form);
      if (hint) hint.hidden = m !== 'subir';
      const preview = $('[data-preview]', form);
      preview.replaceChildren();
      let src = '';
      if (m === sourceMode) src = sourceSrc(select.value);
      if (m === 'subir') src = photo.pending ? photo.pending.preview : photo.uploaded ? imageUrl(photo.uploaded) : '';
      const sources = [].concat(src).filter(Boolean);
      preview.classList.toggle('is-multi', sources.length > 1);
      sources.forEach(url => { const img = el('img'); img.src = url; img.alt = 'Vista previa'; preview.append(img); });
      if (!sources.length) preview.textContent = m === 'ninguna' ? 'Sin foto' : m === 'subir' ? 'Ninguna foto elegida' : emptyText;
      $('[data-pick]', form).textContent = photo.pending || photo.uploaded ? 'Cambiar foto…' : 'Elegir foto…';
    };
    photo.reset = (uploaded, chosenMode) => {
      photo.pending = null; photo.uploaded = uploaded || '';
      $(`[name=fotoTipo][value=${chosenMode}]`, form).checked = true;
      photo.error('');
      photo.update();
    };
    $$('[name=fotoTipo]', form).forEach(r => r.addEventListener('change', photo.update));
    select.addEventListener('change', photo.update);
    $('[data-pick]', form).addEventListener('click', () => { photoTarget = photo; $('#photo-file').click(); });
    return photo;
  }

  // =====================================================
  //                     PRODUCTOS
  // =====================================================
  const productForm = $('#product-form');
  const webSelect = $('[data-web-photo]', productForm);
  webSelect.append(new Option('Elegí una foto…', ''));
  WEB_PHOTOS.forEach(([file, name]) => webSelect.append(new Option(name, file)));
  const productPhotoCtl = photoControl(productForm, webSelect, 'web', file => file ? '../img/productos/' + file : '', 'Elegí una foto');
  let editingProduct = null;

  function visibleProducts() {
    const filter = $('#product-filter').value;
    const raw = $('#product-search').value.trim();
    const query = raw ? slug(raw).replace(/-/g, ' ') : '';
    return products.filter(p => {
      if (filter === 'ocultos' ? !p.oculto : filter && p.categoria !== filter) return false;
      return !query || slug(p.nombre).replace(/-/g, ' ').includes(query);
    });
  }
  function renderProducts() {
    const list = $('#product-list');
    list.replaceChildren();
    const visible = visibleProducts();
    if (!visible.length) list.append(el('p', 'admin-empty', products.length ? 'No hay productos con ese filtro.' : 'Todavía no hay productos. Tocá «Nuevo producto».'));
    visible.forEach((product, index) => {
      const row = el('article', 'admin-row product-row' + (product.oculto ? ' is-off' : ''));
      const info = el('div', 'row-info');
      info.append(el('h3', '', product.nombre));
      const meta = el('p', 'admin-row-meta');
      if (product.oculto) meta.append(el('span', 'badge off', 'OCULTO'));
      if (product.favorito) meta.append(el('span', 'badge fav', '★ FAVORITO'));
      const linked = linkedOffers(product);
      if (linked.length) meta.append(el('span', 'badge sale', 'EN OFERTA' + (linked[0].precio ? ' ' + money(linked[0].precio) : '')));
      meta.append(document.createTextNode(CATEGORIES[product.categoria] || product.categoria));
      if (product.sabores && product.sabores.length) meta.append(document.createTextNode(' · Sabores: ' + product.sabores.join(', ')));
      info.append(meta);

      // Precios editables directamente en la lista
      const prices = el('div', 'quick-prices');
      product.variantes.forEach(variant => {
        const key = product.id + '|' + variant.id;
        const label = el('label', 'quick-price');
        label.append(el('span', '', variant.etiqueta));
        const wrap = el('span', 'money-input');
        wrap.append(el('span', '', '$'));
        const input = el('input');
        input.inputMode = 'numeric';
        input.placeholder = 'A consultar';
        input.setAttribute('aria-label', `Precio de ${product.nombre}, ${variant.etiqueta}`);
        const current = priceEdits.has(key) ? priceEdits.get(key) : variant.precio;
        input.value = current === null || Number.isNaN(current) ? '' : current;
        if (priceEdits.has(key)) label.classList.add('is-changed');
        input.addEventListener('input', () => {
          const value = parsePrice(input.value);
          label.classList.toggle('is-invalid', Number.isNaN(value));
          if (value === variant.precio) priceEdits.delete(key); else priceEdits.set(key, value);
          label.classList.toggle('is-changed', priceEdits.has(key));
          updatePriceBar();
        });
        wrap.append(input);
        label.append(wrap);
        prices.append(label);
      });
      info.append(prices);

      const actions = el('div', 'admin-row-actions');
      const button = (text, label, handler, className = '') => {
        const b = el('button', className, text); b.type = 'button'; b.setAttribute('aria-label', label + ': ' + product.nombre);
        b.addEventListener('click', handler); actions.append(b); return b;
      };
      button('↑', 'Subir', () => moveProduct(product, visible[index - 1])).disabled = index === 0;
      button('↓', 'Bajar', () => moveProduct(product, visible[index + 1])).disabled = index === visible.length - 1;
      button(product.oculto ? 'Mostrar' : 'Ocultar', product.oculto ? 'Mostrar' : 'Ocultar', () => {
        if (!confirmDiscard()) return;
        saveProducts(products.map(p => p.id === product.id ? { ...p, oculto: !p.oculto } : p), product.oculto ? 'El producto vuelve a verse en la web.' : 'Producto oculto: ya no se ve en la web.');
      });
      button('Editar', 'Editar', () => openProductForm(product));
      if (linked.length) {
        button('Quitar oferta', 'Quitar oferta', async () => {
          if (!confirm(`¿Sacar la oferta de «${product.nombre}»? Deja de verse arriba en la web.`)) return;
          if (await saveOffers(offers.filter(o => o.productoId !== product.id), 'Oferta eliminada.')) {
            renderProducts();
            setStatus('#products-status', `Listo: «${product.nombre}» ya no está en oferta.`);
          }
        }, 'danger');
      } else {
        button('Poner en oferta', 'Poner en oferta', () => openProductForm(product, true), 'sale');
      }
      button('Eliminar', 'Eliminar', async () => {
        const extra = linked.length ? ' También se borra su oferta.' : '';
        if (!confirmDiscard() || !confirm(`¿Eliminar «${product.nombre}» del catálogo? No se puede deshacer.${extra} (Si solo querés sacarlo por un tiempo, usá «Ocultar».)`)) return;
        if (await saveProducts(products.filter(p => p.id !== product.id), 'Producto eliminado.') && linked.length) {
          await saveOffers(offers.filter(o => o.productoId !== product.id), 'Oferta eliminada.');
          renderProducts();
        }
      }, 'danger');
      row.append(thumb(productPhoto(product)), info, actions);
      list.append(row);
    });
    updatePriceBar();
  }
  $('#product-filter').addEventListener('change', renderProducts);
  $('#product-search').addEventListener('input', renderProducts);

  function confirmDiscard() {
    return !priceEdits.size || confirm('Tenés precios cambiados sin guardar. ¿Descartarlos?');
  }
  function moveProduct(product, neighbor) {
    if (!neighbor || !confirmDiscard()) return;
    const next = [...products];
    const a = next.findIndex(p => p.id === product.id), b = next.findIndex(p => p.id === neighbor.id);
    [next[a], next[b]] = [next[b], next[a]];
    saveProducts(next, 'Orden actualizado.');
  }

  // Barra para guardar los precios cambiados en la lista
  function updatePriceBar() {
    const onProducts = !$('#productos-view').hidden;
    $('#price-bar').hidden = !priceEdits.size || !onProducts;
    const invalid = [...priceEdits.values()].some(Number.isNaN);
    $('#price-bar-text').textContent = invalid ? 'Hay un precio mal escrito (usá solo números).' : `Cambiaste ${priceEdits.size} ${priceEdits.size === 1 ? 'precio' : 'precios'}.`;
    $('#price-bar').classList.toggle('is-error', invalid);
    $('#save-prices').disabled = invalid;
  }
  $('#discard-prices').addEventListener('click', () => { priceEdits.clear(); renderProducts(); setStatus('#products-status', 'Cambios descartados.'); });
  $('#save-prices').addEventListener('click', async () => {
    const button = $('#save-prices');
    button.disabled = true;
    const count = priceEdits.size;
    const next = products.map(p => ({ ...p, variantes: p.variantes.map(v => {
      const key = p.id + '|' + v.id;
      return priceEdits.has(key) ? { ...v, precio: priceEdits.get(key) } : v;
    }) }));
    await saveProducts(next, `Listo: ${count} ${count === 1 ? 'precio actualizado' : 'precios actualizados'} en la web.`);
    button.disabled = false;
  });

  // Formulario de producto
  function variantRow(variant = { id:'', etiqueta:'', precio:null }) {
    const row = el('div', 'variant-row');
    row.dataset.id = variant.id;
    const name = el('input'); name.placeholder = 'Ej.: Grande, 1 kg, 1 docena'; name.maxLength = 40; name.value = variant.etiqueta; name.setAttribute('aria-label', 'Nombre de la presentación');
    const priceWrap = el('span', 'money-input'); priceWrap.append(el('span', '', '$'));
    const price = el('input'); price.inputMode = 'numeric'; price.placeholder = 'A consultar'; price.value = variant.precio || ''; price.setAttribute('aria-label', 'Precio');
    priceWrap.append(price);
    const remove = el('button', 'icon-button', '✕'); remove.type = 'button'; remove.setAttribute('aria-label', 'Quitar esta presentación');
    remove.addEventListener('click', () => { row.remove(); });
    row.append(name, priceWrap, remove);
    return row;
  }
  const PRESETS = {
    tamanos: [['chica', 'Chica'], ['mediana', 'Mediana'], ['grande', 'Grande']],
    pesos: [['1kg', '1 kg'], ['medio', '½ kg'], ['cuarto', '¼ kg']],
    docena: [['docena', '1 docena']],
    unidad: [['unidad', '1 unidad']]
  };
  $$('[data-preset]', productForm).forEach(b => b.addEventListener('click', () => {
    const list = $('#variant-list');
    const hasData = $$('.variant-row', list).some(r => $$('input', r).some(i => i.value.trim()));
    if (hasData && !confirm('Esto reemplaza las presentaciones que escribiste. ¿Seguir?')) return;
    list.replaceChildren(...PRESETS[b.dataset.preset].map(([id, etiqueta]) => variantRow({ id, etiqueta, precio:null })));
    $('input', list.lastElementChild ? list.firstElementChild.querySelector('.money-input') : list)?.focus();
  }));
  $('#add-variant').addEventListener('click', () => { const row = variantRow(); $('#variant-list').append(row); $('input', row).focus(); });

  // Ofertas vinculadas a un producto (se crean desde su formulario)
  // (las promos que combinan varios productos se manejan desde la pestaña Ofertas)
  const linkedOffers = product => offers.filter(o => o.productoId === product.id && !o.imagen && (o.fotos || []).length <= 1);
  const offerFields = $('[data-offer-fields]', productForm);
  function firstVariantPrice() {
    const input = $('.variant-row .money-input input', productForm);
    const value = input ? parsePrice(input.value) : null;
    return Number.isInteger(value) ? value : null;
  }
  function toggleOfferFields() {
    offerFields.hidden = !productForm.enOferta.checked;
    if (productForm.enOferta.checked && !productForm.ofertaAnterior.value && firstVariantPrice()) productForm.ofertaAnterior.value = firstVariantPrice();
  }
  productForm.enOferta.addEventListener('change', () => { toggleOfferFields(); if (productForm.enOferta.checked) productForm.ofertaPrecio.focus(); });

  function openProductForm(product = null, withOffer = false) {
    editingProduct = product;
    productForm.reset();
    $('#product-form-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
    $('[data-save]', productForm).textContent = product ? 'Guardar cambios' : 'Agregar producto';
    const p = product || { nombre:'', categoria:'tortas', variantes:[], sabores:[] };
    productForm.nombre.value = p.nombre;
    productForm.categoria.value = p.categoria;
    productForm.visible.checked = !p.oculto;
    productForm.favorito.checked = !!p.favorito;
    productForm.sabores.value = (p.sabores || []).join(', ');
    $('#variant-list').replaceChildren(...(p.variantes.length ? p.variantes.map(variantRow) : [variantRow()]));
    webSelect.value = p.foto && !p.imagen ? p.foto : '';
    productPhotoCtl.reset(p.imagen, p.imagen ? 'subir' : p.foto ? 'web' : product ? 'ninguna' : 'subir');
    const linked = product ? linkedOffers(product)[0] : null;
    productForm.enOferta.checked = Boolean(linked) || withOffer;
    productForm.ofertaPrecio.value = linked && linked.precio ? linked.precio : '';
    productForm.ofertaAnterior.value = linked && linked.precioAnterior ? linked.precioAnterior : '';
    productForm.ofertaDetalle.value = linked ? linked.descripcion : '';
    productForm.ofertaHasta.value = linked ? linked.hasta : '';
    toggleOfferFields();
    productForm.hidden = false;
    $('#new-product').hidden = true;
    const focusTarget = withOffer ? productForm.ofertaPrecio : productForm.nombre;
    (withOffer ? $('#product-offer') : productForm).scrollIntoView({ behavior:'smooth', block:'start' });
    focusTarget.focus({ preventScroll:true });
  }
  function closeProductForm() { productForm.hidden = true; $('#new-product').hidden = false; editingProduct = null; }
  $('#new-product').addEventListener('click', () => openProductForm());
  $('[data-cancel]', productForm).addEventListener('click', closeProductForm);

  productForm.addEventListener('submit', async event => {
    event.preventDefault();
    productPhotoCtl.error('');
    const nombre = productForm.nombre.value.trim();
    if (!nombre) return productPhotoCtl.error('Escribí el nombre del producto.');
    const rows = $$('.variant-row', productForm);
    if (!rows.length) return productPhotoCtl.error('Agregá al menos una presentación (por ejemplo «1 unidad»).');
    const usedVariantIds = new Set();
    const variantes = [];
    for (const row of rows) {
      const [nameInput, priceInput] = $$('input', row);
      const etiqueta = nameInput.value.trim();
      const precio = parsePrice(priceInput.value);
      if (!etiqueta) { nameInput.focus(); return productPhotoCtl.error('Cada presentación necesita un nombre (ej.: «Grande», «1 kg»).'); }
      if (Number.isNaN(precio)) { priceInput.focus(); return productPhotoCtl.error(`Revisá el precio de «${etiqueta}»: escribilo solo con números. Ej.: 15000`); }
      let id = row.dataset.id && !usedVariantIds.has(row.dataset.id) ? row.dataset.id : uniqueId(etiqueta, usedVariantIds);
      usedVariantIds.add(id);
      variantes.push({ id, etiqueta, precio });
    }
    if (variantes.length > 12) return productPhotoCtl.error('Podés tener hasta 12 presentaciones.');
    const mode = productPhotoCtl.mode();
    if (mode === 'web' && !webSelect.value) return productPhotoCtl.error('Elegí una foto, subí una nueva o marcá «Sin foto».');
    if (mode === 'subir' && !productPhotoCtl.pending && !productPhotoCtl.uploaded) return productPhotoCtl.error('Elegí la foto para subir, o marcá «Sin foto».');
    const enOferta = productForm.enOferta.checked;
    const ofertaPrecio = parsePrice(productForm.ofertaPrecio.value);
    const ofertaAnterior = parsePrice(productForm.ofertaAnterior.value);
    if (enOferta) {
      if (!ofertaPrecio) { productForm.ofertaPrecio.focus(); return productPhotoCtl.error('Escribí el precio de oferta solo con números. Ej.: 15000'); }
      if (Number.isNaN(ofertaAnterior)) { productForm.ofertaAnterior.focus(); return productPhotoCtl.error('Escribí el precio anterior solo con números, o dejalo vacío.'); }
      if (ofertaAnterior && ofertaAnterior <= ofertaPrecio) return productPhotoCtl.error('El precio anterior tiene que ser mayor que el de oferta.');
    }
    if (!confirmDiscard()) return;
    const button = $('[data-save]', productForm);
    button.disabled = true;
    try {
      const imagen = mode === 'subir' ? await uploadPending(productPhotoCtl, '#products-status') : '';
      const data = {
        id: editingProduct ? editingProduct.id : uniqueId(nombre, new Set(products.map(p => p.id))),
        nombre,
        categoria: productForm.categoria.value,
        variantes,
        sabores: productForm.sabores.value.split(',').map(s => s.trim()).filter(Boolean),
        foto: mode === 'web' ? webSelect.value : '',
        imagen,
        favorito: productForm.favorito.checked,
        oculto: !productForm.visible.checked
      };
      const next = editingProduct ? products.map(p => p.id === editingProduct.id ? data : p) : [data, ...products];
      const linked = editingProduct ? linkedOffers(editingProduct)[0] : null;
      if (!await saveProducts(next, editingProduct ? `«${nombre}» actualizado.` : `«${nombre}» agregado al catálogo.`)) return;
      // Crear, actualizar o sacar la oferta del producto
      if (enOferta) {
        const keepTitle = linked && editingProduct && linked.titulo !== editingProduct.nombre;
        const offer = {
          id: linked ? linked.id : randomId(),
          titulo: keepTitle ? linked.titulo : nombre,
          descripcion: productForm.ofertaDetalle.value.trim(),
          precio: ofertaPrecio,
          precioAnterior: ofertaAnterior,
          productoId: data.id,
          fotos: linked && linked.fotos ? linked.fotos : [],
          imagen: linked ? linked.imagen : '',
          activa: linked ? linked.activa : true,
          hasta: productForm.ofertaHasta.value
        };
        const rest = offers.filter(o => o.productoId !== data.id);
        const nextOffers = linked ? offers.filter(o => o.productoId !== data.id || o.id === linked.id).map(o => o.id === linked.id ? offer : o) : [offer, ...rest];
        if (!await saveOffers(nextOffers, 'Oferta guardada.')) return setStatus('#products-status', 'El producto se guardó, pero la oferta no. Probá de nuevo.', true);
        setStatus('#products-status', linked ? `«${nombre}» y su oferta, actualizados.` : `Listo: «${nombre}» está en oferta y aparece arriba en la web.`);
      } else if (linked) {
        if (!await saveOffers(offers.filter(o => o.productoId !== data.id), 'Oferta eliminada.')) return setStatus('#products-status', 'El producto se guardó, pero no se pudo sacar la oferta. Probá de nuevo.', true);
        setStatus('#products-status', `«${nombre}» actualizado y su oferta, eliminada.`);
      }
      renderProducts();
      closeProductForm();
      $('#products-status').scrollIntoView({ behavior:'smooth', block:'center' });
    } catch (error) {
      productPhotoCtl.error(error.message);
      setStatus('#products-status', '');
    } finally { button.disabled = false; }
  });

  // =====================================================
  //                       OFERTAS
  // =====================================================
  const offerForm = $('#offer-form');
  const productSelect = $('[data-product-photo]', offerForm);
  const extraSelects = $$('[data-extra-photo]', offerForm);
  const chosenPhotoIds = () => [...new Set([productSelect, ...extraSelects].map(s => s.value).filter(Boolean))];
  const offerPhotoCtl = photoControl(offerForm, productSelect, 'producto', () => chosenPhotoIds().map(id => productPhoto(products.find(p => p.id === id))), 'Elegí un producto', $('[data-product-box]', offerForm));
  extraSelects.forEach(s => s.addEventListener('change', offerPhotoCtl.update));
  let editingOffer = null;

  function refreshOfferProductSelect() {
    const withPhoto = products.filter(p => p.foto || p.imagen);
    [productSelect, ...extraSelects].forEach((select, i) => {
      const value = select.value;
      select.replaceChildren(new Option(i ? `Foto ${i + 1}: ninguna (opcional)` : 'Elegí un producto…', ''), ...withPhoto.map(p => new Option(p.nombre, p.id)));
      select.value = value;
    });
  }
  function offerPhoto(offer) {
    if (offer.imagen) return imageUrl(offer.imagen);
    return productPhoto(products.find(p => p.id === ((offer.fotos || [])[0] || offer.productoId)));
  }
  function renderOffers() {
    refreshOfferProductSelect();
    const list = $('#offer-list');
    list.replaceChildren();
    $('#offers-empty').hidden = offers.length > 0;
    offers.forEach((offer, index) => {
      const late = offer.hasta && today && offer.hasta < today;
      const row = el('article', 'admin-row' + (!offer.activa || late ? ' is-off' : ''));
      const info = el('div', 'row-info');
      info.append(el('h3', '', offer.titulo));
      const meta = el('p', 'admin-row-meta');
      meta.append(el('span', 'badge' + (late ? ' late' : offer.activa ? '' : ' off'), late ? 'VENCIDA' : offer.activa ? 'VISIBLE' : 'PAUSADA'));
      meta.append(document.createTextNode(offer.precio ? money(offer.precio) : 'A consultar'));
      if (offer.precioAnterior) meta.append(el('s', '', money(offer.precioAnterior)));
      if (offer.hasta) { const [y, m, d] = offer.hasta.split('-'); meta.append(document.createTextNode(` · hasta ${d}/${m}/${y}`)); }
      info.append(meta);
      const actions = el('div', 'admin-row-actions');
      const button = (text, label, handler, className = '') => {
        const b = el('button', className, text); b.type = 'button'; b.setAttribute('aria-label', label + ': ' + offer.titulo);
        b.addEventListener('click', handler); actions.append(b); return b;
      };
      button('↑', 'Subir', () => moveOffer(index, -1)).disabled = index === 0;
      button('↓', 'Bajar', () => moveOffer(index, 1)).disabled = index === offers.length - 1;
      button(offer.activa ? 'Pausar' : 'Mostrar', offer.activa ? 'Pausar' : 'Mostrar', () =>
        saveOffers(offers.map(o => o.id === offer.id ? { ...o, activa: !o.activa } : o), offer.activa ? 'Oferta pausada: ya no se ve en la web.' : 'Oferta visible en la web.'));
      button('Editar', 'Editar', () => openOfferForm(offer));
      button('Eliminar', 'Eliminar', () => {
        if (confirm(`¿Eliminar la oferta «${offer.titulo}»? No se puede deshacer.`)) saveOffers(offers.filter(o => o.id !== offer.id), 'Oferta eliminada.');
      }, 'danger');
      row.append(thumb(offerPhoto(offer)), info, actions);
      list.append(row);
    });
  }
  function moveOffer(index, delta) {
    const next = [...offers];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    saveOffers(next, 'Orden actualizado.');
  }
  function openOfferForm(offer = null) {
    editingOffer = offer;
    offerForm.reset();
    $('#offer-form-title').textContent = offer ? 'Editar oferta' : 'Nueva oferta';
    $('[data-save]', offerForm).textContent = offer ? 'Guardar cambios' : 'Publicar oferta';
    if (offer) {
      offerForm.titulo.value = offer.titulo;
      offerForm.descripcion.value = offer.descripcion;
      offerForm.precio.value = offer.precio || '';
      offerForm.precioAnterior.value = offer.precioAnterior || '';
      offerForm.hasta.value = offer.hasta;
      offerForm.activa.checked = offer.activa;
    }
    const ids = offer ? ((offer.fotos || []).length ? offer.fotos : [offer.productoId]) : [];
    [productSelect, ...extraSelects].forEach((select, i) => { select.value = ids[i] || ''; });
    offerPhotoCtl.reset(offer ? offer.imagen : '', offer ? (offer.imagen ? 'subir' : offer.productoId ? 'producto' : 'ninguna') : 'producto');
    offerForm.hidden = false;
    $('#new-offer').hidden = true;
    offerForm.scrollIntoView({ behavior:'smooth', block:'start' });
    offerForm.titulo.focus({ preventScroll:true });
  }
  function closeOfferForm() { offerForm.hidden = true; $('#new-offer').hidden = false; editingOffer = null; }
  $('#new-offer').addEventListener('click', () => openOfferForm());
  $('[data-cancel]', offerForm).addEventListener('click', closeOfferForm);

  offerForm.addEventListener('submit', async event => {
    event.preventDefault();
    offerPhotoCtl.error('');
    if (!offerForm.titulo.value.trim()) return offerPhotoCtl.error('Escribí un título para la oferta.');
    const precio = parsePrice(offerForm.precio.value);
    const precioAnterior = parsePrice(offerForm.precioAnterior.value);
    if (Number.isNaN(precio) || Number.isNaN(precioAnterior)) return offerPhotoCtl.error('Escribí los precios solo con números. Ej.: 15000');
    if (precio && precioAnterior && precioAnterior <= precio) return offerPhotoCtl.error('El precio anterior tiene que ser mayor que el de oferta.');
    const mode = offerPhotoCtl.mode();
    if (mode === 'producto' && !chosenPhotoIds().length) return offerPhotoCtl.error('Elegí de qué producto tomar la foto, o marcá «Sin foto».');
    if (mode === 'subir' && !offerPhotoCtl.pending && !offerPhotoCtl.uploaded) return offerPhotoCtl.error('Elegí una foto para subir, o marcá «Sin foto».');
    const button = $('[data-save]', offerForm);
    button.disabled = true;
    try {
      const imagen = mode === 'subir' ? await uploadPending(offerPhotoCtl, '#offers-status') : '';
      const data = {
        id: editingOffer ? editingOffer.id : randomId(),
        titulo: offerForm.titulo.value.trim(),
        descripcion: offerForm.descripcion.value.trim(),
        precio, precioAnterior,
        productoId: mode === 'producto' ? chosenPhotoIds()[0] : '',
        fotos: mode === 'producto' ? chosenPhotoIds() : [],
        imagen,
        activa: offerForm.activa.checked,
        hasta: offerForm.hasta.value
      };
      const next = editingOffer ? offers.map(o => o.id === editingOffer.id ? data : o) : [data, ...offers];
      if (await saveOffers(next, editingOffer ? 'Cambios guardados.' : 'Oferta publicada. Ya aparece arriba en la web.')) closeOfferForm();
    } catch (error) {
      offerPhotoCtl.error(error.message);
      setStatus('#offers-status', '');
    } finally { button.disabled = false; }
  });

  // Si ya había entrado en esta pestaña, no pide la clave de nuevo.
  let saved = '';
  try { saved = sessionStorage.getItem(SESSION_KEY) || ''; } catch { /* sin almacenamiento */ }
  if (saved) login(saved).catch(() => logout());
})();
