import { notFound } from "next/navigation";
import { DebtEntryForm } from "@/components/app/debt-entry-form";
import { formatDate, todayAr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Transaction, type ITransaction } from "@/server/models/transaction";
import { getPerson, KIND_LABEL } from "@/server/services/debts";
import { requireUserId } from "@/server/session";

const kinds = ["loan", "paid_for", "payment", "offset", "adjustment"] as const;

export default async function NuevoMovDeudaPage(props: PageProps<"/deudas/[id]/nuevo">) {
  const userId = await requireUserId();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const person = /^[a-f0-9]{24}$/i.test(id) ? await getPerson(userId, id) : null;
  if (!person) notFound();
  const k = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind = kinds.find((x) => x === k) ?? "loan";
  const recent = await Transaction.find({ userId, deletedAt: null, type: "expense" }).sort({ date: -1 }).limit(30).lean<ITransaction[]>();
  const recentTx = recent.map((t) => ({ _id: String(t._id), label: `${formatDate(t.date)} · ${t.merchant || t.rawDescription || "Gasto"} · ${formatMoney(t.amountCents, t.currency)}` }));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{KIND_LABEL[kind]} · {person.name}</h1>
      <DebtEntryForm personId={id} kind={kind} today={todayAr().toISOString().slice(0, 10)} recentTx={recentTx} />
    </div>
  );
}
