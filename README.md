# Dulce Deleite

Sitio y catálogo de pastelería artesanal. Los pedidos se coordinan por WhatsApp.

## Actualizar desde GitHub

- Precios, presentaciones, nombres y fotos: `public/js/productos.js`.
- Fotografías de productos: `public/img/productos/`.
- Textos de inicio, Nosotros, ubicación y redes: `public/index.html`.
- Estilos y adaptación a celulares: `public/css/style.css`.
- WhatsApp y configuración del negocio: `public/js/config.js`.

Los precios se escriben en pesos, como números enteros sin puntos. Ejemplo: `26000` significa $26.000. Un precio `null` se muestra como «A consultar».

Para editar un archivo en GitHub, abrilo, elegí el lápiz, realizá el cambio y guardalo con **Commit changes** en la rama **main**. La publicación automática se habilita al conectar este repositorio con Cloudflare Pages.

## Alojamiento elegido

Cloudflare Pages con integración de GitHub. Configuración: rama `main`, sin framework, comando `exit 0` y carpeta de salida `public`. No requiere paquetes, claves ni instalación.

## Vista local

Desde la carpeta del repositorio: `python -m http.server 8771 --directory public`. Abrir http://127.0.0.1:8771/.

Este repositorio contiene únicamente los archivos de la web y sus imágenes finales. No incluye originales, copias de seguridad ni la dirección particular.
