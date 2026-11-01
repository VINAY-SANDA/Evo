import { Outlet } from 'react-router-dom';
import { useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from '../ErrorBoundary';
import { getApiFailures } from '../../services/api';

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [apiFailures, setApiFailures] = useState(() => getApiFailures());
  const [pendingReads, setPendingReads] = useState(0);
  const location = useLocation();

  useLayoutEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ endpoint: string; message: string }>).detail;
      setApiFailures(current => [...current.filter(item => item.endpoint !== detail?.endpoint), {
        endpoint: detail?.endpoint || 'unknown',
        message: detail?.message || 'Some information could not be loaded. Check your connection and retry.',
      }]);
    };
    const handleApiSuccess = (event: Event) => {
      const detail = (event as CustomEvent<{ endpoint: string }>).detail;
      setApiFailures(current => current.filter(item => item.endpoint !== detail?.endpoint));
    };
    const handleLoadStart = () => setPendingReads(count => count + 1);
    const handleLoadEnd = () => setPendingReads(count => Math.max(0, count - 1));
    window.addEventListener('evo-api-error', handleApiError);
    window.addEventListener('evo-api-success', handleApiSuccess);
    window.addEventListener('evo-api-load-start', handleLoadStart);
    window.addEventListener('evo-api-load-end', handleLoadEnd);
    return () => {
      window.removeEventListener('evo-api-error', handleApiError);
      window.removeEventListener('evo-api-success', handleApiSuccess);
      window.removeEventListener('evo-api-load-start', handleLoadStart);
      window.removeEventListener('evo-api-load-end', handleLoadEnd);
    };
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <main className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onToggleSidebar={() => setSidebarCollapsed(c => !c)} />
        <div className="app-content">
          {apiFailures.length === 0 && pendingReads > 0 && <div className="card api-error-banner api-loading-banner" role="status" aria-live="polite"><span>Loading your saved information…</span></div>}
          {apiFailures.length > 0 && <section className="card api-error-banner" role="status" aria-live="polite">
            <div>
              <strong>Some saved information could not be loaded.</strong>
              <p>{apiFailures[0].message} Affected sections may look empty until you reload and retry.</p>
            </div>
            <button className="btn btn-secondary sm" onClick={() => window.location.reload()}>Reload to retry</button>
          </section>}
          <ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
