import React from "react";

export function ErrorBadge({ error }: { error: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border border-rose-500/20 bg-rose-500/10 text-rose-300">
      {error}
    </span>
  );
}
