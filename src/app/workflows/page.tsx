import Link from "next/link";
import { getEffectiveInstanceId } from "@/lib/auth";
import { ManualVersionFormClient } from "@/components/ManualVersionFormClient";
import { WorkflowsTableClient } from "@/components/WorkflowsTableClient";
import { listWorkflows } from "@/lib/versionsStore";

export default async function WorkflowsPage(props: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const q = (searchParams.q ?? "").trim();
  const instanceId = await getEffectiveInstanceId();

  const workflows = await listWorkflows({ search: q || undefined, instanceId: instanceId ?? undefined });

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-400">Overview</div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Workflows</h1>
            <p className="text-sm text-zinc-500">
              Browse and manage workflow versions.
            </p>
          </div>

          <form className="flex w-full gap-2 sm:w-auto" action="/workflows" method="get">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search workflows…"
              className="form-field h-10 sm:w-72"
            />
            <button className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]">
              Search
            </button>
            {q ? (
              <Link
                className="button-secondary h-10 px-4 text-sm font-medium leading-10 text-zinc-700"
                href="/workflows"
              >
                Reset
              </Link>
            ) : null}
          </form>
        </div>
      </div>

      <ManualVersionFormClient
        workflows={workflows.map((workflow) => ({
          workflowId: workflow.workflowId,
          name: workflow.name,
        }))}
      />

      <div className="border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4 text-sm font-medium text-zinc-600">
          {workflows.length} workflow(s)
        </div>
        <WorkflowsTableClient workflows={workflows} />
      </div>
    </div>
  );
}
