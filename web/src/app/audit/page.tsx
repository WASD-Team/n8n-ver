import { listAudit } from "@/lib/auditStore";
import { formatDateTimeUtc } from "@/lib/dates";

export default async function AuditPage() {
  const events = await listAudit();

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-400">Security</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Audit log</h1>
        <p className="text-sm text-zinc-500">Recent actions across settings, users, and versions.</p>
      </div>

      <div className="border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4 text-sm font-medium text-zinc-600">
          {events.length} event(s)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Entity</th>
                <th className="px-6 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-6 py-3 text-zinc-600">
                    {formatDateTimeUtc(e.createdAt)}
                  </td>
                  <td className="px-6 py-3 text-zinc-600">{e.actorEmail ?? "system"}</td>
                  <td className="px-6 py-3 font-medium text-[#1a2545]">{e.action}</td>
                  <td className="px-6 py-3 text-zinc-600">
                    {e.entityType}
                    {e.entityId ? `:${e.entityId}` : ""}
                  </td>
                  <td className="px-6 py-3 text-zinc-500">
                    {e.details ? (
                      <pre className="max-w-[520px] overflow-auto bg-zinc-950 p-2 text-[11px] text-zinc-100">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-zinc-500" colSpan={5}>
                    No audit events yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
