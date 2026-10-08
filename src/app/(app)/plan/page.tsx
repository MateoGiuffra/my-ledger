import { saveEntryAction, updateGoalAction, updatePlanAction } from "@/app/actions/savings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { monthKey, todayAr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { BUCKET_LABEL } from "@/server/services/savings-calc";
import { goalsWithProgress, history, monthChecklist, planOverview } from "@/server/services/savings";
import { requireUserId } from "@/server/session";

const dateFmt = new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric", timeZone: "UTC" });
const money = (c: number) => String(c / 100).replace(".", ",");

export default async function PlanPage() {
  const userId = await requireUserId();
  const month = monthKey(todayAr());
  const [ov, checklist, goals, hist] = await Promise.all([planOverview(userId), monthChecklist(userId, month), goalsWithProgress(userId), history(userId, 12)]);
  const { plan } = ov;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Plan de ahorro</h1>

      <Card className="gap-2">
        <div className="flex justify-between px-4 text-sm"><span>Dólar plan</span><b>{plan.fxPlan}</b></div>
        <div className="flex justify-between px-4 text-sm"><span>Dólar actual</span><b>{ov.fxActual ?? "—"}</b></div>
        <div className="flex justify-between px-4 text-sm"><span>Para gastar por mes</span><b>{formatMoney(ov.budgetCents)}</b></div>
        {ov.freedArs != null && (
          <p className="px-4 text-xs text-muted-foreground">
            Con el dólar actual, ahorrar {plan.usdSp500 + plan.usdSavings} USD cuesta {formatMoney(ov.actualArs!)} vs {formatMoney(ov.planArs)} del plan:{" "}
            {ov.freedArs >= 0 ? `liberás ${formatMoney(ov.freedArs)}` : `te faltan ${formatMoney(-ov.freedArs)}`}.
          </p>
        )}
      </Card>

      <section className="space-y-2">
        <h2 className="font-medium">Checklist de {month}</h2>
        {checklist.map((e) => (
          <form key={e.bucket} action={saveEntryAction} className={`space-y-2 rounded-lg border p-3 ${e.done ? "border-green-500/50 bg-green-500/5" : ""}`}>
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="bucket" value={e.bucket} />
            <div className="flex justify-between text-sm">
              <span className="font-medium">{e.done ? "✅" : "⬜"} {BUCKET_LABEL[e.bucket]}</span>
              <span className="text-muted-foreground">plan {e.bucket === "pesos_plus" ? formatMoney(e.plannedArsCents) : formatMoney(e.plannedUsdCents, "USD")}</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input name="amount" inputMode="decimal" placeholder={e.bucket === "pesos_plus" ? "Monto real (ARS)" : "Monto real (USD)"} defaultValue={e.actualAmountCents ? money(e.actualAmountCents) : ""} aria-label="Monto real" />
              <Input name="fxUsed" inputMode="decimal" placeholder="Dólar usado" defaultValue={e.fxUsed ?? ""} aria-label="Dólar usado" />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="done" defaultChecked={e.done} /> Hecho</label>
            </div>
            <Button size="sm" type="submit" className="w-full">Guardar</Button>
          </form>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Objetivos</h2>
        <p className="text-xs text-muted-foreground">Ahorrado total: {formatMoney(goals.totalUsdCents, "USD")} · ritmo {formatMoney(goals.paceUsdCents, "USD")}/mes</p>
        {goals.goals.map((g) => (
          <div key={g._id} className="space-y-1 rounded-lg border p-3">
            <div className="flex justify-between text-sm"><b>{g.name}</b><span>{g.pct}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${g.pct}%` }} /></div>
            <p className="text-xs text-muted-foreground">
              {formatMoney(g.savedUsdCents, "USD")} de {formatMoney(g.targetUsdCents, "USD")}
              {g.etaDate && ` · estimado ${dateFmt.format(new Date(g.etaDate))}`}
            </p>
            <form action={updateGoalAction} className="flex gap-2 pt-1">
              <input type="hidden" name="id" value={g._id} />
              <Input name="target" inputMode="decimal" placeholder="Meta (USD)" defaultValue={money(g.targetUsdCents)} aria-label="Meta en USD" />
              <Button size="sm" variant="outline" type="submit">Cambiar meta</Button>
            </form>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Parámetros del plan</h2>
        <form action={updatePlanAction} className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <label className="col-span-2 space-y-1">Ingreso mensual (ARS)<Input name="income" inputMode="decimal" defaultValue={money(plan.incomeCents)} /></label>
          <label className="space-y-1">USD S&amp;P 500<Input name="usdSp500" inputMode="decimal" defaultValue={plan.usdSp500} /></label>
          <label className="space-y-1">USD ahorro normal<Input name="usdSavings" inputMode="decimal" defaultValue={plan.usdSavings} /></label>
          <label className="space-y-1">% en dólares (resto: pesos plus)<Input name="pctUsd" inputMode="decimal" defaultValue={plan.pctUsd * 100} /></label>
          <label className="space-y-1">Dólar plan<Input name="fxPlan" inputMode="decimal" defaultValue={plan.fxPlan} /></label>
          <Button type="submit" className="col-span-2">Guardar plan</Button>
        </form>
      </section>

      <section className="space-y-1">
        <h2 className="font-medium">Histórico</h2>
        <ul className="grid grid-cols-3 gap-2 text-center text-xs">
          {hist.map((h) => (
            <li key={h.month} className={`rounded-lg border p-2 ${h.done === h.total ? "border-green-500/50" : ""}`}>{h.month}<br /><b>{h.done}/{h.total}</b></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
