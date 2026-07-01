import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Navbar from './Navbar';
import toast from 'react-hot-toast';
import Avatar from './Avatar';

export default function MentorSearch() {
    const [mentors, setMentors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requestingId, setRequestingId] = useState(null);

    useEffect(() => {
        api.get('/gamification/mentors')
            .then((res) => { if (res.data.success) setMentors(res.data.mentors); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleRequest = async (mentorId) => {
        try {
            setRequestingId(mentorId);
            const res = await api.post('/gamification/mentors/request', {
                receiverId: mentorId,
                message: "Hi! I would love some mentorship — could we connect?"
            });
            if (res.data.success) {
                toast.success('Mentor request sent');
                setMentors((prev) => prev.map((m) => (
                    m._id === mentorId ? { ...m, relationship: 'pending' } : m
                )));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send request');
        } finally {
            setRequestingId(null);
        }
    };

    return (
        <div className="app-bg pb-16">
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="hero-card p-6 sm:p-8 mb-8"
                >
                    <span className="section-eyebrow">Mentorship</span>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
                        Find a <span className="text-gradient">mentor</span>
                    </h1>
                    <p className="text-gray-600 mt-2 max-w-2xl">
                        Connect with scholars at least two levels above you for personalized guidance and faster progress.
                    </p>
                </motion.div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1, 2, 3].map((i) => <div key={i} className="surface h-56 shimmer rounded-2xl" />)}
                    </div>
                ) : mentors.length === 0 ? (
                    <div className="surface p-16 text-center">
                        <div className="text-4xl mb-3">🎓</div>
                        <h3 className="font-bold text-lg">No mentors available yet</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                            Level up to see more mentors — or become a mentor yourself by leading the leaderboard.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {mentors.map((u, i) => (
                            <motion.div
                                key={u._id}
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="surface p-6 hover-lift group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="relative">
                                        <Avatar
                                            user={u}
                                            className="w-16 h-16 rounded-2xl ring-2 ring-white shadow-md"
                                            initialsClassName="text-xl font-bold text-white"
                                            placeholderClassName="bg-gradient-to-br from-indigo-500 to-purple-500"
                                        />
                                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-white"></span>
                                    </div>
                                    <span className="pill pill-primary">Lvl {u.level}</span>
                                </div>

                                <h3 className="font-semibold text-gray-900 text-lg mt-4">{u.name}</h3>
                                <div className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                                    <span className="inline-flex items-center gap-1"><span>⭐</span> {(u.xp || 0).toLocaleString()} XP</span>
                                    <span className="text-gray-300">·</span>
                                    <span>Active mentor</span>
                                </div>

                                {u.relationship === 'connected' ? (
                                    <Link
                                        to="/connections"
                                        className="btn-primary w-full mt-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                                    >
                                        ✓ Connected · Open chat
                                    </Link>
                                ) : u.relationship === 'pending' ? (
                                    <button
                                        disabled
                                        className="btn-primary w-full mt-5 opacity-60 cursor-not-allowed"
                                    >
                                        Request pending…
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleRequest(u._id)}
                                        disabled={requestingId === u._id}
                                        className="btn-primary w-full mt-5"
                                    >
                                        {requestingId === u._id ? (
                                            <>
                                                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                                Sending…
                                            </>
                                        ) : 'Request mentorship'}
                                    </button>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
