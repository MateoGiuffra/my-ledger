# Funcionalidades (FT)

Prioridad: **P0** = MVP, **P1** = siguiente, **P2** = después.

## FT-AUTH Acceso
- FT-AUTH-1 (P0) Registro inicial de un usuario (se deshabilita luego: app personal) y login user/contraseña.
- FT-AUTH-2 (P0) Sesión persistente; logout; cambio de contraseña.
- FT-AUTH-3 (P1) Rate-limit de login.

## FT-MOV Gastos e ingresos
- FT-MOV-1 (P0) Alta rápida: monto, fecha (default hoy), categoría, cuenta, nota. Tipo: gasto / ingreso.
- FT-MOV-2 (P0) Editar, borrar (soft delete), listar con filtros (fecha, categoría, cuenta, texto) y paginación.
- FT-MOV-3 (P0) Cuentas: Mercado Pago, Efectivo, Tarjeta, Cocos-ARS, Cocos-USD, SUBE.
- FT-MOV-4 (P0) Ingreso recurrente "Sueldo" 1.8M (se genera cada mes, se confirma con un toque).
- FT-MOV-5 (P1) Gastos en USD con cotización al momento (campo `fx`).
- FT-MOV-6 (P1) Transferencias entre cuentas propias (no cuentan como gasto).

## FT-IMP Importación
- FT-IMP-1 (P0) Subir CSV de **Mercado Pago**; mapeo de columnas → movimientos.
- FT-IMP-2 (P2) ~~SUBE~~: **fuera de alcance** (el PDF no se parsea de forma confiable). El PDF queda solo como archivo de consulta. Transporte: carga manual o gasto mensual recurrente estimado (FT-COM).
- FT-IMP-2b (P0) Ignorar filas no-gasto del CSV de MP: `Rendimientos` (→ ingreso por rendimientos o ignorar, configurable), `Dinero reservado/retirado` (movimiento interno), `Devolución de pago` (se netea contra el pago original por `REFERENCE_ID`).
- FT-IMP-3 (P0) **Deduplicación**: hash por (fuente, id externo | fecha+monto+descripción). Reimportar no duplica.
- FT-IMP-4 (P0) Pantalla de revisión previa: ver filas nuevas / duplicadas / sin categoría antes de confirmar.
- FT-IMP-5 (P0) Historial de importaciones (archivo, fecha, filas, rollback del lote).
- FT-IMP-6 (P1) Parser extensible por "perfil" (agregar banco/tarjeta nuevo sin tocar el core).
- FT-IMP-7 (P2) Sync automático por API de MP (ver doc 04, requiere validar viabilidad).

## FT-CPA Contrapartes (personas / alias / CBU-CVU)
Una **contraparte** es a quién le pagás o de quién cobrás. Se vincula a categoría/comercio por defecto, para que el import lo tenga en cuenta.
- FT-CPA-1 (P0) Crear contraparte: nombre visible (ej. "Lucas · Peluquería"), **identificadores** (varios): nombre tal cual figura en MP ("Juan Pérez Gómez"), alias, CBU/CVU, CUIT.
- FT-CPA-2 (P0) Defaults de la contraparte: categoría, comercio/etiqueta, tipo (gasto, ingreso, deuda).
- FT-CPA-3 (P0) Al importar, cada fila se cruza con contrapartes (match exacto por identificador, luego normalizado sin tildes/mayúsculas/orden de palabras). Si matchea: aplica categoría y etiqueta. **Prioridad: contraparte > regla > sin categorizar.**
- FT-CPA-4 (P0) En la revisión del import, filas "Transferencia enviada/recibida X" sin contraparte se muestran agrupadas por nombre: asignás una vez y se aplica a todas las del lote y futuras.
- FT-CPA-5 (P0) Una contraparte puede tener **modo deuda**: sus transferencias generan movimiento sugerido en Deudas (ej. papá).
- FT-CPA-6 (P1) Excepción por monto (ej. Lucas 17.000 = peluquería, otro monto = otra cosa).
- FT-CPA-7 (P1) Fusionar contrapartes duplicadas; ver historial de gasto por contraparte.
- FT-CPA-8 (P1) Transferencias a vos mismo / a tus cuentas → tipo transferencia (no gasto).

## FT-CAT Categorización
- FT-CAT-1 (P0) Categorías por defecto (Comida, Transporte, Servicios, Salud, Ocio, Hogar, Tarjeta, Préstamos, Ahorro, Otros) editables.
- FT-CAT-2 (P0) **Reglas** (para comercios/tipos, p.ej. `Pago Spotify`, `Pago EBANX`, `Compra Mercado Libre`): "si descripción contiene X → categoría Y". Se aplican al importar.
- FT-CAT-3 (P0) Al recategorizar un movimiento, ofrecer "crear regla para movimientos similares".
- FT-CAT-4 (P1) Comercios normalizados (alias).

## FT-RPT "En qué se va la plata"
- FT-RPT-1 (P0) Resumen del mes: ingresos, gastos, ahorro, saldo libre vs. los 800k disponibles.
- FT-RPT-2 (P0) Gasto por categoría (dona + ranking) y por comercio top 10.
- FT-RPT-3 (P0) Evolución mensual (barras) y comparación con mes anterior.
- FT-RPT-4 (P1) Presupuesto por categoría y barra de consumo.
- FT-RPT-5 (P1) Gasto diario promedio y proyección a fin de mes.

## FT-DEU Deudas con trazabilidad (me deben)
Modelo: **persona** → **movimientos de deuda** inmutables con saldo corrido.
- FT-DEU-1 (P0) Alta de persona.
- FT-DEU-2 (P0) Registrar movimiento con **persona + motivo + monto + fecha**. Tipos:
  - `prestamo` (+): le presté / le pagué algo (efectivo, transferencia).
  - `gasto_a_cargo` (+): pagué algo suyo (ej. frazada, tarjeta).
  - `pago` (−): me devolvió.
  - `compensacion` (−): me quedé con plata suya (ej. "me agarré 40k para el médico").
  - `ajuste` (±): corrección con motivo obligatorio.
- FT-DEU-3 (P0) Línea de tiempo por persona con **saldo acumulado** tras cada movimiento y total adeudado.
- FT-DEU-4 (P0) Los movimientos no se editan: se corrigen con `ajuste` (trazabilidad). Se puede anular con motivo (queda visible tachado).
- FT-DEU-5 (P0) Vínculo opcional a un movimiento real (ej. el gasto de MP que originó el préstamo).
- FT-DEU-6 (P0) Dashboard: total que me deben, ranking por persona, antigüedad.
- FT-DEU-7 (P1) Recordatorio de deuda ("hace 30 días sin pagos") y texto listo para copiar/mandar por WhatsApp con el detalle.
- FT-DEU-8 (P1) Exportar extracto de la persona (texto/PDF).

Ejemplo real (papá, 5 semanas), debe reproducirse exactamente:

| # | Movimiento | Tipo | Monto | Saldo |
|---|---|---|---|---|
| 1 | Deuda inicial septiembre | prestamo | +285.000 | 285.000 |
| 2 | Me pasó | pago | −230.000 | 55.000 |
| 3 | Me dio 10k | pago | −10.000 | 45.000 |
| 4 | Pidió 50k hasta el sábado | prestamo | +50.000 | 95.000 |
| 5 | Frazada | gasto_a_cargo | +13.000 | 108.000 |
| 6 | Me agarré 40k efectivo, médico | compensacion | −40.000 | 68.000 |
| 7 | Pagué tarjeta: termotanque 35k + aire 60k | gasto_a_cargo | +95.000 | 163.000 |

(El movimiento 7 puede cargarse como 2 ítems: un movimiento con desglose.)

## FT-COM Compromisos y recurrentes
- FT-COM-1 (P0) Crear compromiso: nombre, monto, frecuencia (única/mensual/semanal), día, **fecha fin** (ej. "tarjeta 35k, mensual, hasta dic-2026").
- FT-COM-2 (P0) Cuotas restantes y total pendiente calculados ("quedan 3 × 35k = 105k").
- FT-COM-3 (P0) Marcar ocurrencia como **pagada** (genera el gasto) / saltada / postergada.
- FT-COM-4 (P0) Vista calendario/lista de próximos vencimientos 30 días.
- FT-COM-5 (P0) **Google Calendar**: crear evento recurrente (RRULE con UNTIL) con recordatorios; editar/borrar compromiso actualiza/borra el evento.
- FT-COM-6 (P1) Compromisos por defecto del plan: transferencia a Cocos (S&P, USD, pesos plus) el día de cobro.

## FT-AHO Plan de ahorro y objetivos
- FT-AHO-1 (P0) Configurar plan: ingreso, USD S&P, USD ahorro, % en USD vs pesos plus, dólar de planificación.
- FT-AHO-2 (P0) **Checklist mensual**: ¿compré los 100 USD S&P? ¿dejé 262,5 USD? ¿pesos plus? Con monto real y dólar real usado.
- FT-AHO-3 (P0) Objetivos (Auto, Casa): meta en USD, aporte acumulado, % y fecha estimada con el ritmo actual.
- FT-AHO-4 (P0) Alerta si el mes cierra sin completar el checklist.
- FT-AHO-5 (P1) Diferencia plan vs real (dólar 1600 vs 1547) y cuánto "libera" el dólar más bajo.
- FT-AHO-6 (P1) Foto de saldos de Cocos (carga manual de saldo) para cotejar.

## FT-FX Dólar
- FT-FX-1 (P0) Cotización de planificación editable + cotización actual manual.
- FT-FX-2 (P1) Cotización automática (API pública dólar blue/MEP/oficial) cacheada.

## FT-ALR Alertas
- FT-ALR-1 (P0) Notificación push web (PWA) vía FCM: vencimientos (3 días, 1 día, hoy), checklist de ahorro, día de cobro.
- FT-ALR-2 (P0) Centro de alertas in-app con leído/pendiente.
- FT-ALR-3 (P1) Alertas de gasto: categoría > 80% del presupuesto, gasto inusual.
- FT-ALR-4 (P1) Recordatorio de cobrar deudas.
- FT-ALR-5 (P0) Preferencias: qué alertas y a qué hora.

## FT-CFG Configuración
- Cuentas, categorías, reglas, plan de ahorro, conexión Google, notificaciones, exportar todo a JSON/CSV (backup).

## Requisitos no funcionales
- Responsive mobile-first, instalable (PWA), carga < 2s en 4G.
- Montos en **centavos enteros** (nunca float). Moneda por movimiento (ARS/USD).
- Datos solo del usuario autenticado; secrets de integraciones cifrados.
- Auditoría: deudas inmutables; borrados lógicos.
