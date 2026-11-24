import { ErrorNegocio } from '../errors/ErrorNegocio.js';
import { RegistroDuplicado } from '../errors/RegistroDuplicado.js';
import { alcanceDe } from './alcance.js';
import { abiertaEn, validarHorario } from './horario.js';

/** Texto obligatorio recortado, con largo máximo. */
export const textoObligatorio = (valor, campo, max) => {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!limpio) throw new ErrorNegocio(`${campo} es obligatorio`);
  if (limpio.length > max) throw new ErrorNegocio(`${campo} admite como máximo ${max} caracteres`);
  return limpio;
};

/** Texto opcional: undefined = no cambia; null o '' = vaciar. */
export const textoOpcional = (valor, campo, max) => {
  if (valor === undefined) return undefined;
  if (valor === null || (typeof valor === 'string' && !valor.trim())) return null;
  return textoObligatorio(valor, campo, max);
};

const sinIndefinidos = (datos) => Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined));

const ESTADOS = ['activo', 'suspendido'];

const coordenada = (valor, campo, limite) => {
  if (valor === null) return null;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || Math.abs(valor) > limite) {
    throw new ErrorNegocio(`${campo} debe ser un número entre -${limite} y ${limite}`);
  }
  return valor;
};

/**
 * Latitud y longitud van juntas: ninguna (no cambian), las dos con número o
 * las dos en null (se borran). Una sola, o una null y otra no, es 400.
 */
export const coordenadasDe = ({ latitud, longitud }) => {
  if (latitud === undefined && longitud === undefined) return {};
  if (latitud === undefined || longitud === undefined || (latitud === null) !== (longitud === null)) {
    throw new ErrorNegocio('latitud y longitud se envían juntas: las dos con valor o las dos en null');
  }
  return { latitud: coordenada(latitud, 'latitud', 90), longitud: coordenada(longitud, 'longitud', 180) };
};

/**
 * Restaurantes (RF-35). Solo el superadmin los crea, suspende o reactiva
 * (RN-24); el administrador de un restaurante edita sus datos de contacto.
 */
export const crearRestauranteService = ({ restaurantes }) => {
  const nivel = (usuario) => alcanceDe(usuario).nivel;

  /** Plataforma: todos; el resto del personal, solo el suyo. */
  const filtroDe = (usuario) => (nivel(usuario) === 'plataforma' ? {} : { id: usuario.restaurante_id ?? null });

  const soloSuperadmin = (usuario) => {
    if (nivel(usuario) !== 'plataforma') {
      throw new ErrorNegocio('Solo el administrador de la plataforma puede hacer esto', 403);
    }
  };

  const datosDe = (entrada, { nuevo }) => {
    const { nombre, ruc, telefono, correo_electronico } = entrada;
    const datos = {
      nombre: nuevo || nombre !== undefined ? textoObligatorio(nombre, 'nombre', 150) : undefined,
      ruc: textoOpcional(ruc, 'ruc', 13),
      telefono: textoOpcional(telefono, 'telefono', 20),
      correo_electronico: textoOpcional(correo_electronico, 'correo_electronico', 150)?.toLowerCase()
    };
    if (datos.ruc && !/^\d{13}$/.test(datos.ruc)) throw new ErrorNegocio('El RUC debe tener 13 dígitos');
    if (datos.correo_electronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo_electronico)) {
      throw new ErrorNegocio('correo_electronico no es válido');
    }
    return sinIndefinidos(datos);
  };

  const unico = async (operacion) => {
    try {
      return await operacion();
    } catch (error) {
      if (error instanceof RegistroDuplicado) throw new ErrorNegocio('Ya existe un restaurante con ese RUC');
      throw error;
    }
  };

  return {
    listar: (usuario) => restaurantes.listar(filtroDe(usuario)),

    obtener: async (id, usuario) => {
      const restaurante = await restaurantes.buscar(id, filtroDe(usuario));
      if (!restaurante) throw new ErrorNegocio('Restaurante no encontrado', 404);
      return restaurante;
    },

    crear: async (usuario, entrada) => {
      soloSuperadmin(usuario);
      return unico(() => restaurantes.crear(datosDe(entrada, { nuevo: true })));
    },

    /** Datos: superadmin o su administrador. Estado: solo el superadmin. */
    actualizar: async (id, usuario, entrada) => {
      if (!['plataforma', 'restaurante'].includes(nivel(usuario))) {
        throw new ErrorNegocio('Solo el administrador del restaurante puede editarlo', 403);
      }
      const restaurante = await restaurantes.buscar(id, filtroDe(usuario));
      if (!restaurante) throw new ErrorNegocio('Restaurante no encontrado', 404);
      const datos = datosDe(entrada, { nuevo: false });
      if (entrada.estado !== undefined) {
        soloSuperadmin(usuario);
        if (!ESTADOS.includes(entrada.estado)) throw new ErrorNegocio('estado debe ser activo o suspendido');
        datos.estado = entrada.estado;
      }
      return unico(() => restaurantes.actualizar(restaurante, datos));
    }
  };
};

/**
 * Sucursales (RF-36, RF-37). Las crean el superadmin (en cualquier
 * restaurante) y el administrador de restaurante (en el suyo), con su
 * ubicación. El admin de una sucursal solo cambia su teléfono y horario.
 */
export const crearSucursalService = ({ sucursales, reloj }) => {
  const nivel = (usuario) => alcanceDe(usuario).nivel;

  /** Lo que ve el cliente, con si atiende ahora. */
  const publica = (fila) => {
    const datos = fila.toJSON ? fila.toJSON() : { ...fila };
    return { ...datos, abierta: abiertaEn(datos.horario, reloj()) };
  };

  const unico = async (operacion) => {
    try {
      return await operacion();
    } catch (error) {
      if (error instanceof RegistroDuplicado) {
        throw new ErrorNegocio('Ya existe una sucursal con ese nombre en el restaurante');
      }
      throw error;
    }
  };

  const datosDe = (entrada, { nuevo }) => {
    const { nombre, direccion, telefono, horario, activa, payphone_store_id } = entrada;
    if (activa !== undefined && typeof activa !== 'boolean') throw new ErrorNegocio('activa debe ser true o false');
    return sinIndefinidos({
      nombre: nuevo || nombre !== undefined ? textoObligatorio(nombre, 'nombre', 150) : undefined,
      direccion: nuevo || direccion !== undefined ? textoObligatorio(direccion, 'direccion', 255) : undefined,
      telefono: textoOpcional(telefono, 'telefono', 20),
      horario: horario === undefined ? undefined : validarHorario(horario),
      activa,
      payphone_store_id: textoOpcional(payphone_store_id, 'payphone_store_id', 100),
      ...coordenadasDe(entrada)
    });
  };

  return {
    listarPublicas: async () => (await sucursales.listarPublicas()).map(publica),

    obtenerPublica: async (id) => {
      const sucursal = await sucursales.buscarPublica(id);
      if (!sucursal) throw new ErrorNegocio('Sucursal no encontrada', 404);
      return publica(sucursal);
    },

    listar: (usuario) => sucursales.listar(alcanceDe(usuario)),

    crear: async (usuario, entrada) => {
      const alcance = alcanceDe(usuario);
      if (!['plataforma', 'restaurante'].includes(alcance.nivel)) {
        throw new ErrorNegocio('Solo el administrador del restaurante crea sucursales', 403);
      }
      const restauranteId = alcance.nivel === 'restaurante' ? alcance.restauranteId : entrada.restaurante_id;
      if (!restauranteId || !(await sucursales.restauranteExiste(restauranteId))) {
        throw new ErrorNegocio('restaurante_id es obligatorio: indica de qué restaurante');
      }
      return unico(() => sucursales.crear({ ...datosDe(entrada, { nuevo: true }), restaurante_id: restauranteId }));
    },

    actualizar: async (id, usuario, entrada) => {
      const sucursal = await sucursales.buscar(id, alcanceDe(usuario));
      if (!sucursal) throw new ErrorNegocio('Sucursal no encontrada', 404);
      const datos = datosDe(entrada, { nuevo: false });
      if (nivel(usuario) === 'sucursal') {
        const otros = Object.keys(datos).filter((campo) => !['telefono', 'horario'].includes(campo));
        if (otros.length) {
          throw new ErrorNegocio('El administrador de la sucursal solo cambia su teléfono y horario', 403);
        }
      }
      return unico(() => sucursales.actualizar(sucursal, datos));
    }
  };
};
