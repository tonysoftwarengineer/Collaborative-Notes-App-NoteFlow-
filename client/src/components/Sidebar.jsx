import { useContext, useState, useMemo, useEffect } from 'react';
import { NoteContext } from '../context/NoteContext';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Plus, FileText, LogOut, Palette, Sparkles, 
  AlertCircle, ChevronRight, ChevronDown, ChevronLeft, Trash, 
  RotateCcw, Trash2, Search, Settings, Star, Link as LinkIcon, MessageSquare
} from 'lucide-react';

const Sidebar = ({ 
  setIsCreating, 
  globalPresence, 
  setShowSettingsModal,
  isCollapsed = false,
  setIsCollapsed,
  isMobileOpen = false
}) => {
  const { notes, trashNotes, restoreNote, deleteNotePermanently, createNote } = useContext(NoteContext);
  const { user, logout, token } = useContext(AuthContext);
  const { themeName, setThemeName, activeTheme, themes } = useContext(ThemeContext);
  
  const [expandedNotes, setExpandedNotes] = useState({});
  const [showTrash, setShowTrash] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  
  // New Sidebar States
  const [collaborators, setCollaborators] = useState([]);
  const [starredNotes, setStarredNotes] = useState([]);
  const [pinnedLinks, setPinnedLinks] = useState([]);
  const [unreadComments, setUnreadComments] = useState([]);
  const [showInbox, setShowInbox] = useState(false);
  
  const [scratchpadText, setScratchpadText] = useState(localStorage.getItem('scratchpad') || '');
  const [showScratchpad, setShowScratchpad] = useState(false);

  const navigate = useNavigate();

  // Fetch Collaborators, Starred Notes, Comments, Links
  useEffect(() => {
    if (!token || user?.isGuest) return;
    const fetchData = async () => {
      try {
        const [collabRes, starRes, linkRes, commentRes] = await Promise.all([
          axios.get('http://localhost:5050/api/notes/collaborators', { headers: { 'x-auth-token': token } }),
          axios.get('http://localhost:5050/api/notes/starred', { headers: { 'x-auth-token': token } }),
          axios.get('http://localhost:5050/api/links', { headers: { 'x-auth-token': token } }),
          axios.get('http://localhost:5050/api/comments/unread', { headers: { 'x-auth-token': token } }),
        ]);
        if (collabRes.data.success) setCollaborators(collabRes.data.data);
        if (starRes.data.success) setStarredNotes(starRes.data.data);
        if (linkRes.data.success) setPinnedLinks(linkRes.data.data);
        if (commentRes.data.success) setUnreadComments(commentRes.data.data);
      } catch (err) {
        console.error('Error fetching sidebar data:', err);
      }
    };
    fetchData();
  }, [token, user]);

  // Handle Scratchpad
  useEffect(() => {
    localStorage.setItem('scratchpad', scratchpadText);
  }, [scratchpadText]);

  const handleDirectCreateNote = async () => {
    const note = await createNote('Untitled Note', 'General');
    if (note) {
      navigate(`/note/${note._id}`);
    }
  };

  const handleCreateSubPage = async (parentId) => {
    const note = await createNote('Untitled Sub-page', 'General', parentId);
    if (note) {
      setExpandedNotes((prev) => ({ ...prev, [parentId]: true }));
      navigate(`/note/${note._id}`);
    }
  };

  const toggleExpand = (noteId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedNotes((prev) => ({ ...prev, [noteId]: !prev[noteId] }));
  };

  const noteTree = useMemo(() => {
    if (sidebarSearchQuery.trim()) {
      const query = sidebarSearchQuery.toLowerCase();
      return notes
        .filter((note) => (note.title || 'Untitled Note').toLowerCase().includes(query))
        .map((note) => ({ ...note, children: [] }));
    }

    const map = {};
    const roots = [];
    notes.forEach((note) => { map[note._id] = { ...note, children: [] }; });
    notes.forEach((note) => {
      const mapped = map[note._id];
      if (note.parentId && map[note.parentId]) {
        map[note.parentId].children.push(mapped);
      } else {
        roots.push(mapped);
      }
    });
    return roots;
  }, [notes, sidebarSearchQuery]);


  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set();
    notes.forEach(note => {
      if (note.tags && note.tags.length > 0) {
        note.tags.forEach(t => tags.add(t));
      }
    });
    return Array.from(tags);
  }, [notes]);

  const renderNoteItem = (note, depth = 0) => {
    const isExpanded = !!expandedNotes[note._id];
    const hasChildren = note.children && note.children.length > 0;
    const activeCollaboratorsCount = globalPresence[note._id]?.length || 0;

    return (
      <div key={note._id} className="flex flex-col">
        <div
          className={`group flex items-center justify-between py-1.5 px-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${activeTheme.textPrimary} hover:bg-slate-100/60 dark:hover:bg-zinc-800/40`}
          onClick={() => navigate(`/note/${note._id}`)}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 font-semibold">
            <button
              onClick={(e) => toggleExpand(note._id, e)}
              className={`p-0.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded text-gray-400 transition-opacity ${!hasChildren ? 'opacity-0 cursor-default' : 'opacity-100'}`}
              disabled={!hasChildren}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <FileText size={15} className="text-gray-400 dark:text-zinc-500 group-hover:text-blue-500 transition-colors flex-shrink-0" />
            <span className="truncate">{note.title || 'Untitled Note'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {activeCollaboratorsCount > 0 && (
              <span title={`${activeCollaboratorsCount} active collaborator(s) editing`} className="flex h-2 w-2 relative flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCreateSubPage(note._id);
              }}
              title="Add a sub-page"
              className="p-1 hover:bg-slate-200/50 dark:hover:bg-zinc-700/50 rounded text-gray-400 transition opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="flex flex-col ml-3 pl-2.5 border-l border-slate-200/40 dark:border-zinc-800/55 space-y-0.5 mt-0.5">
            {note.children.map((child) => renderNoteItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleMarkAsRead = async (commentId) => {
    try {
      await axios.put(`http://localhost:5050/api/comments/${commentId}/read`, {}, { headers: { 'x-auth-token': token } });
      setUnreadComments(prev => prev.filter(c => c._id !== commentId));
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className={`
      fixed inset-y-0 left-0 z-45 lg:static lg:translate-x-0 flex flex-col border-r backdrop-blur-md transition-all duration-300 h-full
      ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      ${isCollapsed ? 'w-16' : 'w-64'}
      ${activeTheme.sidebar} ${activeTheme.border}
    `}>
      {/* Header */}
      <div className={`p-4 border-b flex ${isCollapsed ? 'flex-col gap-4 items-center' : 'justify-between items-center'} transition-all duration-300 ${activeTheme.sidebarHeader} ${activeTheme.border}`}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <Sparkles size={18} />
          </div>
          {!isCollapsed && (
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">NoteFlow</span>
          )}
        </div>
        <div className={`flex ${isCollapsed ? 'flex-col gap-3' : 'gap-1'} items-center`}>
          {!isCollapsed && (
            <button 
              onClick={() => setShowInbox(!showInbox)} 
              className="relative p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-200 cursor-pointer"
            >
              <MessageSquare size={18} />
              {unreadComments.length > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse border border-white dark:border-zinc-900"></span>
              )}
            </button>
          )}
          {!isCollapsed && (
            <button 
              onClick={logout} 
              title="Logout" 
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 cursor-pointer"
            >
              <LogOut size={18} />
            </button>
          )}
          {/* Collapse/Expand Toggle Button */}
          <button
            onClick={() => {
              if (setIsCollapsed) {
                setIsCollapsed(!isCollapsed);
              }
            }}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-200 cursor-pointer"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      {/* Inbox Dropdown (Absolute overlay) */}
      {showInbox && !isCollapsed && (
        <div className={`absolute top-16 left-4 w-64 z-50 rounded-xl border shadow-xl p-3 ${activeTheme.card} ${activeTheme.border}`}>
          <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${activeTheme.textSecondary}`}>Inbox ({unreadComments.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {unreadComments.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No new messages</p>
            ) : (
              unreadComments.map(c => (
                <div key={c._id} className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 cursor-pointer border border-slate-100 dark:border-zinc-700 hover:border-blue-500 transition-colors" onClick={() => { handleMarkAsRead(c._id); navigate(`/note/${c.note._id}`); setShowInbox(false); }}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-blue-500">{c.authorName}</span>
                    <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className={`text-xs truncate ${activeTheme.textPrimary}`}>{c.content}</p>
                  <p className={`text-[10px] mt-1 ${activeTheme.textSecondary}`}>In: {c.note.title}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Note Button or Guest Login Banner */}
      <div className={isCollapsed ? 'p-2 flex justify-center' : 'p-4'}>
        {user?.isGuest ? (
          isCollapsed ? (
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Sign In / Sign Up"
              className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer flex items-center justify-center"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                You are editing as a guest. Log in to create documents and save your progress.
              </p>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full text-center py-2 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer"
              >
                Sign In / Sign Up
              </button>
            </div>
          )
        ) : (
          <button
            onClick={() => {
              if (setIsCreating) {
                setIsCreating(true);
              } else {
                handleDirectCreateNote();
              }
            }}
            title="New Note"
            className={`flex items-center justify-center transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              isCollapsed 
                ? 'h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20' 
                : `w-full gap-2 py-3 rounded-xl font-bold text-sm ${activeTheme.btnBrand}`
            }`}
          >
            <Plus size={16} />
            {!isCollapsed && <span>New Note</span>}
          </button>
        )}
      </div>

      {/* Sidebar Search */}
      <div className={isCollapsed ? 'px-2 pb-4 flex justify-center' : 'px-4 pb-4'}>
        {isCollapsed ? (
          <button
            onClick={() => setIsCollapsed(false)}
            title="Search sidebar"
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${activeTheme.border} ${activeTheme.inputBg} ${activeTheme.textPrimary}`}
          >
            <Search size={14} />
          </button>
        ) : (
          <div className={`flex items-center gap-2 px-3 py-2 border rounded-xl transition-all ${activeTheme.border} ${activeTheme.inputBg}`}>
            <Search size={14} className="text-gray-400 dark:text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search sidebar..."
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
              className={`flex-1 bg-transparent border-none outline-none focus:ring-0 text-xs font-bold ${activeTheme.textPrimary} placeholder-gray-400 dark:placeholder-zinc-500 w-full`}
            />
            {sidebarSearchQuery && (
              <button
                onClick={() => setSidebarSearchQuery('')}
                className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-350 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className={`flex-1 overflow-y-auto space-y-6 py-2 ${isCollapsed ? 'px-1' : 'px-3'}`}>
        
        {/* Collaborators */}
        {!user?.isGuest && collaborators.length > 0 && (
          <div>
            {!isCollapsed && <h3 className="px-3 text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Team</h3>}
            <div className={isCollapsed ? 'space-y-2 flex flex-col items-center' : 'space-y-1'}>
              {collaborators.map(c => {
                // Determine if user is active in any room
                let activeNoteId = null;
                for (const [nId, users] of Object.entries(globalPresence)) {
                  if (users.some(u => u.userId === c._id)) {
                    activeNoteId = nId;
                    break;
                  }
                }
                return isCollapsed ? (
                  <div 
                    key={c._id} 
                    className="relative cursor-pointer hover:scale-115 transition-transform" 
                    onClick={() => activeNoteId && navigate(`/note/${activeNoteId}`)}
                    title={`${c.name} ${activeNoteId ? '(Editing)' : '(Offline)'}`}
                  >
                    <div className="h-6 w-6 rounded-full text-white flex items-center justify-center font-bold text-[10px] uppercase shadow-inner" style={{backgroundColor: c.color || '#3b82f6'}}>{c.name.substring(0,2)}</div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white dark:border-zinc-900 ${activeNoteId ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  </div>
                ) : (
                  <div key={c._id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer ${activeTheme.textPrimary} hover:bg-slate-100/60 dark:hover:bg-zinc-800/40`} onClick={() => activeNoteId && navigate(`/note/${activeNoteId}`)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative">
                        <div className="h-5 w-5 rounded-full text-white flex items-center justify-center font-bold text-[9px] uppercase shadow-inner" style={{backgroundColor: c.color || '#3b82f6'}}>{c.name.substring(0,2)}</div>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white dark:border-zinc-900 ${activeNoteId ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                      </div>
                      <span className="text-xs font-semibold truncate">{c.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Starred Notes */}
        {!user?.isGuest && starredNotes.length > 0 && (
          <div>
            {!isCollapsed && <h3 className="px-3 text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Star size={12}/> Starred</h3>}
            <div className={isCollapsed ? 'space-y-2 flex flex-col items-center' : 'space-y-0.5'}>
              {starredNotes.map(n => isCollapsed ? (
                <div key={n._id} className="cursor-pointer text-amber-500 hover:scale-115 transition-transform" onClick={() => navigate(`/note/${n._id}`)} title={n.title || 'Untitled Note'}>
                  <Star size={18} fill="currentColor" />
                </div>
              ) : (
                <div key={n._id} className={`flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all duration-200 ${activeTheme.textPrimary} hover:bg-slate-100/60 dark:hover:bg-zinc-800/40`} onClick={() => navigate(`/note/${n._id}`)}>
                  <FileText size={15} className="text-amber-500" />
                  <span className="truncate">{n.title || 'Untitled Note'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {!user?.isGuest && allTags.length > 0 && !isCollapsed && (
          <div>
            <h3 className="px-3 text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5 px-3">
              {allTags.map(tag => (
                <span key={tag} className="px-2 py-1 text-[10px] font-bold rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Workspace Pages */}
        {!user?.isGuest && (
          <div>
            {!isCollapsed && <h3 className="px-3 text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Workspace Pages</h3>}
            <div className={isCollapsed ? 'space-y-2 flex flex-col items-center' : 'space-y-0.5'}>
              {noteTree.length === 0 ? (
                !isCollapsed && (
                  <div className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500 italic flex items-center gap-1.5 font-semibold">
                    <AlertCircle size={13} />
                    No notes created yet.
                  </div>
                )
              ) : (
                isCollapsed ? (
                  noteTree.map((note) => (
                    <div 
                      key={note._id} 
                      className="cursor-pointer text-gray-400 hover:text-blue-500 hover:scale-115 transition-transform" 
                      onClick={() => navigate(`/note/${note._id}`)}
                      title={note.title || 'Untitled Note'}
                    >
                      <FileText size={18} />
                    </div>
                  ))
                ) : (
                  noteTree.map((note) => renderNoteItem(note, 0))
                )
              )}
            </div>
          </div>
        )}

        {/* Pinned Links */}
        {!user?.isGuest && pinnedLinks.length > 0 && (
          <div>
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3 mb-2">
                <h3 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Links</h3>
              </div>
            )}
            <div className={isCollapsed ? 'space-y-2 flex flex-col items-center' : 'space-y-0.5'}>
              {pinnedLinks.map(link => isCollapsed ? (
                <a href={link.url} target="_blank" rel="noopener noreferrer" key={link._id} className="cursor-pointer text-gray-450 hover:text-blue-550 hover:scale-115 transition-transform" title={link.title}>
                  <LinkIcon size={16} />
                </a>
              ) : (
                <a href={link.url} target="_blank" rel="noopener noreferrer" key={link._id} className={`flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all duration-200 ${activeTheme.textPrimary} hover:bg-slate-100/60 dark:hover:bg-zinc-800/40`}>
                  <LinkIcon size={14} className="text-gray-400" />
                  <span className="truncate text-xs">{link.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trash Panel */}
      {!user?.isGuest && (
        <div className={`py-2 border-t transition-colors duration-300 ${activeTheme.border} ${isCollapsed ? 'flex justify-center' : 'px-4'}`}>
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title={`Trash (${trashNotes.length})`}
            >
              <Trash size={18} />
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowTrash((prev) => !prev)}
                className="w-full flex items-center justify-between text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2 transition cursor-pointer hover:text-gray-600 dark:hover:text-zinc-300"
              >
                <div className="flex items-center gap-1">
                  <Trash size={12} />
                  <span>Trash ({trashNotes.length})</span>
                </div>
                {showTrash ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {showTrash && (
                <div className="space-y-1 max-h-48 overflow-y-auto mt-2">
                  {trashNotes.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-zinc-500 italic px-2 py-1 font-semibold">Trash is empty</p>
                  ) : (
                    trashNotes.map((note) => (
                      <div key={note._id} className="flex items-center justify-between p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-sm text-gray-600 dark:text-zinc-300 group">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="truncate font-semibold text-xs" title={note.title}>{note.title || 'Untitled Note'}</div>
                          {note.deletedBy && <div className="text-[9px] text-gray-400 truncate">Deleted by someone</div>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => restoreNote(note._id)}
                            title="Restore Note"
                            className="p-1 hover:bg-green-100 dark:hover:bg-green-950/30 hover:text-green-600 rounded text-gray-450 transition cursor-pointer"
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Permanently delete "${note.title || 'Untitled Note'}"?`)) {
                                deleteNotePermanently(note._id);
                              }
                            }}
                            title="Delete Permanently"
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-950/30 hover:text-red-650 rounded text-gray-450 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Interactive Scratchpad */}
      {!isCollapsed && (
        <div className={`border-t transition-colors duration-300 ${activeTheme.border}`}>
          <div 
            onClick={() => setShowScratchpad(!showScratchpad)} 
            className="px-4 py-2 flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/40"
          >
            <span>Quick Scratchpad</span>
            {showScratchpad ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
          {showScratchpad && (
            <div className="px-3 pb-3">
              <textarea 
                value={scratchpadText}
                onChange={(e) => setScratchpadText(e.target.value)}
                placeholder="Paste snippets or jot ideas..."
                className={`w-full h-24 p-2 text-xs rounded-lg resize-none outline-none border focus:ring-1 focus:ring-blue-500 transition-colors ${activeTheme.isDark ? 'bg-zinc-950/50 border-zinc-700 text-zinc-300' : 'bg-yellow-50/50 border-yellow-200 text-slate-700'}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Footer with Theme Selector */}
      <div className={`border-t transition-colors duration-300 ${activeTheme.sidebarHeader} ${activeTheme.border} ${isCollapsed ? 'p-2 flex flex-col items-center gap-4' : 'p-4 space-y-4'}`}>
        {/* Theme Selector UI */}
        {!isCollapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <Palette size={12} className="text-gray-400 dark:text-zinc-500" />
              <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Theme Settings</span>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-slate-100/50 dark:bg-zinc-950/40 p-1.5 rounded-xl border border-slate-200/50 dark:border-zinc-800/40">
              {Object.keys(themes).map((tName) => {
                const isSelected = themeName === tName;
                const colors = { slate: 'bg-blue-500', forest: 'bg-emerald-600', sunset: 'bg-rose-500', cyberpunk: 'bg-fuchsia-600' };
                return (
                  <button
                    key={tName}
                    onClick={() => setThemeName(tName)}
                    title={themes[tName].name}
                    className={`h-7 w-full rounded-lg ${colors[tName]} transition-all duration-300 relative transform hover:scale-105 flex items-center justify-center cursor-pointer`}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCollapsed(false)}
            className="text-gray-400 hover:text-blue-500 transition-colors"
            title="Theme Settings"
          >
            <Palette size={18} />
          </button>
        )}

        {/* User profile details */}
        {isCollapsed ? (
          <div 
            onClick={() => setShowSettingsModal(true)}
            className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-inner flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
            title="User Profile Settings"
          >
            {user?.name?.substring(0, 2) || 'G'}
          </div>
        ) : (
          <div 
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-3 bg-slate-100/30 dark:bg-zinc-800/20 p-2 rounded-xl border border-slate-200/20 dark:border-zinc-800/10 hover:bg-slate-100/60 dark:hover:bg-zinc-850/40 cursor-pointer transition-all duration-205"
            title="User Profile Settings"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-inner flex-shrink-0">
              {user?.name?.substring(0, 2) || 'G'}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-bold truncate ${activeTheme.textPrimary}`}>{user?.name || 'Guest'}</p>
              <p className="text-[10px] text-gray-450 dark:text-zinc-450 truncate">{user?.email || (user?.isGuest ? 'Guest Session' : '')}</p>
            </div>
            <Settings size={14} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 transition-colors" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
