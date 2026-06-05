"use client";

import useSWR from "swr";
import Link from "next/link";
import { Activity, ArrowRight, RotateCw } from "lucide-react";
import { AgentCard } from "@/components/AgentCard";
import type { DemoState } from "@/lib/client-types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DelegationTree() {
  const { data, error, isLoading } = useSWR<DemoState>("/api/demo/state", fetcher, { refreshInterval: 2000 });

  if (isLoading) {
    return <div className="border border-zinc-800 bg-zinc-950 p-6 text-zinc-400">Loading AgentVault state...</div>;
  }

  if (error || !data) {
    return <div className="border border-red-800 bg-red-950/40 p-6 text-red-200">AgentVault state failed to load.</div>;
  }

  const orchestrator = data.agents.find((agent) => agent.name === "OrchestratorAgent");
  const budget = data.agents.find((agent) => agent.name === "BudgetAgent");
  const vendor = data.agents.find((agent) => agent.name === "VendorAgent");
  const budgetDelegation = data.delegations.find((delegation) => delegation.delegateId === budget?.id);
  const vendorDelegation = data.delegations.find((delegation) => delegation.delegateId === vendor?.id);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Active Agents" value={data.stats.activeAgents} />
        <Stat label="Active Delegations" value={data.stats.activeDelegations} />
        <Stat label="Total Audit Events" value={data.stats.totalAuditEvents} />
      </section>

      <section className="border border-zinc-800 bg-black p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Delegation Tree</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">CFO procurement authority split into scoped agents</h2>
            <p className="mt-3 max-w-3xl text-sm text-zinc-400">
              Each sub-agent operates exclusively within its credential scope. Actions outside scope are rejected and
              logged before execution.
            </p>
          </div>
          <Activity className="text-cyan-300" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_120px_1fr_1fr] xl:items-center">
          {orchestrator ? <AgentCard agent={orchestrator} /> : null}
          <div className="flex h-full items-center justify-center text-cyan-300 max-xl:rotate-90">
            <ArrowRight size={42} />
          </div>
          {budget ? <AgentCard agent={budget} delegation={budgetDelegation} /> : null}
          {vendor ? <AgentCard agent={vendor} delegation={vendorDelegation} /> : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <Link className="group border border-cyan-500/60 bg-cyan-950/30 p-5 text-cyan-100 hover:bg-cyan-900/30" href="/demo">
          <span className="flex items-center justify-between text-lg font-semibold">
            Run Demo Scenario
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </span>
          <span className="mt-2 block text-sm text-cyan-200/70">Step through the over-cap rejection and revocation proof.</span>
        </Link>
        <Link className="group border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 hover:border-amber-400/60" href="/audit">
          <span className="flex items-center justify-between text-lg font-semibold">
            View Audit Trail
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </span>
          <span className="mt-2 block text-sm text-zinc-400">Inspect signed append-only agent events.</span>
        </Link>
      </section>

      <section className="border border-zinc-800 bg-zinc-950 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-zinc-500">
          <RotateCw size={15} />
          Live Event Ticker
        </div>
        <div className="space-y-2">
          {data.recentLogs.length === 0 ? (
            <p className="text-zinc-500">No audit events yet. Run the demo scenario to generate logs.</p>
          ) : (
            data.recentLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="grid gap-2 border-t border-zinc-800 py-2 text-sm md:grid-cols-[180px_1fr_120px]">
                <span className="font-mono text-zinc-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                <span className="text-zinc-200">
                  {log.agentName} / {log.action}
                </span>
                <span className={log.outcome === "SUCCESS" ? "text-emerald-300" : "text-red-300"}>{log.outcome}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-4xl text-zinc-50">{value}</p>
    </div>
  );
}
