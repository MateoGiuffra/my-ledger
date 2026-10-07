# Pantallas y navegación

Mobile-first. Navegación inferior (5 tabs) + botón flotante **+** (alta rápida).

```
[Inicio] [Movimientos] [ + ] [Deudas] [Plan]      menú ☰ → Compromisos, Importar, Alertas, Config
```

## S01 Login
Usuario, contraseña, botón entrar. Error genérico. (FT-AUTH)

## S02 Inicio (dashboard)
- Tarjeta **Mes actual**: ingresos / gastos / ahorro / libre vs 800k (barra).
- **En qué se va**: dona por categoría + top 5.
- **Próximos vencimientos** (3 más cercanos) con botón "Pagado".
- **Me deben**: total + top 3 personas.
- **Plan del mes**: checklist 3 ítems (S&P, USD, pesos plus) con estado.
- Alertas pendientes (campana con contador).
(FT-RPT-1/2, FT-COM-4, FT-DEU-6, FT-AHO-2)

## S03 Movimientos
- Lista agrupada por día, filtros (mes, categoría, cuenta, texto), total del filtro.
- Item: comercio, categoría (chip), cuenta, monto. Tap → S04.
- Swipe: borrar / recategorizar.

## S04 Alta / edición de movimiento (modal inferior)
Teclado numérico grande → monto, toggle Gasto/Ingreso, categoría (chips recientes), cuenta, fecha, nota, moneda. "Guardar y otro". Si es recategorización: toggle "crear regla".

## S05 Importar
1. Elegir fuente (Mercado Pago) y subir CSV.
2. **Revisión**: tabla con nuevas / duplicadas / sin categoría; editar categoría inline.
3. Confirmar → resumen (n importados, n omitidos).
- Pestaña **Historial** con rollback por lote. (FT-IMP)

## S05b Contrapartes
Lista con buscador. Detalle: nombre visible, identificadores (chips: nombre MP, alias, CBU/CVU), categoría default, modo deuda, historial y total gastado. En la **revisión del import** (S05) las filas sin contraparte aparecen agrupadas por nombre con botón "Asignar" (elegir existente o crear con categoría).

## S06 Reportes ("En qué se va")
Selector de período. Dona categorías, barras por mes, ranking comercios, comparación vs mes anterior, gasto diario promedio y proyección. Tap en categoría → S03 filtrado.

## S07 Deudas (lista)
Total que me deben, tarjetas por persona (nombre, saldo, último movimiento, antigüedad). Botón "Nueva persona / movimiento".

## S08 Deuda · detalle de persona
- Cabecera: saldo actual grande.
- **Línea de tiempo** de movimientos: fecha, tipo (icono +/−), motivo, monto, **saldo acumulado**.
- Botones: "Le presté", "Pagó", "Compensé", "Gasto a su cargo".
- Acciones: copiar extracto, exportar, anular movimiento (con motivo).
(FT-DEU)

## S09 Movimiento de deuda (modal)
Persona, tipo, **motivo (obligatorio)**, monto, fecha, vínculo opcional a movimiento real, desglose opcional (ítems).

## S10 Compromisos
Lista por estado (activos / finalizados). Item: nombre, monto, frecuencia, "quedan N cuotas · total X", ícono Google Calendar sincronizado.
- **Alta/edición**: nombre, monto, frecuencia, día, fecha fin, categoría, recordatorios (3d/1d/hoy), toggle "Agregar a Google Calendar".
- **Vista calendario** mensual con puntos por vencimiento.

## S11 Plan de ahorro
- Parámetros del plan (editables) y dólar plan vs actual.
- **Checklist del mes** (registrar monto real + dólar usado por ítem).
- **Objetivos**: Auto (barra, meta USD, fecha estimada), Casa.
- Histórico mensual de cumplimiento.

## S12 Alertas
Lista cronológica, filtro pendientes/todas, tap lleva a la entidad.

## S13 Configuración
Cuentas · Categorías · Reglas de categorización · Plan · Dólar · Google (conectar/desconectar) · Notificaciones (permiso push, horario, tipos) · Perfil y contraseña · Exportar datos.

## Flujos clave
1. **Gasto en 3 toques**: + → monto → categoría → guardar.
2. **Cierre de semana**: Importar → subir CSV MP → revisar → confirmar.
3. **Préstamo**: Deudas → persona → "Le presté" → monto + motivo → saldo actualizado.
4. **Compromiso con calendario**: Compromisos → nuevo → fin dic → toggle Calendar → evento recurrente creado.
5. **Día de cobro**: alerta → checklist plan → marcar S&P / USD / pesos plus.
