import { TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui';
import { diagnosticsReport, recordError } from './diagnostics';

/**
 * Shown inside the app frame when a screen fails, instead of a blank page.
 * Navigation keeps working, and the details can be copied for a bug report.
 */
export function RouteError() {
  const error = useRouteError();
  const [copied, setCopied] = useState(false);
  const message = error instanceof Error ? error.message : String(error);

  useEffect(() => {
    recordError('screen', error);
  }, [error]);

  return (
    <div className="flex flex-col items-start py-10">
      <TriangleAlert className="text-danger mb-4 size-7" />
      <h1 className="title-page">This screen couldn’t load</h1>
      <p className="text-muted mt-2 max-w-md text-[15px] md:text-sm">
        Your data is safe. Reload to try again. If it keeps happening, copy the details and send them to the
        developer.
      </p>
      <pre className="bg-surface-2 text-muted mt-5 w-full overflow-x-auto rounded-xl p-3 text-xs whitespace-pre-wrap">
        {message}
      </pre>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button
          onClick={() => void navigator.clipboard?.writeText(diagnosticsReport()).then(() => setCopied(true))}
        >
          {copied ? 'Copied' : 'Copy details'}
        </Button>
        <Link
          to="/"
          className="text-muted hover:text-fg inline-flex h-11 items-center px-3 text-[15px] md:h-10 md:text-sm"
        >
          Go to Today
        </Link>
      </div>
    </div>
  );
}
