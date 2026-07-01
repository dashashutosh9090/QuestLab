import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { GoogleLogin } from '@react-oauth/google';

const features = [
    { icon: '✨', title: 'AI-generated quests', desc: 'Personalized challenges that match your skill level.' },
    { icon: '⚡', title: 'Real test execution', desc: 'Submit code, run against test cases, earn XP on pass.' },
    { icon: '🗺️', title: 'Roadmap progression', desc: 'Unlock DSA, Projects, Resume and Interview tracks.' },
    { icon: '💬', title: 'Live study rooms', desc: 'Chat with peers grinding the same track in real time.' }
];

const stats = [
    { value: '12k+', label: 'XP earned today' },
    { value: '1.4k', label: 'Active learners' },
    { value: '94%', label: 'Quest pass rate' }
];

function AuthCard() {
    const [showWelcome, setShowWelcome] = useState(true);
    const [showSignIn, setShowSignIn] = useState(true);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        adminKey: ""
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { login, register, googleLogin, selectedRole, setSelectedRole } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGoogleSuccess = async (response) => {
        setLoading(true);
        const result = await googleLogin(response.credential);
        if (result?.success) {
            const dest = result.user?.role === 'admin' ? '/admin' : '/dashboard';
            setTimeout(() => navigate(dest), 800);
        }
        setLoading(false);
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await login(formData.email, formData.password);
        if (result?.success) {
            const dest = result.user?.role === 'admin' ? '/admin' : '/dashboard';
            setTimeout(() => navigate(dest), 1000);
        }
        setLoading(false);
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            setLoading(false);
            return;
        }
        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            setLoading(false);
            return;
        }
        if (selectedRole === 'admin' && !formData.adminKey) {
            toast.error('Admin signup key is required');
            setLoading(false);
            return;
        }

        const result = await register(formData.name, formData.email, formData.password, formData.adminKey);
        if (result?.success) {
            const dest = result.user?.role === 'admin' ? '/admin' : '/dashboard';
            setTimeout(() => navigate(dest), 1000);
        }
        setLoading(false);
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden bg-[#0a0b1e]">
            {/* ANIMATED BACKDROP */}
            <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0a0b1e] via-[#1a1147] to-[#2d0a3f]" />
                <motion.div
                    className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/20 blur-3xl"
                    animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute -bottom-40 -right-40 w-[42rem] h-[42rem] rounded-full bg-gradient-to-br from-pink-500/30 to-orange-500/15 blur-3xl"
                    animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
                    transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute top-1/3 right-1/4 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-cyan-400/20 to-violet-500/10 blur-3xl"
                    animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
                    transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* subtle dot grid */}
                <div className="absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
                        backgroundSize: '32px 32px'
                    }} />
            </div>

            <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-10 items-stretch">
                {/* LEFT: Brand panel */}
                <motion.aside
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="hidden lg:flex relative overflow-hidden rounded-3xl p-10 text-white border border-white/10"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(79, 70, 229, 0.85) 0%, rgba(124, 58, 237, 0.8) 45%, rgba(219, 39, 119, 0.85) 100%)',
                        backdropFilter: 'blur(20px)'
                    }}
                >
                    {/* ambient highlights */}
                    <div aria-hidden className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
                        style={{
                            backgroundImage:
                                'radial-gradient(600px 300px at 80% 0%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(255,255,255,0.3), transparent 60%)'
                        }} />
                    <motion.div
                        aria-hidden
                        className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-white/15 blur-3xl"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        aria-hidden
                        className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/15 blur-3xl"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    />
                    {/* geometric accent */}
                    <motion.div
                        aria-hidden
                        className="absolute top-12 right-12 w-16 h-16 border-2 border-white/30 rounded-2xl"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                    />

                    <div className="relative z-10 flex flex-col justify-between h-full w-full">
                        <div>
                            <motion.div
                                className="flex items-center gap-3 mb-10"
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <motion.div
                                    className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center font-bold text-xl shadow-lg"
                                    whileHover={{ rotate: [0, -8, 8, 0], scale: 1.05 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    G
                                </motion.div>
                                <span className="font-bold text-xl tracking-tight">QuestLab</span>
                                <span className="ml-auto inline-flex items-center gap-1.5 text-xs bg-white/10 border border-white/20 rounded-full px-2.5 py-1 backdrop-blur-md">
                                    <motion.span
                                        className="w-1.5 h-1.5 rounded-full bg-emerald-300"
                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                        transition={{ duration: 1.6, repeat: Infinity }}
                                    />
                                    <span className="text-white/90 font-medium">Live</span>
                                </span>
                            </motion.div>

                            <motion.h1
                                className="text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight mb-5"
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.6 }}
                            >
                                Learn by playing.<br />
                                <span className="text-white/75">Level up by</span>{' '}
                                <span className="relative inline-block">
                                    <span className="relative z-10">shipping.</span>
                                    <motion.span
                                        className="absolute left-0 bottom-1 h-2.5 bg-white/30 rounded-sm -z-0"
                                        initial={{ width: 0 }}
                                        animate={{ width: '100%' }}
                                        transition={{ delay: 1, duration: 0.8, ease: 'easeOut' }}
                                    />
                                </span>
                            </motion.h1>
                            <motion.p
                                className="text-white/85 text-base leading-relaxed max-w-md"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                A gamified learning platform that turns the path from beginner to interview-ready into XP, streaks, and unlocked tracks.
                            </motion.p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10">
                            {features.map((f, i) => (
                                <motion.div
                                    key={f.title}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + i * 0.08 }}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 hover:bg-white/15 hover:border-white/30 transition-colors cursor-default group"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-base group-hover:scale-110 transition-transform">{f.icon}</span>
                                        <div className="text-sm font-semibold">{f.title}</div>
                                    </div>
                                    <div className="text-xs text-white/70 leading-snug">{f.desc}</div>
                                </motion.div>
                            ))}
                        </div>

                        <motion.div
                            className="mt-10"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: 0.9 }}
                        >
                            <div className="flex items-center gap-4 text-white/70 text-xs mb-4">
                                <div className="flex -space-x-2">
                                    {['#fde68a', '#a7f3d0', '#bfdbfe', '#fbcfe8'].map((c, i) => (
                                        <motion.div
                                            key={c}
                                            className="w-7 h-7 rounded-full border-2 border-indigo-700 shadow-lg"
                                            style={{ background: c }}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 1 + i * 0.08 }}
                                        />
                                    ))}
                                </div>
                                <span>Join scholars climbing the leaderboard.</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/15">
                                {stats.map((s, i) => (
                                    <motion.div
                                        key={s.label}
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.1 + i * 0.08 }}
                                    >
                                        <div className="text-lg font-bold tabular-nums">{s.value}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-white/60">{s.label}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </motion.aside>

                {/* RIGHT: Auth panel */}
                <div className="flex items-center justify-center">
                    <div className="w-full max-w-md relative">
                        {/* glow halo */}
                        <div aria-hidden className="absolute -inset-4 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-pink-500/30 rounded-[2rem] blur-2xl opacity-60 pointer-events-none" />

                        <AnimatePresence mode="wait">
                            {showWelcome ? (
                                <motion.div
                                    key="welcome"
                                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -16, scale: 0.98 }}
                                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                    className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-10 text-center shadow-2xl border border-white/40"
                                >
                                    <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg">G</div>
                                        <span className="font-bold text-lg"><span className="text-gradient">Quest</span>Lab</span>
                                    </div>

                                    <motion.span
                                        className="pill pill-primary mb-5"
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15 }}
                                    >
                                        For students &amp; self-learners
                                    </motion.span>
                                    <motion.h2
                                        className="text-3xl font-bold text-gray-900 mb-3 tracking-tight"
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        Welcome to <span className="text-gradient">QuestLab</span>
                                    </motion.h2>
                                    <motion.p
                                        className="text-gray-600 mb-8 leading-relaxed"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        transition={{ delay: 0.28 }}
                                    >
                                        Sign in to pick up your quest log, or create an account in under a minute.
                                    </motion.p>

                                    <motion.button
                                        onClick={() => { setShowWelcome(false); setShowSignIn(true); }}
                                        whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                                        className="btn-primary w-full mb-3"
                                    >
                                        Sign in
                                    </motion.button>
                                    <motion.button
                                        onClick={() => { setShowWelcome(false); setShowSignIn(false); }}
                                        whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                                        className="btn-ghost w-full"
                                    >
                                        Create account
                                    </motion.button>

                                    <p className="text-xs text-gray-400 mt-8">
                                        By continuing you agree to our Terms &amp; Privacy.
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="auth"
                                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -16, scale: 0.98 }}
                                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                    className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-7 sm:p-9 shadow-2xl border border-white/40"
                                >
                                    {/* Role switcher */}
                                    <div className="flex items-center justify-between mb-6">
                                        <button
                                            onClick={() => setShowWelcome(true)}
                                            className="text-xs font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 transition-colors"
                                            disabled={loading}
                                        >
                                            ← Back
                                        </button>
                                        <div className="flex bg-gray-100 rounded-full p-1 relative">
                                            <button
                                                onClick={() => setSelectedRole('user')}
                                                className={`relative z-10 px-3.5 py-1 rounded-full text-xs font-bold transition-colors ${
                                                    selectedRole === 'user' ? 'text-indigo-600' : 'text-gray-500'
                                                }`}
                                            >
                                                Learner
                                            </button>
                                            <button
                                                onClick={() => setSelectedRole('admin')}
                                                className={`relative z-10 px-3.5 py-1 rounded-full text-xs font-bold transition-colors ${
                                                    selectedRole === 'admin' ? 'text-rose-600' : 'text-gray-500'
                                                }`}
                                            >
                                                Admin
                                            </button>
                                            <motion.div
                                                className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm"
                                                initial={false}
                                                animate={{
                                                    left: selectedRole === 'user' ? '4px' : '50%',
                                                    right: selectedRole === 'user' ? '50%' : '4px'
                                                }}
                                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                            />
                                        </div>
                                    </div>

                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={showSignIn ? 'signin-head' : 'signup-head'}
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -6 }}
                                            transition={{ duration: 0.2 }}
                                            className="mb-6"
                                        >
                                            <h2 className="text-2xl font-bold tracking-tight">
                                                {showSignIn ? 'Welcome back' : 'Create your account'}
                                            </h2>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {showSignIn
                                                    ? 'Sign in to continue your learning streak.'
                                                    : selectedRole === 'admin'
                                                        ? 'Admins manage core curriculum tasks.'
                                                        : 'Start earning XP in under a minute.'}
                                            </p>
                                        </motion.div>
                                    </AnimatePresence>

                                    {showSignIn ? (
                                        <form onSubmit={handleSignIn} className="space-y-4">
                                            <div>
                                                <label className="label" htmlFor="email">Email</label>
                                                <input
                                                    id="email" type="email" name="email"
                                                    value={formData.email} onChange={handleChange}
                                                    placeholder="you@example.com"
                                                    className="input" required disabled={loading}
                                                />
                                            </div>
                                            <div>
                                                <label className="label" htmlFor="password">Password</label>
                                                <div className="relative">
                                                    <input
                                                        id="password" type={showPassword ? "text" : "password"} name="password"
                                                        value={formData.password} onChange={handleChange}
                                                        placeholder="••••••••"
                                                        className="input pr-12" required disabled={loading}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm transition-colors"
                                                    >
                                                        {showPassword ? 'Hide' : 'Show'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex justify-end -mt-1">
                                                <Link
                                                    to="/forgot-password"
                                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                                >
                                                    Forgot password?
                                                </Link>
                                            </div>

                                            <motion.button
                                                type="submit" disabled={loading}
                                                whileHover={!loading ? { scale: 1.01 } : {}}
                                                whileTap={!loading ? { scale: 0.99 } : {}}
                                                className="btn-primary w-full mt-2"
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                                        Signing in…
                                                    </>
                                                ) : 'Sign in'}
                                            </motion.button>

                                            <div className="flex items-center gap-3 my-2">
                                                <div className="divider flex-1"></div>
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">or</span>
                                                <div className="divider flex-1"></div>
                                            </div>

                                            <div className="flex justify-center">
                                                <GoogleLogin
                                                    onSuccess={handleGoogleSuccess}
                                                    onError={() => toast.error("Google login failed")}
                                                    theme="outline" shape="pill"
                                                />
                                            </div>

                                            <p className="text-sm text-gray-500 text-center pt-2">
                                                New to QuestLab?{' '}
                                                <button type="button" onClick={() => setShowSignIn(false)}
                                                        className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                                        disabled={loading}>
                                                    Create an account
                                                </button>
                                            </p>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleSignUp} className="space-y-4">
                                            <div>
                                                <label className="label" htmlFor="name">Full name</label>
                                                <input
                                                    id="name" type="text" name="name"
                                                    value={formData.name} onChange={handleChange}
                                                    placeholder="Ada Lovelace" className="input" required disabled={loading}
                                                />
                                            </div>
                                            <div>
                                                <label className="label" htmlFor="email-r">Email</label>
                                                <input
                                                    id="email-r" type="email" name="email"
                                                    value={formData.email} onChange={handleChange}
                                                    placeholder="you@example.com" className="input" required disabled={loading}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <label className="label" htmlFor="pw-r">Password</label>
                                                    <div className="relative">
                                                        <input
                                                            id="pw-r" type={showPassword ? "text" : "password"} name="password"
                                                            value={formData.password} onChange={handleChange}
                                                            placeholder="At least 6 characters" className="input pr-12"
                                                            required disabled={loading}
                                                        />
                                                        <button type="button"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm transition-colors">
                                                            {showPassword ? 'Hide' : 'Show'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="label" htmlFor="pw-c">Confirm password</label>
                                                    <div className="relative">
                                                        <input
                                                            id="pw-c" type={showConfirmPassword ? "text" : "password"} name="confirmPassword"
                                                            value={formData.confirmPassword} onChange={handleChange}
                                                            placeholder="Re-enter password" className="input pr-12"
                                                            required disabled={loading}
                                                        />
                                                        <button type="button"
                                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm transition-colors">
                                                            {showConfirmPassword ? 'Hide' : 'Show'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {selectedRole === 'admin' && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.25 }}
                                                >
                                                    <label className="label" htmlFor="adminKey">
                                                        Admin signup key
                                                        <span className="ml-2 pill pill-danger">Restricted</span>
                                                    </label>
                                                    <input
                                                        id="adminKey" type="password" name="adminKey"
                                                        value={formData.adminKey} onChange={handleChange}
                                                        placeholder="Provided by your administrator"
                                                        className="input" required disabled={loading}
                                                    />
                                                </motion.div>
                                            )}

                                            <label className="flex items-start gap-2 text-xs text-gray-500 select-none">
                                                <input type="checkbox" required className="mt-0.5 accent-indigo-600" />
                                                <span>I agree to the Terms of Service and Privacy Policy.</span>
                                            </label>

                                            <motion.button
                                                type="submit" disabled={loading}
                                                whileHover={!loading ? { scale: 1.01 } : {}}
                                                whileTap={!loading ? { scale: 0.99 } : {}}
                                                className="btn-primary w-full"
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                                        Creating account…
                                                    </>
                                                ) : 'Create account'}
                                            </motion.button>

                                            {selectedRole !== 'admin' && (
                                                <>
                                                    <div className="flex items-center gap-3 my-1">
                                                        <div className="divider flex-1"></div>
                                                        <span className="text-xs text-gray-400 uppercase tracking-wider">or</span>
                                                        <div className="divider flex-1"></div>
                                                    </div>
                                                    <div className="flex justify-center">
                                                        <GoogleLogin
                                                            onSuccess={handleGoogleSuccess}
                                                            onError={() => toast.error("Google login failed")}
                                                            theme="outline" shape="pill"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            <p className="text-sm text-gray-500 text-center pt-2">
                                                Already a member?{' '}
                                                <button type="button" onClick={() => setShowSignIn(true)}
                                                        className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                                        disabled={loading}>
                                                    Sign in
                                                </button>
                                            </p>
                                        </form>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AuthCard;
