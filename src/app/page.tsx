import { DelegationTree } from "@/components/DelegationTree";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-8 border-b border-zinc-800 pb-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">T3 ADK Hackathon Submission</p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-50 sm:text-5xl">AgentVault</h1>
        <p className="mt-3 max-w-3xl text-lg text-zinc-400">
          Hierarchical agent authorization for enterprise procurement: verifiable identity, scoped credentials,
          hard scope checks, revocation, and signed audit proof.
        </p>
      </header>
      <DelegationTree />
    </main>
  );
}
