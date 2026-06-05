import { Ban, XCircle } from "lucide-react";
import type { DemoStepResult } from "@/lib/client-types";

export function ScopeViolationAlert({ result }: { result: DemoStepResult }) {
  const requested = formatCurrency(result.attemptedValue ?? 0);
  const cap = formatCurrency(result.scope?.maxValue ?? 0);
  const over = formatCurrency(Math.max((result.attemptedValue ?? 0) - (result.scope?.maxValue ?? 0), 0));
  const revokedAt = result.scope?.revokedAt ? new Date(result.scope.revokedAt).toLocaleString() : "unknown";

  return (
    <div className="border-l-4 border-red-500 bg-red-950/40 p-5 text-red-100 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.22)]">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          {result.reason === "CREDENTIAL_REVOKED" ? <XCircle size={22} /> : <Ban size={22} />}
          <div>
            <p className="font-mono text-sm font-semibold">Agent cannot act</p>
            <p className="mt-1 text-sm text-red-100/80">{result.title}</p>
          </div>
        </div>
        <span className="max-w-full break-all border border-red-400 bg-red-500/15 px-2 py-1 font-mono text-xs font-semibold text-red-100">
          {result.reason ?? "REJECTED"}
        </span>
      </div>

      {result.reason === "VALUE_EXCEEDS_SCOPE" ? (
        <>
          <p className="mt-4 font-semibold text-red-50">
            {requested} requested - {cap} cap - {over} over limit
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Fact label="Requested" value={requested} />
            <Fact label="Credential cap" value={cap} />
            <Fact label="Over limit" value={over} />
          </div>
        </>
      ) : null}

      {result.reason === "CREDENTIAL_REVOKED" ? (
        <div className="mt-4 space-y-2">
          <p className="font-semibold text-red-50">Agent cannot act. Credential status: REVOKED.</p>
          <p className="text-sm text-red-100/80">
            Credential revoked at {revokedAt}. Reason: {result.scope?.revokedReason ?? "none provided"}
          </p>
        </div>
      ) : null}

      <dl className="mt-4 grid gap-3 border-t border-red-400/20 pt-4 text-sm md:grid-cols-2">
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.16em] text-red-200/70">Credential checked</dt>
          <dd className="mt-1 font-mono text-red-50">{result.scope?.credentialId ?? result.delegationId ?? "none"}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs uppercase tracking-[0.16em] text-red-200/70">Allowed max value</dt>
          <dd className="mt-1 text-red-50">{cap}</dd>
        </div>
      </dl>

      {result.detail ? <p className="mt-4 text-sm text-red-100/80">{result.detail}</p> : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-red-400/30 bg-red-950/50 p-3">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-red-200/70">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-red-50">{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
