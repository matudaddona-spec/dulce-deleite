/* Precios actualizados con la lista del 28/10/2026. null significa a consultar.
   Los cuartos fueron fijados con autorización del usuario; ver registro privado de precios. */
(() => {
  const tamanos = (chica, mediana, grande) => [
    { id: 'chica', etiqueta: 'Chica', precio: chica },
    { id: 'mediana', etiqueta: 'Mediana', precio: mediana },
    { id: 'grande', etiqueta: 'Grande', precio: grande }
  ];
  const pesos = (kilo, medio = null, cuarto = null) => [
    { id: '1kg', etiqueta: '1 kg', precio: kilo },
    { id: 'medio', etiqueta: '½ kg', precio: medio },
    { id: 'cuarto', etiqueta: '¼ kg', precio: cuarto }
  ];
  const docena = precio => [{ id: 'docena', etiqueta: '1 docena', precio }];
  const unidad = precio => [{ id: 'unidad', etiqueta: '1 unidad', precio }];
  window.PRODUCTOS = [
    { id:'pastafrola', nombre:'Pastafrola', categoria:'tortas', foto:'pastafrola.jpg', favorito:true, variantes:tamanos(7000,10000,16000) },
    { id:'lemon-pie', nombre:'Lemon pie', categoria:'tortas', foto:'lemon-pie-aluminio.webp', favorito:true, variantes:tamanos(10000,16000,21000) },
    { id:'cabsha', nombre:'Cabsha', categoria:'tortas', foto:'cabsha-costado-aprobada.webp', variantes:tamanos(9000,15000,20000) },
    { id:'frutal', nombre:'Tarta frutal con pastelera', categoria:'tortas', foto:'frutal-oct18.webp', variantes:tamanos(8000,14000,19000) },
    { id:'ricota', nombre:'Tarta de ricota', categoria:'tortas', foto:'ricota-aluminio.webp', variantes:tamanos(9000,15000,20000) },
    { id:'coco', nombre:'Tarta de coco', categoria:'tortas', foto:'coco-aluminio-v2.webp', variantes:tamanos(10000,16000,22000) },
    { id:'manzana', nombre:'Crumble de manzana', categoria:'tortas', foto:'manzana-costado-madera-aprobada.webp', variantes:tamanos(9000,14000,19000) },
    { id:'banana', nombre:'Tarta de banana', categoria:'tortas', foto:'banana-aluminio.webp', variantes:tamanos(9000,14000,19000) },
    { id:'alfajor-chocolate', nombre:'Alfajores de chocolate', categoria:'dulces', foto:'alfajores-chocolate.jpg', favorito:true, variantes:pesos(21000,12000,6000) },
    { id:'alfajor-maicena', nombre:'Alfajores de maicena', categoria:'dulces', foto:'alfajores-maicena.jpg', favorito:true, variantes:pesos(18000,10000,5000) },
    { id:'alfajor-colores', nombre:'Alfajores de maicena de colores', categoria:'dulces', foto:'alfajores-colores.jpg', variantes:pesos(19000,11000,6000) },
    { id:'alfajor-nuez', nombre:'Alfajores de nuez', categoria:'dulces', foto:'alfajor-nuez-oct18.webp', variantes:pesos(22000,11000,6000) },
    { id:'alfajor-chip', nombre:'Alfajores de chip', categoria:'dulces', foto:'alfajor-chip-oct18.webp', variantes:pesos(20000,10000,5000) },
    { id:'brownie', nombre:'Brownie tradicional', categoria:'dulces', foto:'brownie-tradicional-merengue-mejorado.webp', favorito:true, variantes:unidad(26000) },
    { id:'brownie-tentacion', nombre:'Brownie Tentación', categoria:'dulces', foto:'brownie-tentacion-oct18.webp', variantes:unidad(31000) },
    { id:'conitos', nombre:'Conitos de dulce de leche', categoria:'dulces', foto:'conitos.jpg', favorito:true, variantes:pesos(20000,11000,6000) },
    { id:'vianesas', nombre:'Vienesas', categoria:'dulces', foto:'vianesas-oct18.webp', variantes:pesos(19000,10000,5000) },
    { id:'scon-dulce', nombre:'Scon dulce', categoria:'dulces', foto:'scon-dulce-oct18.webp', variantes:pesos(14000,8000,4000) },
    { id:'bizcochitos', nombre:'Bizcochitos de grasa', categoria:'salados', foto:'bizcochitos-oct18.webp', variantes:pesos(14000,8000,4000) },
    { id:'panes-saborizados', nombre:'Panes saborizados', categoria:'salados', foto:'panes-saborizados-oct18.webp', variantes:pesos(14000,7000,4000) },
    { id:'scon-queso', nombre:'Scon de queso', categoria:'salados', foto:'scon-queso-oct18.webp', variantes:pesos(22000,11000,6000) },
    { id:'pizzetas', nombre:'Pizzetas', categoria:'salados', foto:'pizzetas-oct18.webp', variantes:docena(2400) },
    { id:'prepizzas', nombre:'Prepizzas', categoria:'salados', foto:'prepizzas-oct18.webp', variantes:unidad(2400) },
    { id:'fosforitos', nombre:'Fosforitos de jamón y queso', categoria:'salados', foto:'fosforitos-mejorados.webp', variantes:docena(18000) },
    { id:'pancitos-rellenos', nombre:'Pancitos de jamón y queso', categoria:'salados', foto:'pancitos-mejorados.webp', variantes:docena(14000) },
    { id:'panes-pollo', nombre:'Panes rellenos de pollo y verdeo', categoria:'salados', foto:'panes-pollo-oct18.webp', variantes:docena(20000) },
    { id:'medialunas', nombre:'Medialunas de jamón y queso', categoria:'salados', foto:'medialunas-mejoradas.webp', variantes:docena(16000) },
    { id:'empanaditas', nombre:'Empanaditas de copetín', categoria:'salados', foto:'empanaditas-oct18.webp', variantes:docena(14000), sabores:['Carne','Pollo','Jamón y queso'] },
    { id:'miga', nombre:'Sándwiches de miga triples de jamón y queso', categoria:'salados', foto:'sandwiches-miga.png', variantes:[{ id:'consulta', etiqueta:'Cantidad a convenir', precio:null }] },
    { id:'pizzas-armadas', nombre:'Pizzas armadas', categoria:'salados', foto:'pizzas-armadas-oct18.webp', variantes:unidad(null) }
  ];
})();
