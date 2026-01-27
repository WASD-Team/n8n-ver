"use client";

export function AccessDeniedClient(props: { admins: string[] }) {
  const { admins } = props;

  return (
    <div className="space-y-4 border border-zinc-100 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-[#1a2545]">Access denied</h1>
      <p className="text-sm text-zinc-600">
        Settings are available to <span className="font-medium">Admin</span> users only.
      </p>
      {admins.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs text-zinc-500">Select an admin user to continue:</div>
          <div className="flex flex-wrap gap-2">
            {admins.map((email) => (
              <button
                key={email}
                className="button-secondary h-9 px-3 text-xs"
                onClick={async () => {
                  await fetch("/api/auth/impersonate", {
                    method: "POST",
                    body: JSON.stringify({ email }),
                  });
                  window.location.reload();
                }}
              >
                {email}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500">
          No admin users found. Configure DB access first, then create an Admin.
        </div>
      )}
      <div className="text-xs text-zinc-500">
        Or open the <a className="underline" href="/login">login page</a>.
      </div>
    </div>
  );
}

