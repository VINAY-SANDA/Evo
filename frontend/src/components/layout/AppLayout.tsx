import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <main className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onToggleSidebar={() => setSidebarCollapsed(c => !c)} />
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
