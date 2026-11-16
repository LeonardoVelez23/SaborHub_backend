import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openapi } from '../src/docs/openapi.js';
import { DOCUMENTOS_LEGALES } from '../src/legal/documentos.js';
import { api } from './helpers.js';

const leer = (archivo) => readFileSync(new URL(`../src/${archivo}`, import.meta.url), 'utf8');

/** `/pedidos/:id` → `/pedidos/{id}`; sin barra final. */
const normalizar = (ruta) => (ruta.replace(/:(\w+)/g, '{$1}').replace(/\/$/, '') || '/');

/** Rutas `get|post|put|delete` declaradas en un archivo de rutas. */
const rutasDe = (archivo, prefijo) =>
  [...leer(`routes/${archivo}`).matchAll(/router\.(get|post|put|delete)\(\s*'([^']*)'/g)].map(
    ([, metodo, ruta]) => `${metodo} ${normalizar(prefijo + ruta)}`
  );

/** Todas las rutas de la API según src/routes/index.js. */
const rutasDeLaApi = () => {
  const indice = leer('routes/index.js');
  const imports = Object.fromEntries(
    [...indice.matchAll(/import (\w+) from '\.\/(\w+(?:\.routes)?\.js)'/g)].map(([, nombre, archivo]) => [nombre, archivo])
  );
  const montajes = [...indice.matchAll(/router\.use\('([^']*)', (\w+)\)/g)];
  expect(montajes.length).toBeGreaterThan(10);

  return [
    ...montajes.flatMap(([, prefijo, nombre]) => rutasDe(imports[nombre], prefijo === '/' ? '' : prefijo)),
    ...rutasDe('index.js', '')
  ];
};

const PAGINAS = [
  ...Object.keys(DOCUMENTOS_LEGALES).map((tipo) => `get /legal/${tipo}`),
  'get /legal/eliminar-cuenta',
  ...rutasDe('paginasPago.js', '/pagos/payphone')
];

const METODOS = ['get', 'post', 'put', 'delete'];

const rutasDelContrato = (paginas) =>
  Object.entries(openapi.paths).flatMap(([ruta, item]) =>
    METODOS.filter((m) => item[m] && Boolean(item[m].servers) === paginas).map((m) => `${m} ${ruta}`)
  );

describe('Contrato OpenAPI (DERCAS 9.3)', () => {
  it('documenta exactamente las rutas de la API', () => {
    expect(rutasDelContrato(false).sort()).toEqual(rutasDeLaApi().sort());
  });

  it('documenta exactamente las páginas HTML públicas', () => {
    expect(rutasDelContrato(true).sort()).toEqual(PAGINAS.sort());
  });

  it('cada ruta protegida declara el token y cada operación tiene respuestas', () => {
    for (const [ruta, item] of Object.entries(openapi.paths)) {
      for (const metodo of METODOS.filter((m) => item[m])) {
        const op = item[metodo];
        expect(op.responses, `${metodo} ${ruta}`).toBeTruthy();
        if (op['x-roles']) expect(op.security, `${metodo} ${ruta}`).toEqual([{ bearer: [] }]);
      }
    }
  });

  it('todas las referencias apuntan a esquemas existentes', () => {
    const refs = JSON.stringify(openapi).match(/#\/components\/schemas\/\w+/g);
    for (const ref of new Set(refs)) {
      expect(openapi.components.schemas[ref.split('/').pop()], ref).toBeTruthy();
    }
  });

  it('se sirve en GET /api/v1/openapi.json', async () => {
    const res = await api().get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths)).toContain('/pedidos/mios');
  });
});
