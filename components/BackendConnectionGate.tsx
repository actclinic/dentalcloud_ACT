import React, { useSyncExternalStore } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { backendConnection } from '../services/backendConnection';

export const BackendConnectionGate: React.FC = () => {
  const status = useSyncExternalStore(backendConnection.subscribe, backendConnection.getStatus, backendConnection.getStatus);
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    const check = () => { void backendConnection.checkNow(); };
    const handleOffline = () => backendConnection.markBrowserOffline();
    window.addEventListener('online', check);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', check);
    const interval = window.setInterval(check, 30_000);
    check();
    return () => {
      window.removeEventListener('online', check);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', check);
      window.clearInterval(interval);
    };
  }, []);

  if (status !== 'disconnected') return null;

  const retry = async () => {
    setIsRetrying(true);
    await backendConnection.checkNow();
    setIsRetrying(false);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/75 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="backend-connection-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl sm:p-9">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-7 w-7 text-red-600" aria-hidden="true" />
        </div>
        <h2 id="backend-connection-title" className="text-xl font-black text-gray-900">Server connection lost</h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          This clinic cannot currently reach the server. To prevent lost or duplicate records, the application is temporarily locked.
        </p>
        <p className="mt-3 text-sm font-semibold text-gray-800">
          If you just saved something, do not submit it again until the connection is restored.
        </p>
        <button type="button" onClick={() => void retry()} disabled={isRetrying} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70">
          {isRetrying ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          {isRetrying ? 'Checking server…' : 'Retry connection'}
        </button>
        <p className="mt-4 text-xs text-gray-500">The app checks automatically every 30 seconds.</p>
      </div>
    </div>
  );
};