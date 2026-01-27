"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { VersionRow } from "@/lib/versionsStore";
import { formatDateTimeUtc } from "@/lib/dates";

function formatDate(value: string) {
  return formatDateTimeUtc(value);
}

export function VersionDetailsClient(props: { version: VersionRow }) {
  const { version } = props;
  const [description, setDescription] = useState(version.description ?? "");
  const [comment, setComment] = useState(version.comment ?? "");
  const [tags, setTags] = useState<string[]>(version.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const tagsLabel = useMemo(() => (tags.length ? tags.join(", ") : "—"), [tags]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-4 border border-zinc-100 bg-white p-5 shadow-sm lg:col-span-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Actions</h2>
            <p className="text-xs text-zinc-500">Restore or compare this version.</p>
          </div>
          <div className="h-9 w-9 bg-zinc-100" aria-hidden="true" />
        </div>

        <div className="grid gap-2">
          <button
            className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
            onClick={async () => {
              setStatus("Sending restore webhook…");
              try {
                const res = await fetch(`/api/versions/${version.id}/restore`, { method: "POST" });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error ?? `Restore failed (${data.status})`);
                setStatus(`Restore OK (${data.status})`);
              } catch (err) {
                setStatus(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            Restore this version
          </button>
          <Link
            className="button-secondary flex h-10 items-center justify-center px-4 text-sm"
            href={`/diff?base=${version.id}`}
          >
            Compare…
          </Link>
          <button
            className="button-secondary h-10 px-4 text-sm"
            onClick={async () => {
              setStatus("Deleting metadata…");
              try {
                const res = await fetch(`/api/versions/${version.id}/metadata`, { method: "DELETE" });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
                setDescription("");
                setComment("");
                setTags([]);
                setStatus("Metadata deleted");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            Delete metadata
          </button>
          <button
            className="h-10 border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100"
            onClick={async () => {
              setStatus("Deleting version…");
              try {
                const res = await fetch(`/api/versions/${version.id}`, { method: "DELETE" });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
                setStatus("Version deleted");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            Delete version
          </button>
        </div>
        {status ? <div className="text-xs text-zinc-500">{status}</div> : null}

        <div className="space-y-2 border-t border-zinc-100 pt-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Created</span>
            <span className="font-medium text-zinc-900">{formatDate(version.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Workflow updated</span>
            <span className="font-medium text-zinc-900">{formatDate(version.w_updatedAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Tags</span>
            <span className="font-medium text-zinc-900">{tagsLabel}</span>
          </div>
        </div>
      </section>

      <section className="space-y-4 border border-zinc-100 bg-white p-5 shadow-sm lg:col-span-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Metadata</h2>
          <p className="text-xs text-zinc-500">Add context to this version for audits.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-zinc-700">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-field h-10"
              placeholder="Short description of why this version exists…"
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-zinc-700">Comment</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="form-textarea min-h-24"
              placeholder="Detailed notes, rollback reason, links to tickets…"
            />
          </label>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-end gap-2">
              <label className="grid flex-1 gap-1.5">
                <span className="text-xs font-medium text-zinc-700">Add tag</span>
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  className="form-field h-10"
                  placeholder="e.g. hotfix, prod, rollback"
                />
              </label>
              <button
                type="button"
                className="button-secondary h-10 px-4 text-sm"
                onClick={() => {
                  const next = tagDraft.trim();
                  if (!next) return;
                  setTags((t) => (t.includes(next) ? t : [...t, next]));
                  setTagDraft("");
                }}
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="button-secondary px-3 py-1 text-xs text-zinc-700"
                  title="Click to remove"
                  onClick={() => setTags((all) => all.filter((x) => x !== t))}
                >
                  {t} <span className="text-zinc-400">×</span>
                </button>
              ))}
              {tags.length === 0 ? <div className="text-xs text-zinc-500">No tags yet.</div> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4">
          <div className="text-xs text-zinc-500">Saves to metadata table.</div>
          <button
            type="button"
            className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
            onClick={async () => {
              setStatus("Saving metadata…");
              try {
                const res = await fetch(`/api/versions/${version.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ description, comment, tags }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
                setStatus("Metadata saved");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            Save metadata
          </button>
        </div>

        <div className="space-y-2 border-t border-zinc-100 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">Workflow JSON</h3>
            <button
              type="button"
            className="button-secondary h-9 px-3 text-xs font-medium"
              onClick={async () => {
                await navigator.clipboard.writeText(version.w_json);
              }}
            >
              Copy JSON
            </button>
          </div>
          <pre className="max-h-[420px] overflow-auto bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
            {version.w_json}
          </pre>
        </div>
      </section>
    </div>
  );
}

