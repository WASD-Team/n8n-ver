"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import type { WorkflowSummary } from "@/lib/versionsStore";
import type { WorkflowFolderMap } from "@/lib/workflowGroupsStore";

type FolderMap = WorkflowFolderMap;

type NavItem = { label: string; href: string; superAdminOnly?: boolean };

const navItems: NavItem[] = [
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

export function SidebarNav(props: { workflows: WorkflowSummary[]; initialFolders?: FolderMap; isSuperAdmin?: boolean }) {
  const { workflows, initialFolders, isSuperAdmin = false } = props;
  
  const visibleNavItems = navItems.filter(item => !item.superAdminOnly || isSuperAdmin);
  const defaultFolders = useMemo<FolderMap>(() => {
    const map: FolderMap = {};
    for (const w of workflows) {
      const folder = getFolderName(w.name);
      if (!map[folder]) map[folder] = [];
      map[folder].push(w.workflowId);
    }
    return map;
  }, [workflows]);

  const [folders, setFolders] = useState<FolderMap>(initialFolders ?? defaultFolders);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [newFolder, setNewFolder] = useState("");
  const [moveTarget, setMoveTarget] = useState("Ungrouped");
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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

  async function persistFolders(next: FolderMap) {
    try {
      await fetch("/api/workflows/groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folders: next }),
      });
    } catch {
      // Intentionally ignore persistence errors in the sidebar UI.
    }
  }

  function setFoldersAndPersist(updater: (prev: FolderMap) => FolderMap) {
    setFolders((prev) => {
      const next = updater(prev);
      void persistFolders(next);
      return next;
    });
  }

  function moveIds(target: string, ids: string[]) {
    if (ids.length === 0) return;
    const idsToMove = ids;
    setFoldersAndPersist((prev) => {
      const next: FolderMap = {};
      for (const [folder, ids] of Object.entries(prev)) {
        next[folder] = ids.filter((id) => !idsToMove.includes(id));
      }
      if (target !== "Ungrouped") {
        if (!next[target]) next[target] = [];
        next[target] = [...new Set([...next[target], ...idsToMove])];
      }
      return next;
    });
    setSelected({});
  }

  function moveSelected(target: string) {
    moveIds(target, selectedIds);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleDragStart(id: string, event: DragEvent<HTMLDivElement>) {
    const ids = selected[id] ? selectedIds : [id];
    event.dataTransfer.setData("application/x-n8n-workflows", JSON.stringify(ids));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(target: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropTarget(null);
    const data = event.dataTransfer.getData("application/x-n8n-workflows");
    if (!data) return;
    try {
      const ids = JSON.parse(data) as string[];
      moveIds(target, ids);
    } catch {
      return;
    }
  }

  function handleDragOver(target: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropTarget(target);
  }

  return (
    <nav className="flex flex-1 flex-col gap-4 px-4 pb-4 text-sm">
      <div className="space-y-2">
        <div className="px-2 text-xs uppercase tracking-wide text-white/40">Navigation</div>
        <ul className="space-y-1">
          {visibleNavItems.map((item) => (
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const name = newFolder.trim();
                if (!name) return;
                if (selectedIds.length === 0) {
                  setFoldersAndPersist((prev) => ({ ...prev, [name]: prev[name] ?? [] }));
                } else {
                  moveIds(name, selectedIds);
                }
                setMoveTarget(name);
                setNewFolder("");
              }
            }}
            placeholder="Folder name"
            className="form-field-dark h-8 px-2 text-xs"
          />
          <button
            type="button"
            className="h-8 w-full bg-[#ff4d7e] text-xs font-medium text-white hover:bg-[#f43b70]"
            onClick={() => {
              const name = newFolder.trim();
              if (!name) return;
              if (selectedIds.length === 0) {
                setFoldersAndPersist((prev) => ({ ...prev, [name]: prev[name] ?? [] }));
              } else {
                moveIds(name, selectedIds);
              }
              setMoveTarget(name);
              setNewFolder("");
            }}
          >
            Create & Move
          </button>
          {selectedIds.length > 0 && (
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
          )}
        </div>

        <div className="space-y-2">
          {folderNames.map((folder) => {
            const ids = folders[folder] ?? [];
            const isCollapsed = collapsed[folder];
            const isEmpty = ids.length === 0;
            return (
              <div
                key={folder}
                className={`border border-white/10 ${dropTarget === folder ? "bg-white/10" : ""}`}
                onDrop={(event) => handleDrop(folder, event)}
                onDragOver={(event) => handleDragOver(folder, event)}
                onDragLeave={() => setDropTarget(null)}
              >
                <div className="flex w-full items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-between text-left text-xs font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => setCollapsed((s) => ({ ...s, [folder]: !s[folder] }))}
                  >
                    <span>{folder}</span>
                    <span className="text-white/40">{isCollapsed ? "+" : "–"}</span>
                  </button>
                  {isEmpty && (
                    <button
                      type="button"
                      className="ml-2 h-5 w-5 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                      onClick={() => {
                        setFoldersAndPersist((prev) => {
                          const next = { ...prev };
                          delete next[folder];
                          return next;
                        });
                      }}
                      title="Delete empty folder"
                      aria-label={`Delete empty folder ${folder}`}
                    >
                      ×
                    </button>
                  )}
                </div>
                {!isCollapsed ? (
                  <div className="space-y-1 px-3 pb-2">
                    {ids.length > 0 ? (
                      ids.map((id) => {
                        const w = workflowById.get(id);
                        if (!w) return null;
                        return (
                          <div
                            key={id}
                            className={`flex items-center gap-2 rounded px-1 py-1 text-xs ${
                              selected[id] ? "bg-white/10" : ""
                            }`}
                            draggable
                            onDragStart={(event) => handleDragStart(id, event)}
                          >
                            <input
                              type="checkbox"
                              checked={!!selected[id]}
                              onChange={() => toggleSelected(id)}
                              className="h-3 w-3 accent-[#ff4d7e]"
                              aria-label={`Select ${w.name}`}
                            />
                            <Link
                              href={`/workflows/${encodeURIComponent(w.workflowId)}/versions`}
                              className="block flex-1 truncate text-xs text-white/70 hover:text-white"
                            >
                              {w.name}
                            </Link>
                          </div>
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
            <div
              className={`border border-white/10 ${dropTarget === "Ungrouped" ? "bg-white/10" : ""}`}
              onDrop={(event) => handleDrop("Ungrouped", event)}
              onDragOver={(event) => handleDragOver("Ungrouped", event)}
              onDragLeave={() => setDropTarget(null)}
            >
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
                    <div
                      key={w.workflowId}
                      className={`flex items-center gap-2 rounded px-1 py-1 text-xs ${
                        selected[w.workflowId] ? "bg-white/10" : ""
                      }`}
                      draggable
                      onDragStart={(event) => handleDragStart(w.workflowId, event)}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected[w.workflowId]}
                        onChange={() => toggleSelected(w.workflowId)}
                        className="h-3 w-3 accent-[#ff4d7e]"
                        aria-label={`Select ${w.name}`}
                      />
                      <Link
                        href={`/workflows/${encodeURIComponent(w.workflowId)}/versions`}
                        className="block flex-1 truncate text-xs text-white/70 hover:text-white"
                      >
                        {w.name}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto border-t border-white/10 px-3 py-3">
        <div className="text-[10px] text-white/30 font-mono">
          Build: {process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7) || "dev"}
        </div>
      </div>
    </nav>
  );
}

