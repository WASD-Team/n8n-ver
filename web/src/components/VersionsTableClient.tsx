"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { VersionRow } from "@/lib/versionsStore";
import { formatDateTimeUtc } from "@/lib/dates";

function formatDate(value: string) {
  return formatDateTimeUtc(value);
}

export function VersionsTableClient(props: { workflowId: string; versions: VersionRow[] }) {
  const { versions, workflowId } = props;
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{
    key: "w_name" | "createdAt" | "w_updatedAt" | "w_version";
    dir: "asc" | "desc";
  }>({
    key: "createdAt",
    dir: "desc",
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredVersions = useMemo(() => {
    if (!normalizedSearch) return versions;
    return versions.filter((version) => {
      const name = version.w_name.toLowerCase();
      const versionId = version.w_version.toLowerCase();
      const createdAt = version.createdAt.toLowerCase();
      const updatedAt = version.w_updatedAt.toLowerCase();
      return (
        name.includes(normalizedSearch) ||
        versionId.includes(normalizedSearch) ||
        createdAt.includes(normalizedSearch) ||
        updatedAt.includes(normalizedSearch)
      );
    });
  }, [normalizedSearch, versions]);

  const sortedVersions = useMemo(() => {
    const copy = [...filteredVersions];
    copy.sort((a, b) => {
      let result = 0;
      if (sort.key === "w_name") {
        result = a.w_name.localeCompare(b.w_name);
      } else if (sort.key === "createdAt") {
        result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sort.key === "w_updatedAt") {
        result = new Date(a.w_updatedAt).getTime() - new Date(b.w_updatedAt).getTime();
      } else {
        result = a.w_version.localeCompare(b.w_version);
      }
      return sort.dir === "asc" ? result : -result;
    });
    return copy;
  }, [filteredVersions, sort]);

  const selectedIds = useMemo(
    () => sortedVersions.filter((version) => selected[version.id]).map((version) => version.id),
    [selected, sortedVersions],
  );
  const allChecked = selectedIds.length > 0 && selectedIds.length === sortedVersions.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < sortedVersions.length;

  function toggleSort(key: "w_name" | "createdAt" | "w_updatedAt" | "w_version") {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 border border-zinc-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Search versions…"
            className="form-field h-9 sm:w-72"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="button-secondary h-9 px-3 text-sm"
            onClick={() => setSearch("")}
            disabled={!search.trim()}
            title="Clear search and show all versions"
          >
            Reset
          </button>
          <button
            type="button"
            className="button-secondary h-9 px-3 text-sm"
            title="Mock filter"
          >
            Tag filter
          </button>
        </div>

        <div className="flex items-center gap-2">
            <button
            type="button"
            className="h-9 bg-[#ff4d7e] px-3 text-sm font-medium text-white hover:bg-[#f43b70]"
            title="Mock action"
          >
            Restore
          </button>
          <button
            type="button"
            className="button-secondary h-9 px-3 text-sm"
            title="Export all versions for this workflow"
            onClick={async () => {
              setActionStatus("Exporting workflow versions…");
              const url = `/api/export?format=csv&workflowId=${encodeURIComponent(workflowId)}`;
              const res = await fetch(url);
              const blob = await res.blob();
              const href = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = href;
              a.download = `workflow-${workflowId}-versions.csv`;
              a.click();
              URL.revokeObjectURL(href);
              setActionStatus("Exported");
            }}
          >
            Export
          </button>
        </div>
      </div>
      {actionStatus ? <div className="text-xs text-zinc-500">{actionStatus}</div> : null}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-zinc-100 bg-white p-3 shadow-sm">
          <div className="text-sm text-zinc-700">
            Selected <span className="font-medium">{selectedIds.length}</span> version(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button-secondary h-9 px-3 text-sm"
              title="Mock action"
            >
              Add tags
            </button>
            <button
              type="button"
              className="h-9 border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
              title="Delete selected versions"
              onClick={async () => {
                setActionStatus("Deleting selected versions…");
                try {
                  const res = await fetch("/api/versions/bulk", {
                    method: "DELETE",
                    body: JSON.stringify({ ids: selectedIds }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
                  setActionStatus("Deleted. Refreshing…");
                  window.location.reload();
                } catch (err) {
                  setActionStatus(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="button-secondary h-9 px-3 text-sm"
              title="Delete only metadata for selected"
              onClick={async () => {
                setActionStatus("Deleting metadata…");
                try {
                  const res = await fetch("/api/versions/bulk", {
                    method: "DELETE",
                    body: JSON.stringify({ ids: selectedIds, metadataOnly: true }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data.ok) throw new Error(data.error ?? "Metadata delete failed");
                  setActionStatus("Metadata deleted. Refreshing…");
                  window.location.reload();
                } catch (err) {
                  setActionStatus(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              Delete metadata
            </button>
            <button
              type="button"
              className="button-secondary h-9 px-3 text-sm"
              title="Export selected versions"
              onClick={async () => {
                setActionStatus("Exporting selected…");
                const url = `/api/export?format=csv&ids=${selectedIds.join(",")}`;
                const res = await fetch(url);
                const blob = await res.blob();
                const href = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = href;
                a.download = `versions-${selectedIds.length}.csv`;
                a.click();
                URL.revokeObjectURL(href);
                setActionStatus("Exported");
              }}
            >
              Export selected
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-zinc-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-400">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  aria-label="Select all"
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={(e) => {
                    const next = e.target.checked;
                    const map: Record<number, boolean> = {};
                    for (const v of sortedVersions) map[v.id] = next;
                    setSelected(map);
                  }}
                />
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={() => toggleSort("w_name")}
                >
                  Name {sort.key === "w_name" ? (sort.dir === "asc" ? "▲" : "▼") : null}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={() => toggleSort("createdAt")}
                >
                  Created {sort.key === "createdAt" ? (sort.dir === "asc" ? "▲" : "▼") : null}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={() => toggleSort("w_updatedAt")}
                >
                  Last updated {sort.key === "w_updatedAt" ? (sort.dir === "asc" ? "▲" : "▼") : null}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={() => toggleSort("w_version")}
                >
                  Version UUID {sort.key === "w_version" ? (sort.dir === "asc" ? "▲" : "▼") : null}
                </button>
              </th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedVersions.map((v) => (
              <tr key={v.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <input
                    aria-label={`Select version ${v.id}`}
                    type="checkbox"
                    checked={!!selected[v.id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [v.id]: e.target.checked }))}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-[#1a2545]">{v.w_name}</td>
                <td className="px-4 py-3 text-zinc-700">{formatDate(v.createdAt)}</td>
                <td className="px-4 py-3 text-zinc-700">{formatDate(v.w_updatedAt)}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{v.w_version}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="button-secondary px-2.5 py-1 text-xs font-medium"
                      href={`/versions/${v.id}`}
                    >
                      Details
                    </Link>
                    <Link
                      className="button-secondary px-2.5 py-1 text-xs font-medium"
                      href={`/diff?base=${v.id}`}
                    >
                      Compare
                    </Link>
                    <button
                      type="button"
                      className="bg-[#ff4d7e] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#f43b70]"
                      title="Mock restore"
                      onClick={async () => {
                        setActionStatus("Sending restore webhook…");
                        try {
                          const res = await fetch(`/api/versions/${v.id}/restore`, { method: "POST" });
                          const data = await res.json();
                          if (!res.ok || !data.ok) throw new Error(data.error ?? `Restore failed (${data.status})`);
                          setActionStatus(`Restore OK (${data.status})`);
                        } catch (err) {
                          setActionStatus(err instanceof Error ? err.message : String(err));
                        }
                      }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      title="Mock delete"
                      onClick={async () => {
                        setActionStatus("Deleting version…");
                        try {
                          const res = await fetch(`/api/versions/${v.id}`, { method: "DELETE" });
                          const data = await res.json();
                          if (!res.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
                          setActionStatus("Version deleted. Refreshing…");
                          window.location.reload();
                        } catch (err) {
                          setActionStatus(err instanceof Error ? err.message : String(err));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedVersions.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={6}>
                  No versions found for this workflow.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

