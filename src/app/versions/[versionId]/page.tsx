import Link from "next/link";
import { notFound } from "next/navigation";
import { getEffectiveInstanceId } from "@/lib/auth";
import { getVersionById } from "@/lib/versionsStore";
import { VersionDetailsClient } from "@/components/VersionDetailsClient";

export default async function VersionDetailsPage(props: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await props.params;
  const id = Number(versionId);
  if (!Number.isFinite(id)) notFound();

  const instanceId = await getEffectiveInstanceId();
  const version = await getVersionById(id, instanceId ?? undefined);
  if (!version) notFound();

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Version details</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">{version.w_name}</h1>
          <p className="text-sm text-zinc-500">
            Workflow ID: <span className="font-mono text-xs">{version.w_id}</span> · Version UUID:{" "}
            <span className="font-mono text-xs">{version.w_version}</span>
          </p>
          <div className="text-xs text-zinc-400">
            <Link className="hover:underline" href="/workflows">
              Workflows
            </Link>{" "}
            <span className="text-zinc-300">/</span>{" "}
            <Link className="hover:underline" href={`/workflows/${encodeURIComponent(version.w_id)}/versions`}>
              Versions
            </Link>{" "}
            <span className="text-zinc-300">/</span> Version {version.id}
          </div>
        </div>
      </div>

      <VersionDetailsClient version={version} />
    </div>
  );
}
