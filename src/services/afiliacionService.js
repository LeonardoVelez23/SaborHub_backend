import { ErrorNegocio } from '../errors/ErrorNegocio.js';

/**
 * Clientes por restaurante (DERCAS 12, RF-43 a RF-45, RN-26 a RN-28).
 *
 * La cuenta, los términos y la política de privacidad son de la plataforma
 * SaborHub y se aceptan una sola vez, al registrarse (modelo tipo Uber). La
 * afiliación solo registra que el cliente le pidió a un restaurante: se crea
 * sola con su primer pedido y marca qué clientes ve ese restaurante (RN-26).
 * Estados: `activo`, `bloqueado` (lo bloqueó ese restaurante, que no recibe
 * sus pedidos) y `retirado` (el cliente pidió que el restaurante deje de
 * verlo; vuelve a `activo` con su próximo pedido). El restaurante del
 * personal sale de la sesión, nunca de la petición.
 */

const SIN_RESTAURANTE = 'Tu usuario no pertenece a un restaurante';

const idValido = (valor, campo) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio(`${campo} inválido`);
  return id;
};

/** Restaurante del personal; el superadmin (sin restaurante) no tiene uno propio. */
export const restauranteDelPersonal = (usuario) => usuario?.restaurante_id ?? null;

const esSuperadmin = (usuario) => usuario?.nivel === 'plataforma';

export const crearAfiliacionService = ({ afiliaciones, restaurantes, versionLegal, ahora = () => new Date() }) => {
  const nuevaAfiliacion = async (clienteId, restauranteId, origen, t, existente) => {
    const datos = {
      estado: 'activo',
      origen,
      legal_version: versionLegal,
      afiliado_en: ahora(),
      bloqueado_en: null,
      bloqueado_por: null,
      motivo_bloqueo: null
    };
    if (existente) return afiliaciones.actualizar(existente, datos, t);
    return afiliaciones.crear({ cliente_id: clienteId, restaurante_id: restauranteId, ...datos }, t);
  };

  return {
    /**
     * Afiliación explícita (RF-43). Ya no hace falta para pedir: el primer
     * pedido la crea sola. Se mantiene por compatibilidad con versiones
     * anteriores de la app. Reactiva una retirada; una bloqueada sigue
     * bloqueada.
     */
    afiliar: async (clienteId, { restaurante_id, acepta_compartir, version_legal } = {}) => {
      const restauranteId = idValido(restaurante_id, 'restaurante_id');
      if (acepta_compartir !== true) {
        throw new ErrorNegocio('Debes aceptar compartir tus datos con el restaurante');
      }
      if (version_legal !== versionLegal) {
        throw new ErrorNegocio('Los términos y condiciones se actualizaron. Revísalos y acéptalos de nuevo.');
      }
      const restaurante = await restaurantes.buscar(restauranteId, {});
      if (!restaurante) throw new ErrorNegocio('Restaurante no encontrado', 404);

      const existente = await afiliaciones.buscar(clienteId, restauranteId);
      if (existente?.estado === 'bloqueado') {
        throw new ErrorNegocio('Tu cuenta está bloqueada en este restaurante', 403);
      }
      if (existente?.estado === 'activo') return existente;
      return nuevaAfiliacion(clienteId, restauranteId, 'app', undefined, existente);
    },

    /** Mis restaurantes (RF-45). */
    mias: (clienteId) => afiliaciones.delCliente(clienteId),

    /**
     * El cliente pide que el restaurante deje de verlo (RF-45); sus pedidos
     * se conservan y un pedido nuevo vuelve a afiliarlo.
     */
    retirar: async (clienteId, restauranteIdTexto) => {
      const restauranteId = idValido(restauranteIdTexto, 'restaurante_id');
      const fila = await afiliaciones.buscar(clienteId, restauranteId);
      if (!fila || fila.estado === 'retirado') throw new ErrorNegocio('No estás afiliado a este restaurante', 404);
      if (fila.estado === 'bloqueado') {
        // El bloqueo lo conserva el restaurante; retirar no debe servir para saltarlo.
        throw new ErrorNegocio('Tu cuenta está bloqueada en este restaurante; comunícate con él', 409);
      }
      await afiliaciones.actualizar(fila, { estado: 'retirado' });
    },

    /**
     * Al crear un pedido (RN-27): si el cliente no está afiliado o se
     * retiró, la afiliación se crea o se reactiva en la misma transacción
     * (`origen` 'pedido'; 'presencial' si el personal registró el
     * consentimiento en persona). Bloqueado en ese restaurante: 403.
     */
    asegurarParaPedido: async ({ clienteId, restaurante, deCliente, consentimientoPresencial, t }) => {
      const fila = await afiliaciones.buscar(clienteId, restaurante.id, t);
      if (fila?.estado === 'activo') return fila;
      if (fila?.estado === 'bloqueado') {
        throw new ErrorNegocio(
          deCliente ? 'Tu cuenta está bloqueada en este restaurante' : 'El cliente está bloqueado en este restaurante',
          403
        );
      }
      const origen = !deCliente && consentimientoPresencial === true ? 'presencial' : 'pedido';
      return nuevaAfiliacion(clienteId, restaurante.id, origen, t, fila);
    },

    /** Afiliación presencial al registrar un cliente desde el panel. */
    afiliarPresencial: async (clienteId, usuario) => {
      const restauranteId = restauranteDelPersonal(usuario);
      if (!restauranteId) return null;
      const existente = await afiliaciones.buscar(clienteId, restauranteId);
      if (existente && existente.estado !== 'retirado') return existente;
      return nuevaAfiliacion(clienteId, restauranteId, 'presencial', undefined, existente);
    },

    /** Clientes del restaurante del personal; el superadmin, todos (RN-26). */
    clientesDelPersonal: (usuario) => {
      if (esSuperadmin(usuario)) return afiliaciones.clientes(null);
      const restauranteId = restauranteDelPersonal(usuario);
      if (!restauranteId) throw new ErrorNegocio(SIN_RESTAURANTE, 403);
      return afiliaciones.clientes(restauranteId);
    },

    /** ¿Puede el personal ver a este cliente? (afiliación activa o bloqueada en su restaurante). */
    visibleParaPersonal: async (usuario, clienteId) => {
      if (esSuperadmin(usuario)) return true;
      const restauranteId = restauranteDelPersonal(usuario);
      if (!restauranteId) return false;
      const fila = await afiliaciones.buscar(clienteId, restauranteId);
      return Boolean(fila) && fila.estado !== 'retirado';
    },

    /**
     * Búsqueda exacta para un pedido asistido (RF-44, RN-26): de un cliente
     * no afiliado solo se devuelven id, nombres y apellidos.
     */
    buscar: async (usuario, texto) => {
      const valor = typeof texto === 'string' ? texto.trim() : '';
      if (!valor) throw new ErrorNegocio('Indica la identificación o el correo exactos (q)');
      const cliente = await afiliaciones.porIdentificacionOCorreo(valor);
      if (!cliente) throw new ErrorNegocio('Cliente no encontrado', 404);
      const restauranteId = restauranteDelPersonal(usuario);
      const fila = restauranteId ? await afiliaciones.buscar(cliente.id, restauranteId) : null;
      return {
        id: cliente.id,
        nombres: cliente.nombres,
        apellidos: cliente.apellidos,
        afiliacion: fila ? fila.estado : null
      };
    },

    /**
     * Bloquea o desbloquea a un cliente en el restaurante del admin (RF-44,
     * RN-28); la cuenta no cambia. El superadmin indica `restaurante_id`.
     */
    cambiarBloqueo: async (usuario, clienteIdTexto, { bloqueado, motivo, restaurante_id } = {}) => {
      const clienteId = idValido(clienteIdTexto, 'id');
      if (typeof bloqueado !== 'boolean') throw new ErrorNegocio('bloqueado debe ser true o false');
      const restauranteId = esSuperadmin(usuario)
        ? idValido(restaurante_id, 'restaurante_id')
        : restauranteDelPersonal(usuario);
      if (!restauranteId) throw new ErrorNegocio(SIN_RESTAURANTE, 403);

      const fila = await afiliaciones.buscar(clienteId, restauranteId);
      if (!fila || fila.estado === 'retirado') throw new ErrorNegocio('Cliente no encontrado', 404);

      if (bloqueado) {
        const texto = typeof motivo === 'string' ? motivo.trim() : '';
        if (!texto) throw new ErrorNegocio('Indica el motivo del bloqueo');
        if (texto.length > 255) throw new ErrorNegocio('El motivo admite hasta 255 caracteres');
        return afiliaciones.actualizar(fila, {
          estado: 'bloqueado',
          bloqueado_en: ahora(),
          bloqueado_por: usuario.id,
          motivo_bloqueo: texto
        });
      }
      return afiliaciones.actualizar(fila, {
        estado: 'activo',
        bloqueado_en: null,
        bloqueado_por: null,
        motivo_bloqueo: null
      });
    }
  };
};
