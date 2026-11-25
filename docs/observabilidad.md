# Observabilidad (Sentry)

Proyecto `plutonio` de la organización `semantica-digital`. El SDK es `@sentry/react-native`, pero el código solo conoce `@/core/observabilidad`.

## Configuración

| Qué | Dónde | Se versiona |
|---|---|---|
| `SENTRY_DSN` (no es secreto) | `.env.prod` (y `.env` solo si se quiere probar) | No |
| Organización y proyecto | `android/sentry.properties`, `ios/sentry.properties` | Sí |
| `SENTRY_AUTH_TOKEN` (secreto, sube source maps) | `.env.sentry-build-plugin` en la raíz; plantilla en `.env.sentry-build-plugin.example` | No |

- Sin `SENTRY_DSN`, Sentry queda apagado. Con Metro (`__DEV__`) también: solo reportan los builds de release.
- Sin token, los builds de release compilan igual pero **no suben source maps** y los errores de JS llegan ilegibles. Gradle lo avisa con `[sentry] Sin token`.
- El token es de organización: Sentry → Settings → Developer Settings → Organization Tokens.
- Cada evento lleva la versión y el build (`com.semantica.cilog2@1.2.1+7`) y el entorno (`ENTORNO`).

## API del módulo

```ts
import {dejarRastro, reportarError} from '@/core/observabilidad';

reportarError(error, {
  etiquetas: {origen: 'cola', tipo: 'entrega'}, // para filtrar
  extras: {id_operacion, request_id},           // para diagnosticar
  huella: ['cola', idOperacion],                // agrupa y evita repetir
});
dejarRastro({categoria: 'cola', mensaje: 'entrega enviada', datos: {id_operacion}});
```

- **Evento** (`reportarError`): algo que alguien debe mirar. **Rastro** (`dejarRastro`): contexto que viaja con el siguiente evento; no gasta cuota.
- Con `huella`, el mismo teléfono no repite el evento en 10 minutos (una operación que falla en bucle no gasta la cuota).

## Qué se reporta

| Origen (`origen`) | Evento | Solo rastro |
|---|---|---|
| Caídas | Errores de JS sin capturar, caídas nativas, bloqueos de Android y caídas de render (`LimiteApp` muestra "Algo salió mal") | |
| `acceso` (login, registro, recuperar clave, reenviar verificación) | Sin respuesta o tiempo agotado **con el teléfono conectado**. Lleva el motivo nativo (`SSLHandshakeException`, `UnknownHostException`…), su clase (`causa`: certificado, dns, conexion, tiempo, protocolo, otra), el tipo de red, el `request_id` enviado y el correo enmascarado (`ru***@gmail.com`) | Clave incorrecta, cuenta sin verificar, sin red de verdad |
| `api` | Respuestas 5xx | Todo fallo de petición: ruta, estado, `request_id`, causa |
| `contrato` / `inesperado` | Una respuesta que no pasa zod, o un error que no viene de la API, en cualquier consulta o mutación | |
| `cola` | Operación `rechazada` o en `conflicto`; `ficheros_con_error > 0`; 409 de "ya aplicada" (la evidencia quedó en el teléfono). Con `id_operacion` y `request_id` | Cada envío y cada reintento. Los fallos de red **no** son evento |
| `base-local` | No se pudo abrir o migrar la base | |
| `llavero` | Falló leer o guardar el token | Sesión invalidada por el servidor |
| `rastreo` | Falló preparar o iniciar el plugin de ubicación | |
| Navegación | | Nombre de cada pantalla (sin parámetros) |

## Privacidad

- `sendDefaultPii: false`. El usuario es su `id`; la empresa va en la etiqueta `tenant_id`. Ni nombre ni correo.
- Nunca se envían claves, tokens ni cuerpos de peticiones. Las rutas van sin parámetros.
- Sin grabación de pantalla ni medición de rendimiento (`tracesSampleRate: 0`).
- El rastro de `console.*` se descarta.
- En Play (Seguridad de los datos) y App Store (privacidad) se declara "registros de fallos y diagnóstico".

## Buscar un caso

- Un conductor no puede entrar: en Sentry, `origen:acceso flujo:login`; el problema se agrupa por `causa`. El `request_id` dice si la petición llegó a Fluor.
- Una entrega rechazada: `origen:cola` y el `id_operacion` que muestra la pantalla de Envíos.

## Pruebas

`jest.setup.js` reemplaza `@sentry/react-native` por un mock; `__alcance` deja ver etiquetas, extras y huella. Ver `__tests__/core/observabilidad.test.ts`.
