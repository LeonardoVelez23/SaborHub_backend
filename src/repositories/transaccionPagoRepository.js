/** Intentos de pago con tarjeta (tabla TransaccionesPayphone). */
export const crearTransaccionPagoRepository = (m) => ({
  crear: (datos) => m.TransaccionPayphone.create(datos),

  porReferencia: (clientTxId) => m.TransaccionPayphone.findOne({ where: { client_tx_id: clientTxId } }),

  bloquear: (id, t) => m.TransaccionPayphone.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t }),

  actualizar: (transaccion, datos, t) =>
    t ? transaccion.update(datos, { transaction: t }) : transaccion.update(datos),

  eliminar: (transaccion) => transaccion.destroy()
});
