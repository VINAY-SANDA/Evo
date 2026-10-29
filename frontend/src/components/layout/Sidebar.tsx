import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { User } from '../../types';
import { getUserProfile, getNotifications } from '../../services/api';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const mainNav = [
  { path: '/', icon: '⌂', label: 'Home' },
  { path: '/goals', icon: '◎', label: 'Goals' },
  { path: '/tasks', icon: '✓', label: 'Tasks' },
  { path: '/progress', icon: '↗', label: 'Progress' },
  { path: '/ai', icon: '✦', label: 'Plan with EVO' },
];

const secondaryNav = [
  { path: '/habits', icon: '◌', label: 'Habits' },
  { path: '/finance', icon: '₹', label: 'Finance' },
  { path: '/learning', icon: '◫', label: 'Learning' },
  { path: '/projects', icon: '◇', label: 'Projects' },
  { path: '/reminders', icon: '◷', label: 'Reminders' },
  { path: '/reviews', icon: '▤', label: 'Reviews' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [user, setUser] = useState<User>({
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Vinay',
    email: 'vinay@example.com',
    timezone: 'Asia/Kolkata',
    aiTone: 'rigorous',
  });
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    getUserProfile().then(setUser);
    getNotifications().then(notifications => {
      setUnreadCount(notifications.filter(n => n.status !== 'read').length);
    });
  }, [location.pathname]);

  const bottomNav = [
    { path: '/notifications', icon: '◉', label: 'Notifications', badge: unreadCount > 0 ? unreadCount : undefined },
    { path: '/settings', icon: '◍', label: 'Settings' },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo" onClick={onToggle} style={{ cursor: 'pointer' }} aria-label="Toggle navigation">
        <img className="sidebar-logo-icon" src="/brand/evo-mark.png" alt="" />
        <span className="sidebar-logo-text">EVO</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Main</div>
          {mainNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive && location.pathname === item.path ? 'active' : ''}`
              }
              end={item.path === '/'}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-text">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Modules</div>
          {secondaryNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-text">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="sidebar-section">
          {bottomNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-text">{item.label}</span>
              {item.badge ? <span className="sidebar-link-badge">{item.badge}</span> : null}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {user.name.charAt(0)}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user.name}</div>
          <div className="sidebar-user-email">{user.email}</div>
        </div>
      </div>
    </aside>
  );
}
