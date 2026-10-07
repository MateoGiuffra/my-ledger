# Modelo de datos (MongoDB / Mongoose)

Reglas: montos en **centavos enteros** (`amountCents`), `currency` ARS|USD, todo con `userId`, `createdAt/updatedAt`, soft delete (`deletedAt`).

## User
`username` (unique), `passwordHash`, `settings{ fxPlan, locale, tz }`, `googleTokens{enc}`, `pushTokens[]`

## Account
`name`, `type` (mp|cash|card|cocos|sube), `currency`

## Category
`name`, `icon`, `color`, `parentId?`

## Rule
`match` (contains|regex), `pattern`, `categoryId`, `priority`

## Counterparty
`displayName`, `identifiers[] {kind: mp_name|alias|cbu|cvu|cuit, value, normalized}`, `defaultCategoryId`, `label`, `debtPersonId?`, `amountOverrides[]? {amountCents, categoryId, label}`
Índice: `{userId, identifiers.normalized}`. El match se hace al importar; se guarda `counterpartyId` en la Transaction.

## Transaction (movimiento)
`type` (expense|income|transfer), `amountCents`, `currency`, `fx?`, `date`, `accountId`, `categoryId?`, `merchant`, `note`,
`counterpartyId?`, `rawDescription`, `source` (manual|mp_csv|mp_api), `externalId?`, `dedupeHash` (**unique con userId**), `importBatchId?`

## ImportBatch
`source`, `fileName`, `rows`, `inserted`, `skipped`, `status`

## Person
`name`, `note`

## DebtEntry (inmutable)
`personId`, `kind` (loan|paid_for|payment|offset|adjustment), `amountCents` (**con signo**: + me deben más, − me deben menos), `reason` (**requerido**), `date`,
`transactionId?`, `voidedAt?`, `voidReason?`, `items[]? {label, amountCents}`
- Saldo = Σ `amountCents` de entradas no anuladas. Saldo corrido se calcula en consulta (aggregation con `$setWindowFields`) o se guarda `balanceAfterCents` al insertar.

## Commitment (compromiso)
`name`, `amountCents`, `currency`, `frequency` (once|weekly|monthly), `dayOfMonth`, `startDate`, `endDate`, `categoryId`, `reminders[]` (días antes), `gcalEventId?`, `active`

## CommitmentOccurrence
`commitmentId`, `dueDate`, `status` (pending|paid|skipped), `transactionId?`
(se generan en rolling window de 60 días + al editar)

## SavingsPlan
`incomeCents`, `usdSp500`, `usdSavings`, `pctUsd` (0.5), `fxPlan`

## SavingsEntry (checklist mensual)
`month` (YYYY-MM), `bucket` (sp500|usd|pesos_plus), `plannedUsdCents`, `actualAmountCents`, `currency`, `fxUsed`, `done`

## Goal
`name` (Auto/Casa), `targetUsdCents`, `startDate`, `order`

## Alert
`type`, `refType/refId`, `fireAt`, `sentAt?`, `readAt?`, `title`, `body`

## Índices clave
- Transaction: `{userId, date:-1}`, `{userId, dedupeHash}` unique, `{userId, categoryId, date}`
- DebtEntry: `{userId, personId, date}`
- CommitmentOccurrence: `{userId, dueDate, status}`
- Alert: `{userId, fireAt, sentAt}`
