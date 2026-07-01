import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/useAuth';
import api from '../api/axios';
import Navbar from './Navbar';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import { formatChatDay, dayKey, formatChatTime } from '../utils/chatDate';
import Avatar from './Avatar';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function Connections() {
    const { user } = useAuth();
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePartner, setActivePartner] = useState(null);
    const [messages, setMessages] = useState([]);
    const [currentMsg, setCurrentMsg] = useState('');
    const [loadingHistory, setLoadingHistory] = useState(false);
    const socketRef = useRef(null);
    const activePartnerRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        api.get('/gamification/connections')
            .then((res) => { if (res.data.success) setConnections(res.data.connections || []); })
            .catch((err) => {
                console.error('Failed to load connections', err);
                toast.error('Failed to load connections');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            if (activePartnerRef.current) {
                socket.emit('join_dm', activePartnerRef.current);
            }
        });
        socket.on('receive_dm', (msg) => {
            const partnerId = activePartnerRef.current;
            const myId = user?._id ? String(user._id) : null;
            const senderId = String(msg.sender);
            const receiverId = String(msg.receiver);
            if (partnerId && ((senderId === myId && receiverId === partnerId) ||
                (senderId === partnerId && receiverId === myId))) {
                setMessages((prev) => [...prev, msg]);
            }
        });
        socket.on('dm_notification', ({ from }) => {
            const fromId = String(from);
            if (activePartnerRef.current === fromId) {
                // Already viewing this chat — mark read on the server immediately
                api.post(`/gamification/dm/${fromId}/read`).catch(() => {});
                return;
            }
            setConnections((prev) => prev.map((c) => (
                c.partner._id === fromId
                    ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
                    : c
            )));
        });
        socket.on('dm_error', (data) => toast.error(data?.message || 'Chat error'));
        socket.on('connect_error', (err) => {
            console.error('[dm] connect_error', err);
            toast.error(`Chat disconnected: ${err.message}`);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user?._id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const openChat = async (partnerId) => {
        if (activePartner === partnerId) return;
        setActivePartner(partnerId);
        activePartnerRef.current = partnerId;
        setMessages([]);
        setLoadingHistory(true);
        try {
            const res = await api.get(`/gamification/dm/${partnerId}`);
            if (res.data.success) setMessages(res.data.messages || []);
            // Mark as read and zero out the local badge
            api.post(`/gamification/dm/${partnerId}/read`).catch(() => {});
            setConnections((prev) => prev.map((c) => (
                c.partner._id === partnerId ? { ...c, unreadCount: 0 } : c
            )));
        } catch (err) {
            console.error('Failed to load DM history', err);
            toast.error(err.response?.data?.message || 'Failed to load messages');
        } finally {
            setLoadingHistory(false);
        }
        socketRef.current?.emit('join_dm', partnerId);
    };

    const handleRemoveConnection = async () => {
        if (!activePartner) return;
        const conn = connections.find((c) => c.partner._id === activePartner);
        if (!conn) return;
        if (!window.confirm(`Remove your mentorship connection with ${conn.partner.name}? This will also delete your message history.`)) {
            return;
        }
        try {
            const res = await api.delete(`/gamification/connections/${conn._id}`);
            if (res.data.success) {
                toast.success('Connection removed');
                setConnections((prev) => prev.filter((c) => c._id !== conn._id));
                setActivePartner(null);
                activePartnerRef.current = null;
                setMessages([]);
            } else {
                toast.error(res.data.message || 'Failed to remove connection');
            }
        } catch (err) {
            console.error('Failed to remove connection', err);
            toast.error(err.response?.data?.message || 'Failed to remove connection');
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        const text = currentMsg.trim();
        if (!text || !activePartner) return;
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
            toast.error('Chat not connected. Please wait and try again.');
            return;
        }
        socket.emit('send_dm', { partnerId: activePartner, text });
        setCurrentMsg('');
    };

    const activeConnection = connections.find((c) => c.partner._id === activePartner);

    return (
        <div className="app-bg pb-16">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="hero-card p-6 sm:p-8 mb-6"
                >
                    <span className="section-eyebrow">Mentorship</span>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
                        Your <span className="text-gradient">connections</span>
                    </h1>
                    <p className="text-gray-600 mt-2">Chat directly with mentors and mentees you've connected with.</p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 h-[calc(100vh-320px)] min-h-[520px]">
                    <aside className="surface p-3 flex flex-col overflow-hidden">
                        <div className="px-2 py-2 flex items-center justify-between">
                            <h3 className="section-title text-sm">Connections</h3>
                            <span className="pill pill-primary text-[10px]">{connections.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1.5">
                            {loading ? (
                                <div className="space-y-2 p-2">
                                    {[1, 2, 3].map((i) => <div key={i} className="h-16 shimmer rounded-xl" />)}
                                </div>
                            ) : connections.length === 0 ? (
                                <div className="text-center text-sm text-gray-500 px-4 py-10">
                                    <div className="text-3xl mb-2">🤝</div>
                                    No connections yet. Send a mentor request, or accept one to start chatting.
                                </div>
                            ) : (
                                connections.map((c) => {
                                    const isActive = activePartner === c.partner._id;
                                    const unread = c.unreadCount || 0;
                                    return (
                                        <button
                                            key={c._id}
                                            onClick={() => openChat(c.partner._id)}
                                            className={`w-full text-left p-3 rounded-xl transition-all border ${
                                                isActive
                                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                    : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                                            }`}
                                        >
                                            {unread > 0 && (
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600">
                                                        {unread} new {unread === 1 ? 'message' : 'messages'}
                                                    </span>
                                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <div className="relative flex-shrink-0">
                                                    <Avatar
                                                        user={c.partner}
                                                        alt=""
                                                        className="w-10 h-10 rounded-xl ring-2 ring-white shadow-sm"
                                                        initialsClassName="text-sm font-bold text-white"
                                                        placeholderClassName="bg-gradient-to-br from-indigo-500 to-purple-500"
                                                    />
                                                    {unread > 0 && (
                                                        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-white">
                                                            {unread > 99 ? '99+' : unread}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className={`font-semibold text-sm truncate ${isActive ? 'text-indigo-700' : 'text-gray-800'}`}>
                                                        {c.partner.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                                        <span className={`pill text-[10px] ${c.role === 'mentor' ? 'pill-success' : 'pill-accent'}`}>
                                                            {c.role === 'mentor' ? 'Mentee' : 'Mentor'}
                                                        </span>
                                                        <span>· Lvl {c.partner.level || 1}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    <section className="surface flex flex-col overflow-hidden">
                        {!activePartner ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                                <div className="text-5xl mb-4">💬</div>
                                <h3 className="font-bold text-gray-800 text-lg">Pick a connection</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-sm">Open a chat with one of your mentors or mentees on the left.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                            user={activeConnection?.partner}
                                            alt=""
                                            className="w-9 h-9 rounded-xl ring-2 ring-white shadow-sm"
                                            initialsClassName="font-bold text-white"
                                            placeholderClassName="bg-gradient-to-br from-indigo-500 to-purple-500"
                                        />
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{activeConnection?.partner.name}</h3>
                                            <p className="text-xs text-gray-500">
                                                {activeConnection?.role === 'mentor' ? 'Your mentee' : 'Your mentor'} · Lvl {activeConnection?.partner.level || 1}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="pill pill-success">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-ring"></span>
                                            Connected
                                        </span>
                                        <button
                                            onClick={handleRemoveConnection}
                                            title="Remove connection"
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>

                                <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/50">
                                    {loadingHistory ? (
                                        <div className="text-center text-gray-400 text-sm py-12">Loading messages…</div>
                                    ) : messages.length === 0 ? (
                                        <div className="text-center text-gray-400 text-sm py-12">
                                            No messages yet. Say hi 👋
                                        </div>
                                    ) : (
                                        (() => {
                                            // Walk messages in order; insert a centered date pill the
                                            // first time we see a new local-day key.
                                            const myId = user?._id ? String(user._id) : null;
                                            let lastDay = null;
                                            const out = [];
                                            messages.forEach((msg, i) => {
                                                const isMe = String(msg.sender) === myId;
                                                const authorName = isMe ? user.name : activeConnection?.partner.name;
                                                const stamp = msg.createdAt || null;
                                                const thisDay = dayKey(stamp);
                                                if (thisDay && thisDay !== lastDay) {
                                                    out.push(
                                                        <div key={`day-${thisDay}-${i}`} className="flex justify-center my-3 first:mt-0">
                                                            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-sm">
                                                                {formatChatDay(stamp)}
                                                            </span>
                                                        </div>
                                                    );
                                                    lastDay = thisDay;
                                                }
                                                const time = formatChatTime(stamp);
                                                out.push(
                                                    <div key={msg._id || `m-${i}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                                                        {!isMe && (
                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                                                {authorName?.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                                                            isMe
                                                                ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-sm'
                                                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                                                        }`}>
                                                            <div className={`text-[11px] font-semibold mb-0.5 ${isMe ? 'text-indigo-100' : 'text-indigo-600'}`}>
                                                                {isMe ? `${authorName} (you)` : authorName}
                                                            </div>
                                                            <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.text}</p>
                                                            <div className={`text-[10px] mt-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>{time}</div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                            return out;
                                        })()
                                    )}
                                </div>

                                <form onSubmit={sendMessage} className="p-3 border-t border-gray-100 flex gap-2 bg-white">
                                    <input
                                        type="text"
                                        value={currentMsg}
                                        onChange={(e) => setCurrentMsg(e.target.value)}
                                        placeholder="Type a message…"
                                        maxLength={1000}
                                        className="input flex-1"
                                    />
                                    <button type="submit" disabled={!currentMsg.trim()} className="btn-primary">
                                        Send
                                    </button>
                                </form>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
