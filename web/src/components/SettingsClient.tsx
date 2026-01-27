"use client";

import { useMemo, useState } from "react";
import type { AppSettings } from "@/lib/settingsStore";
import type { AppUser, UserRole } from "@/lib/usersStore";

type PreviewResult =
  | { ok: true; rendered: string }
  | { ok: false; error: string; rendered?: string };

export function SettingsClient(props: {
  initialSettings: AppSettings;
  initialUsers: AppUser[];
  usersError?: string | null;
}) {
  const [settings, setSettings] = useState<AppSettings>(props.initialSettings);
  const [users, setUsers] = useState<AppUser[]>(props.initialUsers);
  const usersError = props.usersError ?? null;
  const [saving, setSaving] = useState(false);
  const [dbStatus, setDbStatus] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [webhookResponse, setWebhookResponse] = useState<string | null>(null);
  const [webhookTestLoading, setWebhookTestLoading] = useState(false);
  const [dbTestStatus, setDbTestStatus] = useState<string | null>(null);
  const [dbTestLoading, setDbTestLoading] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [newUser, setNewUser] = useState({ name: "", email: "", role: "User" as UserRole });

  const placeholders = useMemo(
    () => ["{id}", "{w_id}", "{w_name}", "{w_version}", "{createdAt}", "{w_updatedAt}", "{w_json}"],
    [],
  );

  async function saveSettings(scope: "db" | "webhook") {
    setSaving(true);
    if (scope === "db") setDbStatus(null);
    if (scope === "webhook") setWebhookStatus(null);
    try {
      const res = await fetch("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      if (scope === "db") setDbStatus("Saved");
      if (scope === "webhook") setWebhookStatus("Saved");
    } catch (err) {
      if (scope === "db") setDbStatus(err instanceof Error ? err.message : String(err));
      if (scope === "webhook") setWebhookStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function testDb() {
    setDbTestLoading(true);
    setDbTestStatus(null);
    try {
      const res = await fetch("/api/settings/test-db", {
        method: "POST",
        body: JSON.stringify({ db: settings.db }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Connection failed");
      setDbTestStatus("Connection OK");
    } catch (err) {
      setDbTestStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setDbTestLoading(false);
    }
  }

  async function runPreview() {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/settings/preview", {
        method: "POST",
        body: JSON.stringify({ versionId: previewId.trim(), template: settings.webhook.template }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPreview({ ok: false, error: data.error ?? "Preview failed", rendered: data.rendered });
      } else {
        setPreview({ ok: true, rendered: data.rendered });
      }
    } catch (err) {
      setPreview({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendTestWebhook() {
    if (!previewId) {
      setWebhookStatus("Enter a version ID to send a test webhook.");
      return;
    }
    setWebhookTestLoading(true);
    setWebhookStatus(null);
    setWebhookResponse(null);
    try {
      const res = await fetch("/api/settings/test-webhook", {
        method: "POST",
        body: JSON.stringify({ versionId: previewId.trim() }),
      });
      const data = await res.json();
      const status = typeof data.status === "number" ? data.status : res.status;
      if (typeof data.body === "string" && data.body.trim()) {
        setWebhookResponse(data.body);
      }
      if (!res.ok) {
        setWebhookStatus(data.error ?? `Failed to send webhook (${status})`);
        return;
      }
      if (!data.ok) {
        setWebhookStatus(data.error ?? `Webhook failed (${status})`);
        return;
      }
      setWebhookStatus(`Webhook OK (${status})`);
    } catch (err) {
      setWebhookStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setWebhookTestLoading(false);
    }
  }

  async function addUser() {
    if (!newUser.name || !newUser.email) return;
    const res = await fetch("/api/users", {
      method: "POST",
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setUsers((prev) => [data.user, ...prev]);
      setNewUser({ name: "", email: "", role: "User" });
    }
  }

  async function updateRole(id: string, role: UserRole) {
    await fetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  async function removeUser(id: string) {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-400">Configuration</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Settings</h1>
        <p className="text-sm text-zinc-500">
          Settings are saved to <code className="bg-zinc-100 px-1.5 py-0.5">.data/settings.json</code> and used when calling the
          webhook.
        </p>
      </div>

      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Database access</h2>
        <p className="text-xs text-zinc-500">
          Connection settings are stored locally and used to connect to PostgreSQL for users and metadata.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Host</span>
            <input
              value={settings.db.host}
              onChange={(e) => setSettings((s) => ({ ...s, db: { ...s.db, host: e.target.value } }))}
              className="form-field h-10"
              placeholder="db.example.com"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Port</span>
            <input
              value={settings.db.port}
              onChange={(e) => setSettings((s) => ({ ...s, db: { ...s.db, port: e.target.value } }))}
              className="form-field h-10"
              placeholder="5432"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Database name</span>
            <input
              value={settings.db.database}
              onChange={(e) => setSettings((s) => ({ ...s, db: { ...s.db, database: e.target.value } }))}
              className="form-field h-10"
              placeholder="n8n"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">User</span>
            <input
              value={settings.db.user}
              onChange={(e) => setSettings((s) => ({ ...s, db: { ...s.db, user: e.target.value } }))}
              className="form-field h-10"
              placeholder="n8n_reader"
            />
          </label>
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-zinc-700">Password</span>
            <input
              type="password"
              value={settings.db.password}
              onChange={(e) => setSettings((s) => ({ ...s, db: { ...s.db, password: e.target.value } }))}
              className="form-field h-10"
              placeholder="••••••••"
            />
          </label>
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-zinc-700">SSL mode</span>
            <select
              value={settings.db.sslMode}
              onChange={(e) =>
                setSettings((s) => ({ ...s, db: { ...s.db, sslMode: e.target.value as AppSettings["db"]["sslMode"] } }))
              }
              className="form-field h-10"
            >
              <option>disable</option>
              <option>require</option>
              <option>verify-full</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
            onClick={() => saveSettings("db")}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save database settings"}
          </button>
          <button
            className="button-secondary h-10 px-4 text-sm"
            onClick={testDb}
            disabled={dbTestLoading}
          >
            {dbTestLoading ? "Testing…" : "Test connection"}
          </button>
          {dbTestStatus ? <div className="text-xs text-zinc-500">{dbTestStatus}</div> : null}
          {dbStatus ? <div className="text-xs text-zinc-500">{dbStatus}</div> : null}
        </div>
      </section>

      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Webhook configuration</h2>
        <p className="text-xs text-zinc-500">
          Define webhook URL and payload template. Placeholders are replaced at request time.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-zinc-700">Webhook URL</span>
            <input
              value={settings.webhook.url}
              onChange={(e) => setSettings((s) => ({ ...s, webhook: { ...s.webhook, url: e.target.value } }))}
              className="form-field h-10"
              placeholder="https://n8n.example.com/webhook/restore"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">HTTP method</span>
            <select
              value={settings.webhook.method}
              onChange={(e) => setSettings((s) => ({ ...s, webhook: { ...s.webhook, method: e.target.value as AppSettings["webhook"]["method"] } }))}
              className="form-field h-10"
            >
              <option>POST</option>
              <option>PUT</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Content type</span>
            <select
              value={settings.webhook.contentType}
              onChange={(e) =>
                setSettings((s) => ({ ...s, webhook: { ...s.webhook, contentType: e.target.value as AppSettings["webhook"]["contentType"] } }))
              }
              className="form-field h-10"
            >
              <option>application/json</option>
              <option>application/x-www-form-urlencoded</option>
            </select>
          </label>
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-zinc-700">Payload template (JSON)</span>
            <textarea
              value={settings.webhook.template}
              onChange={(e) => setSettings((s) => ({ ...s, webhook: { ...s.webhook, template: e.target.value } }))}
              className="form-textarea min-h-40"
            />
          </label>
        </div>

        <div className="mt-4 border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-600">
          Available placeholders: {placeholders.join(", ")}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[200px_1fr]">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Preview version ID or UUID</span>
            <input
              value={previewId}
              onChange={(e) => setPreviewId(e.target.value)}
              className="form-field h-10"
              placeholder="e.g. 2 or 26c95746-a0b5-49b0-9890-3d3c1d7f57bf"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
              onClick={runPreview}
              disabled={previewLoading}
            >
              {previewLoading ? "Previewing…" : "Preview payload"}
            </button>
            <button
              className="button-secondary h-10 px-4 text-sm"
              onClick={sendTestWebhook}
              disabled={webhookTestLoading}
            >
              {webhookTestLoading ? "Sending…" : "Send test webhook"}
            </button>
            <button
              className="button-secondary h-10 px-4 text-sm"
              onClick={() => saveSettings("webhook")}
              disabled={saving}
            >
              Save webhook settings
            </button>
          </div>
        </div>

        {preview ? (
          <div className="mt-4 border border-zinc-100 bg-white p-4 text-xs">
            {preview.ok ? (
              <pre className="max-h-64 overflow-auto bg-zinc-950 p-3 text-zinc-100">{preview.rendered}</pre>
            ) : (
              <div className="text-red-700">
                {preview.error}
                {preview.rendered ? (
                  <pre className="mt-2 max-h-64 overflow-auto bg-zinc-950 p-3 text-zinc-100">{preview.rendered}</pre>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
        {webhookStatus ? <div className="mt-3 text-xs text-zinc-500">{webhookStatus}</div> : null}
        {webhookResponse ? (
          <div className="mt-3 border border-zinc-100 bg-white p-4 text-xs">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">Response body</div>
            <pre className="max-h-64 overflow-auto bg-zinc-950 p-3 text-zinc-100">{webhookResponse}</pre>
          </div>
        ) : null}
      </section>

      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">User management</h2>
            <p className="text-xs text-zinc-500">Admins can add/remove users and change roles.</p>
          </div>
          <div className="text-xs text-zinc-500">
            Role permissions: <span className="font-medium text-zinc-700">Admin</span> = manage users;{" "}
            <span className="font-medium text-zinc-700">User</span> = manage versions only.
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Name</span>
            <input
              value={newUser.name}
              onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
              className="form-field h-10"
              placeholder="Alex Kim"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Email</span>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
              className="form-field h-10"
              placeholder="alex@company.com"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Role</span>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as UserRole }))}
              className="form-field h-10"
            >
              <option>User</option>
              <option>Admin</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]" onClick={addUser}>
            Add user
          </button>
          <button className="button-secondary h-10 px-4 text-sm">
            Invite by email
          </button>
        </div>

        <div className="mt-5 border border-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersError ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-red-700" colSpan={5}>
                    {usersError}
                  </td>
                </tr>
              ) : null}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-[#1a2545]">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="form-field h-8 px-2 text-xs"
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                    >
                      <option>Admin</option>
                      <option>User</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{u.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="button-secondary h-8 px-2 text-xs">Reset</button>
                      <button
                        className="h-8 border border-red-200 bg-red-50 px-2 text-xs text-red-700 hover:bg-red-100"
                        onClick={() => removeUser(u.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={5}>
                    No users yet.
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

