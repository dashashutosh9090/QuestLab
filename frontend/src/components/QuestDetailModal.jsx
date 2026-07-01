import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Per-track theming so the read-only detail modal matches the visual language
// of the corresponding submission/solve modal a learner might open next.
const THEME_BY_TRACK = {
    Basics: { from: 'from-emerald-500', to: 'to-teal-500', icon: '🌱', label: 'Basics quest' },
    DSA: { from: 'from-indigo-500', to: 'to-purple-500', icon: '🧠', label: 'DSA quest' },
    Project: { from: 'from-amber-500', to: 'to-orange-500', icon: '🛠️', label: 'Project quest' },
    Resume: { from: 'from-sky-500', to: 'to-cyan-500', icon: '📄', label: 'Resume quest' },
    Interview: { from: 'from-rose-500', to: 'to-pink-500', icon: '💼', label: 'Interview quest' }
};
const DEFAULT_THEME = { from: 'from-indigo-500', to: 'to-purple-500', icon: '🎯', label: 'Quest' };

export default function QuestDetailModal({ isOpen, onClose, task }) {
    // ESC closes the modal — matches the affordance users expect from any
    // dialog. Other modals in the app don't wire this up; opting in here
    // because there's no form to accidentally cancel.
    useEffect(() => {
        if (!isOpen) return undefined;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!task) return null;
    const theme = THEME_BY_TRACK[task.track] || DEFAULT_THEME;
    const dueDate = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-gray-900/70 backdrop-blur-md"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 20 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-white/40 max-h-[92vh] flex flex-col"
                    >
                        <header className={`bg-gradient-to-r ${theme.from} ${theme.to} text-white px-6 py-5 flex items-start justify-between gap-4`}>
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-lg flex-shrink-0">
                                    {theme.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{theme.label}</p>
                                    <h2 className="text-base sm:text-lg font-bold leading-snug">{task.title}</h2>
                                </div>
                            </div>
                            <button onClick={onClose}
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                                title="Close (Esc)">
                                ✕
                            </button>
                        </header>

                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            <div className="flex flex-wrap gap-1.5">
                                <span className="pill pill-primary">Lvl {task.levelRequired}</span>
                                {!task.isCore && <span className="pill pill-accent">AI generated</span>}
                                {task.isCodingChallenge && task.track !== 'Project' && <span className="pill pill-muted">Coding</span>}
                                {task.track === 'Project' && <span className="pill pill-warning">Project · ZIP</span>}
                                {task.track === 'Resume' && <span className="pill pill-warning">Resume · Proof</span>}
                                {task.track === 'Interview' && <span className="pill pill-warning">Interview · Proof</span>}
                                {task.topic && <span className="pill pill-muted">{task.topic}</span>}
                                {task.difficulty && <span className="pill pill-muted">{task.difficulty}</span>}
                                <span className="pill pill-warning">⭐ {task.xpReward} XP</span>
                                {dueDate && <span className="pill pill-warning">Due {dueDate}</span>}
                            </div>

                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Question</p>
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                    {task.description}
                                </p>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                            <button
                                onClick={onClose}
                                type="button"
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
