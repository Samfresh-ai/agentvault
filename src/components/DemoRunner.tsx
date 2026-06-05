"use client";

import { useState } from "react";
import useSWR from "swr";
import { FileBadge, Play, RotateCcw } from "lucide-react";
import { AuditLogTable } from "@/components/AuditLogTable";
import { ScopeViolationAlert } from "@/components/ScopeViolationAlert";
import type { DemoState, DemoStepResult } from "@/lib/client-types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STEPS = [
  "OrchestratorAgent analyzes task",
  "Issue credentials to BudgetAgent and VendorAgent",
  "BudgetAgent verifies budget availability",
  "VendorAgent attempts $60,000 PO",
  "CFO revokes VendorAgent credential",
  "VendorAgent attempts action after revocation",
];

export function DemoRunner() {
  const { mutate } = useSWR<DemoState>("/api/demo/state", fetcher, { refreshInterval: 2000 });
  const [completed, setCompleted] = useState(0);
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, DemoStepResult>>({});
  const [error, setError] = useState<string | null>(null);

  async function runStep(step: number) {
    setLoadingStep(step);
    setError(null);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const response = await fetch("/api/demo/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
    const data = await response.json();
    setLoadingStep(null);

    if (!response.ok) {
      setError(data.error ?? "Demo step failed");
      return;
    }

    setResults((current) => ({ ...current, [step]: data }));
    setCompleted((current) => Math.max(current, step));
    await mutate();
  }

  async function reset() {
    setLoadingStep(0);
    setError(null);
    await fetch("/api/demo/reset", { method: "POST" });
    setResults({});
    setCompleted(0);
    setLoadingStep(null);
    await mutate();
  }

  return (
    <div className="space-y-8">
      <section className="border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Scenario Context</p>
        <p className="mt-3 max-w-4xl text-lg text-zinc-200">
          CFO delegates procurement of 50 laptops with a hard $50,000 ceiling. AgentVault proves that BudgetAgent can
          read and verify funds, VendorAgent can create an in-scope PO, and every over-cap or revoked action is rejected
          with a signed audit event.
        </p>
      </section>

      {error ? <div className="border border-red-700 bg-red-950/40 p-4 text-red-200">{error}</div> : null}

      <div className="space-y-4">
        {STEPS.map((title, index) => {
          const step = index + 1;
          const result = results[step];
          const disabled = loadingStep !== null || step > completed + 1;

          return (
            <article
              key={step}
              className={`border bg-black p-5 transition-opacity ${
                step <= completed + 1 ? "border-zinc-700 opacity-100" : "border-zinc-900 opacity-50"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div>
                  <p className="font-mono text-xs text-zinc-500">STEP {step}</p>
                  <h2 className="mt-1 text-xl font-semibold text-zinc-50">{title}</h2>
                </div>
                <button
                  className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 border border-cyan-500/70 px-4 font-semibold text-cyan-100 hover:bg-cyan-950 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600 sm:w-auto"
                  disabled={disabled}
                  onClick={() => runStep(step)}
                  type="button"
                >
                  <Play size={16} />
                  {loadingStep === step ? "Processing..." : "Run"}
                </button>
              </div>

              {result ? <StepResult result={result} /> : null}
            </article>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          className="inline-flex h-11 items-center gap-2 border border-zinc-700 px-4 font-semibold text-zinc-100 hover:border-amber-400"
          onClick={reset}
          type="button"
        >
          <RotateCcw size={16} />
          Reset Demo
        </button>
      </div>

      <section>
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Live Feed</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Audit Trail</h2>
        </div>
        <AuditLogTable compact />
      </section>
    </div>
  );
}

function StepResult({ result }: { result: DemoStepResult }) {
  if (result.outcome === "REJECTED") {
    return (
      <div className="mt-5 animate-[fadeIn_180ms_ease-out]">
        <ScopeViolationAlert result={result} />
      </div>
    );
  }

  return (
    <div className="mt-5 animate-[fadeIn_180ms_ease-out] border-l-4 border-emerald-500 bg-emerald-950/20 p-4">
      <p className="font-mono text-sm font-semibold text-emerald-300">{result.outcome}</p>
      <p className="mt-2 text-zinc-200">{result.title}</p>
      {result.reasoning ? (
        <pre className="mt-4 max-h-[280px] overflow-auto border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">
          {JSON.stringify(result.reasoning, null, 2)}
        </pre>
      ) : null}
      {result.delegations ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {result.delegations.map((delegation) => (
            <CredentialCard key={delegation.id} delegation={delegation} />
          ))}
        </div>
      ) : null}
      {result.revocation ? (
        <pre className="mt-4 max-h-[240px] overflow-auto border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">
          {JSON.stringify(result.revocation, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function CredentialCard({ delegation }: { delegation: NonNullable<DemoStepResult["delegations"]>[number] }) {
  return (
    <section className="border border-cyan-500/50 bg-cyan-950/15 p-4 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.12)]">
      <div className="flex items-start justify-between gap-4 border-b border-cyan-400/20 pb-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200/70">Signed delegation credential</p>
          <h3 className="mt-2 text-lg font-semibold text-cyan-50">{delegation.delegateName ?? delegation.delegateId}</h3>
        </div>
        <FileBadge className="text-cyan-200" size={26} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Allowed actions</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {delegation.allowedActions.map((action) => (
              <span className="border border-cyan-500/40 bg-black px-2 py-1 font-mono text-xs text-cyan-100" key={action}>
                {action}
              </span>
            ))}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Max value</dt>
            <dd className="mt-1 font-mono text-zinc-50">{formatCurrency(delegation.maxValue)}</dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Expires</dt>
            <dd className="mt-1 font-mono text-xs text-zinc-300">{new Date(delegation.expiresAt).toLocaleString()}</dd>
          </div>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Credential ID</dt>
          <dd className="mt-1 break-all font-mono text-xs text-zinc-400">
            {String(delegation.credential.credentialId ?? delegation.id)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
