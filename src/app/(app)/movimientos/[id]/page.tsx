import { notFound } from "next/navigation";
import { deleteTxAction, updateTxAction } from "@/app/actions/transactions";
import { TxForm } from "@/components/app/tx-form";
import { Button } from "@/components/ui/button";
import { listAccounts, listCategories } from "@/server/services/catalog";
import { getTransaction } from "@/server/services/transactions";
import { requireUserId } from "@/server/session";

export default async function EditarMovimientoPage(props: PageProps<"/movimientos/[id]">) {
  const userId = await requireUserId();
  const { id } = await props.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const [tx, categories, accounts] = await Promise.all([getTransaction(userId, id), listCategories(userId), listAccounts(userId)]);
  if (!tx) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Editar movimiento</h1>
      {tx.rawDescription && <p className="text-xs text-muted-foreground">Original: {tx.rawDescription}</p>}
      <TxForm
        isEdit
        action={updateTxAction.bind(null, id)}
        categories={categories}
        accounts={accounts}
        defaults={{
          type: tx.type,
          amount: String(tx.amountCents / 100).replace(".", ","),
          currency: tx.currency,
          date: String(tx.date).slice(0, 10),
          accountId: tx.accountId ?? undefined,
          categoryId: tx.categoryId ?? undefined,
          merchant: tx.merchant,
          note: tx.note,
          fx: tx.fx ? String(tx.fx) : undefined,
        }}
      />
      <form action={deleteTxAction}>
        <input type="hidden" name="id" value={id} />
        <Button variant="destructive" type="submit" className="h-10 w-full">Borrar</Button>
      </form>
    </div>
  );
}
