import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import api from '../api/axios';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Submission comment thread. Both learner and admin reach the same endpoints;
 * the component mirrors the same UI on either side, keyed by which `currentUser`
 * is viewing it (used only to right-align "your" messages).
 *
 * Props:
 *   userTaskId   — the UserTask whose thread we're showing
 *   currentUser  — { _id, role } so we can right-align the viewer's bubbles
 *   maxHeight    — scrollable area cap, defaults to 240px
 */
export default function CommentsThread({ userTaskId, currentUser, maxHeight = 240 }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState('');
    const [posting, setPosting] = useState(false);
    const scrollRef = useRef(null);

    // Initial fetch + live subscription. Each thread instance opens its own
    // socket; the connection cost is negligible and the lifecycle stays clean.
    useEffect(() => {
        if (!userTaskId) return undefined;
        let cancelled = false;
        setLoading(true);
        api.get(`/gamification/submissions/${userTaskId}/comments`)
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success) setComments(data.comments || []);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load comments:', err);
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        const token = localStorage.getItem('token');
        let socket = null;
        if (token) {
            socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling']
            });
            socket.on('receive_comment', (payload) => {
                if (!payload || String(payload.userTask) !== String(userTaskId)) return;
                setComments((prev) => {
                    if (prev.some((c) => String(c._id) === String(payload.comment?._id))) return prev;
                    return [...prev, payload.comment];
                });
            });
        }
        return () => {
            cancelled = true;
            if (socket) {
                socket.off('receive_comment');
                socket.disconnect();
            }
        };
    }, [userTaskId]);

    // Keep the scroll anchored to the latest message after append.
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [comments.length]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = body.trim();
        if (!trimmed || posting) return;
        setPosting(true);
        try {
            const { data } = await api.post(
                `/gamification/submissions/${userTaskId}/comments`,
                { body: trimmed }
            );
            if (data.success) {
                // Optimistic local append; the socket fanout will arrive too,
                // and the dedupe in the listener drops the duplicate.
                setComments((prev) => {
                    if (prev.some((c) => String(c._id) === String(data.comment._id))) return prev;
                    return [...prev, data.comment];
                });
                setBody('');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to post comment');
        } finally {
            setPosting(false);
        }
    };

    const myId = currentUser?._id ? String(currentUser._id) : null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Discussion</p>
                {comments.length > 0 && (
                    <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
                        {comments.length} message{comments.length === 1 ? '' : 's'}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="text-center py-6 text-xs text-gray-400">Loading discussion…</div>
            ) : comments.length === 0 ? (
                <div className="text-center py-6 px-4 bg-gray-50 border border-gray-100 rounded-md">
                    <p className="text-sm font-semibold text-gray-700">No messages yet</p>
                    <p className="text-xs text-gray-500 mt-0.5">Be the first to leave a note.</p>
                </div>
            ) : (
                <div
                    ref={scrollRef}
                    style={{ maxHeight }}
                    className="overflow-y-auto space-y-3 pr-1"
                >
                    {comments.map((c) => {
                        const isMine = myId && String(c.authorId) === myId;
                        const isAdminAuthor = c.authorRole === 'admin';
                        return (
                            <div key={c._id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
                                    isAdminAuthor
                                        ? 'bg-gradient-to-br from-rose-400 to-orange-500'
                                        : 'bg-gradient-to-br from-indigo-400 to-purple-500'
                                }`}>
                                    {c.authorAvatar ? (
                                        <img src={c.authorAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        c.authorName?.charAt(0)?.toUpperCase() || '?'
                                    )}
                                </div>
                                <div className={`min-w-0 max-w-[80%] ${isMine ? 'items-end text-right' : ''} flex flex-col`}>
                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
                                        <span className="font-semibold text-gray-700">{c.authorName}</span>
                                        {isAdminAuthor && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[9px] font-bold uppercase tracking-wider">
                                                Admin
                                            </span>
                                        )}
                                        <span>·</span>
                                        <span>{formatTime(c.createdAt)}</span>
                                    </div>
                                    <div className={`inline-block rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-left leading-relaxed ${
                                        isMine
                                            ? 'bg-indigo-600 text-white border border-indigo-700'
                                            : isAdminAuthor
                                                ? 'bg-rose-50 text-rose-900 border border-rose-100'
                                                : 'bg-gray-50 text-gray-800 border border-gray-200'
                                    }`}>
                                        {c.body}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write a comment…"
                    rows={2}
                    maxLength={5000}
                    disabled={posting}
                    onKeyDown={(e) => {
                        // Cmd/Ctrl+Enter sends — matches the muscle memory of
                        // most chat tools without making plain Enter unusable.
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                    className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none resize-none transition-colors disabled:opacity-60"
                />
                <button
                    type="submit"
                    disabled={posting || !body.trim()}
                    className="px-3.5 py-2 rounded-md bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                    {posting ? '…' : 'Send'}
                </button>
            </form>
        </div>
    );
}
