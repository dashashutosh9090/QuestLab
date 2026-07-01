import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/useAuth';
import { useNavigate, NavLink, Link } from 'react-router-dom';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Avatar from './Avatar';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Compact "2m / 3h / 5d" relative time. Falls back to a full date for >30d
// so admins reviewing very old items still see something readable.
function timeAgo(iso) {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms) || ms < 0) return '';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const d = Math.floor(hr / 24);
    if (d < 30) return `${d}d`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const NOTIF_ICON = {
    approval: { icon: '🎉', tile: 'bg-emerald-50 text-emerald-700' },
    rejection: { icon: '⚠️', tile: 'bg-rose-50 text-rose-700' },
    revision: { icon: '↻', tile: 'bg-orange-50 text-orange-700' },
    xp: { icon: '⭐', tile: 'bg-amber-50 text-amber-700' },
    system: { icon: '🔔', tile: 'bg-indigo-50 text-indigo-700' },
    // Admin-only notification types — surfaced by the admins' shared feed.
    submission: { icon: '📥', tile: 'bg-blue-50 text-blue-700' },
    user_signup: { icon: '🆕', tile: 'bg-green-50 text-green-700' },
    task_completion: { icon: '✅', tile: 'bg-emerald-50 text-emerald-700' },
    badge_unlock: { icon: '🏆', tile: 'bg-amber-50 text-amber-700' }
};

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [notifLoading, setNotifLoading] = useState(false);
    // Measured bell rect — used to position the portal'd dropdown so it escapes
    // the navbar's stacking context (which otherwise lets transformed page
    // content paint over the dropdown's overflow region).
    const [bellPos, setBellPos] = useState(null);
    const panelRef = useRef(null);
    const bellRef = useRef(null);

    // Admins and learners read from different feeds: learners see their own
    // personal `Notification` rows, admins see the shared `AdminNotification`
    // feed populated by user activity (submissions, signups, completions).
    const isAdmin = user?.role === 'admin';
    const notifPath = isAdmin ? '/admin/notifications' : '/notifications';
    const readPath = (id) => isAdmin ? `/admin/notifications/${id}/read` : `/notifications/${id}/read`;
    const readAllPath = isAdmin ? '/admin/notifications/read-all' : '/notifications/read-all';

    // Initial fetch of notification list + unread count.
    useEffect(() => {
        if (!user) return undefined;
        let cancelled = false;
        setNotifLoading(true);
        api.get(notifPath)
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success) {
                    setNotifications(data.notifications || []);
                    setUnreadCount(data.unreadCount || 0);
                }
            })
            .catch((e) => {
                if (cancelled) return;
                console.error('Failed to load notifications:', e);
            })
            .finally(() => { if (!cancelled) setNotifLoading(false); });
        return () => { cancelled = true; };
    }, [user, notifPath]);

    // Subscribe to the correct notification channel for this account:
    //   - learners: `receive_notification` on their personal `user:<id>` room.
    //   - admins:   `admin:notification` on the shared `admins` room.
    // Both paths share the same toast + bell-list update logic — only the
    // event name differs.
    useEffect(() => {
        if (!user) return undefined;
        const token = localStorage.getItem('token');
        if (!token) return undefined;

        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        const eventName = isAdmin ? 'admin:notification' : 'receive_notification';

        socket.on(eventName, (payload) => {
            const title = payload?.title || 'New notification';
            const message = payload?.message || '';
            const type = payload?.type;
            const meta = NOTIF_ICON[type] || NOTIF_ICON.system;

            // Toast remains the immediate visual signal even when the panel is
            // closed — same UX as before.
            toast.custom((t) => (
                <div
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white shadow-xl rounded-2xl border border-gray-100 p-4 max-w-sm flex gap-3 pointer-events-auto`}
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${meta.tile}`}>
                        {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-sm leading-snug">{title}</p>
                        {message && (
                            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{message}</p>
                        )}
                    </div>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="text-gray-300 hover:text-gray-500 text-sm flex-shrink-0"
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                </div>
            ), { duration: 6000 });

            // Mirror the live event into the bell list. The backend already
            // wrote a Notification row and emits its real _id in the payload,
            // so we can prepend without a refetch round-trip.
            const live = {
                _id: payload?._id || `live-${Date.now()}`,
                title,
                message,
                type: type || 'system',
                isRead: false,
                createdAt: payload?.createdAt || new Date().toISOString()
            };
            setNotifications((prev) => {
                if (prev.some((n) => String(n._id) === String(live._id))) return prev;
                return [live, ...prev].slice(0, 50);
            });
            setUnreadCount((c) => c + 1);
        });

        return () => {
            socket.off(eventName);
            socket.disconnect();
        };
    }, [user, isAdmin]);

    // Recompute the bell's viewport rect whenever the panel opens or the
    // window resizes. The navbar is `sticky top-0` so the rect stays stable
    // across page scroll, but resize / orientation change still need to retrigger.
    useEffect(() => {
        if (!isPanelOpen) return undefined;
        const measure = () => {
            const r = bellRef.current?.getBoundingClientRect();
            if (r) {
                setBellPos({
                    top: r.bottom + 8,
                    right: Math.max(8, window.innerWidth - r.right)
                });
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [isPanelOpen]);

    // Click-outside / Esc to close the panel.
    useEffect(() => {
        if (!isPanelOpen) return undefined;
        const onClick = (e) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target) &&
                bellRef.current && !bellRef.current.contains(e.target)
            ) {
                setIsPanelOpen(false);
            }
        };
        const onEsc = (e) => { if (e.key === 'Escape') setIsPanelOpen(false); };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onEsc);
        };
    }, [isPanelOpen]);

    if (!user) return null;

    const links = [
        { to: '/dashboard', label: 'Quests' },
        { to: '/roadmap', label: 'Roadmap' },
        { to: '/study-rooms', label: 'Rooms' },
        { to: '/resume', label: 'Resume Builder' },
        { to: '/interview', label: 'Mock Interview' },
        { to: '/leaderboard', label: 'Leaderboard' },
        { to: '/mentors', label: 'Mentors' },
        { to: '/connections', label: 'Connections' }
    ];
    const navLinks = user?.role === 'admin' ? [{ to: '/admin', label: 'Admin Dashboard' }] : links;
    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleMarkRead = async (notif) => {
        if (!notif?._id || notif.isRead) return;
        // Optimistic update — flip locally first, roll back if the server says
        // no. The user expects the badge to drop instantly on click.
        const prevList = notifications;
        const prevCount = unreadCount;
        setNotifications((list) => list.map((n) => n._id === notif._id ? { ...n, isRead: true } : n));
        setUnreadCount((c) => Math.max(0, c - 1));
        try {
            await api.patch(readPath(notif._id));
        } catch (err) {
            console.error('Failed to mark notification read:', err);
            setNotifications(prevList);
            setUnreadCount(prevCount);
        }
    };

    const handleMarkAllRead = async () => {
        if (unreadCount === 0) return;
        const prevList = notifications;
        const prevCount = unreadCount;
        setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        try {
            await api.post(readAllPath);
        } catch (err) {
            console.error('Failed to mark all read:', err);
            toast.error('Could not mark all as read');
            setNotifications(prevList);
            setUnreadCount(prevCount);
        }
    };

    const xpInLevel = (user.xp || 0) % 500;
    const xpProgress = (xpInLevel / 500) * 100;

    return (
        <nav className="glass sticky top-0 z-50 border-b border-white/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-6 min-w-0">
                        <Link to={user?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-2.5 group flex-shrink-0">
                            <div className="relative">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
                                    G
                                </div>
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></span>
                            </div>
                            <span className="font-bold text-lg tracking-tight">
                                <span className="text-gradient">Quest</span>
                                <span className="text-gray-700">Lab</span>
                            </span>
                        </Link>

                        <div className="hidden lg:flex items-center gap-0.5 surface-muted px-1 py-1 rounded-xl">
                            {navLinks.map((l) => (
                                <NavLink
                                    key={l.to}
                                    to={l.to}
                                    className={({ isActive }) =>
                                        `px-2.5 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-all ${isActive
                                            ? 'bg-white text-indigo-600 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                                        }`
                                    }
                                >
                                    {l.label}
                                </NavLink>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {user?.role !== 'admin' && (
                            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 surface-muted rounded-full">
                                <span className="text-[11px] font-bold text-indigo-600 tracking-wider whitespace-nowrap">
                                    LVL {user.level || 1}
                                </span>
                                <div className="hidden xl:flex items-center gap-1.5 min-w-[88px]">
                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                            style={{ width: `${xpProgress}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-500 tabular-nums">{xpInLevel}/500</span>
                                </div>
                                <div className="flex xl:hidden items-center gap-1">
                                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                            style={{ width: `${xpProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Notification bell + dropdown */}
                        <div className="relative">
                            <button
                                ref={bellRef}
                                onClick={() => setIsPanelOpen((v) => !v)}
                                className="relative w-9 h-9 rounded-xl bg-white/80 hover:bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:text-indigo-600 shadow-sm transition-all"
                                aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                            >
                                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                                </svg>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {bellPos && createPortal(
                                <AnimatePresence>
                                    {isPanelOpen && (
                                        <motion.div
                                            ref={panelRef}
                                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                            transition={{ duration: 0.15 }}
                                            style={{ top: bellPos.top, right: bellPos.right }}
                                            className="fixed w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100]"
                                        >
                                            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-gray-900 text-sm">Notifications</p>
                                                    <p className="text-[11px] text-gray-500">{unreadCount} unread</p>
                                                </div>
                                                <button
                                                    onClick={handleMarkAllRead}
                                                    disabled={unreadCount === 0}
                                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Mark all read
                                                </button>
                                            </div>

                                            <div className="max-h-[440px] overflow-y-auto">
                                                {notifLoading ? (
                                                    <div className="px-4 py-10 text-center text-xs text-gray-400">Loading…</div>
                                                ) : notifications.length === 0 ? (
                                                    <div className="px-4 py-10 text-center">
                                                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl mx-auto mb-2">🔔</div>
                                                        <p className="text-sm font-semibold text-gray-700">All caught up</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">No notifications yet.</p>
                                                    </div>
                                                ) : (
                                                    <ul className="divide-y divide-gray-100">
                                                        {notifications.map((n) => {
                                                            const meta = NOTIF_ICON[n.type] || NOTIF_ICON.system;
                                                            return (
                                                                <li key={n._id}>
                                                                    <button
                                                                        onClick={() => handleMarkRead(n)}
                                                                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${n.isRead ? '' : 'bg-indigo-50/40'
                                                                            }`}
                                                                    >
                                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${meta.tile}`}>
                                                                            {meta.icon}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-start justify-between gap-2">
                                                                                <p className={`text-sm leading-snug ${n.isRead ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                                                                                    {n.title}
                                                                                </p>
                                                                                {!n.isRead && (
                                                                                    <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                                                                                )}
                                                                            </div>
                                                                            {n.message && (
                                                                                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed line-clamp-2 whitespace-pre-wrap">
                                                                                    {n.message}
                                                                                </p>
                                                                            )}
                                                                            <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                                                                        </div>
                                                                    </button>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>,
                                document.body
                            )}
                        </div>

                        <Link
                            to="/profile"
                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all overflow-hidden ring-2 ring-white"
                            title={`${user.name} — View profile`}
                        >
                            <Avatar
                                user={user}
                                alt="Avatar"
                                className="w-full h-full"
                                placeholderClassName=""
                            />

                        </Link>

                        <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleLogout}
                            className="btn-ghost btn-danger text-sm hidden sm:inline-flex"
                        >
                            Logout
                        </motion.button>
                    </div>
                </div>

                <div className="lg:hidden -mt-1 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
                    {navLinks.map((l) => (
                        <NavLink
                            key={l.to}
                            to={l.to}
                            className={({ isActive }) =>
                                `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-gray-600 border border-gray-200'
                                }`
                            }
                        >
                            {l.label}
                        </NavLink>
                    ))}
                </div>
            </div>
        </nav>
    );
}
