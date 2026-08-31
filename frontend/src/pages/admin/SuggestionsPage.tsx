import type { ReactNode } from "react";
import { PageHeader } from "../../components/shared/PageHeader";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="list-decimal list-inside space-y-2">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ol>
  );
}

export function SuggestionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Suggestions" subtitle="Pending improvements worth doing next, and how to get there" />

      <Section title="WhatsApp Leads → CRM (configuration + deployment, no new code)">
        <p>The webhook already works — verified directly. What's needed is Meta-side setup and getting DecoTrack onto a public URL.</p>
        <Steps items={[
          <>Get a <strong>dedicated WhatsApp number</strong> — can't be one already active in the regular WhatsApp or WhatsApp Business app.</>,
          <>Create a <strong>Meta Developer account</strong>, create an App, add the WhatsApp product to it.</>,
          <>Start <strong>Business verification early</strong> — the slowest step (can take days); run it in parallel with everything else.</>,
          <><strong>Deploy DecoTrack</strong> to a real public HTTPS URL — it only runs on localhost today, which Meta can't reach. Pick a domain + hosting (a managed platform like Railway/Render is less ongoing work than a VPS).</>,
          <><strong>Fix the webhook's authentication</strong> before going live — the current API-key check won't work with how Meta actually signs webhook calls (HMAC signature, not a custom header). Small, contained backend change.</>,
          <>In Meta's dashboard, set the webhook URL to <code className="bg-gray-100 px-1 rounded text-xs">https://yourdomain.com/api/v1/crm/public/whatsapp-webhook</code>, set your own verify token, subscribe to the <code className="bg-gray-100 px-1 rounded text-xs">messages</code> field.</>,
          <><strong>Test it</strong> — message the business number from your phone, confirm a new Lead appears in CRM with AI-filled city/budget/summary.</>,
        ]} />
      </Section>

      <Section title="Call Log Leads → CRM">
        <p><strong>Works today, zero setup:</strong> after any call, use CRM → Quick Log to jot a one-line summary. No app needed.</p>
        <p className="pt-2"><strong>Automated (needs building — doesn't exist yet):</strong></p>
        <Steps items={[
          <>Decide: dedicated work phones for staff, or personal phones? Affects whether syncing every call is acceptable.</>,
          <>Build the <strong>Android companion app</strong> — logs in once, reads the phone's call log, syncs new calls every 15–30 min to the bulk call-log endpoint (already exists and works).</>,
          <>Distribute as a <strong>direct APK</strong> to staff phones — not through Play Store, since READ_CALL_LOG gets rejected there for an app like this.</>,
          <>Fix two backend gaps first: add a <strong>MISSED_CALL</strong> type (missed calls are a real lead signal, not currently captured), and <strong>duplicate protection</strong> (so a re-sync doesn't double-log the same call).</>,
        ]} />
      </Section>
    </div>
  );
}
