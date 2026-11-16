/**
 * Contrato de una pasarela de pago con tarjeta (principio abierto/cerrado:
 * otra pasarela se agrega implementándolo, sin tocar pagoTarjetaService).
 *
 * Una pasarela es un objeto con:
 *
 * - `nombre`: texto para la referencia del pago (p. ej. "Payphone").
 * - `configurada()`: boolean. Si es false, el pago con tarjeta se ofrece
 *   como no disponible.
 * - `preparar({referencia, centavos, descripcion})` → `{urlPago}`: crea el
 *   cobro y devuelve la página donde el cliente escribe su tarjeta.
 * - `confirmar({id, referencia})` → `{aprobada, referencia, centavos,
 *   transaccionId, autorizacion}`: consulta el resultado en la pasarela.
 *   El backend nunca confía en lo que diga el navegador.
 *
 * Los montos van en centavos (enteros). Errores de red o de la pasarela:
 * lanzar cualquier Error; el servicio responde 502.
 */
const METODOS = ['configurada', 'preparar', 'confirmar'];

/** Falla al arrancar si `pasarela` no cumple el contrato. */
export const comprobarPasarela = (pasarela) => {
  const faltan = METODOS.filter((m) => typeof pasarela?.[m] !== 'function');
  if (faltan.length || typeof pasarela?.nombre !== 'string') {
    throw new TypeError(`La pasarela no cumple el contrato PasarelaPago (falta: ${[...faltan, 'nombre'].join(', ')})`);
  }
  return pasarela;
};

/** Dólares → centavos sin errores de coma flotante (2.675 → 268). */
export const aCentavos = (valor) => Math.round(Number(valor) * 100);
