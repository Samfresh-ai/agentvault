"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { AgentView, AuditLogView, DemoState } from "@/lib/client-types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AuditLogTable({ compact = false }: { compact?: boolean }) {
  const [agentId, setAgentId] = useState("");
  const [outcome, setOutcome] = useState("");
  const { data: state } = useSWR<DemoState>("/api/demo/state", fetcher, { refreshInterval: 2000 });

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: compact ? "10" : "50" });
    if (agentId) params.set("agentId", agentId);
    if (outcome) params.set("outcome", outcome);
    return `/api/audit/logs?${params.toString()}`;
  }, [agentId, compact, outcome]);

  const { data, error, isLoading } = useSWR<{ logs: AuditLogView[]; total: number }>(url, fetcher, {
    refreshInterval: 2000,
  });

  const agents = state?.agents ?? [];

  return (
    <div className="space-y-4">
      {!compact ? (
        <FilterBar
          agents={agents}
          agentId={agentId}
          outcome={outcome}
          setAgentId={setAgentId}
          setOutcome={setOutcome}
        />
      ) : null}

      <div className="overflow-x-auto border border-zinc-800 bg-zinc-950">
        <table className="min-w-[1050px] w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-[0.16em] text-zinc-500">
            <tr>
              <th className="w-[190px] px-4 py-3">Timestamp</th>
              <th className="w-[150px] px-4 py-3">Agent</th>
              <th className="px-4 py-3">Action</th>
              <th className="w-[120px] px-4 py-3">Outcome</th>
              <th className="w-[210px] px-4 py-3">Reason</th>
              <th className="w-[190px] px-4 py-3">Signature</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={6}>
                  Loading audit events...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-4 py-6 text-red-300" colSpan={6}>
                  Audit log failed to load.
                </td>
              </tr>
            ) : data?.logs.length ? (
              data.logs.map((log) => <AuditRow key={log.id} log={log} />)
            ) : (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={6}>
                  No audit events yet. Run the demo scenario to generate logs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterBar({
  agents,
  agentId,
  outcome,
  setAgentId,
  setOutcome,
}: {
  agents: AgentView[];
  agentId: string;
  outcome: string;
  setAgentId: (value: string) => void;
  setOutcome: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-zinc-800 bg-black p-4">
      <select
        className="h-10 border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none"
        value={agentId}
        onChange={(event) => setAgentId(event.target.value)}
      >
        <option value="">All Agents</option>
        {agents.map((agent) => (
          <option value={agent.id} key={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>

      <select
        className="h-10 border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none"
        value={outcome}
        onChange={(event) => setOutcome(event.target.value)}
      >
        <option value="">All Outcomes</option>
        <option value="SUCCESS">SUCCESS</option>
        <option value="REJECTED">REJECTED</option>
        <option value="REVOKED">REVOKED</option>
      </select>

      <button
        className="h-10 border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 hover:border-cyan-400"
        onClick={() => {
          setAgentId("");
          setOutcome("");
        }}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}

function AuditRow({ log }: { log: AuditLogView }) {
  const outcomeClass =
    log.outcome === "SUCCESS"
      ? "border-emerald-500/60 text-emerald-300"
      : log.outcome === "REVOKED"
        ? "border-amber-500/60 text-amber-300"
        : "border-red-500/60 text-red-300";

  return (
    <tr className="animate-[auditPulse_1400ms_ease-out] border-t border-zinc-800 text-zinc-200">
      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{new Date(log.createdAt).toLocaleString()}</td>
      <td className="px-4 py-3">{log.agentName}</td>
      <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
      <td className="px-4 py-3">
        <span className={`border px-2 py-1 text-xs font-semibold ${outcomeClass}`}>{log.outcome}</span>
      </td>
      <td className="px-4 py-3 text-zinc-400">{log.reason ?? "-"}</td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-500" title={log.signature}>
        {log.signature.slice(0, 18)}...{log.signature.slice(-8)}
      </td>
    </tr>
  );
}
