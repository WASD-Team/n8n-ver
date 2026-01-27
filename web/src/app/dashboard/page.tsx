import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listAudit } from "@/lib/auditStore";
import { formatDateTimeUtc } from "@/lib/dates";
import {
  listRecentVersions,
  listStaleWorkflows,
  listVersionsByIds,
  listWorkflows,
} from "@/lib/versionsStore";

const RECENT_LIMIT = 10;
const STALE_LIMIT = 10;
const RESTORE_LIMIT = 10;

export default async function DashboardPage() {
  const [workflows, recentVersions, staleWorkflows, auditEvents, currentUser] = await Promise.all([
    listWorkflows(),
    listRecentVersions(RECENT_LIMIT),
    listStaleWorkflows(STALE_LIMIT),
    listAudit(200),
    getCurrentUser(),
  ]);

  const restoreEvents = auditEvents
    .filter((event) => event.action === "version.restore")
    .slice(0, RESTORE_LIMIT);
  const restoreIds = restoreEvents
    .map((event) => Number(event.entityId))
    .filter((id) => Number.isFinite(id));
  const restoredVersions = restoreIds.length > 0 ? await listVersionsByIds(restoreIds) : [];
  const restoredById = new Map(restoredVersions.map((version) => [String(version.id), version]));

  const displayName = currentUser?.name ?? currentUser?.email ?? "оператор";

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-400">Dashboard</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">
          Привет, {displayName}
        </h1>
        <p className="text-sm text-zinc-500">
          Быстрый обзор активности версионирования и состояния сценариев.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-zinc-100 bg-white px-5 py-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-400">
            Текущее количество сценариев
          </div>
          <div className="mt-2 text-3xl font-semibold text-[#1a2545]">{workflows.length}</div>
          <div className="text-xs text-zinc-500">Всего активных workflow в системе</div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <section className="border border-zinc-100 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-4 text-sm font-medium text-zinc-600">
            Последние 10 загруженных версий
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-400">
                <tr>
                  <th className="px-6 py-3">Версия</th>
                  <th className="px-6 py-3">Сценарий</th>
                  <th className="hidden px-6 py-3 sm:table-cell">Время</th>
                </tr>
              </thead>
              <tbody>
                {recentVersions.map((version) => (
                  <tr key={version.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-6 py-3">
                      <Link
                        className="font-medium text-[#1a2545] hover:text-[#ff4d7e]"
                        href={`/versions/${version.id}`}
                      >
                        #{version.id} · v{version.w_version}
                      </Link>
                      <div className="mt-1 text-xs text-zinc-400 sm:hidden">
                        {formatDateTimeUtc(version.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-zinc-600">{version.w_name}</td>
                    <td className="hidden px-6 py-3 text-zinc-500 sm:table-cell">
                      {formatDateTimeUtc(version.createdAt)}
                    </td>
                  </tr>
                ))}
                {recentVersions.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-zinc-500" colSpan={3}>
                      Пока нет загруженных версий.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-zinc-100 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-4 text-sm font-medium text-zinc-600">
            Давно не обновляемые сценарии
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-400">
                <tr>
                  <th className="px-6 py-3">Сценарий</th>
                  <th className="hidden px-6 py-3 sm:table-cell">Последнее обновление</th>
                  <th className="px-6 py-3">Версий</th>
                </tr>
              </thead>
              <tbody>
                {staleWorkflows.map((workflow) => (
                  <tr key={workflow.workflowId} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-6 py-3">
                      <Link
                        className="font-medium text-[#1a2545] hover:text-[#ff4d7e]"
                        href={`/workflows/${encodeURIComponent(workflow.workflowId)}/versions`}
                      >
                        {workflow.name}
                      </Link>
                      <div className="mt-1 text-xs text-zinc-400 sm:hidden">
                        {formatDateTimeUtc(workflow.lastUpdatedAt)}
                      </div>
                    </td>
                    <td className="hidden px-6 py-3 text-zinc-600 sm:table-cell">
                      {formatDateTimeUtc(workflow.lastUpdatedAt)}
                    </td>
                    <td className="px-6 py-3 text-zinc-500">{workflow.versionsCount}</td>
                  </tr>
                ))}
                {staleWorkflows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-zinc-500" colSpan={3}>
                      Нет сценариев для отображения.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4 text-sm font-medium text-zinc-600">
          Последние восстановленные версии
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-400">
              <tr>
                <th className="hidden px-6 py-3 md:table-cell">Время</th>
                <th className="px-6 py-3">Версия</th>
                <th className="px-6 py-3">Инициатор</th>
                <th className="hidden px-6 py-3 sm:table-cell">Статус</th>
              </tr>
            </thead>
            <tbody>
              {restoreEvents.map((event) => {
                const restored = restoredById.get(String(event.entityId));
                return (
                  <tr key={event.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="hidden px-6 py-3 text-zinc-600 md:table-cell">
                      {formatDateTimeUtc(event.createdAt)}
                    </td>
                    <td className="px-6 py-3">
                      {restored ? (
                        <Link
                          className="font-medium text-[#1a2545] hover:text-[#ff4d7e]"
                          href={`/versions/${restored.id}`}
                        >
                          {restored.w_name} · v{restored.w_version}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">Version #{event.entityId ?? "—"}</span>
                      )}
                      <div className="mt-1 text-xs text-zinc-400 md:hidden">
                        {formatDateTimeUtc(event.createdAt)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400 sm:hidden">
                        {event.details && typeof event.details === "object" && "status" in event.details
                          ? String(event.details.status)
                          : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-zinc-600">{event.actorEmail ?? "system"}</td>
                    <td className="hidden px-6 py-3 text-zinc-500 sm:table-cell">
                      {event.details && typeof event.details === "object" && "status" in event.details
                        ? String(event.details.status)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {restoreEvents.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-zinc-500" colSpan={4}>
                    Восстановлений еще не было.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
