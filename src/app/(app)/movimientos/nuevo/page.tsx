import { createTxAction } from "@/app/actions/transactions";
import { TxForm } from "@/components/app/tx-form";
import { todayAr } from "@/lib/dates";
import { listAccounts, listCategories } from "@/server/services/catalog";
import { requireUserId } from "@/server/session";

export default async function NuevoMovimientoPage(props: PageProps<"/movimientos/nuevo">) {
  const userId = await requireUserId();
  const sp = await props.searchParams;
  const [categories, accounts] = await Promise.all([listCategories(userId), listAccounts(userId)]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo movimiento</h1>
      {sp.ok && <p className="rounded-lg bg-green-500/10 p-2 text-sm text-green-700 dark:text-green-400">Guardado ✓</p>}
      <TxForm
        action={createTxAction}
        categories={categories}
        accounts={accounts}
        defaults={{ type: "expense", amount: "", currency: "ARS", date: todayAr().toISOString().slice(0, 10), merchant: "", note: "", accountId: accounts[0]?._id }}
      />
    </div>
  );
}
