import { useEffect, useContext, useState, useMemo } from 'react';
import { NoteContext } from '../context/NoteContext';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, AlertCircle, ChevronRight, Settings, Loader2, Menu, LayoutGrid, List } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const getNotePreview = (contentString) => {
  if (!contentString) return 'Empty document';
  try {
    const blocks = typeof contentString === 'string' ? JSON.parse(contentString) : contentString;
    if (!Array.isArray(blocks) || blocks.length === 0) return 'Empty document';
    
    for (const block of blocks) {
      if (block.content && Array.isArray(block.content)) {
        const text = block.content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('');
        if (text.trim()) {
          return text.trim();
        }
      }
    }
    return 'Empty document';
  } catch {
    if (typeof contentString === 'string' && contentString.trim()) {
      return contentString.trim();
    }
    return 'Empty document';
  }
};

// Extract multiple text lines from note blocks for card preview
const getNoteLines = (contentString, maxLines = 12) => {
  if (!contentString) return [];
  try {
    const blocks = typeof contentString === 'string' ? JSON.parse(contentString) : contentString;
    if (!Array.isArray(blocks)) return [];
    const lines = [];
    for (const block of blocks) {
      if (lines.length >= maxLines) break;
      if (block.type === 'image') {
        lines.push({ type: 'image', url: block.props?.url });
        continue;
      }
      const text = Array.isArray(block.content)
        ? block.content.filter(i => i.type === 'text').map(i => i.text).join('')
        : '';
      if (text.trim()) {
        lines.push({ type: block.type || 'paragraph', text: text.trim() });
      } else if (block.type === 'bulletListItem' || block.type === 'numberedListItem') {
        lines.push({ type: block.type, text: '' });
      }
    }
    return lines;
  } catch {
    return [];
  }
};

const timeAgo = (date) => {
  if (!date) return 'Recently';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

const formatNoteDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleDateString('en-US', { weekday: 'long' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getGroupLabel = (date) => {
  if (!date) return 'Older';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Previous 7 Days';
  if (diffDays < 30) {
    return d.toLocaleDateString('en-US', { month: 'long' });
  }
  const thisYear = now.getFullYear();
  const noteYear = d.getFullYear();
  if (noteYear === thisYear) {
    return d.toLocaleDateString('en-US', { month: 'long' });
  }
  return String(noteYear);
};

const Dashboard = () => {
  const {
    notes,
    fetchNotes,
    fetchTrashNotes,
    createNote
  } = useContext(NoteContext);
  const { user, token, logout } = useContext(AuthContext);
  const { activeTheme } = useContext(ThemeContext);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [globalPresence, setGlobalPresence] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('note-view-mode') || 'grid');
  const navigate = useNavigate();

  const toggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('note-view-mode', mode);
  };

  // Settings & Account Deletion Modal States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type "DELETE" exactly to confirm.');
      return;
    }
    
    if (user?.isGuest) {
      setShowDeleteConfirmModal(false);
      setShowSettingsModal(false);
      logout();
      navigate('/login');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await axios.delete('http://localhost:5050/api/auth/delete-account');
      if (res.data.success) {
        setShowDeleteConfirmModal(false);
        setShowSettingsModal(false);
        logout();
        navigate('/login');
      } else {
        setDeleteError(res.data.error || 'Failed to delete account.');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Server error deleting account.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const welcomeMessage = useMemo(() => {
    const variations = [
      {
        title: `Welcome back, ${user?.name || 'Writer'}!`,
        subtitle: "Ready to capture your next brilliant idea? Let's collaborate.",
        badge: "✨ Active Session",
        gradient: "from-blue-600/10 to-indigo-600/10 dark:from-blue-500/10 dark:to-indigo-500/5",
        accentText: "text-blue-600 dark:text-blue-400"
      },
      {
        title: `Hello, ${user?.name || 'Writer'}!`,
        subtitle: "Your ideas flow better together. Start or jump into a collaborative note.",
        badge: "🚀 Productive Day",
        gradient: "from-emerald-600/10 to-teal-600/10 dark:from-emerald-500/10 dark:to-teal-500/5",
        accentText: "text-emerald-600 dark:text-emerald-400"
      },
      {
        title: `Welcome, ${user?.name || 'Writer'}!`,
        subtitle: "Organize, write, and share your thoughts seamlessly in real-time.",
        badge: "💡 Creative Flow",
        gradient: "from-amber-600/10 to-orange-600/10 dark:from-amber-500/10 dark:to-orange-500/5",
        accentText: "text-amber-600 dark:text-amber-400"
      },
      {
        title: `Great to see you, ${user?.name || 'Writer'}!`,
        subtitle: "What are we working on today? Your shared documents are waiting.",
        badge: "🎯 Goal Focused",
        gradient: "from-fuchsia-600/10 to-purple-600/10 dark:from-fuchsia-500/10 dark:to-purple-500/5",
        accentText: "text-fuchsia-600 dark:text-fuchsia-400"
      },
      {
        title: `Welcome to NoteFlow, ${user?.name || 'Writer'}!`,
        subtitle: "Capture, refine, and collaborate on your notes in your custom workspace.",
        badge: "⚡ Real-time Sync",
        gradient: "from-rose-600/10 to-pink-600/10 dark:from-rose-500/10 dark:to-pink-500/5",
        accentText: "text-rose-600 dark:text-rose-400"
      }
    ];
    if (!user) return variations[0];
    const userSeed = user.name || user.email || 'Writer';
    const hash = userSeed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return variations[hash % variations.length];
  }, [user]);


  useEffect(() => {
    fetchNotes();
    fetchTrashNotes();
  }, [fetchNotes, fetchTrashNotes]);

  // Connect socket on dashboard to listen to global active rooms presence list
  useEffect(() => {
    if (!token) return;
    const socket = io('http://localhost:5050', {
      auth: { token }
    });

    socket.on('global-presence-update', (presenceMap) => {
      setGlobalPresence(presenceMap);
    });

    socket.on('connect', () => {
      socket.emit('request-global-presence');
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    const note = await createNote(newNoteTitle, 'General');
    if (note) {
      setNewNoteTitle('');
      setIsCreating(false);
      navigate(`/note/${note._id}`);
    }
  };

  const recentNotes = useMemo(() => {
    return notes.slice(0, 6);
  }, [notes]);

  // Group all notes by time period for gallery view
  const groupedNotes = useMemo(() => {
    const groups = {};
    const order = [];
    const sorted = [...notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    for (const note of sorted) {
      const label = getGroupLabel(note.updatedAt);
      if (!groups[label]) {
        groups[label] = [];
        order.push(label);
      }
      groups[label].push(note);
    }
    return order.map(label => ({ label, notes: groups[label] }));
  }, [notes]);

  return (
    <div className={`flex h-screen transition-colors duration-300 ${activeTheme.bg}`}>
      {/* Sidebar Component */}
      <Sidebar 
        setIsCreating={setIsCreating} 
        globalPresence={globalPresence} 
        setShowSettingsModal={setShowSettingsModal} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/45 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className={`lg:hidden flex items-center justify-between px-6 py-4 border-b ${activeTheme.sidebarHeader} ${activeTheme.border}`}>
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1 text-gray-500 hover:text-blue-500 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/40 cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <span className="font-black text-sm tracking-tight bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">NoteFlow</span>
          <div className="w-6" />
        </div>

        <div className="flex-1 overflow-y-auto">
        {isCreating ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/20 dark:bg-zinc-950/10">
            <form 
              onSubmit={handleCreateNote} 
              className={`w-full max-w-md p-8 rounded-2xl border transition-all duration-300 ${activeTheme.card} ${activeTheme.border}`}
            >
              <h2 className={`text-lg font-black mb-1 ${activeTheme.textPrimary}`}>Create New Note</h2>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-6">Choose a descriptive title for your workspace.</p>
              <input
                autoFocus
                type="text"
                placeholder="Marketing Strategy, Project Kickoff..."
                className={`w-full px-4 py-3 border rounded-xl mb-6 outline-none transition-all focus:ring-2 focus:ring-blue-500/50 ${activeTheme.border} ${activeTheme.inputBg} ${activeTheme.textPrimary}`}
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${activeTheme.btnSec}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${activeTheme.btnBrand}`}
                >
                  Create Note
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 lg:p-12">
            <div className="max-w-5xl mx-auto space-y-10">
              {/* Welcome Banner */}
              <div className={`p-6 lg:p-8 rounded-3xl border transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 ${activeTheme.card} bg-gradient-to-r ${welcomeMessage.gradient}`}>
                <div className="space-y-3 z-10">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/80 dark:bg-zinc-800/80 shadow-sm border border-slate-200/40 dark:border-zinc-700/40 ${welcomeMessage.accentText}`}>
                      {welcomeMessage.badge}
                    </span>
                  </div>
                  <div>
                    <h1 className={`text-2xl lg:text-3xl font-black tracking-tight ${activeTheme.textPrimary}`}>
                      {welcomeMessage.title}
                    </h1>
                    <p className={`text-sm mt-1.5 font-semibold opacity-90 max-w-xl ${activeTheme.textSecondary}`}>
                      {welcomeMessage.subtitle}
                    </p>
                  </div>
                </div>

                <div className="z-10 flex-shrink-0">
                  <button
                    onClick={() => setIsCreating(true)}
                    className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:shadow-xl ${activeTheme.btnBrand}`}
                  >
                    <Plus size={16} /> Create a Note
                  </button>
                </div>

                {/* Decorative background glow elements */}
                <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-blue-500/10 dark:bg-blue-400/5 blur-3xl pointer-events-none" />
                <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-indigo-500/10 dark:bg-indigo-400/5 blur-3xl pointer-events-none" />
              </div>

              {recentNotes.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full scale-110"></div>
                    <div className="relative bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/50 p-6 rounded-3xl shadow-xl">
                      <FileText size={48} className="text-blue-500 dark:text-blue-400 animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-lg font-extrabold text-gray-700 dark:text-zinc-300">Start writing your thoughts</h2>
                  <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500 max-w-xs text-center leading-relaxed">
                    Select an existing note from the sidebar or click "New Note" to initiate a real-time collaborative workspace.
                  </p>
                </div>
              ) : (
                /* Notes list container with view toggle options */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className={`text-xs font-black uppercase tracking-widest ${activeTheme.textSecondary}`}>
                      All Notes
                    </h2>
                    {/* View Switch controls */}
                    <div className={`flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/40 p-1 rounded-xl border ${activeTheme.border}`}>
                      <button
                        type="button"
                        onClick={() => toggleViewMode('grid')}
                        title="View as Gallery"
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          viewMode === 'grid'
                            ? 'bg-white dark:bg-zinc-900 shadow-sm text-blue-500'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300'
                        }`}
                      >
                        <LayoutGrid size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleViewMode('list')}
                        title="View as List"
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          viewMode === 'list'
                            ? 'bg-white dark:bg-zinc-900 shadow-sm text-blue-500'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300'
                        }`}
                      >
                        <List size={15} />
                      </button>
                    </div>
                  </div>

                  {viewMode === 'grid' ? (
                    /* iOS NOTES-STYLE GALLERY VIEW — grouped by time */
                    <div className="space-y-8">
                      {groupedNotes.map(({ label, notes: groupNotes }) => (
                        <div key={label}>
                          {/* Group heading */}
                          <h3 className={`text-xl font-black mb-4 ${activeTheme.textPrimary}`}>{label}</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {groupNotes.map((note) => {
                              const lines = getNoteLines(note.content, 14);
                              const isDark = activeTheme.isDark;
                              return (
                                <div
                                  key={note._id}
                                  onClick={() => navigate(`/note/${note._id}`)}
                                  className="group cursor-pointer flex flex-col"
                                >
                                  {/* Document preview card — mimics paper */}
                                  <div
                                    className={`relative rounded-xl overflow-hidden border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                                      isDark
                                        ? 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                                    }`}
                                    style={{ aspectRatio: '3/4', minHeight: '160px' }}
                                  >
                                    {/* Inner content area — scaled-down document */}
                                    <div className="absolute inset-0 p-3 overflow-hidden">
                                      {lines.length === 0 ? (
                                        <p className={`text-[9px] leading-relaxed ${ isDark ? 'text-zinc-500' : 'text-slate-400' }`}>
                                          Empty document
                                        </p>
                                      ) : (
                                        <div className="space-y-0.5">
                                          {lines.map((line, i) => {
                                            if (line.type === 'image') {
                                              return (
                                                <img
                                                  key={i}
                                                  src={line.url}
                                                  alt=""
                                                  className="w-full h-10 object-cover rounded-sm mb-1"
                                                />
                                              );
                                            }
                                            const isHeading = line.type?.startsWith('heading');
                                            const isBullet = line.type === 'bulletListItem';
                                            const isNum = line.type === 'numberedListItem';
                                            return (
                                              <div key={i} className={`flex items-start gap-1 ${ isHeading ? 'mb-0.5' : '' }`}>
                                                {isBullet && (
                                                  <span className={`text-[7px] mt-[3px] flex-shrink-0 ${ isDark ? 'text-zinc-400' : 'text-slate-500' }`}>•</span>
                                                )}
                                                {isNum && (
                                                  <span className={`text-[7px] mt-[3px] flex-shrink-0 ${ isDark ? 'text-zinc-400' : 'text-slate-500' }`}>{i + 1}.</span>
                                                )}
                                                <p
                                                  className={`leading-tight truncate ${
                                                    isHeading
                                                      ? `font-black ${ isDark ? 'text-zinc-100' : 'text-slate-900' } ${ line.type === 'heading1' ? 'text-[10px]' : line.type === 'heading2' ? 'text-[9px]' : 'text-[8px]' }`
                                                      : `text-[8px] font-medium ${ isDark ? 'text-zinc-300' : 'text-slate-600' }`
                                                  }`}
                                                >
                                                  {line.text || <span className="opacity-0">.</span>}
                                                </p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    {/* Subtle bottom fade gradient to clip overflow */}
                                    <div className={`absolute bottom-0 left-0 right-0 h-10 pointer-events-none ${
                                      isDark
                                        ? 'bg-gradient-to-t from-zinc-800 to-transparent'
                                        : 'bg-gradient-to-t from-white to-transparent'
                                    }`} />
                                  </div>

                                  {/* Title + date below card */}
                                  <div className="mt-2 px-0.5">
                                    <p className={`text-xs font-bold leading-tight truncate ${ isDark ? 'text-zinc-100' : 'text-slate-800' }`}>
                                      {note.title || 'Untitled Note'}
                                    </p>
                                    <p className={`text-[10px] mt-0.5 ${ isDark ? 'text-zinc-500' : 'text-slate-400' }`}>
                                      {formatNoteDate(note.updatedAt)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* LIST VIEW */
                    <div className={`border rounded-2xl overflow-hidden transition-colors ${activeTheme.border} ${activeTheme.isDark ? 'bg-zinc-900/40' : 'bg-white'}`}>
                      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {recentNotes.map((note) => {
                          const isPublic = note.publicAccess && note.publicAccess !== 'none';
                          return (
                            <div
                              key={note._id}
                              onClick={() => navigate(`/note/${note._id}`)}
                              className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 cursor-pointer transition-colors duration-150 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20`}
                            >
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className={`p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-gray-505 dark:text-zinc-450 group-hover:text-blue-500 transition-colors flex-shrink-0`}>
                                  <FileText size={18} />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className={`text-sm sm:text-base font-extrabold truncate ${activeTheme.textPrimary} group-hover:text-blue-550 transition-colors`}>
                                      {note.title || 'Untitled Note'}
                                    </h3>
                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wide border ${
                                      activeTheme.isDark
                                        ? 'bg-zinc-850 border-zinc-700 text-zinc-400'
                                        : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}>
                                      {note.folder || 'General'}
                                    </span>
                                    {isPublic && (
                                      <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20 uppercase tracking-wide">
                                        Public
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-xs truncate max-w-xl ${
                                    activeTheme.isDark ? 'text-zinc-450' : 'text-slate-450'
                                  }`}>
                                    {getNotePreview(note.content)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-6 flex-shrink-0">
                                {/* Collaborators Avatars */}
                                {globalPresence[note._id]?.length > 0 ? (
                                  <div className="flex -space-x-1 overflow-hidden">
                                    {globalPresence[note._id].slice(0, 3).map((u, i) => (
                                      <div
                                        key={i}
                                        title={u.name}
                                        className="h-5 w-5 rounded-full border border-white dark:border-zinc-900 flex items-center justify-center text-[8px] font-black text-white uppercase"
                                        style={{ backgroundColor: u.color }}
                                      >
                                        {u.name.substring(0, 2)}
                                      </div>
                                    ))}
                                    {globalPresence[note._id].length > 3 && (
                                      <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-zinc-800 border border-white dark:border-zinc-900 flex items-center justify-center text-[8px] font-bold text-slate-500 dark:text-zinc-450">
                                        +{globalPresence[note._id].length - 3}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-5 w-5" />
                                )}

                                <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400 dark:text-zinc-500">
                                  <span>{timeAgo(note.updatedAt)}</span>
                                  <ChevronRight size={14} className="transform group-hover:translate-x-0.5 transition-transform" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 sm:p-8 border transition-all duration-300 transform scale-100 ${activeTheme.card} ${activeTheme.border}`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Settings size={18} className={activeTheme.textBrand} />
                <h2 className={`text-2xl font-black ${activeTheme.textPrimary}`}>Account Settings</h2>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)} 
                className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/40 ${activeTheme.textSecondary}`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* User Info Card */}
              <div className={`p-5 rounded-2xl border ${activeTheme.isDark ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50 border-slate-200/60'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-lg uppercase shadow-md">
                    {user?.name?.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${activeTheme.textPrimary}`}>{user?.name}</h3>
                    <p className={`text-xs ${activeTheme.textSecondary}`}>{user?.email || 'Guest Session'}</p>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4 border-slate-200/40 dark:border-zinc-800/60 text-xs">
                  <div className="flex justify-between">
                    <span className={activeTheme.textSecondary}>Account Type</span>
                    <span className={`font-bold ${user?.isGuest ? 'text-amber-500' : 'text-blue-500'}`}>
                      {user?.isGuest ? 'Guest' : 'Registered User'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={activeTheme.textSecondary}>Active Workspace Notes</span>
                    <span className={`font-bold ${activeTheme.textPrimary}`}>{notes.length}</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="border-t pt-6 border-red-500/10">
                <h4 className="text-xs font-black uppercase tracking-widest text-red-500 mb-3 flex items-center gap-1.5">
                  <AlertCircle size={14} /> Danger Zone
                </h4>
                <p className={`text-xs leading-relaxed mb-4 ${activeTheme.textSecondary}`}>
                  {user?.isGuest 
                    ? "As a Guest, leaving logs out your session and discards any workspace changes. No account deletion is required."
                    : "Permanently delete your account and all associated notes, messages, comments, and collaborative configurations. This cannot be undone."}
                </p>
                
                {user?.isGuest ? (
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 transition cursor-pointer text-center"
                  >
                    Disconnect Guest Session
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowDeleteConfirmModal(true);
                      setDeleteConfirmText('');
                      setDeleteError('');
                    }}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/25 transition cursor-pointer text-center"
                  >
                    Delete Account & Data
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Double-Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 sm:p-8 border transition-all duration-300 transform scale-100 ${activeTheme.card} ${activeTheme.border}`}>
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertCircle size={24} className="animate-bounce" />
              <h2 className="text-xl font-black">Are you absolutely sure?</h2>
            </div>
            
            <p className={`text-xs leading-relaxed mb-6 ${activeTheme.textSecondary}`}>
              This action is <strong className="text-red-500">permanent</strong> and will delete:
            </p>
            <ul className={`list-disc pl-5 mb-6 text-xs space-y-1.5 ${activeTheme.textSecondary}`}>
              <li>Your user profile and credentials</li>
              <li>All collaborative notes owned by you</li>
              <li>All chat messages inside notes owned by you</li>
              <li>Your chat and editing history across notes</li>
              <li>Your profile details in notes shared with others</li>
            </ul>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${activeTheme.textSecondary}`}>
                  Type <span className="text-red-500 font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  required
                  placeholder="DELETE"
                  className={`w-full px-4 py-3 border rounded-xl outline-none transition focus:ring-2 focus:ring-red-500/35 focus:border-red-500 text-sm ${activeTheme.border} ${activeTheme.inputBg} ${activeTheme.textPrimary}`}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
              </div>

              {deleteError && (
                <div className="p-3 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-500 text-center">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${activeTheme.btnSec}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-red-650 hover:bg-red-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5`}
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Permanently Delete</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
