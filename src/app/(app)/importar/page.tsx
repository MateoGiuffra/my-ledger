import Link from "next/link";
import { UploadForm } from "@/components/app/upload-form";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { listBatches } from "@/server/services/imports";
import { requireUserId } from "@/server/session";

export default async function ImportarPage() {
  const batches = await listBatches(await requireUserId());
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Importar</h1>
      <UploadForm />
      <section className="space-y-2">
        <h2 className="font-medium">Historial</h2>
        {batches.length === 0 && <p className="text-sm text-muted-foreground">Todavía no importaste nada.</p>}
        <ul className="space-y-2">
          {batches.map((b) => (
            <li key={b._id}>
              <Link href={`/importar/${b._id}`} className="block rounded-lg border p-3 text-sm">
                <div className="flex justify-between"><span className="truncate font-medium">{b.fileName}</span><span className={b.status === "rolled_back" ? "text-muted-foreground line-through" : ""}>{b.status === "rolled_back" ? "deshecho" : "confirmado"}</span></div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(new Date(b.createdAt))} · {b.inserted} importados · {b.skipped} omitidos
                  {b.summary && ` · saldo final ${formatMoney(b.summary.finalCents)}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
