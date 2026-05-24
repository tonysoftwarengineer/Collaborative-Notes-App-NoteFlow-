import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, MessageSquare, X, MessageCircle, History, Save, Clock, ArrowUpRight } from 'lucide-react';
import axios from 'axios';

const ChatDrawer = ({ 
  messages, 
  sendChatMessage, 
  onClose, 
  activeTheme, 
  currentUserId,
  socketRef,
  noteId,
  token,
  user,
  activeUsers
}) => {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'comments', 'revisions'
  
  // Chat state
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  // Comments state
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const commentsEndRef = useRef(null);

  // Revisions state
  const [revisions, setRevisions] = useState([]);
  const [isSavingRevision, setIsSavingRevision] = useState(false);
  const [isRestoringRevision, setIsRestoringRevision] = useState(false);

  // Scroll functions
  const scrollChatToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  const scrollCommentsToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll chat on load or update
  useEffect(() => {
    if (activeTab === 'chat') {
      scrollChatToBottom();
    }
  }, [messages, activeTab]);

  // Scroll comments on load or update
  useEffect(() => {
    if (activeTab === 'comments') {
      scrollCommentsToBottom();
    }
  }, [comments, activeTab]);

  // Fetch comments and collaborators on mount or when noteId changes
  useEffect(() => {
    const fetchComments = async () => {
      if (!noteId || !token) return;
      try {
        const res = await axios.get(`http://localhost:5050/api/comments/note/${noteId}`, {
          headers: { 'x-auth-token': token }
        });
        if (res.data.success) {
          setComments(res.data.data);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    };

    const fetchCollabs = async () => {
      if (!token) return;
      try {
        const res = await axios.get('http://localhost:5050/api/notes/collaborators', {
          headers: { 'x-auth-token': token }
        });
        if (res.data.success) {
          setCollaborators(res.data.data);
        }
      } catch (err) {
        console.error('Error fetching collaborators:', err);
      }
    };

    fetchComments();
    fetchCollabs();
  }, [noteId, token]);

  // Fetch revisions when revisions tab is selected
  const fetchRevisions = useCallback(async () => {
    if (!noteId || !token) return;
    try {
      const res = await axios.get(`http://localhost:5050/api/notes/${noteId}/revisions`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data.success) {
        setRevisions(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching revisions:', err);
    }
  }, [noteId, token]);

  useEffect(() => {
    if (activeTab === 'revisions') {
      const timer = setTimeout(() => {
        fetchRevisions();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchRevisions]);

  // Mark comments as read when comments tab becomes active
  useEffect(() => {
    if (activeTab === 'comments' && noteId && token) {
      const markAsRead = async () => {
        try {
          await axios.put(`http://localhost:5050/api/comments/note/${noteId}/read`, {}, {
            headers: { 'x-auth-token': token }
          });
        } catch (err) {
          console.error('Error marking comments as read:', err);
        }
      };
      markAsRead();
    }
  }, [activeTab, noteId, token]);

  // Listen for comments via socket.io
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handleReceiveComment = (comment) => {
      if (comment.noteId === noteId) {
        setComments((prev) => {
          if (prev.some((c) => c._id === comment._id)) return prev;
          return [...prev, comment];
        });
      }
    };

    socket.on('receive-comment', handleReceiveComment);
    return () => {
      socket.off('receive-comment', handleReceiveComment);
    };
  }, [socketRef, noteId]);

  // Handle Mentions list compilation
  const allMentionableUsers = useMemo(() => {
    const map = new Map();
    // Add active users in the room
    if (activeUsers) {
      activeUsers.forEach((u) => {
        if (u.name) map.set(u.id || u._id || u.name, { id: u.id || u._id, name: u.name });
      });
    }
    // Add database collaborators
    collaborators.forEach((u) => {
      if (u.name) map.set(u._id || u.id, { id: u._id || u.id, name: u.name });
    });
    return Array.from(map.values());
  }, [collaborators, activeUsers]);

  const filteredUsers = useMemo(() => {
    if (!mentionQuery) return allMentionableUsers.slice(0, 5);
    return allMentionableUsers.filter((u) =>
      u.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [allMentionableUsers, mentionQuery]);

  // Handlers
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendChatMessage(text);
    setText('');
  };

  const handleCommentChange = (e) => {
    const value = e.target.value;
    setCommentText(value);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursor);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setMentionQuery(lastWord.slice(1));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (username) => {
    const textarea = document.getElementById('comment-input-field');
    if (!textarea) return;

    const cursor = textarea.selectionStart;
    const textBeforeCursor = commentText.slice(0, cursor);
    const textAfterCursor = commentText.slice(cursor);

    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex === -1) return;

    const newTextBefore = textBeforeCursor.slice(0, lastAtIndex) + `@${username} `;
    setCommentText(newTextBefore + textAfterCursor);
    setShowMentions(false);

    setTimeout(() => {
      textarea.focus();
      const pos = newTextBefore.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const res = await axios.post(
        'http://localhost:5050/api/comments',
        {
          noteId,
          content: commentText,
          authorName: user?.name || 'Anonymous'
        },
        { headers: { 'x-auth-token': token } }
      );

      if (res.data.success) {
        const newComment = res.data.data;
        setComments((prev) => [...prev, newComment]);
        socketRef?.current?.emit('send-comment', { noteId, comment: newComment });
        setCommentText('');
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    }
  };

  const handleCreateRevision = async () => {
    setIsSavingRevision(true);
    try {
      const res = await axios.post(
        `http://localhost:5050/api/notes/${noteId}/revisions`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      if (res.data.success) {
        fetchRevisions();
      }
    } catch (err) {
      console.error('Error creating revision:', err);
    } finally {
      setIsSavingRevision(false);
    }
  };

  const handleRestoreRevision = async (revisionId) => {
    if (!window.confirm("Are you sure you want to restore this revision? Current unsaved state might be overwritten.")) return;
    setIsRestoringRevision(true);
    try {
      const res = await axios.post(
        `http://localhost:5050/api/notes/${noteId}/revisions/${revisionId}/restore`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      if (res.data.success) {
        // Broadcast via socket is usually handled by backend, but let's notify locally
        alert("Revision restored successfully!");
      }
    } catch (err) {
      console.error('Error restoring revision:', err);
      alert(err.response?.data?.error || "Error restoring revision");
    } finally {
      setIsRestoringRevision(false);
    }
  };

  return (
    <div 
      className={`fixed top-0 right-0 h-full w-full sm:w-[360px] shadow-2xl z-40 border-l flex flex-col transition-all duration-300 animate-slide-in ${activeTheme.sidebar} ${activeTheme.border}`}
    >
      {/* Header */}
      <div className={`p-3 sm:p-4 border-b flex justify-between items-center transition-colors duration-300 ${activeTheme.sidebarHeader} ${activeTheme.border}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-sm ${activeTheme.textPrimary}`}>Collaborate & History</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex border-b transition-colors duration-300 ${activeTheme.border}`}>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2.5 sm:py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-655'
          }`}
        >
          <MessageSquare size={14} />
          <span>Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-2.5 sm:py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeTab === 'comments'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-655'
          }`}
        >
          <MessageCircle size={14} />
          <span>Comments</span>
        </button>
        <button
          onClick={() => setActiveTab('revisions')}
          className={`flex-1 py-2.5 sm:py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
            activeTab === 'revisions'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-655'
          }`}
        >
          <History size={14} />
          <span>Revisions</span>
        </button>
      </div>

      {/* Content Feed */}
      <div className={`flex-1 overflow-y-auto p-3 sm:p-4 transition-colors duration-300 ${activeTheme.chatBg}`}>
        
        {/* TAB 1: DOCUMENT CHAT */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isMe = msg.sender === currentUserId;
              const msgDate = new Date(msg.createdAt);
              const timeString = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={msg._id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 mb-1 px-1">
                      {msg.senderName}
                    </span>
                  )}
                  <div 
                    className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm shadow-sm leading-relaxed ${
                      isMe 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-200/50 dark:border-zinc-800/40 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-gray-400 dark:text-zinc-500 mt-1 px-1">
                    {timeString}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* TAB 2: IN-DOCUMENT COMMENTS */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 dark:text-zinc-500">
                <MessageCircle size={32} className="stroke-[1.5] mb-2 text-gray-300 dark:text-zinc-650" />
                <p className="text-xs font-semibold">No comments yet</p>
                <p className="text-[11px]">Start a discussion or mention a collaborator using @</p>
              </div>
            ) : (
              comments.map((comment) => {
                const commentDate = new Date(comment.createdAt);
                const timeString = commentDate.toLocaleString([], { 
                  month: 'short', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });

                return (
                  <div 
                    key={comment._id} 
                    className="p-3 bg-white dark:bg-zinc-850 border border-slate-200/60 dark:border-zinc-800/40 rounded-2xl shadow-sm space-y-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">
                        {comment.authorName}
                      </span>
                      <span className="text-[9px] text-gray-400 dark:text-zinc-500">
                        {timeString}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={commentsEndRef} />
          </div>
        )}

        {/* TAB 3: REVISIONS */}
        {activeTab === 'revisions' && (
          <div className="space-y-6">
            <button
              onClick={handleCreateRevision}
              disabled={isSavingRevision}
              className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                isSavingRevision ? 'bg-gray-300 dark:bg-zinc-800 cursor-not-allowed text-gray-500' : activeTheme.btnBrand
              }`}
            >
              <Save size={13} />
              <span>{isSavingRevision ? 'Saving Snapshot...' : 'Save Current Snapshot'}</span>
            </button>

            {revisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400 dark:text-zinc-500">
                <Clock size={32} className="stroke-[1.5] mb-2 text-gray-300 dark:text-zinc-650" />
                <p className="text-xs font-semibold">No snapshots saved yet</p>
                <p className="text-[11px]">Click the button above to snapshot note state.</p>
              </div>
            ) : (
              <div className="relative border-l border-slate-200 dark:border-zinc-700 ml-4 py-2 space-y-6">
                {revisions.map((rev) => {
                  const revDate = new Date(rev.createdAt);
                  const timeString = revDate.toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div key={rev._id} className="relative pl-6">
                      {/* Timeline Dot */}
                      <span className="absolute -left-1.5 top-1.5 flex items-center justify-center w-3 h-3 bg-blue-500 rounded-full border border-white dark:border-zinc-900"></span>
                      
                      <div className="p-3 bg-white dark:bg-zinc-850 border border-slate-200/60 dark:border-zinc-800/40 rounded-xl shadow-sm space-y-2">
                        <div>
                          <div className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">
                            {rev.authorName || 'Collaborator'}
                          </div>
                          <div className="text-[9px] text-gray-400 dark:text-zinc-500">
                            {timeString}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreRevision(rev._id)}
                          disabled={isRestoringRevision}
                          className="flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer"
                        >
                          <ArrowUpRight size={12} />
                          <span>Restore state</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input / Autocomplete Box for Comments/Chat */}
      {activeTab === 'chat' && (
        <form 
          onSubmit={handleChatSubmit}
          className={`p-3 sm:p-4 border-t transition-colors duration-300 ${activeTheme.sidebarHeader} ${activeTheme.border} flex gap-2`}
        >
          <input
            type="text"
            placeholder="Type your message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`flex-1 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-sm outline-none border transition-all focus:ring-2 focus:ring-blue-500/50 ${activeTheme.border} ${activeTheme.inputBg} ${activeTheme.textPrimary}`}
          />
          <button 
            type="submit"
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${activeTheme.btnBrand}`}
          >
            <Send size={15} />
          </button>
        </form>
      )}

      {activeTab === 'comments' && (
        <div className="relative">
          {/* Mentions dropdown list */}
          {showMentions && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-0 w-full bg-white dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 rounded-t-xl shadow-xl z-50 divide-y divide-slate-100 dark:divide-zinc-800">
              <div className="px-3.5 py-2 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Mention Collaborator</div>
              {filteredUsers.map((u) => (
                <button
                  key={u.id || u.name}
                  onClick={() => handleSelectMention(u.name)}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  @{u.name}
                </button>
              ))}
            </div>
          )}

          <form 
            onSubmit={handleCommentSubmit}
            className={`p-3 sm:p-4 border-t transition-colors duration-300 ${activeTheme.sidebarHeader} ${activeTheme.border} flex gap-2`}
          >
            <textarea
              id="comment-input-field"
              placeholder="Write a comment... Use @ to mention"
              value={commentText}
              onChange={handleCommentChange}
              rows={2}
              className={`flex-1 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-sm outline-none border resize-none transition-all focus:ring-2 focus:ring-blue-500/50 ${activeTheme.border} ${activeTheme.inputBg} ${activeTheme.textPrimary}`}
            />
            <button 
              type="submit"
              className={`p-2.5 self-end rounded-xl flex items-center justify-center transition-all cursor-pointer ${activeTheme.btnBrand}`}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatDrawer;
