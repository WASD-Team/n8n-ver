"use client";

import { useMemo, useState } from "react";
import type { AppSettings } from "@/lib/settingsStore";
import type { AppUser, UserRole } from "@/lib/usersStore";

type PreviewResult =
  | { ok: true; rendered: string }
  | { ok: false; error: string; rendered?: string };

type Instance = {
  id: string;
  name: string;
  slug: string;
  role: "Admin" | "User";
};

type InstanceMember = {
  userId: string;
  email: string;
  name: string;
  role: "Admin" | "User";
};

export function SettingsClient(props: {
  initialSettings: AppSettings;
  initialUsers: AppUser[];
  usersError?: string | null;
  isSuperAdmin?: boolean;
  instances?: Instance[];
  currentInstanceId?: string | null;
}) {
  const [settings, setSettings] = useState<AppSettings>(props.initialSettings);
  const [users, setUsers] = useState<AppUser[]>(props.initialUsers);
  const [instances, setInstances] = useState<Instance[]>(props.instances ?? []);
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
  
  // Instance management state
  const [newInstance, setNewInstance] = useState({ name: "", slug: "" });
  const [instanceStatus, setInstanceStatus] = useState<string | null>(null);
  const [editingInstance, setEditingInstance] = useState<string | null>(null);
  const [editInstanceData, setEditInstanceData] = useState({ name: "", slug: "" });
  const [instanceMembers, setInstanceMembers] = useState<Record<string, InstanceMember[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);
  const [newMember, setNewMember] = useState<{ instanceId: string; userId: string; role: "Admin" | "User" } | null>(null);

  // Settings instance selector - which instance's settings we're editing
  const [settingsInstanceId, setSettingsInstanceId] = useState<string>(props.currentInstanceId ?? instances[0]?.id ?? "");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsCache, setSettingsCache] = useState<Record<string, AppSettings>>({
    [props.currentInstanceId ?? ""]: props.initialSettings,
  });

  const currentInstance = instances.find((i) => i.id === props.currentInstanceId);
  const settingsInstance = instances.find((i) => i.id === settingsInstanceId);

  // Load settings for a specific instance
  async function loadSettingsForInstance(instanceId: string) {
    // Check cache first
    if (settingsCache[instanceId]) {
      setSettings(settingsCache[instanceId]);
      setSettingsInstanceId(instanceId);
      return;
    }
    
    setLoadingSettings(true);
    try {
      const res = await fetch(`/api/settings?instanceId=${instanceId}`);
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        setSettingsCache((prev) => ({ ...prev, [instanceId]: data.settings }));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
    }
    setSettingsInstanceId(instanceId);
  }

  const placeholders = useMemo(
    () => ["{id}", "{w_id}", "{w_name}", "{w_version}", "{createdAt}", "{w_updatedAt}", "{w_json}"],
    [],
  );

  // ========== Settings Functions ==========
  async function saveSettings(scope: "db" | "webhook") {
    setSaving(true);
    if (scope === "db") setDbStatus(null);
    if (scope === "webhook") setWebhookStatus(null);
    try {
      const res = await fetch(`/api/settings?instanceId=${settingsInstanceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      const text = await res.text();
      if (!text) throw new Error(`Server returned empty response (status ${res.status})`);
      
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      
      // Update cache
      setSettingsCache((prev) => ({ ...prev, [settingsInstanceId]: settings }));
      
      if (scope === "db") setDbStatus("Saved");
      if (scope === "webhook") setWebhookStatus("Saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (scope === "db") setDbStatus(msg);
      if (scope === "webhook") setWebhookStatus(msg);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db: settings.db }),
      });
      
      const text = await res.text();
      if (!text) throw new Error(`Server returned empty response (status ${res.status})`);
      
      const data = JSON.parse(text);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: previewId.trim(), template: settings.webhook.template }),
      });
      
      const text = await res.text();
      if (!text) throw new Error(`Server returned empty response (status ${res.status})`);
      
      const data = JSON.parse(text);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: previewId.trim() }),
      });
      
      const text = await res.text();
      if (!text) throw new Error(`Server returned empty response (status ${res.status})`);
      
      const data = JSON.parse(text);
      const status = typeof data.status === "number" ? data.status : res.status;
      if (typeof data.body === "string" && data.body.trim()) {
        setWebhookResponse(data.body);
      }
      if (!res.ok || !data.ok) {
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

  // ========== User Functions ==========
  async function addUser() {
    if (!newUser.name || !newUser.email) return;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      
      const text = await res.text();
      if (!text) return;
      
      const data = JSON.parse(text);
      if (res.ok && data.user) {
        setUsers((prev) => [data.user, ...prev]);
        setNewUser({ name: "", email: "", role: "User" });
      }
    } catch (err) {
      console.error("Add user error:", err);
    }
  }

  async function updateRole(id: string, role: UserRole) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  async function toggleSuperAdmin(id: string, isSuperAdmin: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSuperAdmin }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isSuperAdmin } : u)));
    }
  }

  async function removeUser(id: string) {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  async function resetPassword(id: string) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "Invited" as const } : u)));
    }
  }

  async function generateInviteLink(userId: string, userEmail: string) {
    try {
      const res = await fetch(`/api/users/${userId}/invite`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to generate invite link");
      }
      
      // Copy the invite URL to clipboard
      await navigator.clipboard.writeText(data.inviteUrl);
      
      // Show temporary success message
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('bg-green-50', 'border-green-200', 'text-green-700');
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('bg-green-50', 'border-green-200', 'text-green-700');
        }, 2000);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  // ========== Instance Functions ==========
  async function createInstance() {
    if (!newInstance.name || !newInstance.slug) {
      setInstanceStatus("Name and slug are required");
      return;
    }
    setInstanceStatus(null);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInstance),
      });
      const data = await res.json();
      if (!res.ok) {
        setInstanceStatus(data.error ?? "Failed to create instance");
        return;
      }
      setInstances((prev) => [...prev, { ...data.instance, role: "Admin" as const }]);
      setNewInstance({ name: "", slug: "" });
      setInstanceStatus("Instance created");
    } catch (err) {
      setInstanceStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function updateInstance(id: string) {
    try {
      const res = await fetch(`/api/instances/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editInstanceData),
      });
      const data = await res.json();
      if (!res.ok) {
        setInstanceStatus(data.error ?? "Failed to update instance");
        return;
      }
      setInstances((prev) =>
        prev.map((i) => (i.id === id ? { ...i, name: editInstanceData.name, slug: editInstanceData.slug } : i))
      );
      setEditingInstance(null);
      setInstanceStatus("Instance updated");
    } catch (err) {
      setInstanceStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteInstance(id: string) {
    if (!confirm("Are you sure you want to delete this instance?")) return;
    try {
      const res = await fetch(`/api/instances/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setInstanceStatus(data.error ?? "Failed to delete instance");
        return;
      }
      setInstances((prev) => prev.filter((i) => i.id !== id));
      setInstanceStatus("Instance deleted");
    } catch (err) {
      setInstanceStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadMembers(instanceId: string) {
    if (instanceMembers[instanceId]) return;
    setLoadingMembers(instanceId);
    try {
      const res = await fetch(`/api/instances/${instanceId}/members`);
      const data = await res.json();
      if (res.ok && data.members) {
        setInstanceMembers((prev) => ({ ...prev, [instanceId]: data.members }));
      }
    } catch (err) {
      console.error("Load members error:", err);
    } finally {
      setLoadingMembers(null);
    }
  }

  async function addMember(instanceId: string, userId: string, role: "Admin" | "User") {
    try {
      const res = await fetch(`/api/instances/${instanceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (res.ok) {
        // Reload members
        const membersRes = await fetch(`/api/instances/${instanceId}/members`);
        const membersData = await membersRes.json();
        if (membersRes.ok && membersData.members) {
          setInstanceMembers((prev) => ({ ...prev, [instanceId]: membersData.members }));
        }
        setNewMember(null);
      } else {
        setInstanceStatus(data.error ?? "Failed to add member");
      }
    } catch (err) {
      setInstanceStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function updateMemberRole(instanceId: string, userId: string, role: "Admin" | "User") {
    try {
      await fetch(`/api/instances/${instanceId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      setInstanceMembers((prev) => ({
        ...prev,
        [instanceId]: prev[instanceId]?.map((m) => (m.userId === userId ? { ...m, role } : m)) ?? [],
      }));
    } catch (err) {
      console.error("Update member role error:", err);
    }
  }

  async function removeMember(instanceId: string, userId: string) {
    try {
      await fetch(`/api/instances/${instanceId}/members?userId=${userId}`, { method: "DELETE" });
      setInstanceMembers((prev) => ({
        ...prev,
        [instanceId]: prev[instanceId]?.filter((m) => m.userId !== userId) ?? [],
      }));
    } catch (err) {
      console.error("Remove member error:", err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-400">Configuration</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Settings</h1>
        {currentInstance && (
          <p className="text-sm text-zinc-500">
            Settings for instance: <span className="font-medium text-[#1a2545]">{currentInstance.name}</span>
          </p>
        )}
      </div>

      {/* Instance Management Section */}
      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">n8n Instances</h2>
            <p className="text-xs text-zinc-500">
              Manage your n8n instances. Each instance has its own DB settings and webhook configuration.
            </p>
          </div>
        </div>

        {instanceStatus && (
          <div className="mt-3 text-xs text-zinc-600 bg-zinc-50 px-3 py-2 rounded">{instanceStatus}</div>
        )}

        {/* Create new instance - SuperAdmin only */}
        {props.isSuperAdmin && (
          <div className="mt-4 p-4 border border-dashed border-zinc-200 rounded">
            <div className="text-xs font-medium text-zinc-700 mb-3">Create new instance</div>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={newInstance.name}
                onChange={(e) => setNewInstance((n) => ({ ...n, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && createInstance()}
                className="form-field h-9 text-sm"
                placeholder="Instance name"
              />
              <input
                value={newInstance.slug}
                onChange={(e) => setNewInstance((n) => ({ ...n, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                onKeyDown={(e) => e.key === "Enter" && createInstance()}
                className="form-field h-9 text-sm"
                placeholder="slug (url-friendly)"
              />
              <button
                onClick={createInstance}
                className="h-9 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
              >
                Create Instance
              </button>
            </div>
          </div>
        )}

        {/* Instances list - click to select for settings */}
        <div className="mt-4 space-y-3">
          {instances.map((instance) => {
            const isSelected = instance.id === settingsInstanceId;
            const isCurrent = instance.id === props.currentInstanceId;
            
            return (
            <div
              key={instance.id}
              onClick={() => !editingInstance && loadSettingsForInstance(instance.id)}
              className={`border rounded p-4 cursor-pointer transition-all ${
                isSelected 
                  ? "border-[#ff4d7e] bg-pink-50/50 ring-1 ring-[#ff4d7e]" 
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {editingInstance === instance.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={editInstanceData.name}
                        onChange={(e) => setEditInstanceData((d) => ({ ...d, name: e.target.value }))}
                        className="form-field h-8 text-sm w-40"
                      />
                      <input
                        value={editInstanceData.slug}
                        onChange={(e) => setEditInstanceData((d) => ({ ...d, slug: e.target.value }))}
                        className="form-field h-8 text-sm w-32"
                      />
                      <button
                        onClick={() => updateInstance(instance.id)}
                        className="h-8 px-3 text-xs bg-[#ff4d7e] text-white hover:bg-[#f43b70]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingInstance(null)}
                        className="h-8 px-3 text-xs border border-zinc-200 hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#ff4d7e]" />
                        )}
                        <span className="font-medium text-[#1a2545]">{instance.name}</span>
                        <span className="text-xs text-zinc-400">({instance.slug})</span>
                        {isCurrent && (
                          <span className="inline-flex items-center rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                            Active
                          </span>
                        )}
                        {isSelected && (
                          <span className="inline-flex items-center rounded bg-[#ff4d7e] px-1.5 py-0.5 text-[10px] font-medium text-white">
                            Editing
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">Role: {instance.role}</span>
                    </>
                  )}
                </div>
                
                {(props.isSuperAdmin || instance.role === "Admin") && editingInstance !== instance.id && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => loadMembers(instance.id)}
                      className="h-7 px-2 text-xs border border-zinc-200 hover:bg-zinc-50"
                    >
                      {loadingMembers === instance.id ? "Loading..." : "Members"}
                    </button>
                    {props.isSuperAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setEditingInstance(instance.id);
                            setEditInstanceData({ name: instance.name, slug: instance.slug });
                          }}
                          className="h-7 px-2 text-xs border border-zinc-200 hover:bg-zinc-50"
                        >
                          Edit
                        </button>
                        {instance.id !== "default" && (
                          <button
                            onClick={() => deleteInstance(instance.id)}
                            className="h-7 px-2 text-xs border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Members section */}
              {instanceMembers[instance.id] && (
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <div className="text-xs font-medium text-zinc-700 mb-2">Members</div>
                  <div className="space-y-2">
                    {instanceMembers[instance.id].map((member) => (
                      <div key={member.userId} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-zinc-700">{member.name}</span>
                          <span className="ml-2 text-xs text-zinc-400">{member.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) => updateMemberRole(instance.id, member.userId, e.target.value as "Admin" | "User")}
                            className="form-field h-7 px-2 text-xs"
                          >
                            <option value="Admin">Admin</option>
                            <option value="User">User</option>
                          </select>
                          <button
                            onClick={() => removeMember(instance.id, member.userId)}
                            className="h-7 px-2 text-xs border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {instanceMembers[instance.id].length === 0 && (
                      <div className="text-xs text-zinc-400">No members assigned</div>
                    )}
                  </div>
                  
                  {/* Add member form */}
                  {newMember?.instanceId === instance.id ? (
                    <div className="mt-3 flex items-center gap-2">
                      <select
                        value={newMember.userId}
                        onChange={(e) => setNewMember((m) => m ? { ...m, userId: e.target.value } : null)}
                        className="form-field h-8 text-xs flex-1"
                      >
                        <option value="">Select user...</option>
                        {users
                          .filter((u) => !instanceMembers[instance.id]?.some((m) => m.userId === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                          ))}
                      </select>
                      <select
                        value={newMember.role}
                        onChange={(e) => setNewMember((m) => m ? { ...m, role: e.target.value as "Admin" | "User" } : null)}
                        className="form-field h-8 text-xs w-24"
                      >
                        <option value="User">User</option>
                        <option value="Admin">Admin</option>
                      </select>
                      <button
                        onClick={() => newMember.userId && addMember(instance.id, newMember.userId, newMember.role)}
                        className="h-8 px-3 text-xs bg-[#ff4d7e] text-white hover:bg-[#f43b70]"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setNewMember(null)}
                        className="h-8 px-3 text-xs border border-zinc-200 hover:bg-zinc-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewMember({ instanceId: instance.id, userId: "", role: "User" })}
                      className="mt-2 text-xs text-[#ff4d7e] hover:text-[#f43b70]"
                    >
                      + Add member
                    </button>
                  )}
                </div>
              )}
            </div>
          );
          })}
        </div>
      </section>

      {/* Database settings - for selected instance */}
      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">
          Database access
          {settingsInstance && (
            <span className="ml-2 font-normal text-[#ff4d7e]">— {settingsInstance.name}</span>
          )}
          {loadingSettings && <span className="ml-2 font-normal text-zinc-400 text-xs">Loading...</span>}
        </h2>
        <p className="text-xs text-zinc-500">
          Connection settings for the n8n versions database. Select an instance above to configure.
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

      {/* Webhook settings - linked to selected instance */}
      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">
          Webhook configuration
          {settingsInstance && <span className="font-normal text-zinc-400 ml-2">for {settingsInstance.name}</span>}
        </h2>
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
              onKeyDown={(e) => e.key === "Enter" && runPreview()}
              className="form-field h-10"
              placeholder="e.g. 2 or uuid"
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

      {/* User management */}
      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">User management</h2>
            <p className="text-xs text-zinc-500">Admins can add/remove users and change roles.</p>
          </div>
          <div className="text-xs text-zinc-500">
            <span className="font-medium text-purple-700">SuperAdmin</span> = manage all instances;{" "}
            <span className="font-medium text-zinc-700">Admin</span> = manage users;{" "}
            <span className="font-medium text-zinc-700">User</span> = manage versions only.
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Name</span>
            <input
              value={newUser.name}
              onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addUser()}
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
              onKeyDown={(e) => e.key === "Enter" && addUser()}
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
        </div>

        <div className="mt-5 border border-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                {props.isSuperAdmin && <th className="px-4 py-3">SuperAdmin</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersError ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-red-700" colSpan={props.isSuperAdmin ? 6 : 5}>
                    {usersError}
                  </td>
                </tr>
              ) : null}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-[#1a2545]">
                    {u.name}
                    {u.isSuperAdmin && (
                      <span className="ml-2 inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                        SuperAdmin
                      </span>
                    )}
                  </td>
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
                  {props.isSuperAdmin && (
                    <td className="px-4 py-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={u.isSuperAdmin}
                          onChange={(e) => toggleSuperAdmin(u.id, e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300 text-[#ff4d7e] focus:ring-[#ff4d7e]"
                        />
                        <span className="text-xs text-zinc-600">
                          {u.isSuperAdmin ? "Yes" : "No"}
                        </span>
                      </label>
                    </td>
                  )}
                  <td className="px-4 py-3 text-zinc-600">{u.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {u.status === "Invited" ? (
                        <button
                          className="h-8 border border-blue-200 bg-blue-50 px-2 text-xs text-blue-700 hover:bg-blue-100"
                          onClick={() => generateInviteLink(u.id, u.email)}
                          title="Generate and copy one-time invite link (expires in 72 hours)"
                        >
                          Copy invite link
                        </button>
                      ) : (
                        <button
                          className="h-8 border border-amber-200 bg-amber-50 px-2 text-xs text-amber-700 hover:bg-amber-100"
                          onClick={() => resetPassword(u.id)}
                          title="Reset password - user will need to set a new password on next login"
                        >
                          Reset password
                        </button>
                      )}
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
              {users.length === 0 && !usersError ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={props.isSuperAdmin ? 6 : 5}>
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
