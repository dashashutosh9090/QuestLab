import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import Navbar from './Navbar';

const LANGUAGES = ['All', 'MERN Stack', 'Python', 'JavaScript', 'Java', 'C++', 'C'];

const LANGUAGE_GRADIENTS = {
    'MERN Stack': 'from-emerald-500 to-teal-500',
    'Python': 'from-yellow-500 to-amber-500',
    'JavaScript': 'from-amber-400 to-orange-500',
    'Java': 'from-red-500 to-rose-500',
    'C++': 'from-blue-500 to-indigo-500',
    'C': 'from-slate-500 to-gray-600',
    'All': 'from-indigo-500 via-purple-500 to-pink-500'
};

export default function InterviewPrep() {
    const [unlocked, setUnlocked] = useState(null); // null = loading
    const [resources, setResources] = useState([]);
    const [loadingResources, setLoadingResources] = useState(true);
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        api.get('/gamification/roadmap')
            .then((res) => {
                if (cancelled) return;
                const node = (res.data?.roadmap || []).find((n) => n.id === 'interview');
                setUnlocked(node ? node.status !== 'locked' : false);
            })
            .catch(() => { if (!cancelled) setUnlocked(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!unlocked) return;
        let cancelled = false;
        setLoadingResources(true);
        api.get('/gamification/resources')
            .then((res) => {
                if (cancelled) return;
                setResources(res.data?.resources || []);
            })
            .catch(() => { if (!cancelled) setResources([]); })
            .finally(() => { if (!cancelled) setLoadingResources(false); });
        return () => { cancelled = true; };
    }, [unlocked]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return resources.filter((r) => {
            const langMatch = filter === 'All' || r.language === filter || r.language === 'All';
            const searchMatch = !q || r.title?.toLowerCase().includes(q);
            return langMatch && searchMatch;
        });
    }, [resources, filter, search]);

    return (
        <div className="app-bg pb-16">
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
                {/* HERO */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="hero-card p-6 sm:p-8 mb-6 relative overflow-hidden"
                >
                    <div aria-hidden className="absolute -top-24 -right-20 w-72 h-72 bg-gradient-to-br from-indigo-300 to-purple-300 rounded-full opacity-25 blur-3xl pointer-events-none" />
                    <div aria-hidden className="absolute -bottom-32 -left-20 w-64 h-64 bg-gradient-to-br from-pink-300 to-orange-300 rounded-full opacity-20 blur-3xl pointer-events-none" />
                    <div className="relative">
                        <span className="section-eyebrow">Stage 5</span>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
                            Interview <span className="text-gradient">prep</span>
                        </h1>
                        <p className="text-gray-600 mt-2 max-w-xl">
                            Curated PDFs covering core concepts, common questions, and language-specific deep dives.
                        </p>
                    </div>
                </motion.div>

                {unlocked === null ? (
                    <div className="surface h-48 shimmer rounded-2xl" />
                ) : !unlocked ? (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="surface p-10 sm:p-12 text-center"
                    >
                        <div className="text-6xl mb-4">🔒</div>
                        <h3 className="section-title text-lg mb-2">Interview track is locked</h3>
                        <p className="text-sm text-gray-500 max-w-md mx-auto">
                            Finish the Project track first — ship 5 project quests to unlock the interview prep library.
                        </p>
                    </motion.div>
                ) : (
                    <>
                        {/* FILTER BAR */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="surface p-3 sm:p-4 mb-5 space-y-3"
                        >
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.3-4.3" />
                                </svg>
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search resources by title…"
                                    className="input pl-9"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {LANGUAGES.map((l) => (
                                    <button
                                        key={l}
                                        type="button"
                                        onClick={() => setFilter(l)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            filter === l
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {l}
                                    </button>
                                ))}
                                <span className="ml-auto pill text-[11px] whitespace-nowrap">
                                    {filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}
                                </span>
                            </div>
                        </motion.div>

                        {loadingResources ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                                {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="surface h-48 shimmer rounded-2xl" />)}
                            </div>
                        ) : filtered.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="surface p-10 sm:p-14 text-center"
                            >
                                <div className="text-5xl mb-3">📭</div>
                                <h3 className="section-title text-base mb-1">Nothing here yet</h3>
                                <p className="text-sm text-gray-500">
                                    {search.trim()
                                        ? `No resources match "${search.trim()}".`
                                        : filter === 'All'
                                            ? 'No interview resources have been uploaded yet. Check back soon.'
                                            : `No resources tagged ${filter}. Try a different language.`}
                                </p>
                            </motion.div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                                {filtered.map((r, idx) => {
                                    const grad = LANGUAGE_GRADIENTS[r.language] || LANGUAGE_GRADIENTS.All;
                                    return (
                                        <motion.div
                                            key={r._id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                                            whileHover={{ y: -4 }}
                                            className="surface p-5 flex flex-col hover:shadow-xl hover:shadow-indigo-500/10 transition-shadow group"
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-4">
                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xl shadow-md flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                                    📄
                                                </div>
                                                <span className="pill text-[10px] whitespace-nowrap">{r.language}</span>
                                            </div>
                                            <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 mb-1">
                                                {r.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 mb-4">
                                                Added {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                            <a
                                                href={r.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-primary mt-auto justify-center w-full inline-flex items-center"
                                            >
                                                View PDF
                                                <svg className="w-3.5 h-3.5 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M7 17 17 7" />
                                                    <path d="M7 7h10v10" />
                                                </svg>
                                            </a>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
