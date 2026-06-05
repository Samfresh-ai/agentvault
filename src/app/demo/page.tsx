import { DemoRunner } from "@/components/DemoRunner";

export default function DemoPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-8 border-b border-zinc-800 pb-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Live Demo</p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-50 sm:text-5xl">Corporate Procurement Workflow</h1>
        <p className="mt-3 max-w-3xl text-lg text-zinc-400">
          Watch AgentVault enforce credential scope in real time.
        </p>
      </header>
      <DemoRunner />
    </main>
  );
}
