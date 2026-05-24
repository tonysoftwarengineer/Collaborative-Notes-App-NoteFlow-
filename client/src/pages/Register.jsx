import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Sparkles, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useContext(AuthContext);
  const { themeName, activeTheme } = useContext(ThemeContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await register(name, email, password);
      if (res.success) {
        navigate('/');
      } else {
        setError(res.error);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFocusRing = () => {
    if (themeName === 'cyberpunk') return 'focus:ring-fuchsia-500/20 focus:border-fuchsia-500';
    if (themeName === 'forest') return 'focus:ring-emerald-500/20 focus:border-emerald-500';
    if (themeName === 'sunset') return 'focus:ring-rose-500/20 focus:border-rose-500';
    return 'focus:ring-blue-500/20 focus:border-blue-500';
  };

  return (
    <div className={`relative min-h-screen flex items-center justify-center overflow-hidden transition-colors duration-500 ${activeTheme.bg}`}>
      {/* Background Mesh Gradient Circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-30 animate-pulse transition-colors duration-1000 ${
          themeName === 'cyberpunk' ? 'bg-fuchsia-500' :
          themeName === 'forest' ? 'bg-emerald-500' :
          themeName === 'sunset' ? 'bg-rose-450' :
          'bg-blue-500'
        }`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-35 animate-pulse transition-colors duration-1000 ${
          themeName === 'cyberpunk' ? 'bg-purple-600' :
          themeName === 'forest' ? 'bg-teal-600' :
          themeName === 'sunset' ? 'bg-amber-400' :
          'bg-indigo-655'
        }`} />
        <div className={`absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full blur-[100px] opacity-20 transition-colors duration-1000 ${
          themeName === 'cyberpunk' ? 'bg-cyan-500' :
          themeName === 'forest' ? 'bg-emerald-450' :
          themeName === 'sunset' ? 'bg-orange-500' :
          'bg-cyan-400'
        }`} />
      </div>

      {/* Main Glassmorphic Container Card */}
      <div className={`relative w-full max-w-md p-6 sm:p-8 mx-4 rounded-3xl backdrop-blur-xl border shadow-2xl transition-all duration-300 transform hover:scale-[1.01] ${
        activeTheme.isDark 
          ? 'bg-zinc-900/70 border-zinc-800/80 shadow-zinc-950/50' 
          : 'bg-white/70 border-white/40 shadow-slate-200/50'
      }`}>
        
        {/* Header Block */}
        <div className="text-center space-y-2.5 mb-8">
          <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-tr ${
            themeName === 'cyberpunk' ? 'from-fuchsia-600 to-purple-600' :
            themeName === 'forest' ? 'from-emerald-600 to-teal-600' :
            themeName === 'sunset' ? 'from-rose-600 to-orange-500' :
            'from-blue-600 to-indigo-600'
          } text-white shadow-lg`}>
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <h2 className={`text-3xl font-black tracking-tight ${activeTheme.textPrimary}`}>
            Create Account
          </h2>
          <p className={`text-xs font-medium ${activeTheme.textSecondary}`}>
            Join NoteFlow and start collaborating in real-time
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-500 text-center animate-shake">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-widest ${activeTheme.textSecondary}`}>
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User size={16} className={activeTheme.textSecondary} />
              </div>
              <input
                type="text"
                required
                disabled={loading}
                placeholder="Alex Morgan"
                className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 transition-all duration-200 ${
                  activeTheme.isDark 
                    ? 'bg-zinc-950/40 border-zinc-800 text-zinc-100 placeholder-zinc-650' 
                    : 'bg-white/50 border-slate-200 text-slate-800 placeholder-slate-400'
                } ${getFocusRing()}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-widest ${activeTheme.textSecondary}`}>
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail size={16} className={activeTheme.textSecondary} />
              </div>
              <input
                type="email"
                required
                disabled={loading}
                placeholder="name@domain.com"
                className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 transition-all duration-200 ${
                  activeTheme.isDark 
                    ? 'bg-zinc-950/40 border-zinc-800 text-zinc-100 placeholder-zinc-650' 
                    : 'bg-white/50 border-slate-200 text-slate-800 placeholder-slate-400'
                } ${getFocusRing()}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-widest ${activeTheme.textSecondary}`}>
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock size={16} className={activeTheme.textSecondary} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 transition-all duration-200 ${
                  activeTheme.isDark 
                    ? 'bg-zinc-950/40 border-zinc-800 text-zinc-100 placeholder-zinc-650' 
                    : 'bg-white/50 border-slate-200 text-slate-800 placeholder-slate-400'
                } ${getFocusRing()}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-655 dark:hover:text-zinc-350 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 mt-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              activeTheme.btnBrand
            } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <UserPlus size={16} />
                <span>Register</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <p className={`mt-6 text-xs text-center ${activeTheme.textSecondary}`}>
          Already have an account?{' '}
          <Link to="/login" className={`font-semibold underline ${activeTheme.textBrand}`}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
