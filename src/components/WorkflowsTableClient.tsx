"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { WorkflowSummary } from "@/lib/versionsStore";
import { formatDateTimeUtc } from "@/lib/dates";

type SortKey = "name" | "workflowId" | "versionsCount" | "lastUpdatedAt";
type SortDir = "asc" | "desc";

function sortLabel(dir: SortDir) {
  return dir === "asc" ? "▲" : "▼";
}

export function WorkflowsTableClient(props: { workflows: WorkflowSummary[] }) {
  const { workflows } = props;
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "versionsCount",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const copy = [...workflows];
    copy.sort((a, b) => {
      let result = 0;
      if (sort.key === "versionsCount") {
        result = a.versionsCount - b.versionsCount;
      } else if (sort.key === "lastUpdatedAt") {
        result = new Date(a.lastUpdatedAt).getTime() - new Date(b.lastUpdatedAt).getTime();
      } else if (sort.key === "workflowId") {
        result = a.workflowId.localeCompare(b.workflowId);
      } else {
        result = a.name.localeCompare(b.name);
      }
      return sort.dir === "asc" ? result : -result;
    });
    return copy;
  }, [sort, workflows]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-zinc-400">
          <tr>
            <th className="px-6 py-3">
              <button
                type="button"
                className="flex items-center gap-2"
                onClick={() => toggleSort("name")}
              >
                Name {sort.key === "name" ? sortLabel(sort.dir) : null}
              </button>
            </th>
            <th className="px-6 py-3">
              <button
                type="button"
                className="flex items-center gap-2"
                onClick={() => toggleSort("workflowId")}
              >
                Workflow ID {sort.key === "workflowId" ? sortLabel(sort.dir) : null}
              </button>
            </th>
            <th className="px-6 py-3">
              <button
                type="button"
                className="flex items-center gap-2"
                onClick={() => toggleSort("versionsCount")}
              >
                Versions {sort.key === "versionsCount" ? sortLabel(sort.dir) : null}
              </button>
            </th>
            <th className="px-6 py-3">
              <button
                type="button"
                className="flex items-center gap-2"
                onClick={() => toggleSort("lastUpdatedAt")}
              >
                Last updated {sort.key === "lastUpdatedAt" ? sortLabel(sort.dir) : null}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((w) => (
            <tr key={w.workflowId} className="border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-6 py-3 font-medium text-[#1a2545]">
                <Link
                  className="underline-offset-4 hover:underline"
                  href={`/workflows/${encodeURIComponent(w.workflowId)}/versions`}
                >
                  {w.name}
                </Link>
              </td>
              <td className="px-6 py-3 font-mono text-xs text-zinc-500">{w.workflowId}</td>
              <td className="px-6 py-3">{w.versionsCount}</td>
              <td className="px-6 py-3 text-zinc-500">{formatDateTimeUtc(w.lastUpdatedAt)}</td>
            </tr>
          ))}
          {sorted.length === 0 ? (
            <tr>
              <td className="px-6 py-10 text-center text-zinc-500" colSpan={4}>
                No workflows found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

