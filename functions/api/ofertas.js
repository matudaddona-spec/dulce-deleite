import { json, sinConfigurar, esAdmin, leerOfertas, vigente, hoyArgentina, limpiarOfertas, limpiarImagenes, KEY_OFERTAS, OFERTAS_INICIALES } from '../../lib/admin.js';

// GET público: devuelve las ofertas vigentes.
// GET con clave de administración: devuelve todas (incluye pausadas y vencidas).
export async function onRequestGet({ request, env }) {
  const error = sinConfigurar(env);
  const admin = await esAdmin(request, env);
  // Sin configurar todavía: la web muestra las ofertas iniciales.
  if (error) return admin === null ? json({ ofertas: OFERTAS_INICIALES }) : json({ error }, 503);
  if (admin === false) return json({ error: 'Sin acceso: la cuenta no está autorizada o la sesión venció.' }, 401);
  const ofertas = await leerOfertas(env);
  if (admin) return json({ admin: true, hoy: hoyArgentina(), ofertas });
  const hoy = hoyArgentina();
  return json({ ofertas: ofertas.filter(oferta => vigente(oferta, hoy)) }, 200, { 'cache-control': 'public, max-age=30', vary: 'Authorization' });
}

// PUT: reemplaza la lista completa. Solo con clave.
export async function onRequestPut({ request, env }) {
  const error = sinConfigurar(env);
  if (error) return json({ error }, 503);
  if (!(await esAdmin(request, env))) return json({ error: 'Sin acceso: la cuenta no está autorizada o la sesión venció.' }, 401);
  let ofertas;
  try {
    ofertas = limpiarOfertas((await request.json()).ofertas);
  } catch (e) {
    return json({ error: e instanceof SyntaxError ? 'Formato inválido.' : e.message }, 400);
  }
  await env.OFERTAS.put(KEY_OFERTAS, JSON.stringify(ofertas));

  await limpiarImagenes(env);

  return json({ ok: true, ofertas });
}
