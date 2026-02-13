"use client";

export function AccessDeniedClient() {
  return (
    <div className="space-y-4 border border-zinc-100 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-[#1a2545]">Access denied</h1>
      <p className="text-sm text-zinc-600">
        You don't have permission to access this page.
      </p>
      <div className="text-xs text-zinc-500">
        Please contact your administrator if you believe this is an error.
      </div>
      <div className="pt-2">
        <a 
          className="inline-flex h-9 items-center justify-center rounded border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50" 
          href="/login"
        >
          Go to login
        </a>
      </div>
    </div>
  );
}
