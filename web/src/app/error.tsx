"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  const { error, reset } = props;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-3 border border-zinc-200 bg-white p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-zinc-600">
        This is a UI mock that reads from <code className="bg-zinc-100 px-1.5 py-0.5">../test_version.csv</code>. If the
        file is missing, or parsing fails, you’ll see this screen.
      </p>
      <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {error.message}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Try again
        </button>
        <Link
          href="/workflows"
          className="button-secondary h-10 px-4 text-sm"
        >
          Workflows
        </Link>
      </div>
    </div>
  );
}

