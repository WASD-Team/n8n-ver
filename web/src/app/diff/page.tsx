import { DiffClient } from "@/components/DiffClient";
import { getVersionById } from "@/lib/versionsStore";

export default async function DiffPage(props: {
  searchParams?: Promise<{ base?: string; compare?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const baseId = sp.base ? Number(sp.base) : undefined;
  const compareId = sp.compare ? Number(sp.compare) : undefined;

  const base = Number.isFinite(baseId ?? NaN) ? await getVersionById(baseId as number) : undefined;
  const compare = Number.isFinite(compareId ?? NaN) ? await getVersionById(compareId as number) : undefined;

  return <DiffClient base={base} compare={compare} />;
}

