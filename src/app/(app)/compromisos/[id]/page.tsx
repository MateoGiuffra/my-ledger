import { notFound } from "next/navigation";
import { deleteCommitmentAction, updateCommitmentAction } from "@/app/actions/commitments";
import { CommitmentForm } from "@/components/app/commitment-form";
import { Button } from "@/components/ui/button";
import { isGoogleConnected } from "@/server/integrations/gcal";
import { listAccounts, listCategories } from "@/server/services/catalog";
import { getCommitment } from "@/server/services/commitments";
import { requireUserId } from "@/server/session";

export default async function EditarCompromisoPage(props: PageProps<"/compromisos/[id]">) {
  const userId = await requireUserId();
  const { id } = await props.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const [c, categories, accounts, g] = await Promise.all([getCommitment(userId, id), listCategories(userId), listAccounts(userId), isGoogleConnected(userId)]);
  if (!c) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Editar compromiso</h1>
      {c.gcalError && <p className="rounded-lg bg-yellow-500/10 p-2 text-sm">Google Calendar: {c.gcalError}</p>}
      <CommitmentForm
        action={updateCommitmentAction.bind(null, id)}
        categories={categories}
        accounts={accounts}
        googleConnected={g}
        defaults={{
          name: c.name,
          kind: c.kind ?? "expense",
          amount: String(c.amountCents / 100).replace(".", ","),
          currency: c.currency,
          frequency: c.frequency,
          dayOfMonth: c.dayOfMonth,
          startDate: String(c.startDate).slice(0, 10),
          endDate: c.endDate ? String(c.endDate).slice(0, 10) : undefined,
          categoryId: c.categoryId ?? undefined,
          accountId: c.accountId ?? undefined,
          reminders: c.reminders,
          gcalSync: c.gcalSync,
        }}
      />
      <form action={deleteCommitmentAction}>
        <input type="hidden" name="id" value={id} />
        <Button variant="destructive" type="submit" className="h-10 w-full">Eliminar{c.gcalEventId ? " (y borrar evento de Google)" : ""}</Button>
      </form>
    </div>
  );
}
