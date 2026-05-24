import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NoteContext } from '../context/NoteContext';
import { ThemeContext } from '../context/ThemeContext';
import { Search, FileText, Plus, Palette, Trash2, CornerDownLeft, Sparkles } from 'lucide-react';

const CommandPalette = () => {
  const navigate = useNavigate();
  const { notes, trashNotes, createNote, deleteNotePermanently, fetchNotes, fetchTrashNotes } = useContext(NoteContext);
  const { setThemeName, activeTheme, themes } = useContext(ThemeContext);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuType, setMenuType] = useState('main'); // 'main' or 'themes'
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Sync notes and trash notes when opening
  useEffect(() => {
    if (isOpen) {
      fetchNotes();
      fetchTrashNotes();
    }
  }, [isOpen, fetchNotes, fetchTrashNotes]);

  // Toggle Command Palette with keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setMenuType('main');
        setSelectedIndex(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle outside clicks to close the palette
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  // Compile items list based on active menu state and query
  const getItems = () => {
    if (menuType === 'themes') {
      const themeOptions = Object.keys(themes).map((key) => ({
        id: `theme-${key}`,
        type: 'theme',
        name: themes[key].name,
        themeKey: key,
      }));
      return [
        ...themeOptions,
        { id: 'back-to-main', type: 'back', name: '← Back to Main Menu' },
      ];
    }

    // Main Menu Items
    const searchVal = query.toLowerCase().trim();

    // 1. Filtered active notes
    const activeNotes = notes
      .filter((note) => note.title?.toLowerCase().includes(searchVal))
      .map((note) => ({
        id: `note-${note._id}`,
        type: 'note',
        name: note.title || 'Untitled Note',
        noteId: note._id,
        folder: note.folder || 'General',
      }));

    // 2. Commands list
    const commands = [];
    
    // Create new note command (only if it matches search query or query is empty)
    if (!searchVal || 'create new note'.includes(searchVal)) {
      commands.push({
        id: 'cmd-create',
        type: 'action',
        name: 'Create New Note',
        icon: Plus,
        shortcut: '⌘N',
        handler: async () => {
          const newNote = await createNote('Untitled Note', 'General');
          if (newNote) {
            navigate(`/note/${newNote._id}`);
            setIsOpen(false);
          }
        },
      });
    }

    // Change theme command
    if (!searchVal || 'change theme settings'.includes(searchVal)) {
      commands.push({
        id: 'cmd-theme',
        type: 'action',
        name: 'Change Theme...',
        icon: Palette,
        handler: () => {
          setMenuType('themes');
          setSelectedIndex(0);
          setQuery('');
        },
      });
    }

    // Clear trash command
    if (trashNotes.length > 0 && (!searchVal || 'clear trash empty'.includes(searchVal))) {
      commands.push({
        id: 'cmd-clear-trash',
        type: 'action',
        name: `Clear Trash (${trashNotes.length} items)`,
        icon: Trash2,
        handler: async () => {
          if (window.confirm(`Permanently delete all ${trashNotes.length} notes in trash?`)) {
            await Promise.all(trashNotes.map((n) => deleteNotePermanently(n._id)));
            setIsOpen(false);
          }
        },
      });
    }

    return [...activeNotes, ...commands];
  };

  const items = getItems();

  // Select Item Handler
  const handleItemSelect = useCallback((item) => {
    if (item.type === 'note') {
      navigate(`/note/${item.noteId}`);
      setIsOpen(false);
    } else if (item.type === 'action') {
      item.handler();
    } else if (item.type === 'theme') {
      setThemeName(item.themeKey);
      setIsOpen(false);
    } else if (item.type === 'back') {
      setMenuType('main');
      setSelectedIndex(0);
      setQuery('');
    }
  }, [navigate, setThemeName]);

  // Scroll active item into view inside the list container
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle Keyboard Navigation inside the command list
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          handleItemSelect(items[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, handleItemSelect]);

  // Quick shortcut: Create note directly with ⌘N (if user wants)
  useEffect(() => {
    const handleCreateShortcut = (e) => {
      const target = e.target;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.hasAttribute('contenteditable') ||
        target.closest('[contenteditable="true"]');

      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !isInput) {
        e.preventDefault();
        const createDefault = async () => {
          const newNote = await createNote('Untitled Note', 'General');
          if (newNote) {
            navigate(`/note/${newNote._id}`);
          }
        };
        createDefault();
      }
    };
    window.addEventListener('keydown', handleCreateShortcut);
    return () => window.removeEventListener('keydown', handleCreateShortcut);
  }, [createNote, navigate]);

  if (!isOpen) return null;

  // Solid theme colors to match Vercel/Linear crisp aesthetic
  const isDark = activeTheme.isDark;
  const bgStyle = isDark ? 'bg-zinc-900' : 'bg-white';
  const borderStyle = isDark ? 'border-zinc-800' : 'border-slate-200';
  const textStyle = isDark ? 'text-zinc-100' : 'text-slate-800';
  const secondaryTextStyle = isDark ? 'text-zinc-400' : 'text-slate-500';
  const itemHoverStyle = isDark ? 'bg-zinc-800/80 text-zinc-100' : 'bg-slate-100/80 text-slate-900';
  const itemActiveStyle = isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-100 border-slate-300/60';

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/55 backdrop-blur-[1px] z-50 flex items-start justify-center pt-[15vh] p-4 font-sans animate-fade-in"
    >
      <div
        className={`w-full max-w-lg rounded-xl border shadow-2xl flex flex-col overflow-hidden max-h-[480px] ${bgStyle} ${borderStyle} ${textStyle}`}
      >
        {/* Search input field */}
        <div className={`flex items-center gap-3 px-4 py-3.5 border-b ${borderStyle}`}>
          <Search size={18} className={secondaryTextStyle} />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm font-semibold placeholder-gray-400 dark:placeholder-zinc-500"
            placeholder={
              menuType === 'themes'
                ? 'Select a theme...'
                : 'Search notes or type a command...'
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className={`px-2 py-0.5 text-[9px] font-bold rounded border uppercase shadow-sm ${
            isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}>
            ESC
          </kbd>
        </div>

        {/* List of items */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin"
        >
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={() => handleItemSelect(item)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer border border-transparent ${
                  isSelected ? `${itemActiveStyle} ${itemHoverStyle}` : `hover:${itemHoverStyle}`
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.type === 'note' && (
                    <FileText size={15} className={secondaryTextStyle} />
                  )}
                  {item.type === 'action' && item.icon && (
                    <item.icon size={15} className={secondaryTextStyle} />
                  )}
                  {item.type === 'theme' && (
                    <Palette size={15} className={secondaryTextStyle} />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.type === 'note' && item.folder && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100/80 text-slate-500'
                    }`}>
                      {item.folder}
                    </span>
                  )}
                  
                  {item.type === 'action' && item.shortcut && (
                    <kbd className={`px-1.5 py-0.5 text-[9px] font-black rounded border ${
                      isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      {item.shortcut}
                    </kbd>
                  )}

                  {isSelected && (
                    <span className="flex items-center gap-0.5 text-[9px] text-gray-400 dark:text-zinc-500 font-semibold animate-pop-in">
                      Select <CornerDownLeft size={10} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="py-8 text-center text-xs font-semibold flex flex-col items-center justify-center gap-1.5">
              <Sparkles size={16} className="text-gray-400 dark:text-zinc-500 animate-pulse" />
              <span className={secondaryTextStyle}>No results matching "{query}"</span>
            </div>
          )}
        </div>

        {/* Footer helper */}
        <div className={`px-4 py-2 border-t text-[10px] font-semibold flex items-center justify-between transition-colors ${
          isDark ? 'border-zinc-800 bg-zinc-950/30 text-zinc-400' : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="font-bold">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-bold">↵</kbd> Confirm
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-black text-[9px] tracking-tight bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent uppercase">NoteFlow Palette</span>
            <kbd className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase shadow-sm ${
              isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
              ⌘K
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
