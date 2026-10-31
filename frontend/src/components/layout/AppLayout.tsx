import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from '../ErrorBoundary';
import { getLastApiFailureMessage } from '../../services/api';

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [apiError, setApiError] = useState<string | null>(() => getLastApiFailureMessage());
  const location = useLocation();

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string }>).detail;
      setApiError(detail?.message || 'Some information could not be loaded. Check your connection and retry.');
    };
    window.addEventListener('evo-api-error', handleApiError);
    return () => window.removeEventListener('evo-api-error', handleApiError);
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
          {apiError && <div className="card api-error-banner" role="alert"><span>{apiError} Some sections may be incomplete.</span><div><button className="btn btn-secondary sm" onClick={() => window.location.reload()}>Retry</button><button className="btn btn-ghost sm" onClick={() => setApiError(null)} aria-label="Dismiss connection warning">Dismiss</button></div></div>}
          <ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
