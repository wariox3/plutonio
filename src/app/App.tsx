import {envolverApp, iniciarObservabilidad} from '@/core/observabilidad';
import {
  conectarSesionConApi,
  conectarSesionConObservabilidad,
  conectarSesionConRastreo,
} from '@/core/sesion';

import {Navegador} from './navegacion/Navegador';
import {AppProviders} from './providers/AppProviders';
import {LimiteApp} from './providers/LimiteApp';

// Lo primero: un error al arrancar también debe llegar a Sentry.
iniciarObservabilidad();
conectarSesionConObservabilidad();
// Antes de montar nada, para que ninguna petición salga sin token ni manejo de 401.
conectarSesionConApi();
// Retoma el rastreo si quedó corriendo con la app cerrada.
conectarSesionConRastreo();

function Raiz() {
  return (
    <AppProviders>
      <LimiteApp>
        <Navegador />
      </LimiteApp>
    </AppProviders>
  );
}

export const App = envolverApp(Raiz);
