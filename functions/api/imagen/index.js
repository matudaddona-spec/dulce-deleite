import { json, sinConfigurar, esAdmin, MAX_IMAGEN, PREFIJO_IMAGEN } from '../../../lib/admin.js';

const TIPOS = new Set(['image/webp', 'image/jpeg', 'image/png']);

// POST: sube una foto para una oferta. Solo con clave. Devuelve su id.
export async function onRequestPost({ request, env }) {
  const error = sinConfigurar(env);
  if (error) return json({ error }, 503);
  if (!(await esAdmin(request, env))) return json({ error: 'Sin acceso: la cuenta no está autorizada o la sesión venció.' }, 401);
  const tipo = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (!TIPOS.has(tipo)) return json({ error: 'La foto tiene que ser JPG, PNG o WEBP.' }, 415);
  const datos = await request.arrayBuffer();
  if (!datos.byteLength || datos.byteLength > MAX_IMAGEN) return json({ error: 'La foto es demasiado grande.' }, 413);
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 20);
  await env.OFERTAS.put(PREFIJO_IMAGEN + id, datos, { metadata: { tipo, subida: Date.now() } });
  return json({ id });
}
