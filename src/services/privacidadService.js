import { ErrorNegocio } from '../errors/ErrorNegocio.js';

const ESTADOS_FINALES = ['entregado', 'cancelado'];

const noEncontrado = () => new ErrorNegocio('Cliente no encontrado', 404);

/** Derechos del cliente sobre sus datos (LOPDP, RNF-21). */
export const crearPrivacidadService = ({ clientes, fotos, privacidad, afiliaciones, contrasenias, transacciones, ahora = () => new Date() }) => ({
  /** Todos sus datos en un formato descargable (acceso y portabilidad). */
  misDatos: async (clienteId) => {
    const cliente = await clientes.buscar(clienteId);
    if (!cliente) throw noEncontrado();

    const foto = await fotos.buscar(cliente.id);
    const dispositivos = await privacidad.dispositivosBiometricos(cliente.id);
    const carrito = await privacidad.carrito(cliente.id);
    const pedidos = await privacidad.pedidos(cliente.id);
    const restaurantes = await afiliaciones.delCliente(cliente.id);

    return {
      generado_en: ahora().toISOString(),
      cliente: {
        identificacion: cliente.identificacion,
        nombres: cliente.nombres,
        apellidos: cliente.apellidos,
        correo_electronico: cliente.correo_electronico,
        telefono: cliente.telefono,
        // Obsoleto: solo si quedó guardado de antes del 18-11-2026.
        ...(cliente.tipo_cliente ? { tipo_cliente: cliente.tipo_cliente } : {}),
        registrado_en: cliente.createdAt,
        actualizado_en: cliente.updatedAt
      },
      // Portabilidad: la foto va completa (base64) si la subió.
      foto_perfil: foto
        ? { tipo: foto.tipo, actualizada_en: foto.updatedAt, imagen_base64: Buffer.from(foto.datos).toString('base64') }
        : null,
      // Sin la credencial: solo qué dispositivos tienen el ingreso con huella.
      ingreso_biometrico: dispositivos.map((d) => ({
        dispositivo: d.dispositivo,
        activado_en: d.createdAt,
        ultimo_uso: d.ultimo_uso
      })),
      carrito: carrito.map((item) => ({
        producto: item.producto?.nombre ?? null,
        cantidad: item.cantidad,
        agregado_en: item.createdAt
      })),
      // Con qué restaurantes compartió sus datos (RF-43).
      restaurantes: restaurantes.map((a) => ({
        restaurante: a.restaurante?.nombre ?? null,
        estado: a.estado,
        origen: a.origen,
        version_legal: a.legal_version,
        afiliado_en: a.afiliado_en
      })),
      aceptacion_legal: cliente.legal_version
        ? { version: cliente.legal_version, aceptado_en: cliente.legal_aceptado_en }
        : null,
      pedidos: pedidos.map((p) => ({
        id: p.id,
        fecha: p.fecha,
        hora: p.hora,
        modalidad: p.modalidad,
        estado: p.estado,
        valor_total: p.valor_total,
        productos: p.detalles.map((d) => ({
          producto: d.producto?.nombre ?? null,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal
        })),
        pago: p.pago
      }))
    };
  },

  /**
   * Elimina la cuenta confirmando con la contraseña. Se reemplazan los datos
   * personales (la fila se conserva: los pedidos y pagos la referencian y
   * quedan anónimos por contabilidad). Cambiar la contraseña revoca además
   * el ingreso con huella (hook del modelo).
   */
  eliminarCuenta: async (clienteId, contrasenia) => {
    if (typeof contrasenia !== 'string' || !contrasenia) {
      throw new ErrorNegocio('Ingresa tu contraseña para confirmar');
    }
    await transacciones.ejecutar(async (t) => {
      const cliente = await clientes.bloquear(clienteId, t);
      if (!cliente || cliente.eliminado_en) throw noEncontrado();
      if (!(await contrasenias.comparar(contrasenia, cliente.contrasenia))) {
        throw new ErrorNegocio('La contraseña no es correcta');
      }
      if ((await privacidad.contarPedidosAbiertos(cliente.id, ESTADOS_FINALES, t)) > 0) {
        throw new ErrorNegocio(
          'Tienes pedidos en curso. Podrás eliminar tu cuenta cuando se entreguen o se cancelen.'
        );
      }

      await fotos.eliminar(cliente.id, t);
      await privacidad.vaciarCarrito(cliente.id, t);
      await afiliaciones.eliminarDelCliente(cliente.id, t);
      await clientes.actualizar(
        cliente,
        {
          identificacion: `ELIMINADO-${cliente.id}`,
          nombres: 'Cliente',
          apellidos: 'eliminado',
          correo_electronico: `eliminado-${cliente.id}@eliminado.invalid`,
          telefono: null,
          contrasenia: await contrasenias.inutilizable(),
          reset_password_token: null,
          reset_password_expires: null,
          reset_password_attempts: 0,
          legal_version: null,
          legal_aceptado_en: null,
          eliminado_en: ahora()
        },
        t
      );
    });
  }
});
