// Utilidades compartidas por las funciones del panel de administración.
// Necesita en Cloudflare Pages: un espacio KV vinculado como OFERTAS, GOOGLE_CLIENT_ID y ADMIN_EMAILS
// (mails que pueden entrar, separados por coma). Solo se entra con Google.

export const KEY_OFERTAS = 'ofertas';
export const KEY_PRODUCTOS = 'productos';
export const MAX_PRODUCTOS = 200;
export const CATEGORIAS = ['tortas', 'dulces', 'salados'];
export const PREFIJO_IMAGEN = 'img:';
export const MAX_OFERTAS = 30;
export const MAX_IMAGEN = 1_500_000; // bytes

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

export function sinConfigurar(env) {
  if (!env.OFERTAS) return 'Falta vincular el espacio KV «OFERTAS» en Cloudflare Pages.';
  if (!env.GOOGLE_CLIENT_ID || !env.ADMIN_EMAILS) return 'Falta configurar el acceso con Google: GOOGLE_CLIENT_ID y ADMIN_EMAILS.';
  return '';
}

// ---------- Ingreso con Google ----------
const base64url = texto => Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(texto.length / 4) * 4, '=')), c => c.charCodeAt(0));
const leerJson = parte => JSON.parse(new TextDecoder().decode(base64url(parte)));
let clavesGoogle = { keys: [], vence: 0 };

async function obtenerClavesGoogle() {
  if (clavesGoogle.vence > Date.now()) return clavesGoogle.keys;
  const respuesta = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cf: { cacheTtl: 3600 } });
  if (!respuesta.ok) throw new Error('No se pudieron leer las claves de Google.');
  const { keys } = await respuesta.json();
  clavesGoogle = { keys, vence: Date.now() + 60 * 60 * 1000 };
  return keys;
}

export function emailsPermitidos(env) {
  return String(env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
}

// Verifica el token de "Acceder con Google". Devuelve el email si es válido y está autorizado; si no, ''.
export async function verificarGoogle(token, env, claves = null) {
  try {
    if (!env.GOOGLE_CLIENT_ID) return '';
    const partes = token.split('.');
    if (partes.length !== 3) return '';
    const cabecera = leerJson(partes[0]);
    const datos = leerJson(partes[1]);
    if (cabecera.alg !== 'RS256') return '';
    const jwk = (claves || await obtenerClavesGoogle()).find(clave => clave.kid === cabecera.kid);
    if (!jwk) return '';
    const llave = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const firmaValida = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', llave, base64url(partes[2]), new TextEncoder().encode(partes[0] + '.' + partes[1]));
    if (!firmaValida) return '';
    const ahora = Math.floor(Date.now() / 1000);
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(datos.iss)) return '';
    if (datos.aud !== env.GOOGLE_CLIENT_ID || !(datos.exp > ahora) || datos.email_verified !== true) return '';
    const email = String(datos.email || '').toLowerCase();
    return emailsPermitidos(env).includes(email) ? email : '';
  } catch {
    return '';
  }
}

// Devuelve true (acceso correcto), false (cuenta no autorizada / sesión vencida) o null (no se envió nada).
export async function esAdmin(request, env) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return Boolean(await verificarGoogle(header.slice(7), env));
}

// Ofertas que muestra la web hasta que se guarde algo desde el panel.
export const OFERTAS_INICIALES = [
  { id: 'promo-finde-1', titulo: 'Promo 1', descripcion: '¼ kg de alfajores de maicena\n¼ kg de alfajores de chocolate', precio: 10000, precioAnterior: null, productoId: 'alfajor-maicena', fotos: ['alfajor-maicena', 'alfajor-chocolate'], imagen: '', activa: true, hasta: '' },
  { id: 'promo-finde-2', titulo: 'Promo 2', descripcion: '1 pastafrola de batata o membrillo\n¼ kg de alfajores de maicena\n¼ kg de bizcochitos de grasa', precio: 16000, precioAnterior: null, productoId: 'pastafrola', fotos: ['pastafrola', 'alfajor-maicena', 'bizcochitos'], imagen: '', activa: true, hasta: '' },
  { id: 'promo-finde-3', titulo: 'Promo 3', descripcion: '½ kg de alfajores de maicena\n½ kg de bizcochitos de grasa', precio: 18000, precioAnterior: null, productoId: 'alfajor-maicena', fotos: ['alfajor-maicena', 'bizcochitos'], imagen: '', activa: true, hasta: '' }
];

export async function leerOfertas(env) {
  const guardadas = await env.OFERTAS.get(KEY_OFERTAS, 'json');
  return Array.isArray(guardadas) ? guardadas : OFERTAS_INICIALES;
}

// null = todavía no se guardó nada desde el panel (la web usa js/productos.js).
export async function leerProductos(env) {
  const guardados = await env.OFERTAS.get(KEY_PRODUCTOS, 'json');
  return Array.isArray(guardados) ? guardados : null;
}

// Borra las fotos subidas que ya no usa ningún producto ni oferta.
// Las subidas en la última hora se conservan (pueden estar por guardarse).
export async function limpiarImagenes(env) {
  const [ofertas, productos] = await Promise.all([leerOfertas(env), leerProductos(env)]);
  const enUso = new Set([...ofertas, ...(productos || [])].map(item => item.imagen).filter(Boolean));
  const limite = Date.now() - 60 * 60 * 1000;
  let cursor;
  do {
    const pagina = await env.OFERTAS.list({ prefix: PREFIJO_IMAGEN, cursor });
    await Promise.all(pagina.keys
      .filter(({ name, metadata }) => !enUso.has(name.slice(PREFIJO_IMAGEN.length)) && (metadata?.subida || 0) < limite)
      .map(({ name }) => env.OFERTAS.delete(name)));
    cursor = pagina.list_complete ? null : pagina.cursor;
  } while (cursor);
}

// Fecha de hoy en Argentina, formato AAAA-MM-DD.
export function hoyArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

export function vigente(oferta, hoy = hoyArgentina()) {
  return oferta.activa && (!oferta.hasta || oferta.hasta >= hoy);
}

const texto = (valor, max) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');
const precio = valor => (Number.isInteger(valor) && valor > 0 && valor < 100_000_000 ? valor : null);
const archivoValido = valor => typeof valor === 'string' && /^[a-z0-9][a-z0-9._-]{0,100}\.(jpe?g|png|webp)$/i.test(valor);
const idValido = valor => typeof valor === 'string' && /^[a-z0-9-]{1,60}$/.test(valor);

// Limpia lo que manda el panel para guardar solo datos válidos.
export function limpiarOfertas(lista) {
  if (!Array.isArray(lista)) throw new Error('Formato inválido.');
  if (lista.length > MAX_OFERTAS) throw new Error(`Podés tener hasta ${MAX_OFERTAS} ofertas.`);
  const vistos = new Set();
  return lista.map(item => {
    if (!item || typeof item !== 'object' || !idValido(item.id) || vistos.has(item.id)) throw new Error('Hay una oferta con datos inválidos.');
    vistos.add(item.id);
    const titulo = texto(item.titulo, 80);
    if (!titulo) throw new Error('Cada oferta necesita un título.');
    const hasta = typeof item.hasta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.hasta) ? item.hasta : '';
    // Descripción: una línea por cada cosa que incluye (máximo 6 líneas).
    const descripcion = texto(item.descripcion, 240).split(/\r?\n/).map(linea => linea.trim()).filter(Boolean).slice(0, 6).join('\n');
    const fotos = Array.isArray(item.fotos) ? [...new Set(item.fotos.filter(idValido))].slice(0, 3) : [];
    return {
      id: item.id,
      titulo,
      descripcion,
      precio: precio(item.precio),
      precioAnterior: precio(item.precioAnterior),
      productoId: idValido(item.productoId) ? item.productoId : '',
      fotos,
      imagen: idValido(item.imagen) ? item.imagen : '',
      activa: item.activa !== false,
      hasta
    };
  });
}

// Limpia el catálogo que manda el panel.
export function limpiarProductos(lista) {
  if (!Array.isArray(lista)) throw new Error('Formato inválido.');
  if (lista.length > MAX_PRODUCTOS) throw new Error(`Podés tener hasta ${MAX_PRODUCTOS} productos.`);
  const vistos = new Set();
  return lista.map(item => {
    if (!item || typeof item !== 'object' || !idValido(item.id) || vistos.has(item.id)) throw new Error('Hay un producto con datos inválidos.');
    vistos.add(item.id);
    const nombre = texto(item.nombre, 80);
    if (!nombre) throw new Error('Cada producto necesita un nombre.');
    if (!CATEGORIAS.includes(item.categoria)) throw new Error(`«${nombre}» no tiene una categoría válida.`);
    if (!Array.isArray(item.variantes) || !item.variantes.length || item.variantes.length > 12) throw new Error(`«${nombre}» necesita entre 1 y 12 presentaciones.`);
    const variantesVistas = new Set();
    const variantes = item.variantes.map(variante => {
      const etiqueta = texto(variante && variante.etiqueta, 40);
      if (!variante || !idValido(variante.id) || variantesVistas.has(variante.id) || !etiqueta) throw new Error(`Revisá las presentaciones de «${nombre}»: cada una necesita un nombre.`);
      variantesVistas.add(variante.id);
      return { id: variante.id, etiqueta, precio: precio(variante.precio) };
    });
    const sabores = Array.isArray(item.sabores) ? [...new Set(item.sabores.map(sabor => texto(sabor, 40)).filter(Boolean))].slice(0, 20) : [];
    const producto = { id: item.id, nombre, categoria: item.categoria, variantes };
    if (archivoValido(item.foto)) producto.foto = item.foto;
    if (idValido(item.imagen)) producto.imagen = item.imagen;
    if (item.favorito === true) producto.favorito = true;
    if (item.oculto === true) producto.oculto = true;
    if (sabores.length) producto.sabores = sabores;
    return producto;
  });
}
