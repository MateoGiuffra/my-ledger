"use client";

import { useTransition } from "react";
import { setRowCategoryAction } from "@/app/actions/imports";

export function RowCategorySelect({
  batchId,
  rowKey,
  value,
  categories,
}: {
  batchId: string;
  rowKey: string;
  value: string | null;
  categories: { _id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Categoría"
      disabled={pending}
      defaultValue={value ?? ""}
      onChange={(e) => start(() => setRowCategoryAction(batchId, rowKey, e.target.value))}
      className="h-7 max-w-32 rounded border bg-transparent px-1 text-xs"
    >
      <option value="">Sin categoría</option>
      {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
    </select>
  );
}
