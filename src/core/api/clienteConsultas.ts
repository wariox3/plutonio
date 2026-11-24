import {MutationCache, QueryCache, QueryClient} from '@tanstack/react-query';
import {ZodError} from 'zod';

import {reportarError} from '@/core/observabilidad';

import {traducirError} from './errores';

/**
 * Lo que ninguna pantalla espera: una respuesta de Fluor con otra forma
 * (contrato roto) o un error que no viene de la API (un fallo de la app). Los
 * de red y de negocio no se reportan aquí.
 */
const reportarInesperado = (error: unknown, clave: readonly unknown[]) => {
  const origen = typeof clave[0] === 'string' ? clave[0] : 'sin-clave';
  if (error instanceof ZodError) {
    const campos = error.issues.map(i => i.path.join('.')).join(', ');
    reportarError(error, {
      etiquetas: {origen: 'contrato', consulta: origen},
      extras: {campos},
      huella: ['contrato', origen, campos],
    });
    return;
  }
  if (traducirError(error).codigo !== 'DESCONOCIDO') return;
  reportarError(error, {
    etiquetas: {origen: 'inesperado', consulta: origen},
    huella: ['inesperado', origen, error instanceof Error ? error.message : ''],
  });
};

/** Un solo QueryClient para toda la app: la sesión lo limpia al cambiar de usuario o de empresa. */
export const clienteConsultas = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, consulta) => reportarInesperado(error, consulta.queryKey),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _contexto, mutacion) =>
      reportarInesperado(error, mutacion.options.mutationKey ?? []),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // No reintentar errores que el usuario debe corregir o que no cambian al repetir.
      retry: (intentos, error) => {
        const {estado} = traducirError(error);
        const esDeCliente = estado !== null && estado >= 400 && estado < 500;
        return !esDeCliente && intentos < 2;
      },
    },
  },
});
