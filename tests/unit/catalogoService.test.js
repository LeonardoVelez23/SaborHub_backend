import { describe, expect, it } from 'vitest';
import { RegistroDuplicado } from '../../src/errors/RegistroDuplicado.js';
import { crearCategoriaService } from '../../src/services/categoriaService.js';
import { crearProductoService, leerImagenCodigo } from '../../src/services/productoService.js';

/** Repositorio en memoria con un campo único, como la base. */
const enMemoria = (campoUnico, filas = []) => {
  let siguiente = filas.length + 1;
  const duplicado = (datos, propia) =>
    filas.some((f) => f !== propia && f[campoUnico] === datos[campoUnico]);
  const repo = {
    filas,
    listar: async () => filas,
    buscar: async (id) => filas.find((f) => f.id === Number(id)) ?? null,
    crear: async (datos) => {
      if (duplicado(datos)) throw new RegistroDuplicado();
      const fila = { id: siguiente++, ...datos };
      filas.push(fila);
      return fila;
    },
    actualizar: async (fila, datos) => {
      if (duplicado(datos, fila)) throw new RegistroDuplicado();
      return Object.assign(fila, datos);
    },
    eliminar: async (fila) => filas.splice(filas.indexOf(fila), 1)
  };
  repo.buscarConCategoria = repo.buscar;
  return repo;
};

const armar = () => {
  const categorias = enMemoria('nombre', [{ id: 1, nombre: 'Bebidas' }]);
  const productos = enMemoria('codigo', [{ id: 1, codigo: 'P001', nombre: 'Café', precio: 1.5, categoria_id: 1 }]);
  return {
    categorias,
    productos,
    categoriaService: crearCategoriaService({ categorias }),
    productoService: crearProductoService({ productos, categorias })
  };
};

describe('Catálogo (RF-09 a RF-11, RN-17) sin base de datos', () => {
  it('crea un producto con valores por defecto y textos sin espacios sobrantes', async () => {
    const { productoService } = armar();
    const p = await productoService.crear({ codigo: ' P002 ', nombre: ' Té ', precio: 2, categoria_id: 1 });
    expect(p).toMatchObject({ codigo: 'P002', nombre: 'Té', estado: 'disponible', cantidad_disponible: 0, imagen_codigo: null });
  });

  it('rechaza precio 0, stock negativo, categoría inexistente y código repetido (CA-09)', async () => {
    const { productoService } = armar();
    const base = { codigo: 'P003', nombre: 'Agua', precio: 1, categoria_id: 1 };
    await expect(productoService.crear({ ...base, precio: 0 })).rejects.toThrow('mayor a 0');
    await expect(productoService.crear({ ...base, cantidad_disponible: -1 })).rejects.toThrow('negativa');
    await expect(productoService.crear({ ...base, categoria_id: 9 })).rejects.toThrow('categoría indicada no existe');
    await expect(productoService.crear({ ...base, codigo: 'P001' })).rejects.toThrow('Ya existe un producto con ese código');
  });

  it('valida el código de imagen y permite quitarlo (CA-10)', async () => {
    expect(leerImagenCodigo(undefined)).toBeUndefined();
    expect(leerImagenCodigo('')).toBeNull();
    expect(leerImagenCodigo('bandeja_paisa')).toBe('bandeja_paisa');
    for (const malo of ['Bandeja', 'con espacio', 'a.webp', '../x']) {
      expect(() => leerImagenCodigo(malo)).toThrow('imagen_codigo');
    }
    const { productoService, productos } = armar();
    await productoService.actualizar(1, { imagen_codigo: 'cafe' });
    await productoService.actualizar(1, { precio: 2 });
    expect(productos.filas[0]).toMatchObject({ imagen_codigo: 'cafe', precio: 2 });
    await productoService.actualizar(1, { imagen_codigo: null });
    expect(productos.filas[0].imagen_codigo).toBeNull();
  });

  it('responde 404 si el producto no existe antes de validar los datos', async () => {
    const { productoService } = armar();
    await expect(productoService.actualizar(9, { precio: 0 })).rejects.toMatchObject({ status: 404 });
  });

  it('las categorías tienen nombre obligatorio y único', async () => {
    const { categoriaService } = armar();
    await expect(categoriaService.crear({ nombre: '  ' })).rejects.toThrow('obligatorio');
    await expect(categoriaService.crear({ nombre: 'Bebidas' })).rejects.toThrow('Ya existe una categoría con ese nombre');
    expect(await categoriaService.crear({ nombre: ' Postres ' })).toMatchObject({ nombre: 'Postres' });
    await expect(categoriaService.eliminar(9)).rejects.toMatchObject({ status: 404 });
  });
});
