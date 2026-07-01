import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Navbar from './Navbar';

const trackIcon = {
    basics: '🌱',
    dsa: '🧠',
    project: '🛠️',
    resume: '📄',
    interview: '💼'
};

// Maps a roadmap node id to the destination it should open when clicked.
// Quest tracks land on the dashboard with that track preselected; Resume and
// Interview deep-link to their dedicated tool pages.
const trackDestination = {
    basics: { path: '/dashboard', state: { track: 'Basics' } },
    dsa: { path: '/dashboard', state: { track: 'DSA' } },
    project: { path: '/dashboard', state: { track: 'Project' } },
    resume: { path: '/resume', state: null },
    interview: { path: '/interview', state: null }
};

export default function Roadmap() {
    const navigate = useNavigate();
    const [roadmap, setRoadmap] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/gamification/roadmap')
            .then((res) => { if (res.data.success) setRoadmap(res.data.roadmap); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const totalCompleted = roadmap.reduce((acc, n) => acc + (n.completedCount || 0), 0);

    return (
        <div className="app-bg pb-16">
            <Navbar />
            <div className="max-w-4xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="hero-card p-6 sm:p-8 mb-8"
                >
                    <span className="section-eyebrow">Your journey</span>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
                        Skill <span className="text-gradient">roadmap</span>
                    </h1>
                    <p className="text-gray-600 mt-2 max-w-xl">
                        Each track unlocks once you've completed enough quests in the previous one. Stay consistent and the next stage will open up.
                    </p>
                    <div className="mt-5 inline-flex items-center gap-3 surface-muted px-4 py-2 rounded-full">
                        <span className="text-2xl">📈</span>
                        <span className="text-sm">
                            <strong className="tabular-nums">{totalCompleted}</strong>{' '}
                            <span className="text-gray-500">tasks completed across all tracks</span>
                        </span>
                    </div>
                </motion.div>

                {loading ? (
                    <div className="space-y-5">
                        {[1, 2, 3].map((i) => <div key={i} className="surface h-36 shimmer rounded-2xl"></div>)}
                    </div>
                ) : (
                    <div className="relative pl-6 sm:pl-12">
                        <div className="absolute left-2.5 sm:left-5 top-2 bottom-2 w-px bg-gradient-to-b from-indigo-300 via-purple-300 to-pink-300"></div>
                        <div className="space-y-6">
                            {roadmap.map((node, idx) => {
                                const isCompleted = node.status === 'completed';
                                const isUnlocked = node.status === 'unlocked';
                                const isLocked = node.status === 'locked';
                                const pct = Math.min(100, ((node.completedCount || 0) / Math.max(1, node.requiredCount)) * 100);
                                const dest = trackDestination[node.id];
                                const isClickable = !isLocked && Boolean(dest);
                                const openTrack = () => {
                                    if (!isClickable) return;
                                    navigate(dest.path, dest.state ? { state: dest.state } : undefined);
                                };

                                return (
                                    <motion.div
                                        key={node.id}
                                        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.08 }}
                                        className="relative"
                                    >
                                        <div className={`absolute -left-[22px] sm:-left-[34px] top-5 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-4 ring-white shadow ${
                                            isCompleted ? 'bg-emerald-500 text-white' :
                                            isUnlocked ? 'bg-indigo-600 text-white pulse-ring' :
                                            'bg-gray-200 text-gray-500'
                                        }`}>
                                            {isCompleted ? '✓' : idx + 1}
                                        </div>

                                        <div
                                            role={isClickable ? 'button' : undefined}
                                            tabIndex={isClickable ? 0 : undefined}
                                            onClick={openTrack}
                                            onKeyDown={(e) => {
                                                if (!isClickable) return;
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    openTrack();
                                                }
                                            }}
                                            className={`surface p-6 transition-all ${
                                                isCompleted ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-white' :
                                                isUnlocked ? 'border-indigo-200 shadow-md' :
                                                'opacity-70'
                                            } ${isClickable ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400' : ''}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center text-xl">
                                                        {trackIcon[node.id] || '📘'}
                                                    </div>
                                                    <div>
                                                        <h3 className={`text-lg font-bold tracking-tight ${
                                                            isLocked ? 'text-gray-500' : 'text-gray-900'
                                                        }`}>
                                                            {node.title}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 mt-0.5">{node.description}</p>
                                                    </div>
                                                </div>
                                                <span className={`pill ${
                                                    isCompleted ? 'pill-success' :
                                                    isUnlocked ? 'pill-primary' :
                                                    'pill-muted'
                                                }`}>
                                                    {isCompleted ? 'Mastered' : isUnlocked ? 'In progress' : 'Locked'}
                                                </span>
                                            </div>

                                            <div className="mt-5">
                                                <div className="flex justify-between text-xs font-semibold mb-1.5">
                                                    <span className={isLocked ? 'text-gray-400' : 'text-gray-700'}>
                                                        {node.completedCount || 0} / {node.requiredCount} tasks
                                                    </span>
                                                    <span className={isLocked ? 'text-gray-400' : 'text-indigo-600'}>{Math.round(pct)}%</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                        transition={{ duration: 0.7, ease: 'easeOut' }}
                                                        className={`h-full rounded-full ${
                                                            isCompleted ? 'bg-emerald-500' :
                                                            isUnlocked ? 'bg-gradient-to-r from-indigo-500 to-purple-500' :
                                                            'bg-gray-300'
                                                        }`}
                                                    />
                                                </div>
                                                {isLocked && (
                                                    <p className="text-xs text-gray-400 mt-3 italic">
                                                        {node.id === 'resume' || node.id === 'interview'
                                                            ? 'Complete 5 projects to unlock both Resume & Interview.'
                                                            : 'Complete the previous track to unlock.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
