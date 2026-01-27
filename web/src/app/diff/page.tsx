import { DiffClient } from "@/components/DiffClient";
import { getVersionById, listVersionsByWorkflow, listWorkflows } from "@/lib/versionsStore";

export default async function DiffPage(props: {
  searchParams?: Promise<{ workflow?: string; base?: string; compare?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const baseId = sp.base ? Number(sp.base) : undefined;
  const compareId = sp.compare ? Number(sp.compare) : undefined;
  const workflowFromQuery = sp.workflow?.trim();

  const [workflows, base, compare] = await Promise.all([
    listWorkflows(),
    Number.isFinite(baseId ?? NaN) ? getVersionById(baseId as number) : Promise.resolve(undefined),
    Number.isFinite(compareId ?? NaN) ? getVersionById(compareId as number) : Promise.resolve(undefined),
  ]);

  const workflowId = workflowFromQuery || base?.w_id || compare?.w_id;
  const versions = workflowId ? await listVersionsByWorkflow(workflowId) : [];

  const baseScoped = base && base.w_id === workflowId ? base : undefined;
  const compareScoped = compare && compare.w_id === workflowId ? compare : undefined;

  return (
    <DiffClient
      workflows={workflows}
      workflowId={workflowId}
      base={baseScoped}
      compare={compareScoped}
      versions={versions}
    />
  );
}

