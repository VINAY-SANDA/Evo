import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getNotifications } from '../../services/api';

interface HeaderProps {
  onToggleSidebar: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/': '',
    '/goals': 'Goals',
    '/tasks': 'Tasks',
    '/habits': 'Habits',
    '/finance': 'Finance',
    '/learning': 'Learning',
    '/projects': 'Projects',
    '/progress': 'Progress',
    '/reminders': 'Reminders',
    '/reviews': 'Reviews',
    '/diary': 'Diary',
    '/movies': 'Movies',
    '/ai': 'EVO AI',
    '/notifications': 'Notifications',
    '/settings': 'Settings',
  };
  return titles[pathname] || '';
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    getNotifications().then(notifications => {
      setUnreadCount(notifications.filter(n => n.status !== 'read').length);
    });
  }, [location.pathname]);

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="header-toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          ☰
        </button>
        <div className="header-greeting">
          {pageTitle ? (
            pageTitle
          ) : (
            <>
              {getGreeting()} <span>👋</span>
            </>
          )}
        </div>
      </div>

      <div className="header-right">
        <button className="header-assistant-btn" onClick={() => navigate('/ai')}>
          Plan with EVO
        </button>

        <button
          className="header-icon-btn"
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
        >
          🔔
          {unreadCount > 0 && <span className="badge" />}
        </button>

        <button
          className="header-icon-btn header-lock-btn"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          title="Lock EVO (Owner Logout)"
          aria-label="Lock OS"
        >
          🔒
        </button>
      </div>
    </header>
  );
}
