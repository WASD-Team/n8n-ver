"use client";

import { useMemo, useState } from "react";
import type { VersionRow, WorkflowSummary } from "@/lib/versionsStore";
import { formatDateTimeUtc } from "@/lib/dates";

type DiffEntry = {
  type: "added" | "removed" | "changed";
  path: string;
  before?: unknown;
  after?: unknown;
};

function safeParseJson(text: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diffValues(base: unknown, compare: unknown, path = ""): DiffEntry[] {
  if (base === undefined && compare === undefined) return [];
  if (base === undefined) return [{ type: "added", path, after: compare }];
  if (compare === undefined) return [{ type: "removed", path, before: base }];

  const baseIsArray = Array.isArray(base);
  const compareIsArray = Array.isArray(compare);
  if (baseIsArray || compareIsArray) {
    if (!baseIsArray || !compareIsArray) {
      return [{ type: "changed", path, before: base, after: compare }];
    }
    const entries: DiffEntry[] = [];
    const max = Math.max(base.length, compare.length);
    for (let i = 0; i < max; i += 1) {
      const nextPath = `${path}[${i}]`;
      entries.push(...diffValues(base[i], compare[i], nextPath));
    }
    return entries;
  }

  if (isObject(base) && isObject(compare)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(compare)]);
    const entries: DiffEntry[] = [];
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      entries.push(...diffValues(base[key], compare[key], nextPath));
    }
    return entries;
  }

  if (Object.is(base, compare)) return [];
  return [{ type: "changed", path, before: base, after: compare }];
}

function formatValue(value: unknown, maxLength = 140) {
  let text: string;
  if (typeof value === "string") {
    text = value;
  } else {
    text = JSON.stringify(value);
  }
  if (text === undefined) return "undefined";
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function formatVersionLabel(version: VersionRow) {
  return `${version.w_name} · #${version.id} · ${formatDateTimeUtc(version.createdAt)}`;
}

function formatWorkflowLabel(workflow: WorkflowSummary) {
  return `${workflow.name} · ${workflow.workflowId} · ${workflow.versionsCount} versions`;
}

export function DiffClient(props: {
  workflows: WorkflowSummary[];
  workflowId?: string;
  base?: VersionRow;
  compare?: VersionRow;
  versions: VersionRow[];
}) {
  const [workflowId, setWorkflowId] = useState(() => props.workflowId ?? "");
  const [baseId, setBaseId] = useState(() => (props.base?.id ? String(props.base.id) : ""));
  const [compareId, setCompareId] = useState(() => (props.compare?.id ? String(props.compare.id) : ""));

  const baseParsed = useMemo(
    () => (props.base ? safeParseJson(props.base.w_json) : undefined),
    [props.base],
  );
  const compareParsed = useMemo(
    () => (props.compare ? safeParseJson(props.compare.w_json) : undefined),
    [props.compare],
  );

  const versionOptions = useMemo(() => {
    const map = new Map<number, VersionRow>();
    props.versions.forEach((version) => map.set(version.id, version));
    if (props.base && !map.has(props.base.id)) map.set(props.base.id, props.base);
    if (props.compare && !map.has(props.compare.id)) map.set(props.compare.id, props.compare);
    return Array.from(map.values());
  }, [props.versions, props.base, props.compare]);

  const diffEntries = useMemo(() => {
    if (!baseParsed?.ok || !compareParsed?.ok) return [];
    return diffValues(baseParsed.value, compareParsed.value, "");
  }, [baseParsed, compareParsed]);

  const DIFF_LIMIT = 80;
  const diffPreview = diffEntries.slice(0, DIFF_LIMIT);

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Analysis</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Diff</h1>
          <p className="text-sm text-zinc-500">
            Compare two versions to review the JSON side by side.
          </p>
        </div>
      </div>

      <form
        className="grid gap-3 border border-zinc-100 bg-white p-4 shadow-sm sm:grid-cols-3"
        action="/diff"
        method="get"
      >
        <label className="grid gap-1.5 sm:col-span-3">
          <span className="text-xs font-medium text-zinc-700">Workflow</span>
          <select
            name="workflow"
            value={workflowId}
            onChange={(e) => {
              const nextWorkflow = e.target.value;
              setWorkflowId(nextWorkflow);
              setBaseId("");
              setCompareId("");
              e.currentTarget.form?.requestSubmit();
            }}
            className="form-field h-10"
          >
            <option value="">Select workflow</option>
            {props.workflows.map((workflow) => (
              <option key={workflow.workflowId} value={workflow.workflowId}>
                {formatWorkflowLabel(workflow)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-zinc-700">Base version</span>
          <select
            name="base"
            value={baseId}
            onChange={(e) => setBaseId(e.target.value)}
            className="form-field h-10"
            disabled={!workflowId}
          >
            <option value="">Select base version</option>
            {versionOptions.map((version) => (
              <option key={version.id} value={String(version.id)}>
                {formatVersionLabel(version)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-zinc-700">Compare with</span>
          <select
            name="compare"
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
            className="form-field h-10"
            disabled={!workflowId}
          >
            <option value="">Select compare version</option>
            {versionOptions.map((version) => (
              <option key={version.id} value={String(version.id)}>
                {formatVersionLabel(version)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="h-10 w-full bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
          >
            Compare
          </button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-zinc-100 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900">
            Base
            {props.base ? (
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {props.base.w_name} · #{props.base.id}
              </span>
            ) : null}
          </div>
          <div className="p-4">
            {!props.base ? (
              <div className="border border-dashed border-zinc-200 p-6 text-sm text-zinc-500">
                {workflowId ? "Select a base version to preview JSON and changes." : "Select a workflow first."}
              </div>
            ) : baseParsed?.ok ? (
              <pre className="max-h-[420px] overflow-auto bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
                {JSON.stringify(baseParsed.value, null, 2)}
              </pre>
            ) : (
              <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                JSON parse error: {baseParsed?.error}
              </div>
            )}
          </div>
        </section>

        <section className="border border-zinc-100 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900">
            Compare
            {props.compare ? (
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {props.compare.w_name} · #{props.compare.id}
              </span>
            ) : null}
          </div>
          <div className="p-4">
            {!props.compare ? (
              <div className="border border-dashed border-zinc-200 p-6 text-sm text-zinc-500">
                {workflowId ? "Select a compare version to preview JSON and changes." : "Select a workflow first."}
              </div>
            ) : compareParsed?.ok ? (
              <pre className="max-h-[420px] overflow-auto bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
                {JSON.stringify(compareParsed.value, null, 2)}
              </pre>
            ) : (
              <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                JSON parse error: {compareParsed?.error}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900">Change list</div>
        <div className="p-4">
          {!baseParsed?.ok || !compareParsed?.ok ? (
            <div className="text-sm text-zinc-500">Select both versions to see a change list.</div>
          ) : diffEntries.length === 0 ? (
            <div className="text-sm text-zinc-500">No differences found.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-zinc-500">
                {diffEntries.length} change{diffEntries.length === 1 ? "" : "s"} found.
                {diffEntries.length > DIFF_LIMIT ? ` Showing first ${DIFF_LIMIT}.` : ""}
              </div>
              <ul className="space-y-2 text-sm">
                {diffPreview.map((entry, idx) => (
                  <li key={`${entry.path}-${entry.type}-${idx}`} className="border border-zinc-200 bg-zinc-50 p-3">
                    <div className="font-medium text-zinc-900">{entry.type.toUpperCase()}</div>
                    <div className="text-zinc-600">
                      <span className="font-mono text-xs">{entry.path || "(root)"}</span>
                      {entry.type === "changed" ? (
                        <span>
                          {" "}
                          from <span className="font-mono text-xs">{formatValue(entry.before)}</span> to{" "}
                          <span className="font-mono text-xs">{formatValue(entry.after)}</span>
                        </span>
                      ) : entry.type === "added" ? (
                        <span>
                          {" "}
                          = <span className="font-mono text-xs">{formatValue(entry.after)}</span>
                        </span>
                      ) : (
                        <span>
                          {" "}
                          was <span className="font-mono text-xs">{formatValue(entry.before)}</span>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

