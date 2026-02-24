const API_BASE =
  process.env.ORION_WEB_API_BASE_URL ?? 'http://localhost:3001/api';

async function fetchHealth(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return `degraded (${response.status})`;
    }

    const payload = (await response.json()) as { status?: string };
    return payload.status ?? 'unknown';
  } catch {
    return 'unreachable';
  }
}

export default async function Home() {
  const health = await fetchHealth();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
          Orion Pharma
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Platform foundation initialized
        </h1>
        <p className="text-slate-300">
          Multi-tenant NestJS API and Next.js App Router PWA are connected.
        </p>
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm">
          API health: <span className="font-semibold text-emerald-300">{health}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <a className="rounded border border-violet-700 px-3 py-2 text-violet-200" href="/suppliers">
            Suppliers Core
          </a>
          <a className="rounded border border-cyan-700 px-3 py-2 text-cyan-200" href="/products">
            Products Management
          </a>
          <a className="rounded border border-emerald-700 px-3 py-2 text-emerald-200" href="/stock">
            Stock On Hand
          </a>
        </div>
      </section>
    </main>
  );
}
