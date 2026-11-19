import { PREFIJO_IMAGEN } from '../../../lib/admin.js';

// GET público: devuelve una foto subida desde el panel.
export async function onRequestGet({ params, env }) {
  const id = String(params.id || '');
  if (!env.OFERTAS || !/^[a-z0-9-]{1,60}$/.test(id)) return new Response('No encontrada', { status: 404 });
  const { value, metadata } = await env.OFERTAS.getWithMetadata(PREFIJO_IMAGEN + id, 'arrayBuffer');
  if (!value) return new Response('No encontrada', { status: 404 });
  return new Response(value, {
    headers: {
      'content-type': metadata?.tipo || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff'
    }
  });
}
