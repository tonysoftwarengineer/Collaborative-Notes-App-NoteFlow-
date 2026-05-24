import { useEffect, useContext, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { NoteContext } from '../context/NoteContext';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import ChatDrawer from '../components/ChatDrawer';
import Sidebar from '../components/Sidebar';
import { 
  ArrowLeft, Trash2, Share2, Users, Mic, MicOff, 
  MessageSquare, Smile, Sparkles, Menu, Loader2, AlertCircle, Settings, MoreVertical 
} from 'lucide-react';
import io from 'socket.io-client';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import axios from 'axios';
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

const fallbackUserId = `temp_${Math.random().toString(36).substring(2, 9)}`;

const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getNote, updateNote, deleteNote, shareNote, currentNote } = useContext(NoteContext);
  const { token, user, loginAsGuest, logout } = useContext(AuthContext);
  const { activeTheme } = useContext(ThemeContext);
  
  const [title, setTitle] = useState('');
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareStatus, setShareStatus] = useState({ type: '', message: '' });
  const [activeUsers, setActiveUsers] = useState([]);
  const [globalPresence, setGlobalPresence] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Settings & Account Deletion Modal States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isChatOpenRef = useRef(isChatOpen);

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

  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [followingUserId, setFollowingUserId] = useState(null);
  const reactionEmojis = ['👍', '❤️', '🎉', '😂', '🔥', '😮', '💡', '❓'];

  const isEditable = useMemo(() => {
    if (!currentNote || !user) return false;
    const userId = user._id || user.id;
    const isOwner = currentNote.owner === userId || currentNote.owner?._id === userId;
    const isCollaborator = currentNote.collaborators?.includes(userId);
    const isPublicEdit = currentNote.publicAccess === 'edit';
    return isOwner || isCollaborator || isPublicEdit;
  }, [currentNote, user]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // Ephemeral Guest Authentication Effect
  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        await loginAsGuest();
      }
    };
    initAuth();
  }, [token, loginAsGuest]);

  const socketRef = useRef(null);
  const doc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(() => new awarenessProtocol.Awareness(doc), [doc]);
  const saveTimeoutRef = useRef(null);

  const collabUser = useMemo(() => {
    const id = user?.id || user?._id || fallbackUserId;
    const name = user?.name || "Anonymous";
    const color = (user?._id || user?.id)
      ? `#${Math.abs((user._id || user.id).split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)).toString(16).substring(0, 6)}`
      : "#3b82f6";
    return { id, name, color };
  }, [user]);

  // Initialize BlockNote with Collaboration & Presence
  const editor = useCreateBlockNote({
    collaboration: {
      fragment: doc.getXmlFragment("document-store"),
      user: collabUser,
      provider: { awareness }
    },
    uploadFile: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('http://localhost:5050/api/notes/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token
        }
      });
      if (res.data.success) {
        return res.data.data.url;
      }
      throw new Error(res.data.error || 'Upload failed');
    }
  });

  const checkIsEmpty = useCallback(() => {
    if (!editor) return true;
    const docs = editor.document;
    if (docs.length === 1 && docs[0].type === 'paragraph') {
      const content = docs[0].content;
      if (!content || content.length === 0 || (content.length === 1 && content[0].text === '')) {
        return true;
      }
    }
    return false;
  }, [editor]);

  // Voice to Text Logic
  const handleSpeechResult = useCallback(({ final }) => {
    if (!final || !editor) return;

    const lowerTranscript = final.toLowerCase().trim();
    
    // Ensure the editor has focus before executing content insertions or commands
    editor.focus();
    const selection = editor.getTextCursorPosition();

    if (!selection) {
      editor.insertInlineContent(final);
      return;
    }

    // Smart Command Detection
    if (lowerTranscript.includes("new paragraph")) {
      const inserted = editor.insertBlocks([{ type: "paragraph", content: "" }], selection.block, "after");
      if (inserted && inserted[0]) {
        editor.setTextCursorPosition(inserted[0], "start");
      }
    } else if (lowerTranscript.includes("checklist") || lowerTranscript.includes("to do")) {
      const inserted = editor.insertBlocks([{ type: "checkListItem", content: "" }], selection.block, "after");
      if (inserted && inserted[0]) {
        editor.setTextCursorPosition(inserted[0], "start");
      }
    } else if (lowerTranscript.includes("bullet point")) {
      const inserted = editor.insertBlocks([{ type: "bulletListItem", content: "" }], selection.block, "after");
      if (inserted && inserted[0]) {
        editor.setTextCursorPosition(inserted[0], "start");
      }
    } else if (lowerTranscript.includes("heading one")) {
      editor.updateBlock(selection.block, { type: "heading", props: { level: 1 } });
    } else if (lowerTranscript.includes("heading two")) {
      editor.updateBlock(selection.block, { type: "heading", props: { level: 2 } });
    } else {
      // Regular text insertion at cursor position, behaving like natural typing
      editor.insertInlineContent(final);
    }
  }, [editor]);

  const { isListening, startListening, stopListening, error: speechError } = useSpeechRecognition(handleSpeechResult);

  // Spawn floating emoji helper
  const spawnFloatingEmoji = useCallback((emoji, blockId) => {
    let targetElement = null;
    if (blockId) {
      targetElement = document.querySelector(`[data-id="${blockId}"]`);
    }
    
    const rect = targetElement 
      ? targetElement.getBoundingClientRect() 
      : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
      
    const div = document.createElement('div');
    div.innerText = emoji;
    div.className = 'fixed z-50 pointer-events-none text-3xl select-none animate-float-emoji';
    
    // Position it slightly offset relative to the block
    const randomOffset = Math.random() * 60 - 30;
    div.style.left = `${Math.max(20, rect.left + 80 + randomOffset)}px`;
    div.style.top = `${rect.top - 15}px`;
    
    document.body.appendChild(div);
    setTimeout(() => {
      div.remove();
    }, 1200);
  }, []);

  // Socket.io & Yjs Sync
  useEffect(() => {
    if (!token) return; // Wait until guest or user token is active
    
    socketRef.current = io('http://localhost:5050', {
      auth: { token }
    });
    
    socketRef.current.emit('join-note', id);
    socketRef.current.emit('request-global-presence');

    socketRef.current.on('global-presence-update', (presenceMap) => {
      setGlobalPresence(presenceMap);
    });

    socketRef.current.on('init-note-state', (state) => {
      Y.applyUpdate(doc, new Uint8Array(state), 'server');
    });

    socketRef.current.on('receive-update', (update) => {
      Y.applyUpdate(doc, new Uint8Array(update), 'server');
    });

    socketRef.current.on('receive-awareness', (update) => {
      awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(update), socketRef.current.id);
    });

    socketRef.current.on('receive-cursor-reaction', ({ emoji, blockId }) => {
      spawnFloatingEmoji(emoji, blockId);
    });

    socketRef.current.on('init-chat-history', (history) => {
      setChatMessages(history);
    });

    socketRef.current.on('receive-chat-message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatOpenRef.current) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    socketRef.current.on('restore-revision-state', (state) => {
      Y.applyUpdate(doc, new Uint8Array(state), 'server');
    });

    const handleDocUpdate = (update, origin) => {
      if (origin === 'server') return;
      if (!isEditable) return; // Prevent local updates from sending if read-only
      
      socketRef.current.emit('update-note-content', { noteId: id, update: Array.from(update) });
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setIsSaving(true);
        socketRef.current.emit('save-to-db', { noteId: id, blocks: editor.document });
        setTimeout(() => setIsSaving(false), 500);
      }, 3000);
    };

    doc.on('update', handleDocUpdate);

    const handleAwarenessUpdate = () => {
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID]);
      socketRef.current.emit('update-awareness', { noteId: id, awarenessUpdate: Array.from(update) });
      
      const states = awareness.getStates();
      const users = [];
      states.forEach((state, clientId) => {
        if (state.user) {
          users.push({
            clientId,
            id: state.user.id || state.user._id,
            name: state.user.name,
            color: state.user.color,
            activeBlockId: state.activeBlockId
          });
        }
      });
      setActiveUsers(users);
    };

    awareness.on('update', handleAwarenessUpdate);

    socketRef.current.on('error', (err) => {
      console.error('Socket error:', err);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      socketRef.current = null;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      doc.off('update', handleDocUpdate);
      awareness.off('update', handleAwarenessUpdate);
    };
  }, [id, token, doc, editor, awareness, user, spawnFloatingEmoji, isEditable]);

  // Track cursor block ID in Yjs Awareness and empty state check
  useEffect(() => {
    if (!editor || !awareness) return;
    
    // Set initial empty state asynchronously to avoid cascading render warning
    const timer = setTimeout(() => {
      setIsEditorEmpty(checkIsEmpty());
    }, 0);

    const unsubscribe = editor.onChange(() => {
      // Update empty state
      setIsEditorEmpty(checkIsEmpty());

      const selection = editor.getTextCursorPosition();
      if (selection && selection.block) {
        const currentLocal = awareness.getLocalState();
        if (!currentLocal || currentLocal.activeBlockId !== selection.block.id) {
          awareness.setLocalStateField('activeBlockId', selection.block.id);
        }
      }
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [editor, awareness, checkIsEmpty]);

  // Followed User Scrolling Sync Effect
  useEffect(() => {
    if (!followingUserId) return;
    const followedUser = activeUsers.find((u) => u.id === followingUserId);
    if (followedUser && followedUser.activeBlockId) {
      const element = document.querySelector(`[data-id="${followedUser.activeBlockId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [followingUserId, activeUsers]);

  // Interaction key/mouse listener to disengage Presenter Mode
  useEffect(() => {
    if (!followingUserId) return;

    const handleInteraction = () => {
      setFollowingUserId(null);
    };

    window.addEventListener('wheel', handleInteraction, { passive: true });
    window.addEventListener('mousedown', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [followingUserId]);

  // Reaction hotkey: Toggle Reaction Menu when pressing E outside text inputs
  useEffect(() => {
    const handleKeyPress = (e) => {
      const target = e.target;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.hasAttribute('contenteditable') ||
        target.closest('[contenteditable="true"]');

      if ((e.key === 'e' || e.key === 'E') && !isInput) {
        e.preventDefault();
        setShowReactionMenu((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  const sendReaction = (emoji) => {
    if (socketRef.current) {
      const selection = editor.getTextCursorPosition();
      const blockId = selection?.block?.id || null;
      socketRef.current.emit('cursor-reaction', {
        noteId: id,
        emoji,
        blockId
      });
      // Also spawn locally so the sender sees it immediately
      spawnFloatingEmoji(emoji, blockId);
    }
    setShowReactionMenu(false);
  };

  const sendChatMessage = (text) => {
    if (socketRef.current) {
      socketRef.current.emit('send-chat-message', { noteId: id, text });
    }
  };

  useEffect(() => {
    const fetchNoteData = async () => {
      const note = await getNote(id);
      if (note) setTitle(note.title);
      else navigate('/');
    };
    fetchNoteData();
  }, [id, getNote, navigate]);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    updateNote(id, { title: newTitle });
  };

  const handleShare = async (e) => {
    e.preventDefault();
    setShareStatus({ type: 'info', message: 'Sharing...' });
    const res = await shareNote(id, shareEmail);
    if (res.success) {
      setShareStatus({ type: 'success', message: 'Note shared successfully!' });
      setShareEmail('');
    } else {
      setShareStatus({ type: 'error', message: res.error });
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      const success = await deleteNote(id);
      if (success) navigate('/');
    }
  };

  if (!currentNote && !title) return <div className={`p-8 text-center text-gray-500 h-screen transition-colors duration-300 ${activeTheme?.bg || ''}`}>Initializing document...</div>;

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${activeTheme.bg}`}>
      {/* Sidebar Component */}
      <Sidebar 
        setIsCreating={null}
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

      {/* Main Editor Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {user?.isGuest && (
          <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20 px-6 py-2 text-xs font-semibold flex items-center justify-between transition-colors duration-300 flex-shrink-0">
            <span>You are editing this note as a guest. Sign in or register to save notes permanently to your account.</span>
            <div className="flex gap-4">
              <Link to="/login" className="underline hover:text-amber-500 transition font-bold">Log In</Link>
              <Link to="/register" className="underline hover:text-amber-500 transition font-bold">Register</Link>
            </div>
          </div>
        )}

        <div className={`flex items-center justify-between px-6 py-3 border-b shadow-sm transition-colors duration-300 ${activeTheme.sidebar} ${activeTheme.border} flex-shrink-0`}>
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Hamburger Menu button */}
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-zinc-800/40 cursor-pointer"
            >
              <Menu size={20} />
            </button>

            <Link to="/" className={`p-2 rounded-full transition ${activeTheme.btnSec}`}>
              <ArrowLeft size={20} />
            </Link>
            <input
              type="text"
              className={`text-xl font-bold bg-transparent border-none outline-none focus:ring-0 w-full max-w-xl ${activeTheme.textPrimary}`}
              value={title}
              onChange={handleTitleChange}
              placeholder="Untitled Note"
            />
          </div>
        
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="flex -space-x-2 overflow-hidden mr-1 sm:mr-4 flex-shrink-0 items-center">
            {activeUsers.map((u, i) => {
              const isSelf = u.id === (user?._id || user?.id);
              const isFollowed = followingUserId === u.id;
              return (
                <button
                  key={i}
                  disabled={isSelf}
                  onClick={() => {
                    if (isFollowed) {
                      setFollowingUserId(null);
                    } else {
                      setFollowingUserId(u.id);
                    }
                  }}
                  title={isSelf ? `${u.name} (You)` : `Click to follow ${u.name}'s view`}
                  className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full border items-center justify-center text-[9px] sm:text-[10px] font-bold text-white uppercase shadow-sm transition-all duration-300 transform hover:scale-110 cursor-pointer ${
                    i > 0 ? 'hidden md:inline-flex' : 'inline-flex'
                  } ${
                    isFollowed 
                      ? 'ring-4 ring-blue-500 ring-offset-2 animate-pulse scale-105 z-20' 
                      : activeTheme.isDark ? 'ring-2 ring-zinc-900 border-zinc-800' : 'ring-2 ring-white border-slate-200'
                  } ${isSelf ? 'cursor-not-allowed opacity-85' : ''}`}
                  style={{ backgroundColor: u.color }}
                >
                  {u.name.substring(0, 2)}
                </button>
              );
            })}
            {activeUsers.length > 0 && (
              <div className="flex items-center ml-2 text-xs text-green-500 font-semibold animate-pulse gap-1">
                <Users size={12} /> <span className="hidden sm:inline">{activeUsers.length} active</span><span className="sm:hidden">{activeUsers.length}</span>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-1 sm:gap-2 border-l pl-2 sm:pl-4 ${activeTheme.border} flex-shrink-0`}>
            {/* Dictation Button */}
            <div className="relative">
              {isListening && (
                <>
                  <span className="absolute -inset-1 rounded-lg bg-red-500/30 animate-ping opacity-75"></span>
                  <span className="absolute -inset-2 rounded-lg bg-red-500/10 animate-pulse opacity-50"></span>
                </>
              )}
              <button
                onClick={isListening ? stopListening : startListening}
                onMouseDown={(e) => e.preventDefault()} // Prevent editor focus loss when clicking mic
                className={`p-1.5 sm:p-2 rounded-lg transition relative z-10 ${
                  isListening 
                    ? 'bg-red-500 text-white' 
                    : `hover:bg-slate-100 dark:hover:bg-zinc-800/60 ${activeTheme.textSecondary}`
                }`}
                title={isListening ? "Stop Dictation" : "Start Dictation"}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>

            {/* Synced dot status badge */}
            <div className="flex items-center gap-1.5 mr-1" title={isSaving ? "Saving changes..." : "All changes synced"}>
              <span className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
              <span className={`text-[10px] uppercase tracking-widest font-black hidden md:inline ${isSaving ? activeTheme.textSecondary : 'text-green-500'}`}>
                {isSaving ? 'Saving' : 'Synced'}
              </span>
            </div>

            {/* Chat Toggle Button */}
            <button 
              onClick={() => {
                const nextState = !isChatOpen;
                setIsChatOpen(nextState);
                if (nextState) {
                  setUnreadCount(0);
                }
              }} 
              className={`p-1.5 sm:p-2 rounded-lg transition relative ${
                isChatOpen 
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' 
                  : `hover:bg-slate-100 dark:hover:bg-zinc-800/60 ${activeTheme.textSecondary}`
              }`}
              title="Chat"
            >
              <MessageSquare size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center border border-white dark:border-zinc-900 animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Reaction Trigger Button */}
            <div className="relative">
              <button
                onClick={() => setShowReactionMenu(!showReactionMenu)}
                className={`p-1.5 sm:p-2 rounded-lg transition relative cursor-pointer ${
                  showReactionMenu 
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' 
                    : `hover:bg-slate-100 dark:hover:bg-zinc-800/60 ${activeTheme.textSecondary}`
                }`}
                title="Send Reaction (Press E outside editor)"
              >
                <Smile size={16} />
              </button>
              {showReactionMenu && (
                <div className={`absolute right-0 mt-2 p-2 rounded-xl border shadow-xl flex gap-1 z-50 transition-all duration-300 ${activeTheme.card} ${activeTheme.border}`}>
                  {reactionEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="hover:scale-130 active:scale-95 transition-all text-xl p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/60 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className={`p-1.5 sm:p-2 rounded-lg transition relative cursor-pointer ${
                  showActionMenu 
                    ? 'bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-150' 
                    : `hover:bg-slate-100 dark:hover:bg-zinc-800/60 ${activeTheme.btnSec}`
                }`}
                title="More Actions"
              >
                <MoreVertical size={16} />
              </button>
              {showActionMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowActionMenu(false)} />
                  <div className={`absolute right-0 mt-2 w-48 rounded-xl border shadow-xl z-50 py-1.5 transition-all duration-300 ${activeTheme.card} ${activeTheme.border}`}>
                    <button
                      onClick={() => {
                        setShowActionMenu(false);
                        setShowShareModal(true);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-zinc-850 ${activeTheme.textPrimary}`}
                    >
                      <Share2 size={14} />
                      Share Note
                    </button>
                    <button
                      onClick={() => {
                        setShowActionMenu(false);
                        handleDelete();
                      }}
                      className="w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 size={14} />
                      Delete Note
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full p-8 border transition-colors duration-300 ${activeTheme.card} ${activeTheme.border}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-black ${activeTheme.textPrimary}`}>Share with team</h2>
              <button 
                onClick={() => { setShowShareModal(false); setShareStatus({ type: '', message: '' }); }} 
                className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/40 ${activeTheme.textSecondary}`}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleShare} className="space-y-6">
              <div>
                <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${activeTheme.textSecondary}`}>Collaborator Email</label>
                <input
                  type="email"
                  required
                  placeholder="teammate@example.com"
                  className={`w-full px-4 py-3 border rounded-xl outline-none transition focus:ring-2 focus:ring-blue-500/50 ${activeTheme.border} ${activeTheme.inputBg} ${activeTheme.textPrimary}`}
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                />
              </div>
              {shareStatus.message && (
                <div className={`p-3 rounded-lg text-sm font-semibold border ${
                  shareStatus.type === 'error' 
                    ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                    : 'bg-green-500/10 text-green-500 border-green-500/20'
                }`}>
                  {shareStatus.message}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowShareModal(false)} 
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${activeTheme.btnSec}`}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${activeTheme.btnBrand}`}
                >
                  Send Invite
                </button>
              </div>
            </form>

            {/* Public Link Sharing Section */}
            <div className={`border-t pt-6 mt-6 ${activeTheme.border}`}>
              <h3 className={`text-sm font-black uppercase tracking-widest mb-3 ${activeTheme.textSecondary}`}>Public Link Access</h3>
              {currentNote && user && (currentNote.owner === (user._id || user.id) || currentNote.owner?._id === (user._id || user.id)) ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <select
                      value={currentNote?.publicAccess || 'none'}
                      onChange={async (e) => {
                        const val = e.target.value;
                        await updateNote(id, { publicAccess: val });
                      }}
                      className={`flex-1 px-3 py-2.5 border rounded-xl outline-none transition focus:ring-2 focus:ring-blue-500/50 ${activeTheme.border} ${activeTheme.inputBg} ${activeTheme.textPrimary} text-sm font-semibold`}
                    >
                      <option value="none">Private (Invite only)</option>
                      <option value="read">Anyone with link can view</option>
                      <option value="edit">Anyone with link can edit</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className={`text-sm font-semibold ${activeTheme.textSecondary}`}>
                  {currentNote?.publicAccess === 'edit' && 'Anyone with this link can edit.'}
                  {currentNote?.publicAccess === 'read' && 'Anyone with this link can view.'}
                  {currentNote?.publicAccess === 'none' && 'This note is private.'}
                </div>
              )}

              {currentNote?.publicAccess && currentNote.publicAccess !== 'none' && (
                <div className="mt-4 space-y-2">
                  <label className={`block text-[10px] font-black uppercase tracking-widest ${activeTheme.textSecondary}`}>Share Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/note/${id}`}
                      className={`flex-1 px-3 py-2 border rounded-xl outline-none text-xs font-semibold ${activeTheme.border} ${activeTheme.inputBg} ${activeTheme.textSecondary}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/note/${id}`);
                        setShareStatus({ type: 'success', message: 'Link copied to clipboard!' });
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${activeTheme.btnSec}`}
                    >
                      <Share2 size={14} />
                      Copy Link
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pt-8 pb-32">
        {speechError && (
          <div className="max-w-4xl mx-auto px-8 mb-4">
            <div className="bg-red-50 text-red-650 p-3 rounded-lg text-sm font-semibold border border-red-200">
              {speechError}
            </div>
          </div>
        )}

        {isEditorEmpty && (
          <div className={`mb-8 p-6 rounded-xl border max-w-4xl mx-auto font-sans transition-all duration-300 animate-pop-in ${
            activeTheme.isDark 
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100' 
              : 'bg-slate-50/60 border-slate-200/80 text-slate-800 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.02)]'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${activeTheme.badgeBg} flex-shrink-0`}>
                <Sparkles size={16} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Collaborative Workspace Ready</h4>
                <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed">
                  Start typing to document your ideas. Other collaborators can join and view your changes in real-time.
                </p>
                <div className="flex flex-wrap gap-2 pt-2.5">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                    activeTheme.isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    Type <kbd className="font-mono">/</kbd> for blocks
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                    activeTheme.isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    Press <kbd className="font-mono">⌘K</kbd> for commands
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                    activeTheme.isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    Click <Mic size={10} className="inline mr-0.5" /> to dictate
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                    activeTheme.isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    Press <kbd className="font-mono">E</kbd> for emojis
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto px-8 font-semibold">
          <BlockNoteView editor={editor} editable={isEditable} theme={activeTheme.blockNoteTheme} />
        </div>
      </div>

      {isChatOpen && (
        <ChatDrawer 
          messages={chatMessages}
          sendChatMessage={sendChatMessage}
          onClose={() => setIsChatOpen(false)}
          activeTheme={activeTheme}
          currentUserId={user?._id || user?.id}
          socketRef={socketRef}
          noteId={id}
          token={token}
          user={user}
          activeUsers={activeUsers}
        />
      )}
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

export default Editor;
