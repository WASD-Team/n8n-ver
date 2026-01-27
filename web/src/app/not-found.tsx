import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-3 border border-zinc-200 bg-white p-6">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-zinc-600">
        The page you’re looking for doesn’t exist, or the requested version/workflow wasn’t found in the CSV-backed mock dataset.
      </p>
      <div className="flex gap-2">
        <Link
          href="/workflows"
          className="inline-flex h-10 items-center bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Go to Workflows
        </Link>
        <Link
          href="/diff"
          className="button-secondary h-10 px-4 text-sm"
        >
          Go to Diff
        </Link>
      </div>
    </div>
  );
}

