import { describe, expect, it } from 'vitest';
import { RegistroDuplicado } from '../../src/errors/RegistroDuplicado.js';
import { crearCategoriaService } from '../../src/services/categoriaService.js';
import { crearProductoService, leerImagenCodigo } from '../../src/services/productoService.js';

/** Sucursales 1 y 2 del restaurante 1; la 3, del restaurante 2. */
const SUCURSALES = [
  { id: 1, restaurante_id: 1 },
  { id: 2, restaurante_id: 1 },
  { id: 3, restaurante_id: 2 }
];
const enAlcance = (sucursalId, alcance) => {
  if (!alcance || alcance.nivel === 'plataforma') return true;
  if (alcance.nivel === 'sucursal') return sucursalId === alcance.sucursalId;
  if (alcance.nivel === 'restaurante') {
    return SUCURSALES.find((s) => s.id === sucursalId)?.restaurante_id === alcance.restauranteId;
  }
  return false;
};
const sucursales = {
  buscar: async (id, alcance) => SUCURSALES.find((s) => s.id === Number(id) && enAlcance(s.id, alcance)) ?? null
};

/** Repositorio en memoria con un campo único, como la base. */
const enMemoria = (campoUnico, filas = []) => {
  let siguiente = filas.length + 1;
  const duplicado = (datos, propia) =>
    filas.some((f) => f !== propia && f[campoUnico] === datos[campoUnico]);
  const repo = {
    filas,
    listar: async () => filas,
    // Respeta el alcance como el repositorio real (nivel sucursal o restaurante).
    buscar: async (id, alcance) =>
      filas.find((f) => f.id === Number(id) && enAlcance(f.sucursal_id, alcance)) ?? null,
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
  const categorias = enMemoria('nombre', [{ id: 1, nombre: 'Bebidas', sucursal_id: 1 }, { id: 2, nombre: 'Otra sucursal', sucursal_id: 2 }]);
  const productos = enMemoria('codigo', [{ id: 1, codigo: 'P001', nombre: 'Café', precio: 1.5, categoria_id: 1, sucursal_id: 1 }]);
  return {
    categorias,
    productos,
    categoriaService: crearCategoriaService({ categorias, sucursales }),
    productoService: crearProductoService({ productos, categorias, sucursales })
  };
};

/** Cajero de la sucursal 1. */
const CAJERO = { id: 7, rol: 'cajero', restaurante_id: 1, sucursal_id: 1 };

describe('Catálogo (RF-09 a RF-11, RN-17) sin base de datos', () => {
  it('crea un producto con valores por defecto y textos sin espacios sobrantes', async () => {
    const { productoService } = armar();
    const p = await productoService.crear(CAJERO, { codigo: ' P002 ', nombre: ' Té ', precio: 2, categoria_id: 1, sucursal_id: 99 });
    // La sucursal sale de la sesión, no de los datos enviados.
    expect(p).toMatchObject({ codigo: 'P002', nombre: 'Té', estado: 'disponible', cantidad_disponible: 0, imagen_codigo: null, sucursal_id: 1 });
  });

  it('rechaza precio 0, stock negativo, categoría inexistente y código repetido (CA-09)', async () => {
    const { productoService } = armar();
    const base = { codigo: 'P003', nombre: 'Agua', precio: 1, categoria_id: 1 };
    await expect(productoService.crear(CAJERO, { ...base, precio: 0 })).rejects.toThrow('mayor a 0');
    await expect(productoService.crear(CAJERO, { ...base, cantidad_disponible: -1 })).rejects.toThrow('negativa');
    await expect(productoService.crear(CAJERO, { ...base, categoria_id: 9 })).rejects.toThrow('categoría indicada no existe');
    // Categoría de otra sucursal: como si no existiera.
    await expect(productoService.crear(CAJERO, { ...base, categoria_id: 2 })).rejects.toThrow('categoría indicada no existe');
    await expect(productoService.crear({ id: 8, rol: 'cajero' }, base)).rejects.toMatchObject({ status: 403 });
    await expect(productoService.crear(CAJERO, { ...base, codigo: 'P001' })).rejects.toThrow('Ya existe un producto con ese código');
  });

  it('valida el código de imagen y permite quitarlo (CA-10)', async () => {
    expect(leerImagenCodigo(undefined)).toBeUndefined();
    expect(leerImagenCodigo('')).toBeNull();
    expect(leerImagenCodigo('bandeja_paisa')).toBe('bandeja_paisa');
    for (const malo of ['Bandeja', 'con espacio', 'a.webp', '../x']) {
      expect(() => leerImagenCodigo(malo)).toThrow('imagen_codigo');
    }
    const { productoService, productos } = armar();
    await productoService.actualizar(1, CAJERO, { imagen_codigo: 'cafe' });
    await productoService.actualizar(1, CAJERO, { precio: 2 });
    expect(productos.filas[0]).toMatchObject({ imagen_codigo: 'cafe', precio: 2 });
    await productoService.actualizar(1, CAJERO, { imagen_codigo: null });
    expect(productos.filas[0].imagen_codigo).toBeNull();
  });

  it('responde 404 si el producto no existe antes de validar los datos', async () => {
    const { productoService } = armar();
    await expect(productoService.actualizar(9, CAJERO, { precio: 0 })).rejects.toMatchObject({ status: 404 });
  });

  it('las categorías tienen nombre obligatorio y único', async () => {
    const { categoriaService } = armar();
    await expect(categoriaService.crear(CAJERO, { nombre: '  ' })).rejects.toThrow('obligatorio');
    await expect(categoriaService.crear(CAJERO, { nombre: 'Bebidas' })).rejects.toThrow('Ya existe una categoría con ese nombre');
    expect(await categoriaService.crear(CAJERO, { nombre: ' Postres ' })).toMatchObject({ nombre: 'Postres', sucursal_id: 1 });
    await expect(categoriaService.eliminar(9, CAJERO)).rejects.toMatchObject({ status: 404 });
  });

  it('el personal solo modifica lo de su sucursal; el admin de restaurante elige una de las suyas (RN-21, RN-24)', async () => {
    const { productoService, categoriaService, categorias } = armar();
    categorias.filas.push({ id: 3, nombre: 'Lejana', sucursal_id: 3 });
    // La categoría 2 es de la sucursal 2: para el cajero de la 1, no existe.
    await expect(categoriaService.actualizar(2, CAJERO, { nombre: 'X' })).rejects.toMatchObject({ status: 404 });
    await expect(categoriaService.eliminar(2, CAJERO)).rejects.toMatchObject({ status: 404 });

    const ADMIN_R1 = { id: 20, rol: 'admin', nivel: 'restaurante', restaurante_id: 1, sucursal_id: null };
    await expect(categoriaService.crear(ADMIN_R1, { nombre: 'Snacks' })).rejects.toThrow('sucursal_id es obligatorio');
    expect(await categoriaService.crear(ADMIN_R1, { nombre: 'Snacks', sucursal_id: 2 })).toMatchObject({ sucursal_id: 2 });
    // Sucursal de otro restaurante: no existe para él.
    await expect(categoriaService.crear(ADMIN_R1, { nombre: 'Snacks', sucursal_id: 3 })).rejects.toThrow('no existe');
    const p = await productoService.crear(ADMIN_R1, { codigo: 'P9', nombre: 'Jugo', precio: 2, categoria_id: 2, sucursal_id: 2 });
    expect(p.sucursal_id).toBe(2);
    await expect(productoService.actualizar(p.id, CAJERO, { precio: 3 })).rejects.toMatchObject({ status: 404 });
    expect(await productoService.actualizar(p.id, ADMIN_R1, { precio: 3 })).toMatchObject({ precio: 3 });
    // La categoría debe ser de la sucursal del producto.
    await expect(
      productoService.crear(ADMIN_R1, { codigo: 'P10', nombre: 'Agua', precio: 1, categoria_id: 1, sucursal_id: 2 })
    ).rejects.toThrow('categoría indicada no existe');
  });
});
