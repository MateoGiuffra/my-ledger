# My Ledger

App personal de finanzas (1 usuario): en qué se va la plata, deudas con trazabilidad, compromisos con Google Calendar, plan de ahorro y alertas push. Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + MongoDB (Mongoose). PWA instalable.

La visión, funcionalidades, pantallas y modelo de datos están en [`docs/`](docs/) (00 a 04).

## Cómo correrlo

Requisitos: Node 22+, pnpm, un MongoDB (local en el puerto 27017 o Atlas).

```bash
pnpm install
cp .env.example .env.local   # completar (ver abajo)
pnpm dev                     # http://localhost:3000
```

1. Entrá a `/registro` y creá tu usuario (solo se permite mientras no exista ningún usuario y `ALLOW_REGISTER` no sea `false`). Al registrarte se cargan las cuentas, las categorías y reglas sugeridas por defecto.
2. Después poné `ALLOW_REGISTER=false` en producción.
3. Para el plan inicial: en **Compromisos** hay un botón "Cargar sueldo y transferencias del plan" (Sueldo 1.8M + S&P / dólares / pesos plus).

### Variables de entorno

| Variable | Para qué |
|---|---|
| `MONGODB_URI` | Conexión a Mongo (`mongodb://127.0.0.1:27017/my-ledger` o la de Atlas) |
| `AUTH_SECRET` | Secreto de Auth.js (`openssl rand -base64 32`) |
| `AUTH_URL` | URL pública de la app |
| `ALLOW_REGISTER` | `true` hasta crear tu usuario; después `false` |
| `ENCRYPTION_KEY` | 32 bytes en base64 (AES-GCM para los tokens de Google): `openssl rand -base64 32` |
| `CRON_SECRET` | Protege `/api/cron/alerts` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google Calendar (OAuth2) |
| `NEXT_PUBLIC_FIREBASE_*` (API_KEY, PROJECT_ID, MESSAGING_SENDER_ID, APP_ID, VAPID_KEY) | Push, lado cliente |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push, lado servidor (JSON de la service account en una línea) |

Sin las claves de Google / Firebase la app funciona igual: solo quedan desactivados Calendar y el push (las alertas siguen apareciendo dentro de la app).

## Tests

```bash
pnpm test        # vitest; levanta mongodb-memory-server
pnpm typecheck   # next typegen + tsc (app y service worker)
pnpm lint
```

- Los tests de servicios corren contra Mongo real. Si no podés bajar el binario de `mongodb-memory-server` (entornos sin acceso a `fastdl.mongodb.org`), apuntá a cualquier Mongo/FerretDB con `TEST_MONGODB_URI=mongodb://127.0.0.1:27017 pnpm test` (cada archivo usa una base efímera que se borra al terminar).
- Hay un test opcional que valida el parser contra los extractos reales de `docs/files/mp/*.csv` (gitignoreado); si no existen, se saltea. Todos los demás tests usan datos inventados.
- El caso del papá del doc 01 está como test (`src/server/services/debts.test.ts`): saldos corridos 285k → 55k → 45k → 95k → 108k → 68k → 163k.

## Build / PWA / cron

- `pnpm build` primero compila el service worker (`src/sw.ts` → `public/sw.js`, con Serwist + esbuild, porque Next 16 usa Turbopack y `@serwist/next` no corre ahí) y después `next build`. `public/sw.js` está en `.gitignore`.
- El service worker cachea solo estáticos y maneja el push. Las páginas nunca se cachean (son privadas).
- **Cron de alertas**: `GET|POST /api/cron/alerts` con `Authorization: Bearer $CRON_SECRET` (Vercel Cron lo manda solo si definís `CRON_SECRET`). `vercel.json` lo agenda 1 vez por día; para respetar la hora configurada hay un workflow de GitHub Actions horario (`.github/workflows/cron-alerts.yml`, necesita los secrets `APP_URL` y `CRON_SECRET`). Es idempotente: no duplica alertas ni pushes.
- Backup: `Configuración → Exportar datos (JSON)` (`/api/export`, sin hash de contraseña ni tokens).

## Qué hay

| Roadmap | Estado |
|---|---|
| Auth (user/pass, JWT, registro inicial, cambio de contraseña, rate-limit 5 fallos → 15 min), cuentas/categorías con seed, layout mobile con tabs y botón + | ✅ |
| Movimientos (alta rápida, edición, soft delete, filtros, paginación, crear regla al recategorizar) + reportes (mes, categorías, comercios, evolución, promedio diario/proyección) | ✅ |
| Deudas inmutables con saldo corrido, anulación con motivo, ajustes, vínculo a movimiento, extracto copiable | ✅ |
| Import CSV de Mercado Pago: contrapartes, reglas, dedupe por `REFERENCE_ID`, validación saldo inicial + Σ = final, pantalla de revisión, historial y rollback | ✅ |
| Compromisos (rrule), pagar/saltar/postergar, calendario, Google Calendar (RRULE con UNTIL, recordatorios) | ✅ |
| Plan de ahorro (checklist mensual, objetivos Auto/Casa, dólar plan vs actual) | ✅ |
| PWA + push FCM + alertas in-app + cron | ✅ |

### Decisiones por defecto (cuando el doc no definía algo)

- **Rendimientos** de MP: se ignoran por defecto; en la revisión del import hay un selector para importarlos como ingreso.
- **Dinero reservado/retirado**: se importa como transferencia interna (no cuenta como gasto ni ingreso).
- **Devolución de pago**: se importa como ingreso marcado `refund` que *resta* del gasto original en reportes (así reimportar no vuelve a netear). Comparte `REFERENCE_ID` con el pago, por eso su clave de dedupe incluye el sufijo `:refund:<monto>`.
- **Transferencias a personas**: la categoría sale de la contraparte (match exacto por identificador y luego normalizado: sin tildes/mayúsculas/orden de palabras). Prioridad: override manual de la fila > contraparte > regla > sin categoría. Contrapartes en modo *deuda* generan un movimiento en Deudas al confirmar (y se anulan con motivo si se deshace el lote).
- **Categoría extra** "Ingresos" además de las 10 del FT-CAT-1, para poder clasificar ingresos.
- **Reglas sugeridas** al registrarse (Spotify, EBANX, Steam, Mercado Libre, Tuenti, Movistar, ARCA, SUBE, PedidosYa, Rappi). Son editables en Config → Reglas.
- **Compromisos mensuales**: el día va de 1 a 28 (evita meses sin día 29-31). Solo se generan vencimientos desde 3 días atrás hasta 60 días adelante (ventana móvil).
- **Eventos de Google**: con hora (09:00 por defecto, la hora de aviso configurada), zona `America/Argentina/Buenos_Aires`, recordatorios popup a 3 días / 1 día / el día.
- **Ahorro**: el doc dice "6.300 USD en dólares + 3.150 USD-eq en pesos plus + 1.200 S&P" para 12 meses, pero 525 × 12 = 6.300 ya es el total de ahorro normal (3.150 + 3.150). Se tomó la meta del Auto como 12 × 625 = **USD 7.500** (editable). La meta de **Casa** no está definida en el doc: quedó un placeholder de USD 30.000 (editable). El ahorro acumulado llena Auto primero y después Casa.
- **Presupuesto libre** = ingreso − (USD S&P + USD ahorro) × dólar plan = 800.000 con los valores por defecto (1.8M − 625 × 1600).
- Montos siempre en centavos enteros; fechas "calendario" a mediodía UTC para evitar corrimientos de zona horaria.
- En lugar de swipe en la lista de movimientos, se borra/recategoriza desde el detalle del movimiento.

### No implementado (P1/P2 del doc y spikes)

- Presupuesto por categoría con barra de consumo (FT-RPT-4) y alertas de gasto inusual (FT-ALR-3).
- Foto de saldos de Cocos (FT-AHO-6) y comercios normalizados con alias (FT-CAT-4).
- Exportar extracto de deuda a PDF (FT-DEU-8; hay texto copiable).
- Sync por API de Mercado Pago y spike de viabilidad (FT-IMP-7, roadmap 8).
- Import de SUBE: descartado por diseño; el PDF no se toca.
- Tests E2E con Playwright (se probó a mano el flujo completo contra la app corriendo, pero no hay suite E2E en el repo).

## Qué tenés que cargar vos a mano

1. **Google Calendar**: crear un proyecto en Google Cloud, habilitar *Google Calendar API*, crear credenciales OAuth (aplicación web), agregar como redirect `https://TU_DOMINIO/api/google/callback` (y `http://localhost:3000/api/google/callback`) y completar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Después, en la app: Configuración → Google Calendar → Conectar.
2. **Firebase (push)**: crear un proyecto, agregar una app web y copiar la config a `NEXT_PUBLIC_FIREBASE_API_KEY / PROJECT_ID / MESSAGING_SENDER_ID / APP_ID`; en Cloud Messaging generar la clave **VAPID** (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`); crear una service account con permiso de *Firebase Cloud Messaging API* y pegar su JSON (en una sola línea) en `FIREBASE_SERVICE_ACCOUNT_JSON`. Después, en la app: Configuración → Notificaciones → Activar (en iPhone la PWA tiene que estar instalada en la pantalla de inicio).
3. **`MONGODB_URI`** si usás Atlas (con el IP allow-list de donde corra la app).
4. En producción: `AUTH_SECRET`, `AUTH_URL`, `ENCRYPTION_KEY`, `CRON_SECRET`, `ALLOW_REGISTER=false`, y los secrets `APP_URL` / `CRON_SECRET` en GitHub Actions si querés el cron horario.

## Datos personales

`docs/files/`, `*.csv`, `*.pdf` y `.env*` están en `.gitignore`. Los tests usan solo datos inventados.
