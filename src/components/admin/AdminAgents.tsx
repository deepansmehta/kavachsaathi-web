"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type AgentRow = {
  id: string;
  agentCode: string;
  name: string;
  phone: string;
  company: string;
  city: string;
  status: "pending" | "approved";
  email: string;
};

/** Admin · Agent Connect approvals — calls /api/admin/agents. */
export function AdminAgents({ getToken }: { getToken: () => Promise<string> }) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getToken();
      const res = await fetch("/api/admin/agents", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load agents");
        return;
      }
      setAgents(data.agents || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (agentId: string, action: "approve" | "reject" | "suspend") => {
    setBusyId(agentId);
    try {
      const t = await getToken();
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, agentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }
      toast.success(`Agent ${action}d`);
      await load();
    } catch {
      toast.error("Network error");
    } finally {
      setBusyId(null);
    }
  };

  const pending = agents.filter((a) => a.status === "pending");
  const approved = agents.filter((a) => a.status === "approved");

  return (
    <div className="rounded-2xl border border-[var(--gold-border)] bg-[var(--kavach-s1)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-rajdhani text-xl font-bold text-[var(--gold)]">
          Agents — Agent Connect
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-[var(--gold)] underline"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--text-soft)]">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">No agent registrations yet.</p>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 ? (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-amber-300">
                Pending ({pending.length})
              </p>
              <div className="space-y-2">
                {pending.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--gold-border)] p-3 text-sm"
                  >
                    <div>
                      <p className="font-mono text-[var(--gold)]">{a.agentCode}</p>
                      <p className="text-white">{a.name} · {a.company}</p>
                      <p className="text-xs text-[var(--text-soft)]">
                        {a.phone} · {a.city} · {a.email}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => void act(a.id, "approve")}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => void act(a.id, "reject")}
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {approved.length > 0 ? (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-emerald-300">
                Approved ({approved.length})
              </p>
              <div className="space-y-2">
                {approved.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--gold-border)] p-3 text-sm"
                  >
                    <div>
                      <p className="font-mono text-[var(--gold)]">{a.agentCode}</p>
                      <p className="text-white">{a.name} · {a.company}</p>
                      <p className="text-xs text-[var(--text-soft)]">{a.phone} · {a.city}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => void act(a.id, "suspend")}
                      className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200"
                    >
                      Suspend
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
