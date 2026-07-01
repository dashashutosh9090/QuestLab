import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import Navbar from './Navbar';
import Avatar from './Avatar';

const medals = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/gamification/leaderboard')
            .then((res) => { if (res.data.success) setLeaders(res.data.leaderboard); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const top3 = leaders.slice(0, 3);
    const rest = leaders.slice(3);

    return (
        <div className="app-bg pb-16">
            <Navbar />
            <div className="max-w-5xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="hero-card p-6 sm:p-8 mb-8"
                >
                    <span className="section-eyebrow">Hall of fame</span>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
                        Global <span className="text-gradient">leaderboard</span>
                    </h1>
                    <p className="text-gray-600 mt-2">The top scholars climbing the XP ladder this season.</p>
                </motion.div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => <div key={i} className="surface h-44 shimmer rounded-2xl"></div>)}
                    </div>
                ) : leaders.length === 0 ? (
                    <div className="surface p-14 text-center">
                        <div className="text-4xl mb-3">🏆</div>
                        <h3 className="font-bold text-lg">No rankings yet</h3>
                        <p className="text-sm text-gray-500 mt-1">Complete quests to be the first on the board.</p>
                    </div>
                ) : (
                    <>
                        {/* Podium */}
                        {top3.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                {[1, 0, 2].map((podiumIndex) => {
                                    const u = top3[podiumIndex];
                                    if (!u) return <div key={podiumIndex} className="hidden md:block"></div>;
                                    const heights = { 0: 'md:pt-0', 1: 'md:pt-8', 2: 'md:pt-10' };
                                    const tones = {
                                        0: 'from-amber-300 via-amber-200 to-yellow-100 ring-amber-300',
                                        1: 'from-slate-200 via-slate-100 to-white ring-slate-300',
                                        2: 'from-orange-200 via-orange-100 to-white ring-orange-300'
                                    };
                                    return (
                                        <motion.div
                                            key={u._id}
                                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.05 * podiumIndex }}
                                            className={`${heights[podiumIndex]}`}
                                        >
                                            <div className={`surface p-6 text-center bg-gradient-to-br ${tones[podiumIndex]} ring-1 hover-lift`}>
                                                <div className="text-3xl mb-2">{medals[podiumIndex]}</div>
                                                <div className="relative inline-block">
                                                    <Avatar
                                                        user={u}
                                                        alt=""
                                                        className="w-16 h-16 rounded-2xl ring-2 ring-white shadow-md mx-auto"
                                                        initialsClassName="text-xl font-bold text-white"
                                                        placeholderClassName="bg-gradient-to-br from-indigo-500 to-pink-500"
                                                    />
                                                </div>
                                                <h3 className="font-bold text-gray-900 mt-3">{u.name}</h3>
                                                <p className="text-xs text-gray-500 mt-0.5">Level {u.level || 1}</p>
                                                <div className="mt-3 inline-flex items-center gap-2 pill pill-primary">
                                                    <span>⭐</span>
                                                    <span className="tabular-nums">{(u.xp || 0).toLocaleString()} XP</span>
                                                </div>
                                                {u.streak > 0 && (
                                                    <div className="text-xs text-gray-500 mt-2">🔥 {u.streak}-day streak</div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Rest */}
                        {rest.length > 0 && (
                            <div className="surface overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                                    <h3 className="section-title">Rankings 4–{leaders.length}</h3>
                                </div>
                                <ul className="divide-y divide-gray-100">
                                    {rest.map((u, idx) => (
                                        <motion.li
                                            key={u._id}
                                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.04 }}
                                            className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                <span className="text-xs font-bold text-gray-400 tabular-nums w-6">#{idx + 4}</span>
                                                <Avatar
                                                    user={u}
                                                    alt=""
                                                    className="w-10 h-10 rounded-xl ring-1 ring-gray-200"
                                                    initialsClassName="text-sm font-bold text-white"
                                                    placeholderClassName="bg-gradient-to-br from-indigo-400 to-purple-500"
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                                                    <p className="text-xs text-gray-500">Lvl {u.level || 1} · 🔥 {u.streak || 0}d</p>
                                                </div>
                                            </div>
                                            <span className="pill pill-primary tabular-nums">{(u.xp || 0).toLocaleString()} XP</span>
                                        </motion.li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
