import Link from "next/link";
import { getEffectiveInstanceId } from "@/lib/auth";
import { listVersionsByWorkflow } from "@/lib/versionsStore";
import { VersionsTableClient } from "@/components/VersionsTableClient";

export default async function VersionsPage(props: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await props.params;
  const instanceId = await getEffectiveInstanceId();
  const versions = await listVersionsByWorkflow(workflowId, instanceId ?? undefined);
  const workflowName = versions[0]?.w_name ?? "Unknown workflow";

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Workflows</div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">{workflowName}</h1>
            <div className="text-sm text-zinc-500">
              Workflow ID: <span className="font-mono text-xs">{workflowId}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Link
              href="/diff"
              className="text-sm font-medium text-[#ff4d7e] underline-offset-4 hover:underline"
            >
              Open Diff
            </Link>
          </div>
        </div>
      </div>

      <VersionsTableClient workflowId={workflowId} versions={versions} />
    </div>
  );
}
