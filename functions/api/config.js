import { json } from '../../lib/admin.js';

// Datos públicos que necesita la página /admin para mostrar el botón de Google.
export function onRequestGet({ env }) {
  return json({ googleClientId: env.GOOGLE_CLIENT_ID || '' });
}
