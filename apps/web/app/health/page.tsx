import type { Metadata } from "next";

import { fetchApiHealth } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Health",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function HealthPage() {
  try {
    const api = await fetchApiHealth();
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="font-heading text-3xl">Health</h1>
        <pre className="mt-4 overflow-auto rounded-lg border bg-card p-4 text-xs">
          {JSON.stringify(
            {
              web: "ok",
              api,
            },
            null,
            2,
          )}
        </pre>
      </main>
    );
  } catch (error) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="font-heading text-3xl">Health</h1>
        <pre className="mt-4 overflow-auto rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {JSON.stringify(
            {
              web: "ok",
              api: "unreachable",
              error: (error as Error).message,
            },
            null,
            2,
          )}
        </pre>
      </main>
    );
  }
}
