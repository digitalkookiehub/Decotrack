import { useEffect, useState } from "react";
import { PageHeader } from "../../components/shared/PageHeader";

export function FlowGuidePage() {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/FLOW-GUIDE.md")
      .then((res) => { if (!res.ok) throw new Error(); return res.text(); })
      .then(setText)
      .catch(() => setError(true));
  }, []);

  return (
    <div>
      <PageHeader title="Flow Guide" subtitle="The full business flow, step by step, with where each AI feature fits in" />
      {error && <p className="text-sm text-gray-500">Couldn't load the flow guide right now.</p>}
      {!error && !text && <p className="text-sm text-gray-500">Loading...</p>}
      {text && (
        <div className="overflow-x-auto rounded-lg bg-gray-900">
          <pre className="p-4 text-xs leading-relaxed text-gray-100 whitespace-pre font-mono">{text}</pre>
        </div>
      )}
    </div>
  );
}
