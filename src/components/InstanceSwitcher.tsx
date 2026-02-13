"use client";

import { useState, useEffect } from "react";

type Instance = {
  id: string;
  name: string;
  slug: string;
  role: "Admin" | "User";
};

type InstanceSwitcherProps = {
  instances: Instance[];
  currentInstanceId: string | null;
  isSuperAdmin?: boolean;
};

export function InstanceSwitcher({ instances, currentInstanceId, isSuperAdmin }: InstanceSwitcherProps) {
  const [selected, setSelected] = useState(currentInstanceId || instances[0]?.id || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentInstanceId) {
      setSelected(currentInstanceId);
    }
  }, [currentInstanceId]);

  // Don't show switcher if only one instance and not superadmin
  if (instances.length <= 1 && !isSuperAdmin) {
    return null;
  }

  async function handleChange(instanceId: string) {
    if (instanceId === selected) return;
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/instances/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });
      
      if (response.ok) {
        setSelected(instanceId);
        // Reload to refresh all data for new instance
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to switch instance:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const currentInstance = instances.find((i) => i.id === selected);

  return (
    <div className="border-b border-white/10 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Instance</div>
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isLoading}
          className="w-full appearance-none bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-1 focus:ring-[#ff4d7e] disabled:opacity-50"
        >
          {instances.map((instance) => (
            <option key={instance.id} value={instance.id} className="bg-zinc-900 text-white">
              {instance.name}
              {instance.role === "Admin" ? " (Admin)" : ""}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/40">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
      {currentInstance && (
        <div className="mt-1 text-xs text-white/40">
          Role: {isSuperAdmin ? "SuperAdmin" : currentInstance.role}
        </div>
      )}
    </div>
  );
}
