import { Outlet } from 'react-router-dom';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from '../ErrorBoundary';
import { checkApiHealth, getLastApiFailureMessage } from '../../services/api';

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [apiError, setApiError] = useState<string | null>(() => getLastApiFailureMessage());
  const [pendingReads, setPendingReads] = useState(0);
  const location = useLocation();

  useLayoutEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string }>).detail;
      setApiError(detail?.message || 'Some information could not be loaded. Check your connection and retry.');
    };
    const handleLoadStart = () => setPendingReads(count => count + 1);
    const handleLoadEnd = () => setPendingReads(count => Math.max(0, count - 1));
    window.addEventListener('evo-api-error', handleApiError);
    window.addEventListener('evo-api-load-start', handleLoadStart);
    window.addEventListener('evo-api-load-end', handleLoadEnd);
    return () => {
      window.removeEventListener('evo-api-error', handleApiError);
      window.removeEventListener('evo-api-load-start', handleLoadStart);
      window.removeEventListener('evo-api-load-end', handleLoadEnd);
    };
  }, []);

  useEffect(() => {
    if (!apiError) return;
    let stopped = false;
    let timer: number | undefined;
    void checkApiHealth().then(alreadyReady => {
      if (alreadyReady || stopped) return;
      timer = window.setInterval(() => {
        void checkApiHealth().then(ready => {
          if (ready && !stopped) window.location.reload();
        });
      }, 8000);
    });
    return () => { stopped = true; if (timer !== undefined) window.clearInterval(timer); };
  }, [apiError]);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <main className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onToggleSidebar={() => setSidebarCollapsed(c => !c)} />
        <div className="app-content">
          {!apiError && pendingReads > 0 && <div className="card api-error-banner api-loading-banner" role="status" aria-live="polite"><span>Loading your saved information…</span></div>}
          {apiError && <section className="card api-error-banner" role="status" aria-live="polite">
            <div>
              <strong>Reconnecting to your saved data…</strong>
              <p>{apiError} EVO will reload your data automatically when the backend is ready.</p>
            </div>
            <button className="btn btn-secondary sm" onClick={() => window.location.reload()}>Retry now</button>
          </section>}
          <ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
