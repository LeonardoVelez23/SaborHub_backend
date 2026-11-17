import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { MAX_UNIDADES_POR_PRODUCTO } from './reglasPedido.js';

export const MAX_PRODUCTOS = 100;

/** Valida `items` (lista de {producto_id, cantidad}, sin repetidos). */
export const validarItems = (items) => {
  if (!Array.isArray(items)) throw new ErrorNegocio('items debe ser una lista');
  if (items.length > MAX_PRODUCTOS) {
    throw new ErrorNegocio(`El carrito admite como máximo ${MAX_PRODUCTOS} productos`);
  }
  const vistos = new Set();
  for (const item of items) {
    const { producto_id: id, cantidad } = item ?? {};
    if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('producto_id debe ser un entero positivo');
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_UNIDADES_POR_PRODUCTO) {
      throw new ErrorNegocio(
        `La cantidad de cada producto debe ser un entero entre 1 y ${MAX_UNIDADES_POR_PRODUCTO}`
      );
    }
    if (vistos.has(id)) throw new ErrorNegocio('Un producto aparece más de una vez en el carrito');
    vistos.add(id);
  }
};

/** Carrito guardado en el servidor (RF-13). */
export const crearCarritoService = ({ carritos, transacciones }) => {
  const leer = async (clienteId) => ({
    items: (await carritos.items(clienteId)).map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      producto: item.producto
    }))
  });

  return {
    leer,

    /**
     * Reemplaza el carrito completo (la última versión gana). Los productos
     * que ya no existen se ignoran; stock y disponibilidad se validan al
     * crear el pedido. Todos deben ser de la misma sucursal (RF-39).
     */
    reemplazar: async (clienteId, items) => {
      validarItems(items);
      const existentes = await carritos.productosExistentes(items.map((i) => i.producto_id));
      if (new Set(existentes.values()).size > 1) {
        throw new ErrorNegocio('El carrito solo puede tener productos de una sucursal');
      }
      await transacciones.ejecutar(async (t) => {
        await carritos.vaciar(clienteId, t);
        await carritos.insertar(
          items
            .filter((i) => existentes.has(i.producto_id))
            .map((i, posicion) => ({ cliente_id: clienteId, producto_id: i.producto_id, cantidad: i.cantidad, posicion })),
          t
        );
      });
      return leer(clienteId);
    }
  };
};
