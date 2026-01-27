import React from "react";

export function AutoFixBadge({ fix }: { fix: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border border-amber-400/20 bg-amber-400/10 text-amber-300">
      {fix}
    </span>
  );
}
