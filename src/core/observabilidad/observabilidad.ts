import * as Sentry from '@sentry/react-native';

import {env} from '@/core/config';

/** Valores planos: nada de cuerpos de peticiones, claves ni tokens. */
type Datos = Record<string, string | number | boolean | null | undefined>;

export type ContextoReporte = {
  /** Para filtrar en Sentry (p. ej. `flujo: 'login'`). */
  etiquetas?: Datos;
  /** Detalle para diagnosticar (p. ej. `request_id`, `id_operacion`). */
  extras?: Datos;
  /**
   * Agrupa los eventos iguales en un solo problema y evita repetirlos: el mismo
   * teléfono no manda la misma huella más de una vez cada `PAUSA_HUELLA_MS`.
   */
  huella?: string[];
  nivel?: 'error' | 'warning';
};

export type Rastro = {
  categoria: string;
  mensaje: string;
  datos?: Datos;
  nivel?: 'info' | 'warning' | 'error';
};

/** Una operación que falla en bucle (reintentos de la cola) no debe gastar la cuota. */
const PAUSA_HUELLA_MS = 10 * 60_000;
const ultimoEnvio = new Map<string, number>();

let activa = false;

/**
 * Enciende Sentry. Se llama una vez, antes de registrar la app. Sin
 * `SENTRY_DSN` (desarrollo, pruebas) queda apagado y todo lo demás no hace nada.
 */
export const iniciarObservabilidad = () => {
  if (!env.SENTRY_DSN || activa) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.ENTORNO,
    // Con Metro los errores ya se ven en pantalla; no ensucian producción.
    enabled: !__DEV__,
    // Sin IP ni datos del usuario: solo su id y su empresa (ver identificarUsuario).
    sendDefaultPii: false,
    // Solo errores. El rendimiento se activa después si hace falta (gasta cuota).
    tracesSampleRate: 0,
    maxBreadcrumbs: 100,
    beforeBreadcrumb: rastro => {
      // console.* puede traer datos del conductor; el resto del rastro basta.
      if (rastro.category === 'console') return null;
      return rastro;
    },
  });
  activa = true;
};

const limpiar = (datos: Datos | undefined) =>
  Object.fromEntries(
    Object.entries(datos ?? {}).filter(
      ([, valor]) => valor !== undefined && valor !== null,
    ),
  );

/** Reporta un error como evento. Los errores esperados (sin señal, clave incorrecta) no pasan por aquí. */
export const reportarError = (
  error: unknown,
  {etiquetas, extras, huella, nivel = 'error'}: ContextoReporte = {},
  ahora = Date.now(),
) => {
  if (huella) {
    const clave = huella.join('|');
    const anterior = ultimoEnvio.get(clave);
    if (anterior !== undefined && ahora - anterior < PAUSA_HUELLA_MS) return;
    ultimoEnvio.set(clave, ahora);
  }
  Sentry.withScope(alcance => {
    alcance.setLevel(nivel);
    alcance.setTags(limpiar(etiquetas));
    alcance.setExtras(limpiar(extras));
    if (huella) alcance.setFingerprint(huella);
    Sentry.captureException(
      error instanceof Error ? error : new Error(String(error)),
    );
  });
};

/** Deja una miga: no es un evento, viaja con el siguiente error para dar contexto. */
export const dejarRastro = ({
  categoria,
  mensaje,
  datos,
  nivel = 'info',
}: Rastro) => {
  Sentry.addBreadcrumb({
    category: categoria,
    message: mensaje,
    data: limpiar(datos),
    level: nivel,
  });
};

/** Solo el id y la empresa: ni correo ni nombre salen del teléfono. */
export const identificarUsuario = (
  usuario: {id: number; tenantId: number | null} | null,
) => {
  Sentry.setUser(usuario ? {id: String(usuario.id)} : null);
  Sentry.setTag(
    'tenant_id',
    usuario?.tenantId !== null && usuario?.tenantId !== undefined
      ? String(usuario.tenantId)
      : undefined,
  );
};

/** Envuelve el componente raíz: captura caídas de render y errores nativos. */
export const envolverApp: typeof Sentry.wrap = componente =>
  Sentry.wrap(componente);

/** Límite de errores de React: muestra `fallback` y reporta la caída. */
export const LimiteErrores = Sentry.ErrorBoundary;

/** Solo para pruebas: olvida las huellas ya enviadas. */
export const reiniciarHuellas = () => ultimoEnvio.clear();
