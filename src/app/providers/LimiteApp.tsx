import type {ReactNode} from 'react';

import {LimiteErrores} from '@/core/observabilidad';
import {EstadoVacio, Pantalla, TriangleAlert} from '@/ui';

const alCaer = ({resetError}: {resetError: () => void}) => (
  <Pantalla>
    <EstadoVacio
      accion={{titulo: 'Reintentar', alPresionar: resetError}}
      icono={TriangleAlert}
      mensaje="Tus entregas guardadas siguen en el teléfono. Reintenta; si sigue fallando, cierra la app y ábrela de nuevo."
      titulo="Algo salió mal"
      tono="peligro"
    />
  </Pantalla>
);

/**
 * Si una pantalla se cae al dibujarse, el conductor ve cómo seguir en vez de
 * una pantalla en blanco, y la caída llega a Sentry. Lo guardado en el
 * teléfono no se toca.
 */
export function LimiteApp({children}: {children: ReactNode}) {
  return <LimiteErrores fallback={alCaer}>{children}</LimiteErrores>;
}
