import { ShieldCheck, ShieldOff } from "lucide-react";
import type { AgentView, DelegationView } from "@/lib/client-types";

function truncate(value: string) {
  return `${value.slice(0, 18)}...${value.slice(-6)}`;
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "border-emerald-500/60 text-emerald-300";
  if (status === "REVOKED") return "border-red-500/60 text-red-300";
  return "border-amber-500/60 text-amber-300";
}

export function AgentCard({ agent, delegation }: { agent: AgentView; delegation?: DelegationView }) {
  const Icon = agent.status === "ACTIVE" ? ShieldCheck : ShieldOff;

  return (
    <article className="min-h-[190px] border border-zinc-700 bg-zinc-950 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{agent.role.replace("_", " ")}</p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-50">{agent.name}</h3>
        </div>
        <span className={`inline-flex items-center gap-2 border px-2.5 py-1 text-xs font-semibold ${statusClass(agent.status)}`}>
          <Icon size={14} />
          {agent.status}
        </span>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-zinc-500">T3 DID</dt>
          <dd className="mt-1 font-mono text-zinc-300" title={agent.t3DID}>
            {truncate(agent.t3DID)}
          </dd>
        </div>
        {delegation ? (
          <>
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-zinc-500">Scope</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {delegation.allowedActions.map((action) => (
                  <span key={action} className="border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200">
                    {action}
                  </span>
                ))}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-zinc-500">Max</dt>
                <dd className="mt-1 text-zinc-100">
                  {delegation.maxValue > 900000000 ? "Unlimited" : `$${delegation.maxValue.toLocaleString()}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-zinc-500">Credential</dt>
                <dd className={`mt-1 ${statusClass(delegation.status)}`}>{delegation.status}</dd>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-5 border-l-2 border-zinc-700 pl-3 text-sm text-zinc-400">Root identity. Issues scoped credentials.</p>
        )}
      </dl>
    </article>
  );
}
