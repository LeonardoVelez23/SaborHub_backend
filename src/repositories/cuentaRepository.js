import { Op } from 'sequelize';

/**
 * Lo que el inicio de sesión, la recuperación de contraseña y la sesión
 * necesitan de las dos tablas de cuentas: primero Clientes, luego Empleados.
 * `m` son los modelos (se leen al usarse).
 */
export const crearCuentaRepository = (m) => {
  const porCorreoOIdentificacion = (texto) => ({
    where: {
      [Op.or]: [{ correo_electronico: texto.trim().toLowerCase() }, { identificacion: texto.trim() }]
    }
  });

  return {
    /** {cuenta, esCliente} o null. */
    paraIngresar: async (texto) => {
      const cliente = await m.Cliente.findOne(porCorreoOIdentificacion(texto));
      if (cliente) return { cuenta: cliente, esCliente: true };
      const empleado = await m.Empleado.findOne(porCorreoOIdentificacion(texto));
      return empleado ? { cuenta: empleado, esCliente: false } : null;
    },

    porCorreo: async (correo) =>
      (await m.Cliente.findOne({ where: { correo_electronico: correo } })) ??
      (await m.Empleado.findOne({ where: { correo_electronico: correo } })),

    /** Lo mínimo para validar una sesión. */
    clienteDeSesion: (id) => m.Cliente.findByPk(id, { attributes: ['id', 'eliminado_en'] }),
    empleadoDeSesion: (id) =>
      m.Empleado.findByPk(id, { attributes: ['id', 'cargo', 'restaurante_id', 'sucursal_id'] }),

    actualizar: (cuenta, datos) => cuenta.update(datos),

    sumarIntentoOtp: (cuenta) => cuenta.increment('reset_password_attempts')
  };
};
