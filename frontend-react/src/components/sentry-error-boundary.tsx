import * as Sentry from "@sentry/react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

function FallbackComponent({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-void p-6">
      <div className="glass-strong max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red/15 text-red">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-bold text-ink">Something went wrong</h2>
        <p className="mb-6 text-sm text-ink-muted">
          An unexpected error occurred. Our team has been notified.
        </p>
        <button
          onClick={resetErrorBoundary}
          className="rounded-lg bg-green px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#33ffa1]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function SentryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={FallbackComponent}
      onError={(error, info) => {
        Sentry.withScope((scope) => {
          scope.setExtras(info?.componentStack as any);
          Sentry.captureException(error);
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
