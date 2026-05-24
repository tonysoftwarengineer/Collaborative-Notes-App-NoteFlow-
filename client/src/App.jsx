import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { NoteProvider } from './context/NoteContext';
import { ThemeProvider } from './context/ThemeContext';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import CommandPalette from './components/CommandPalette';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  return (user && !user.isGuest) ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <MantineProvider>
      <ThemeProvider>
        <AuthProvider>
          <NoteProvider>
          <Router>
            <CommandPalette />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/note/:id"
                element={<Editor />}
              />
            </Routes>
          </Router>
        </NoteProvider>
      </AuthProvider>
      </ThemeProvider>
    </MantineProvider>
  );
}

export default App;
