"use client";

import { useMemo, useState } from "react";
import type { VersionRow } from "@/lib/versionsStore";

function safeParseJson(text: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export function DiffClient(props: { base?: VersionRow; compare?: VersionRow }) {
  const [baseId, setBaseId] = useState(props.base?.id ? String(props.base.id) : "");
  const [compareId, setCompareId] = useState(props.compare?.id ? String(props.compare.id) : "");

  const baseParsed = useMemo(
    () => (props.base ? safeParseJson(props.base.w_json) : undefined),
    [props.base],
  );
  const compareParsed = useMemo(
    () => (props.compare ? safeParseJson(props.compare.w_json) : undefined),
    [props.compare],
  );

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Analysis</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Diff</h1>
          <p className="text-sm text-zinc-500">
            This is a UI mock. Later we’ll render a real JSON diff (tree + change list) and allow “compare from versions table”.
          </p>
        </div>
      </div>

      <form
        className="grid gap-3 border border-zinc-100 bg-white p-4 shadow-sm sm:grid-cols-3"
        action="/diff"
        method="get"
      >
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-zinc-700">Base version ID</span>
          <input
            name="base"
            value={baseId}
            onChange={(e) => setBaseId(e.target.value)}
            className="form-field h-10"
            placeholder="e.g. 2"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-zinc-700">Compare with ID</span>
          <input
            name="compare"
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
            className="form-field h-10"
            placeholder="e.g. 3"
          />
        </label>
        <div className="flex items-end">
          <button className="h-10 w-full bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]">
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
                Enter a base ID to preview JSON and changes.
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
                Enter a compare ID to preview JSON and changes.
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
        <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900">Change list (mock)</div>
        <div className="p-4">
          <ul className="space-y-2 text-sm">
            <li className="border border-zinc-200 bg-zinc-50 p-3">
              <div className="font-medium">Node updated</div>
              <div className="text-zinc-600">Example: <span className="font-mono text-xs">nodes[2].parameters.model</span> changed</div>
            </li>
            <li className="border border-zinc-200 bg-zinc-50 p-3">
              <div className="font-medium">Connection added</div>
              <div className="text-zinc-600">Example: <span className="font-mono text-xs">connections.Servers.ai_tool</span> added</div>
            </li>
            <li className="border border-zinc-200 bg-zinc-50 p-3">
              <div className="font-medium">Settings changed</div>
              <div className="text-zinc-600">Example: <span className="font-mono text-xs">settings.executionOrder</span> modified</div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

