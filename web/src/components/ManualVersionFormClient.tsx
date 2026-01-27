"use client";

import { useMemo, useState } from "react";

type WorkflowOption = {
  workflowId: string;
  name: string;
};

type Mode = "existing" | "new";

export function ManualVersionFormClient(props: { workflows: WorkflowOption[] }) {
  const { workflows } = props;
  const hasWorkflows = workflows.length > 0;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(hasWorkflows ? "existing" : "new");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(workflows[0]?.workflowId ?? "");
  const [workflowId, setWorkflowId] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [versionUuid, setVersionUuid] = useState("");
  const [workflowJson, setWorkflowJson] = useState(
    "{\n  \"name\": \"New workflow\",\n  \"nodes\": [],\n  \"connections\": {}\n}",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.workflowId === selectedWorkflowId),
    [selectedWorkflowId, workflows],
  );

  async function submit() {
    setStatus(null);
    const workflowIdValue = mode === "existing" ? selectedWorkflow?.workflowId ?? "" : workflowId.trim();
    const workflowNameValue = mode === "existing" ? selectedWorkflow?.name ?? "" : workflowName.trim();

    if (!workflowIdValue || !workflowNameValue) {
      setStatus("Select a workflow or enter workflow details.");
      return;
    }
    if (!workflowJson.trim()) {
      setStatus("Provide workflow JSON.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: workflowIdValue,
          workflowName: workflowNameValue,
          workflowJson,
          versionUuid: versionUuid.trim() || undefined,
        }),
      });
      const raw = await res.text();
      let data: { ok?: boolean; error?: string } | null = null;
      if (raw) {
        try {
          data = JSON.parse(raw) as { ok?: boolean; error?: string };
        } catch (parseError) {
          throw new Error(
            parseError instanceof Error
              ? `Response parse failed: ${parseError.message}`
              : "Response parse failed",
          );
        }
      }
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? (raw || "Failed to create version"));
      }
      setStatus("Created. Redirecting…");
      window.location.href = `/workflows/${encodeURIComponent(workflowIdValue)}/versions`;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="border border-zinc-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Manual version entry</h2>
          <p className="text-xs text-zinc-500">
            Create a version manually by choosing an existing workflow or defining a new one.
          </p>
        </div>
        <button
          type="button"
          className="h-9 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Hide form" : "Add version"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              className={mode === "existing" ? "button-secondary" : "button-secondary opacity-60"}
              onClick={() => setMode("existing")}
              disabled={!hasWorkflows}
            >
              Existing workflow
            </button>
            <button
              type="button"
              className={mode === "new" ? "button-secondary" : "button-secondary opacity-60"}
              onClick={() => setMode("new")}
            >
              New workflow
            </button>
            {!hasWorkflows && mode === "existing" ? (
              <span className="text-xs text-zinc-500">No workflows found yet.</span>
            ) : null}
          </div>

          {mode === "existing" ? (
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-zinc-700">Workflow</span>
              <select
                className="form-field h-10"
                value={selectedWorkflowId}
                onChange={(event) => setSelectedWorkflowId(event.target.value)}
              >
                {workflows.map((workflow) => (
                  <option key={workflow.workflowId} value={workflow.workflowId}>
                    {workflow.name} ({workflow.workflowId})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-zinc-700">Workflow name</span>
                <input
                  className="form-field h-10"
                  value={workflowName}
                  onChange={(event) => setWorkflowName(event.target.value)}
                  placeholder="New workflow"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-zinc-700">Workflow ID</span>
                <input
                  className="form-field h-10"
                  value={workflowId}
                  onChange={(event) => setWorkflowId(event.target.value)}
                  placeholder="workflow-123"
                />
              </label>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-zinc-700">Version UUID (optional)</span>
              <input
                className="form-field h-10"
                value={versionUuid}
                onChange={(event) => setVersionUuid(event.target.value)}
                placeholder="auto-generated if empty"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Workflow JSON</span>
            <textarea
              className="form-textarea min-h-48"
              value={workflowJson}
              onChange={(event) => setWorkflowJson(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create version"}
            </button>
            {status ? <span className="text-xs text-zinc-500">{status}</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
