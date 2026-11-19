import { json, sinConfigurar, esAdmin, leerProductos, limpiarProductos, limpiarImagenes, KEY_PRODUCTOS } from '../../lib/admin.js';

// GET público: devuelve el catálogo guardado desde el panel (sin los productos ocultos).
// Si todavía no se guardó nada, devuelve productos: null y la web usa js/productos.js.
// GET con clave: devuelve el catálogo completo, incluidos los ocultos.
export async function onRequestGet({ request, env }) {
  const error = sinConfigurar(env);
  const admin = await esAdmin(request, env);
  if (error) return admin === null ? json({ productos: null }) : json({ error }, 503);
  if (admin === false) return json({ error: 'Sin acceso: la cuenta no está autorizada o la sesión venció.' }, 401);
  const productos = await leerProductos(env);
  if (admin) return json({ admin: true, productos });
  return json({ productos: productos && productos.filter(producto => !producto.oculto) }, 200, { 'cache-control': 'public, max-age=30', vary: 'Authorization' });
}

// PUT: reemplaza el catálogo completo. Solo con clave.
export async function onRequestPut({ request, env }) {
  const error = sinConfigurar(env);
  if (error) return json({ error }, 503);
  if (!(await esAdmin(request, env))) return json({ error: 'Sin acceso: la cuenta no está autorizada o la sesión venció.' }, 401);
  let productos;
  try {
    productos = limpiarProductos((await request.json()).productos);
  } catch (e) {
    return json({ error: e instanceof SyntaxError ? 'Formato inválido.' : e.message }, 400);
  }
  await env.OFERTAS.put(KEY_PRODUCTOS, JSON.stringify(productos));
  await limpiarImagenes(env);
  return json({ ok: true, productos });
}
