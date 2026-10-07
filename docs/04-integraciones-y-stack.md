# Integraciones y stack

## Decisión: Next.js PWA (no app nativa)
Una sola base: Next.js (App Router, última) + TypeScript. **PWA instalable** en el celular + push web con FCM. Se evita build/publicación de app mobile. Si luego hace falta nativa: Capacitor sobre la misma web.

## Stack propuesto (no reinventar)
| Necesidad | Librería |
|---|---|
| Framework | Next.js (latest) + TS, Route Handlers como API |
| DB | MongoDB Atlas (free) + **Mongoose** |
| Auth user/pass | **Auth.js (NextAuth) Credentials** + `bcryptjs`/`argon2` |
| UI | **Tailwind + shadcn/ui** (Radix) |
| Gráficos | **Recharts** (vía shadcn charts) |
| Formularios/validación | **react-hook-form + zod** (mismos schemas en API) |
| Datos cliente | **TanStack Query** |
| Tablas | **TanStack Table** |
| CSV | **PapaParse** (delimiter `;`, parser de números es-AR propio) |
| Fechas | **date-fns** (+ tz America/Argentina/Buenos_Aires) |
| Dinero | enteros en centavos + `Intl.NumberFormat` (opcional `dinero.js`) |
| Recurrencia | **rrule** (RRULE para eventos y ocurrencias) |
| Google Calendar | **googleapis** (OAuth2, scope `calendar.events`) |
| Push | **Firebase Cloud Messaging** (free) + service worker; PWA con **serwist** |
| Jobs/alertas | **Vercel Cron** (free) o GitHub Actions cron → endpoint protegido |
| Tests | Vitest + Playwright |
| Deploy | Vercel (free) + Atlas (free) |

## Integración Google Calendar
1. OAuth2 consentimiento una vez (offline access → refresh token cifrado en User).
2. Al crear compromiso con toggle: `events.insert` con `recurrence: ["RRULE:FREQ=MONTHLY;BYMONTHDAY=10;UNTIL=20261231T000000Z"]` y `reminders.overrides` (3d, 1d).
3. Guardar `gcalEventId`. Editar/borrar compromiso → `events.patch/delete`.
4. Marcar "pagada" en la app no toca el calendario (el evento es solo aviso).

## Integración Mercado Pago (CSV analizado: 6 archivos, abr–sep 2026, ~500 filas)
Formato real `account_statement-*.csv`:
- Separador `;`, decimales con coma y miles con punto (`-1.415.972,44`), fecha `DD-MM-YYYY`.
- Línea 1-2: resumen (`INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE`). Línea 4 en adelante: `RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE`.
- **No hay columnas de comercio ni categoría**: todo viene dentro de `TRANSACTION_TYPE` como texto libre: `Transferencia enviada <Nombre>`, `Transferencia recibida <Nombre>`, `Pago <Comercio>`, `Compra Mercado Libre`, `Rendimientos`, `Devolución de pago <Comercio>`, `Dinero reservado/retirado Gastos`, `Pedido <Comercio>`, `Pago de suscripción Meli+`.
- `REFERENCE_ID` = id de operación → `externalId` para dedupe. `Devolución de pago` comparte el id del pago original.
- **Por eso FT-CPA es clave**: ~160 de ~500 filas son transferencias a personas (Juan Pérez, etc.). Sin vincular nombre → categoría no se pueden clasificar.
- Los archivos se solapan por mes; `PARTIAL_BALANCE` permite **validar el import** (saldo inicial + Σ filas = saldo final).
- Parser: dividir `TRANSACTION_TYPE` con prefijos conocidos (`Transferencia enviada `, `Pago `, `Compra `...) → `kind` + `counterpartyName`.
- **API (v2)**: a validar antes (la API pública de MP está orientada a vendedores). Spike: `GET /v1/payments/search` con tu access token. Si no cubre gastos como pagador, queda el CSV.

## SUBE
**Descartada del import.** El PDF exportado es inconsistente al extraer texto (filas sin monto/tipo). Se conserva el PDF original sin modificar en `docs/files/sube/` solo para consulta manual. Transporte se registra a mano o como compromiso recurrente estimado.

## Cocos
Sin integración: solo registro manual del checklist y saldos. La app **no opera**.

## Dólar
API pública (ej. dolarapi.com) para blue/MEP/oficial, cacheada 1h. Plan fijo en 1600 editable.

## Seguridad
Hash de password, cookies httpOnly, tokens de Google/FCM cifrados (AES-GCM con clave en env), endpoints cron con secreto, validación zod en toda entrada, rate-limit en login.

## Estructura de repo sugerida
```
src/app/(auth)/login
src/app/(app)/{inicio,movimientos,deudas,plan,compromisos,importar,alertas,config}
src/app/api/*            # Route Handlers
src/server/{models,services,importers,integrations}
src/lib/{money,dates,validators}
docs/
```

## Roadmap sugerido
1. Setup + auth + cuentas/categorías
2. Movimientos + reportes
3. Deudas con trazabilidad (caso papá como test)
4. Import CSV MP + reglas
5. Compromisos + Google Calendar
6. Plan de ahorro + objetivos
7. PWA + push + cron de alertas
8. Spike API MP
