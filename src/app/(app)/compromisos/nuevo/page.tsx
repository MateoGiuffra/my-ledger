import { createCommitmentAction } from "@/app/actions/commitments";
import { CommitmentForm } from "@/components/app/commitment-form";
import { todayAr } from "@/lib/dates";
import { isGoogleConnected } from "@/server/integrations/gcal";
import { listAccounts, listCategories } from "@/server/services/catalog";
import { requireUserId } from "@/server/session";

export default async function NuevoCompromisoPage() {
  const userId = await requireUserId();
  const [categories, accounts, g] = await Promise.all([listCategories(userId), listAccounts(userId), isGoogleConnected(userId)]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo compromiso</h1>
      <CommitmentForm
        action={createCommitmentAction}
        categories={categories}
        accounts={accounts}
        googleConnected={g}
        defaults={{ name: "", amount: "", currency: "ARS", frequency: "monthly", startDate: todayAr().toISOString().slice(0, 10), reminders: [3, 1, 0], gcalSync: g }}
      />
    </div>
  );
}
