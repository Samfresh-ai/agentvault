import { AuditLogTable } from "@/components/AuditLogTable";

export default function AuditPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-8 border-b border-zinc-800 pb-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Audit Trail</p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-50 sm:text-5xl">Immutable Event Log</h1>
        <p className="mt-3 max-w-3xl text-lg text-zinc-400">
          Cryptographically signed, append-only agent action log. Rows are read-only.
        </p>
      </header>
      <AuditLogTable />
      <p className="mt-5 border-l-2 border-amber-400 pl-3 text-sm text-zinc-400">
        All records are append-only and cryptographically signed. No record can be modified or deleted after creation.
      </p>
    </main>
  );
}
