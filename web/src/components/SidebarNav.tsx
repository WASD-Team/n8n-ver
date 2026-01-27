"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { WorkflowSummary } from "@/lib/versionsStore";

type FolderMap = Record<string, string[]>;

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Workflows", href: "/workflows" },
  { label: "Diff", href: "/diff" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
  { label: "Audit", href: "/audit" },
];

function getFolderName(name: string) {
  if (name.startsWith("[") && name.includes("]")) {
    return name.slice(1, name.indexOf("]")).trim() || "Grouped";
  }
  if (name.includes("/")) return name.split("/")[0].trim() || "Grouped";
  if (name.includes(" - ")) return name.split(" - ")[0].trim() || "Grouped";
  return "Ungrouped";
}

export function SidebarNav(props: { workflows: WorkflowSummary[] }) {
  const { workflows } = props;
  const defaultFolders = useMemo<FolderMap>(() => {
    const map: FolderMap = {};
    for (const w of workflows) {
      const folder = getFolderName(w.name);
      if (!map[folder]) map[folder] = [];
      map[folder].push(w.workflowId);
    }
    return map;
  }, [workflows]);

  const [folders, setFolders] = useState<FolderMap>(defaultFolders);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [newFolder, setNewFolder] = useState("");
  const [moveTarget, setMoveTarget] = useState("Ungrouped");

  const assigned = useMemo(() => {
    const set = new Set<string>();
    Object.values(folders).forEach((ids) => ids.forEach((id) => set.add(id)));
    return set;
  }, [folders]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  );

  const ungrouped = workflows.filter((w) => !assigned.has(w.workflowId));

  const workflowById = useMemo(() => {
    const map = new Map(workflows.map((w) => [w.workflowId, w]));
    return map;
  }, [workflows]);

  const folderNames = Object.keys(folders).sort();

  function moveSelected(target: string) {
    if (selectedIds.length === 0) return;
    setFolders((prev) => {
      const next: FolderMap = {};
      for (const [folder, ids] of Object.entries(prev)) {
        next[folder] = ids.filter((id) => !selectedIds.includes(id));
      }
      if (!next[target]) next[target] = [];
      next[target] = [...new Set([...next[target], ...selectedIds])];
      return next;
    });
    setSelected({});
  }

  return (
    <nav className="flex flex-1 flex-col gap-4 px-4 pb-4 text-sm">
      <div className="space-y-2">
        <div className="px-2 text-xs uppercase tracking-wide text-white/40">Navigation</div>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={`${item.label}-${item.href}`}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 border-l-2 border-transparent px-3 py-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <span className="flex h-7 w-7 items-center justify-center border border-white/10 text-[9px] font-semibold">
                  {item.label.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="px-2 text-xs uppercase tracking-wide text-white/40">Workflow folders</div>

        <div className="space-y-2 border border-white/10 p-3">
          <div className="text-xs text-white/60">Create folder + move selected</div>
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="Folder name"
            className="form-field-dark h-8 px-2 text-xs"
          />
          <button
            type="button"
            className="h-8 w-full bg-[#ff4d7e] text-xs font-medium text-white hover:bg-[#f43b70]"
            onClick={() => {
              const name = newFolder.trim();
              if (!name) return;
              setFolders((prev) => ({ ...prev, [name]: prev[name] ?? [] }));
              setMoveTarget(name);
              moveSelected(name);
              setNewFolder("");
            }}
          >
            Create & Move
          </button>
          <div className="flex items-center gap-2">
            <select
              className="form-field-dark h-8 px-2 text-xs"
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
            >
              <option className="text-zinc-900" value="Ungrouped">
                Ungrouped
              </option>
              {folderNames.map((f) => (
                <option className="text-zinc-900" key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="h-8 w-24 border border-white/20 text-xs text-white/80 hover:bg-white/10"
              onClick={() => moveSelected(moveTarget)}
            >
              Move
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {folderNames.map((folder) => {
            const ids = folders[folder] ?? [];
            const isCollapsed = collapsed[folder];
            return (
              <div key={folder} className="border border-white/10">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-white/80 hover:bg-white/10"
                  onClick={() => setCollapsed((s) => ({ ...s, [folder]: !s[folder] }))}
                >
                  <span>{folder}</span>
                  <span className="text-white/40">{isCollapsed ? "+" : "–"}</span>
                </button>
                {!isCollapsed ? (
                  <div className="space-y-1 px-3 pb-2">
                    {ids.length > 0 ? (
                      ids.map((id) => {
                        const w = workflowById.get(id);
                        if (!w) return null;
                        return (
                          <Link
                            key={id}
                            href={`/workflows/${encodeURIComponent(w.workflowId)}/versions`}
                            className="block truncate text-xs text-white/70 hover:text-white"
                          >
                            {w.name}
                          </Link>
                        );
                      })
                    ) : (
                      <div className="text-xs text-white/40">No workflows yet.</div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {ungrouped.length > 0 ? (
            <div className="border border-white/10">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-white/80 hover:bg-white/10"
                onClick={() => setCollapsed((s) => ({ ...s, Ungrouped: !s.Ungrouped }))}
              >
                <span>Ungrouped</span>
                <span className="text-white/40">{collapsed.Ungrouped ? "+" : "–"}</span>
              </button>
              {!collapsed.Ungrouped ? (
                <div className="space-y-1 px-3 pb-2">
                  {ungrouped.map((w) => (
                    <Link
                      key={w.workflowId}
                      href={`/workflows/${encodeURIComponent(w.workflowId)}/versions`}
                      className="block truncate text-xs text-white/70 hover:text-white"
                    >
                      {w.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

