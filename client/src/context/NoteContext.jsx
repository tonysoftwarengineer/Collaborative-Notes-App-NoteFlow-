/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useCallback } from 'react';
import axios from 'axios';

export const NoteContext = createContext();

export const NoteProvider = ({ children }) => {
  const [notes, setNotes] = useState([]);
  const [trashNotes, setTrashNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5050/api/notes');
      if (res.data.success) {
        setNotes(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrashNotes = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5050/api/notes/trash');
      if (res.data.success) {
        setTrashNotes(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching trash notes:', err);
    }
  }, []);

  const getNote = useCallback(async (id) => {
    try {
      const res = await axios.get(`http://localhost:5050/api/notes/${id}`);
      if (res.data.success) {
        setCurrentNote(res.data.data);
        return res.data.data;
      }
    } catch (err) {
      console.error('Error fetching note:', err);
    }
    return null;
  }, []);

  const createNote = async (title, folder, parentId = null) => {
    try {
      const res = await axios.post('http://localhost:5050/api/notes', { title, folder, parentId });
      if (res.data.success) {
        setNotes((prev) => [res.data.data, ...prev]);
        return res.data.data;
      }
    } catch (err) {
      console.error('Error creating note:', err);
    }
    return null;
  };

  const updateNote = async (id, updates) => {
    try {
      const res = await axios.put(`http://localhost:5050/api/notes/${id}`, updates);
      if (res.data.success) {
        setNotes((prev) =>
          prev.map((note) => (note._id === id ? res.data.data : note))
        );
        if (currentNote?._id === id) {
          setCurrentNote(res.data.data);
        }
        return res.data.data;
      }
    } catch (err) {
      console.error('Error updating note:', err);
    }
    return null;
  };

  const deleteNote = async (id) => {
    try {
      const res = await axios.delete(`http://localhost:5050/api/notes/${id}`);
      if (res.data.success) {
        setNotes((prev) => prev.filter((note) => note._id !== id));
        if (currentNote?._id === id) {
          setCurrentNote(null);
        }
        // Refresh trash notes automatically
        fetchTrashNotes();
        return true;
      }
    } catch (err) {
      console.error('Error deleting note:', err);
    }
    return false;
  };

  const restoreNote = async (id) => {
    try {
      const res = await axios.put(`http://localhost:5050/api/notes/${id}/restore`);
      if (res.data.success) {
        setNotes((prev) => [res.data.data, ...prev]);
        setTrashNotes((prev) => prev.filter((note) => note._id !== id));
        return true;
      }
    } catch (err) {
      console.error('Error restoring note:', err);
    }
    return false;
  };

  const deleteNotePermanently = async (id) => {
    try {
      const res = await axios.delete(`http://localhost:5050/api/notes/${id}/permanent`);
      if (res.data.success) {
        setTrashNotes((prev) => prev.filter((note) => note._id !== id));
        return true;
      }
    } catch (err) {
      console.error('Error permanently deleting note:', err);
    }
    return false;
  };

  const shareNote = async (id, email) => {
    try {
      const res = await axios.post(`http://localhost:5050/api/notes/${id}/share`, { email });
      if (res.data.success) {
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Error sharing note' };
    }
    return { success: false, error: 'Error sharing note' };
  };

  return (
    <NoteContext.Provider
      value={{
        notes,
        trashNotes,
        currentNote,
        setCurrentNote,
        loading,
        fetchNotes,
        fetchTrashNotes,
        getNote,
        createNote,
        updateNote,
        deleteNote,
        restoreNote,
        deleteNotePermanently,
        shareNote,
      }}
    >
      {children}
    </NoteContext.Provider>
  );
};
