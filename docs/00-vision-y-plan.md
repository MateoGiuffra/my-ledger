# My Ledger: visión y plan financiero

## Qué es
App personal (1 usuario, login user/pass) para saber **en qué se va la plata**, controlar **deudas que me deben** con trazabilidad, y cumplir el **plan de ahorro**. Avisa por push y Google Calendar.

## Plan de vida (parámetros base)
| Concepto | Valor |
|---|---|
| Ingreso mensual | ARS 1.800.000 |
| Inversión S&P500 | USD 100/mes |
| Ahorro normal | USD 525/mes (50% USD, 50% "pesos plus") |
| Total a ahorrar | USD 625/mes |
| Dólar de planificación | 1600 (hoy 1547) |
| Objetivo 1 | Ahorrar 12 meses → comprar auto |
| Objetivo 2 | Misma intensidad → comprar casa |

Cuentas rápidas (a 1600): 625 USD = ARS 1.000.000 → quedan **ARS 800.000/mes** para gastar.
A 1547: 625 USD = ARS 966.875 → sobran ~33k. El dólar es parámetro editable, no hardcodeado.

Ahorro por tramo: 100 USD S&P + 262,5 USD en dólares + 262,5 USD en pesos plus (≈ ARS 420k a 1600).
Meta 12 meses: 6.300 USD en dólares + 3.150 USD-eq en pesos plus + 1.200 USD S&P (sin rendimientos).

## Principios operativos
- **Cocos**: todas las operaciones de ahorro/inversión. La app solo *registra y controla* que se hizo (no opera).
- **Mercado Pago**: gasto cotidiano. Fuente principal de gastos.
- **SUBE**: transporte, carga manual/estimada (sin import).
- Carga lo más automática posible (CSV/API), manual en 3 toques.

## Alcance v1 (MVP funcional)
1. Auth user/pass
2. Gastos e ingresos (manual + import CSV MP)
3. Categorización (reglas automáticas) y "en qué se va la plata"
4. Deudas por persona con trazabilidad (libro de movimientos)
5. Compromisos recurrentes (ej. tarjeta 35k hasta dic) + alertas + Google Calendar
6. Plan de ahorro: checklist mensual, progreso hacia el auto
7. Dólar configurable (plan vs. real)

## Fuera de v1 (backlog)
Conexión directa API MP (ver `04-integraciones-y-stack.md`), multi-usuario, casa/hipotecario, rendimiento real de inversiones, presupuestos por categoría con alertas de desvío avanzadas.

## Glosario
- **Movimiento**: gasto, ingreso o transferencia propia.
- **Deuda**: relación con una persona; saldo = suma firmada de sus movimientos de deuda.
- **Compromiso**: pago futuro programado (único o recurrente).
- **Pesos plus**: fondo de pesos en Cocos (remunerado).
