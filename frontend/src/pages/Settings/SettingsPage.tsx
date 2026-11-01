import { useState, useEffect } from 'react';
import type { Memory } from '../../types';
import { getUserProfile, updateUserProfile, getMemories, addMemory, updateMemory, deleteMemory, exportUserData } from '../../services/api';
import './SettingsPage.css';

export default function SettingsPage() {
  const [userName, setUserName] = useState('Vinay');
  const [userEmail, setUserEmail] = useState('vinay@example.com');
  const [aiTone, setAiTone] = useState<'rigorous' | 'balanced' | 'empathetic'>('rigorous');
  const [aiContextEnabled, setAiContextEnabled] = useState(true);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryType, setNewMemoryType] = useState<Memory['memoryType']>('preference');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [memoryLoadError, setMemoryLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [exportingData, setExportingData] = useState(false);

  useEffect(() => {
    let active = true;
    getUserProfile().then(user => {
      if (!active) return;
      if (user) {
        setUserName(user.name);
        setUserEmail(user.email);
        if (user.aiTone) setAiTone(user.aiTone);
        setAiContextEnabled(user.aiContextEnabled !== false);
      }
    });
    getMemories().then(mems => {
      if (!active) return;
      if (mems) setMemories(mems);
      else setMemoryLoadError(true);
    }).finally(() => { if (active) setLoadingMemories(false); });
    return () => { active = false; };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateUserProfile({ name: userName.trim(), email: userEmail.trim(), aiTone, aiContextEnabled });
      if (!updated) throw new Error('Profile update failed');
      setSavedSuccess(true);
      showToast('Profile saved.');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      showToast('Profile could not be saved. Check your connection and try again.');
    } finally { setSaving(false); }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;

    const newMem = editingMemoryId
      ? await updateMemory(editingMemoryId, { text: newMemoryText.trim(), memoryType: newMemoryType })
      : await addMemory(newMemoryText.trim(), newMemoryType, 8);
    if (newMem) {
      setMemories(current => editingMemoryId ? current.map(memory => memory.id === editingMemoryId ? newMem : memory) : [newMem, ...current]);
      showToast(editingMemoryId ? 'Memory updated.' : 'Memory saved.');
    } else {
      showToast('Memory could not be saved. Check your connection and try again.');
      return;
    }
    setNewMemoryText('');
    setEditingMemoryId(null);
  };

  const handleDeleteMemory = async (id: string) => {
    setDeletingMemoryId(id);
    const deleted = await deleteMemory(id);
    if (deleted) {
      setMemories(prev => prev.filter(m => m.id !== id));
      showToast('Memory deleted.');
    } else showToast('Memory could not be deleted. Please try again.');
    setDeletingMemoryId(null);
  };

  const handleToneChange = async (tone: 'rigorous' | 'balanced' | 'empathetic') => {
    const previousTone = aiTone;
    setAiTone(tone);
    const updated = await updateUserProfile({ aiTone: tone });
    if (!updated) {
      setAiTone(previousTone);
      showToast('Coaching tone could not be saved. Please try again.');
      return;
    }
    showToast(`Coaching tone set to ${tone}.`);
  };

  const handleAiContextChange = async (enabled: boolean) => {
    const previous = aiContextEnabled;
    setAiContextEnabled(enabled);
    const updated = await updateUserProfile({ aiContextEnabled: enabled });
    if (!updated) {
      setAiContextEnabled(previous);
      showToast('AI context preference could not be saved. Please try again.');
      return;
    }
    showToast(enabled ? 'Workspace context enabled for AI requests.' : 'Workspace context disabled for AI requests.');
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const exportData = await exportUserData();
      if (!exportData) { showToast('Your data export could not be prepared. Please try again.'); return; }
      let browserData: Record<string, unknown> = {};
      try {
        browserData.aiChatHistory = JSON.parse(window.localStorage.getItem('evo_chat_history') || '[]');
        browserData.activeFocusSession = JSON.parse(window.localStorage.getItem('evo.learning.focus-session') || 'null');
        browserData.reminderAlertHistory = Object.fromEntries(Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
          .filter((key): key is string => Boolean(key?.startsWith('evo.reminders.notified.')))
          .map(key => [key, window.localStorage.getItem(key)]));
      } catch {
        browserData = { note: 'Some browser-local records could not be read in this browser.' };
      }
      const blob = new Blob([JSON.stringify({ ...exportData, browserData }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evo-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Your EVO data export has been downloaded.');
    } catch {
      showToast('Your data export could not be prepared. Please try again.');
    } finally { setExportingData(false); }
  };

  return (
    <div className="settings-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Settings & System Configuration</h1>
        <p className="page-subtitle">Configure your profile, AI reasoning preferences, and memory store</p>
      </div>

      <div className="settings-grid">
        {/* Profile Settings */}
        <div className="card settings-card animate-fade-in-up">
          <h2 className="settings-section-title">👤 User Profile</h2>
          <form onSubmit={handleSaveProfile} className="settings-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                value={userName}
                onChange={e => setUserName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Timezone</label>
              <select className="form-input" defaultValue="Asia/Kolkata">
                <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">
              {saving ? 'Saving…' : savedSuccess ? '✓ Saved Profile' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="card settings-card animate-fade-in-up">
          <h2 className="settings-section-title">Your data</h2>
          <p className="settings-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
            Download a copy of your EVO records, including your private diary. The file is prepared only when you request it.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => void handleExportData()} disabled={exportingData}>
            {exportingData ? 'Preparing export…' : 'Download my data'}
          </button>
        </div>

        {/* AI Personality & Logic Engine */}
        <div className="card settings-card animate-fade-in-up stagger-1">
          <h2 className="settings-section-title">✨ EVO AI Persona & Directive</h2>
          <p className="settings-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
            Diary entries are never included. When workspace context is on, goals, today’s tasks, habits, this month’s finance totals, and saved memories may be sent to Gemini with your request. Turn it off to send only your message and coaching tone.
          </p>
          <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input type="checkbox" checked={aiContextEnabled} onChange={event => { void handleAiContextChange(event.target.checked); }} />
            <span className="form-label" style={{ margin: 0 }}>Include workspace context in AI requests</span>
          </label>
          <div className="form-group">
            <label className="form-label">Coaching Tone</label>
            <div className="tone-selector">
              <button type="button" aria-pressed={aiTone === 'rigorous'}
                className={`tone-card ${aiTone === 'rigorous' ? 'selected' : ''}`}
                onClick={() => handleToneChange('rigorous')}
              >
                <strong>Direct & Rigorous</strong>
                <p>Prioritizes truth over feelings, calls out procrastination and excuses.</p>
              </button>
              <button type="button" aria-pressed={aiTone === 'balanced'}
                className={`tone-card ${aiTone === 'balanced' ? 'selected' : ''}`}
                onClick={() => handleToneChange('balanced')}
              >
                <strong>Balanced Advisor</strong>
                <p>Constructive feedback with realistic adjustments.</p>
              </button>
              <button type="button" aria-pressed={aiTone === 'empathetic'}
                className={`tone-card ${aiTone === 'empathetic' ? 'selected' : ''}`}
                onClick={() => handleToneChange('empathetic')}
              >
                <strong>Encouraging Coach</strong>
                <p>Focuses on positive reinforcement and mental wellness.</p>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Daily Review Prompt Time</label>
            <input className="form-input" type="time" defaultValue="20:00" />
          </div>
        </div>

        {/* Long Term AI Memory Management */}
        <div className="card settings-card span-2 animate-fade-in-up stagger-2">
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 className="settings-section-title">🧠 Long-Term Memory Store</h2>
              <p className="settings-subtitle">Saved preferences and facts that can be included in EVO AI coaching context. Diary entries are never included.</p>
            </div>
            <span className="badge badge-primary">{memories.length} Memories Stored</span>
          </div>

          {/* Add New Memory */}
          <form onSubmit={handleAddMemory} className="add-memory-row">
            <input
              type="text"
              className="form-input flex-1"
              placeholder="Teach EVO something about you (e.g., 'I learn best through building projects first')"
              value={newMemoryText}
              onChange={e => setNewMemoryText(e.target.value)}
            />
            <select
              className="form-input"
              style={{ width: '150px' }}
              value={newMemoryType}
              onChange={e => setNewMemoryType(e.target.value as Memory['memoryType'])}
            >
              <option value="preference">Preference</option>
              <option value="decision">Decision</option>
              <option value="fact">Fact</option>
              <option value="lesson">Lesson</option>
            </select>
            <button type="submit" className="btn btn-primary sm">
              {editingMemoryId ? 'Save changes' : '+ Store Memory'}
            </button>
            {editingMemoryId && <button type="button" className="btn btn-secondary sm" onClick={() => { setEditingMemoryId(null); setNewMemoryText(''); setNewMemoryType('preference'); }}>Cancel</button>}
          </form>

          {/* List of Memories */}
          {loadingMemories ? <p className="settings-feedback" role="status">Loading saved memories…</p> : memoryLoadError ? <p className="settings-feedback" role="alert">Saved memories could not be loaded. Check your connection and reopen Settings.</p> : memories.length === 0 ? <p className="settings-feedback">No saved memories yet. Add one above to help EVO remember what matters to you.</p> : <div className="memories-list">
            {memories.map(mem => (
              <div key={mem.id} className="memory-card">
                <div className="memory-badge-row">
                  <span className={`memory-type-pill ${mem.memoryType || 'preference'}`}>
                    {(mem.memoryType || 'preference').toUpperCase()}
                  </span>
                  <span className="memory-importance">Importance: {mem.importance}/10</span>
                </div>
                <p className="memory-text">{mem.text}</p>
                <div className="memory-footer">
                  <span className="memory-date">Learned {mem.createdAt ? new Date(mem.createdAt).toLocaleDateString() : 'recently'}</span>
                  <button
                    className="btn btn-secondary sm"
                    onClick={() => { setEditingMemoryId(mem.id); setNewMemoryText(mem.text); setNewMemoryType(mem.memoryType || 'preference'); }}
                  >Edit</button>
                  <button
                    className="memory-delete-btn"
                    onClick={() => void handleDeleteMemory(mem.id)}
                    disabled={deletingMemoryId === mem.id}
                    title="Delete memory"
                  >
                    {deletingMemoryId === mem.id ? 'Deleting…' : 'Delete memory'}
                  </button>
                </div>
              </div>
            ))}
          </div>}
        </div>
      </div>
    </div>
  );
}
