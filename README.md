# Dulce Deleite

Sitio y catálogo de pastelería artesanal. Los pedidos se coordinan por WhatsApp.

## Actualizar desde GitHub

- Precios, presentaciones, nombres y fotos: desde el panel `/admin` (ver abajo). `public/js/productos.js` es el catálogo inicial.
- Fotografías de productos: `public/img/productos/`.
- Textos de inicio, Nosotros, ubicación y redes: `public/index.html`.
- Estilos y adaptación a celulares: `public/css/style.css`.
- WhatsApp y configuración del negocio: `public/js/config.js`.

Los precios se escriben en pesos, como números enteros sin puntos. Ejemplo: `26000` significa $26.000. Un precio `null` se muestra como «A consultar».

Para editar un archivo en GitHub, abrilo, elegí el lápiz, realizá el cambio y guardalo con **Commit changes** en la rama **main**. La publicación automática se habilita al conectar este repositorio con Cloudflare Pages.

## Panel de administración

En `/admin` hay un panel para manejar la web sin tocar código. Se entra con una cuenta de Google autorizada.

- **Productos y precios:** cambiar precios directamente en la lista y guardarlos todos juntos; agregar, editar, ocultar, ordenar y eliminar productos; cambiar nombre, categoría, foto (una de la web o una nueva subida desde el celular), presentaciones (tamaños, pesos, docenas…) y sabores; marcar favoritos; poner un producto en oferta (o quitarle la oferta) desde su ficha o con el botón «Poner en oferta».
- **Ofertas:** aparecen arriba de todo en la web, con precio anterior tachado, hasta 3 fotos de productos, la lista de lo que incluye y botón para agregarlas al carrito. Hasta que se guarde algo desde el panel, la web muestra las «Promos de finde» (definidas en `lib/admin.js`). Se pueden pausar, editar, ordenar, eliminar y ponerles fecha de vencimiento.

Mientras no se guarde nada desde el panel, la web usa `public/js/productos.js`. Después del primer guardado, el catálogo vive en Cloudflare y se edita solo desde el panel.

### Activarlo en Cloudflare (una sola vez)

1. **Workers y Pages → KV → Crear espacio de nombres** (por ejemplo `dulce-deleite-datos`).
2. En el proyecto de Pages: **Configuración → Vinculaciones → Agregar → Espacio de nombres KV**, nombre de variable `OFERTAS`, y elegir el espacio creado.
3. Crear el acceso con Google: en https://console.cloud.google.com → **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo *Aplicación web*. En **Orígenes autorizados de JavaScript** agregar la dirección de la web (por ejemplo `https://dulce-deleite.pages.dev`) y `http://localhost:8788` para probar en la compu. Copiar el *ID de cliente*.
4. En Pages: **Configuración → Variables y secretos**, agregar:
   - `GOOGLE_CLIENT_ID`: el ID de cliente del paso anterior.
   - `ADMIN_EMAILS`: los Gmail que pueden entrar, separados por coma. No hay contraseña: solo entran esas cuentas de Google.
5. Volver a implementar el sitio.

### Probarlo en la compu

Necesita Node.js. Crear un archivo `.dev.vars` (no se sube a GitHub) con esas mismas variables, una por línea (`NOMBRE=valor`), y ejecutar `npx wrangler pages dev public --kv OFERTAS --port 8788`. Abrir http://localhost:8788/ y http://localhost:8788/admin/.

## Alojamiento elegido

Cloudflare Pages con integración de GitHub. Configuración: rama `main`, sin framework, comando `exit 0` y carpeta de salida `public`. No requiere paquetes, claves ni instalación.

## Vista local

Desde la carpeta del repositorio: `python -m http.server 8771 --directory public`. Abrir http://127.0.0.1:8771/.

Este repositorio contiene únicamente los archivos de la web y sus imágenes finales. No incluye originales, copias de seguridad ni la dirección particular.
