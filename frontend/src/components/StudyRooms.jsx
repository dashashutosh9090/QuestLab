import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/useAuth';
import Navbar from './Navbar';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { formatChatDay, dayKey, formatChatTime } from '../utils/chatDate';

// Each room unlocks once its prerequisite roadmap node reaches the 'completed' state.
const ROOM_UNLOCK_PREREQ = {
    basics: null,
    dsa: 'basics',
    project: 'dsa',
    resume: 'project',
    interview: 'project'
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const rooms = [
    { id: 'basics', name: 'Basics Grinders', icon: '🌱', desc: 'Programming fundamentals' },
    { id: 'dsa', name: 'DSA Masters', icon: '🧠', desc: 'Algorithms & data structures' },
    { id: 'project', name: 'Project Builders', icon: '🛠️', desc: 'Ship real-world apps' },
    { id: 'resume', name: 'Resume Builders', icon: '📄', desc: 'Share drafts, get feedback' },
    { id: 'interview', name: 'Interview Prep', icon: '💼', desc: 'Mocks & system design' }
];

export default function StudyRooms() {
    const { user } = useAuth();
    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [currentMsg, setCurrentMsg] = useState('');
    const [unlockMap, setUnlockMap] = useState({ basics: true, dsa: false, project: false, resume: false, interview: false });
    const [historyLoading, setHistoryLoading] = useState(false);
    const socketRef = useRef(null);
    const activeRoomRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        // Mirror the backend `roomAccessGate` bypass: a user with
        // unlockAllTracks=true is allowed into every room server-side, so the
        // UI must reflect that. Without this short-circuit, the user sees
        // every roadmap track "unlocked" but only Basics chat is clickable.
        if (user?.unlockAllTracks) {
            setUnlockMap({ basics: true, dsa: true, project: true, resume: true, interview: true });
            return () => { cancelled = true; };
        }

        api.get('/gamification/roadmap')
            .then((res) => {
                if (cancelled) return;
                const nodes = res.data?.roadmap || [];
                const statusById = Object.fromEntries(nodes.map((n) => [n.id, n.status]));
                const next = { basics: true, dsa: false, project: false, resume: false, interview: false };
                for (const room of Object.keys(next)) {
                    const prereq = ROOM_UNLOCK_PREREQ[room];
                    if (!prereq) { next[room] = true; continue; }
                    next[room] = statusById[prereq] === 'completed';
                }
                setUnlockMap(next);
            })
            .catch(() => { /* leave defaults; server still gates the join */ });
        return () => { cancelled = true; };
    }, [user?.unlockAllTracks]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('You must be logged in to join rooms');
            return;
        }
        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[chat] connected', socket.id);
            if (activeRoomRef.current) {
                socket.emit('join_room', activeRoomRef.current);
            }
        });
        socket.on('receive_message', (data) => {
            console.log('[chat] receive_message', data);
            setMessages((prev) => [...prev, data]);
        });
        socket.on('room_error', (data) => toast.error(data?.message || 'Room error'));
        socket.on('connect_error', (err) => {
            console.error('[chat] connect_error', err);
            toast.error(`Chat disconnected: ${err.message}`);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    const joinRoom = async (roomId) => {
        if (!unlockMap[roomId]) {
            toast.error('Complete the prerequisite track to unlock this room.');
            return;
        }
        if (activeRoom === roomId) return;
        setActiveRoom(roomId);
        activeRoomRef.current = roomId;
        setMessages([]);
        socketRef.current?.emit('join_room', roomId);

        setHistoryLoading(true);
        try {
            const res = await api.get(`/gamification/rooms/${roomId}/messages`);
            // Guard against late-arriving history if user already switched rooms.
            if (activeRoomRef.current !== roomId) return;
            setMessages(res.data?.messages || []);
        } catch (err) {
            if (activeRoomRef.current === roomId) {
                toast.error(err?.response?.data?.message || 'Could not load message history');
            }
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleLeaveRoom = () => {
        const room = activeRoomRef.current;
        if (!room) return;
        socketRef.current?.emit('leave_room', room);
        activeRoomRef.current = null;
        setActiveRoom(null);
        setMessages([]);
    };

    const sendMessage = (e) => {
        e.preventDefault();
        const text = currentMsg.trim();
        if (!text || !activeRoom) return;
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
            toast.error('Chat not connected. Please wait and try again.');
            return;
        }
        socket.emit('send_message', { room: activeRoom, text });
        setCurrentMsg('');
    };

    const activeRoomMeta = rooms.find((r) => r.id === activeRoom);

    return (
        <div className="app-bg pb-16">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="hero-card p-6 sm:p-8 mb-6"
                >
                    <span className="section-eyebrow">Live chat</span>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
                        Study <span className="text-gradient">rooms</span>
                    </h1>
                    <p className="text-gray-600 mt-2">Join a track-specific room to collaborate, get unstuck, and pair with peers.</p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 h-[calc(100vh-320px)] min-h-[520px]">
                    {/* Room list */}
                    <aside className="surface p-3 flex flex-col overflow-hidden">
                        <div className="px-2 py-2 flex items-center justify-between">
                            <h3 className="section-title text-sm">Available rooms</h3>
                            <span className="pill pill-success text-[10px]">Live</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1.5">
                            {rooms.map((room) => {
                                const isActive = activeRoom === room.id;
                                const isUnlocked = !!unlockMap[room.id];
                                return (
                                    <button
                                        key={room.id}
                                        onClick={() => joinRoom(room.id)}
                                        disabled={!isUnlocked}
                                        title={isUnlocked ? '' : 'Complete the prerequisite track to unlock'}
                                        className={`w-full text-left p-3 rounded-xl transition-all border ${
                                            !isUnlocked
                                                ? 'border-transparent bg-gray-50 opacity-60 cursor-not-allowed'
                                                : isActive
                                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                    : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                                                !isUnlocked ? 'bg-gray-100 grayscale' : isActive ? 'bg-white shadow-sm' : 'bg-gray-50'
                                            }`}>
                                                {isUnlocked ? room.icon : '🔒'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`font-semibold text-sm ${
                                                    !isUnlocked ? 'text-gray-500' : isActive ? 'text-indigo-700' : 'text-gray-800'
                                                }`}>
                                                    {room.name}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate">
                                                    {isUnlocked ? room.desc : 'Locked — finish the prerequisite track'}
                                                </div>
                                            </div>
                                            <span className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${
                                                isUnlocked ? 'bg-emerald-500' : 'bg-gray-300'
                                            }`}></span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    {/* Chat */}
                    <section className="surface flex flex-col overflow-hidden">
                        {!activeRoom ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                                <div className="text-5xl mb-4">💬</div>
                                <h3 className="font-bold text-gray-800 text-lg">Select a room</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-sm">Pick a track on the left to start chatting with peers grinding the same material.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-xl">
                                            {activeRoomMeta?.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{activeRoomMeta?.name}</h3>
                                            <p className="text-xs text-gray-500">{activeRoomMeta?.desc}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="pill pill-success">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-ring"></span>
                                            Connected
                                        </span>
                                        <button
                                            onClick={handleLeaveRoom}
                                            className="text-xs font-semibold px-3 py-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                            title="Leave this room"
                                        >
                                            Leave
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50">
                                    {historyLoading ? (
                                        <div className="text-center text-gray-400 text-sm py-12">Loading history…</div>
                                    ) : messages.length === 0 ? (
                                        <div className="text-center text-gray-400 text-sm py-12">
                                            It's quiet here. Send the first message 👋
                                        </div>
                                    ) : (
                                        (() => {
                                            // Walk messages in order; each time the local-day key flips
                                            // we render a centered date pill before the next bubble.
                                            const myId = user?._id ? String(user._id) : null;
                                            let lastDay = null;
                                            const out = [];
                                            messages.forEach((msg, i) => {
                                                const isMe = myId && msg.userId === myId;
                                                const authorName = msg.author || 'User';
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
                                                // Prefer client-formatted time so timezones match the
                                                // user's wall clock; fall back to server-pushed `time`.
                                                const bubbleTime = stamp ? formatChatTime(stamp) : (msg.time || '');
                                                out.push(
                                                    <div key={msg._id || `m-${i}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                                                        {!isMe && (
                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                                                {authorName.charAt(0).toUpperCase()}
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
                                                            <div className={`text-[10px] mt-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>{bubbleTime}</div>
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
