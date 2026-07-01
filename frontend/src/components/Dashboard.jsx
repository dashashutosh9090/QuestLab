import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import CodeEditorModal from './CodeEditorModal';
import ProjectSubmissionModal from './ProjectSubmissionModal';
import QuestDetailModal from './QuestDetailModal';
import ProfileSummaryCard from './ProfileSummaryCard';
import { TOPIC_CATALOG, DIFFICULTIES, isTopicTrack, trackToCategory } from '../constants/topics';
import Avatar from './Avatar';

const trackMeta = {
    Basics: { icon: '🌱', tone: 'from-emerald-500 to-teal-500' },
    DSA: { icon: '🧠', tone: 'from-indigo-500 to-blue-500' },
    Project: { icon: '🛠️', tone: 'from-amber-500 to-orange-500' },
    Resume: { icon: '📄', tone: 'from-sky-500 to-cyan-500' },
    Interview: { icon: '💼', tone: 'from-rose-500 to-pink-500' }
};

export default function Dashboard() {
    const { user, setUser, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const initialTab = ['Basics', 'DSA', 'Project', 'Resume', 'Interview'].includes(location.state?.track)
        ? location.state.track
        : 'Basics';
    const [activeTab, setActiveTab] = useState(initialTab);

    // If the user navigates to /dashboard again with a different track in state
    // (e.g. clicking a different roadmap tile), switch the active tab.
    useEffect(() => {
        const t = location.state?.track;
        if (t && ['Basics', 'DSA', 'Project', 'Resume', 'Interview'].includes(t)) {
            setActiveTab(t);
        }
    }, [location.state]);
    const [tasks, setTasks] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [mentorRequests, setMentorRequests] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [completingId, setCompletingId] = useState(null);
    const [roadmap, setRoadmap] = useState([]);
    const [loadingRoadmap, setLoadingRoadmap] = useState(true);
    const [genCount, setGenCount] = useState(3);
    const [genDifficulty, setGenDifficulty] = useState('Medium');
    // Per-track topic the learner is practicing. Null = show every topic in the
    // track. Resets whenever activeTab changes so an "Array" filter doesn't
    // bleed across from DSA into Basics.
    const [topic, setTopic] = useState(null);
    const [selectedCodingTask, setSelectedCodingTask] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedProjectTask, setSelectedProjectTask] = useState(null);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    // Read-only "click the card to see the full question" modal — separate from
    // the action modals (Solve/Submit) so it never interferes with submission flow.
    const [selectedDetailTask, setSelectedDetailTask] = useState(null);

    const tracks = ['Basics', 'DSA', 'Project', 'Resume', 'Interview'];

    useEffect(() => {
        if (!isAuthenticated) navigate('/');
    }, [isAuthenticated, navigate]);

    const fetchMentorRequests = async () => {
        try {
            const res = await api.get('/gamification/mentor-requests');
            if (res.data.success) setMentorRequests(res.data.requests || []);
        } catch (e) {
            console.error('Failed to load mentor requests', e);
        }
    };

    const fetchRoadmap = async () => {
        setLoadingRoadmap(true);
        try {
            const res = await api.get('/gamification/roadmap');
            if (res.data.success) setRoadmap(res.data.roadmap);
        } catch (e) {
            console.error('Failed to load roadmap', e);
        } finally {
            setLoadingRoadmap(false);
        }
    };


    useEffect(() => {
        if (!user) return;
        (async () => {
            await Promise.all([fetchRoadmap(), fetchMentorRequests()]);
        })();
    }, [user]);

    const handleRequestResponse = async (id, status) => {
        try {
            const res = await api.patch(`/gamification/mentor-requests/${id}`, { status });
            if (res.data.success) {
                if (status === 'accepted') {
                    toast.success('Mentorship accepted! Find them in Connections to chat.', { duration: 5000 });
                } else {
                    toast.success(`Request ${status}`);
                }
                setMentorRequests((prev) => prev.filter((r) => r._id !== id));
            } else {
                toast.error(res.data.message || 'Failed to update request');
            }
        } catch (error) {
            console.error('Mentor request update failed:', error);
            toast.error(error.response?.data?.message || 'Failed to update request');
        }
    };

    // Clear the topic filter whenever the learner switches tabs so a stale
    // selection (e.g. "Array" from DSA) doesn't accidentally hide every task
    // when they jump to Basics or a non-practice track. Wrapped here instead
    // of in an effect so the reset is colocated with the trigger.
    const switchTrack = (t) => {
        setActiveTab(t);
        setTopic(null);
    };

    useEffect(() => {
        if (!user || roadmap.length === 0) return;
        const currentTrack = roadmap.find((r) => r.trackName === activeTab);
        if (currentTrack?.status === 'locked') return;
        // Cancel any in-flight tasks request before kicking off the next one so a
        // slow earlier response can't overwrite a fresher one when tabs flip fast.
        const controller = new AbortController();
        (async () => {
            setLoadingTasks(true);
            try {
                const params = new URLSearchParams({ track: activeTab });
                // Filters only apply when the learner has explicitly picked a
                // topic. Without an explicit selection we must NOT send
                // category/difficulty — otherwise an empty selection would hide
                // previously-generated tasks whose stored category/difficulty
                // happen not to match the default control values, which made
                // generated quests vanish on every refresh.
                if (isTopicTrack(activeTab) && topic) {
                    const cat = trackToCategory(activeTab);
                    if (cat) params.set('category', cat);
                    params.set('topic', topic);
                }
                const res = await api.get(`/gamification/tasks?${params.toString()}`, { signal: controller.signal });
                if (res.data.success) setTasks(res.data.tasks || []);
            } catch (e) {
                if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
                toast.error('Failed to load quests');
            } finally {
                if (!controller.signal.aborted) setLoadingTasks(false);
            }
        })();
        return () => controller.abort();
    }, [activeTab, user, roadmap, topic]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const body = { track: activeTab, count: genCount, difficulty: genDifficulty };
            if (isTopicTrack(activeTab) && topic) body.topic = topic;
            const res = await api.post('/gamification/tasks/generate', body);
            if (res.data.success) {
                toast.success(`Generated ${res.data.tasks?.length || 0} ${activeTab} quests`);
                setTasks((prev) => [...(res.data.tasks || []), ...prev]);
            }
        } catch {
            toast.error('Failed to generate AI quests');
        } finally {
            setGenerating(false);
        }
    };

    const handleComplete = async (taskId) => {
        setCompletingId(taskId);
        try {
            const res = await api.post(`/gamification/tasks/${taskId}/complete`);
            if (res.data.success) {
                if (res.data.newUser) {
                    setUser({ ...user, ...res.data.newUser });
                }
                if (res.data.leveledUp) {
                    toast.success(`Level up! You reached Level ${res.data.newUser.level}`, { duration: 5000 });
                } else {
                    toast.success(`+${res.data.xpAwarded} XP earned`);
                }
                setTasks(tasks.map((t) => (t._id === taskId ? { ...t, status: 'completed' } : t)));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error completing quest');
        } finally {
            setCompletingId(null);
        }
    };

    const handleSolveIt = (task) => {
        setSelectedCodingTask(task);
        setIsEditorOpen(true);
    };

    const handleSubmitProject = (task) => {
        setSelectedProjectTask(task);
        setIsProjectModalOpen(true);
    };

    const handleProjectSubmitted = () => {
        // Optimistically reflect pending state on the active task so the card
        // immediately shows "Under review" without waiting for a refetch.
        if (!selectedProjectTask) return;
        setTasks((prev) => prev.map((t) =>
            t._id === selectedProjectTask._id
                ? { ...t, reviewStatus: 'pending', adminFeedback: '' }
                : t
        ));
    };

    const handleCodeComplete = (data, code, language) => {
        if (data.newUser) setUser({ ...user, ...data.newUser });
        if (data.leveledUp && data.newUser) {
            toast.success(`Level up! You reached Level ${data.newUser.level}`, { duration: 5000 });
        }
        setTasks(tasks.map((t) =>
            t._id === selectedCodingTask._id
                ? { ...t, status: 'completed', savedCode: code, savedLanguage: language }
                : t
        ));
    };

    if (!user) return null;

    const xp = user.xp || 0;
    const level = user.level || 1;
    const streak = user.streak || 0;
    const xpInLevel = xp % 500;
    const progressPct = (xpInLevel / 500) * 100;
    const completedAll = tasks.filter((t) => t.status === 'completed').length;
    const activeTrackInfo = roadmap.find((r) => r.trackName === activeTab);
    const isActiveLocked = activeTrackInfo?.status === 'locked';

    return (
        <div className="app-bg pb-16">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <ProfileSummaryCard user={user} />

                {/* Hero */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="hero-card p-6 sm:p-8 mb-8"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
                        <div>
                            <span className="section-eyebrow">Welcome back</span>
                            <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
                                Hello, <span className="text-gradient">{user.name?.split(' ')[0]}</span>.
                            </h1>
                            <p className="text-gray-600 mt-2 max-w-xl">
                                Pick a track and complete quests to earn XP. {streak > 0
                                    ? `You're on a ${streak}-day streak — keep it alive.`
                                    : 'Start a streak by completing a quest today.'}
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2">
                                {tracks.map((t) => {
                                    const ti = roadmap.find((r) => r.trackName === t);
                                    const locked = ti?.status === 'locked';
                                    const completed = ti?.status === 'completed';
                                    return (
                                        <span
                                            key={t}
                                            className={`pill ${
                                                completed ? 'pill-success' : locked ? 'pill-muted' : 'pill-primary'
                                            }`}
                                        >
                                            <span>{trackMeta[t]?.icon}</span>
                                            {t}
                                            {completed && <span className="ml-1">✓</span>}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <StatCard label="Level" value={level} accent="indigo" sub={`${xpInLevel}/500 XP`} />
                            <StatCard label="Total XP" value={xp.toLocaleString()} accent="violet" />
                            <StatCard label="Streak" value={`${streak}d`} accent="amber" sub="🔥 active" />
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                            <span>Progress to Level {level + 1}</span>
                            <span>{Math.round(progressPct)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
                            />
                        </div>
                    </div>
                </motion.section>

                {/* Mentor requests */}
                {mentorRequests.length > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="section-title">Mentorship requests</h2>
                            <span className="pill pill-accent">{mentorRequests.length} pending</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {mentorRequests.map((req) => (
                                <div key={req._id} className="surface p-5 hover-lift">
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                            user={req.sender}
                                            alt=""
                                            className="w-11 h-11 rounded-full ring-2 ring-white shadow-sm"
                                            initialsClassName="font-bold text-white"
                                            placeholderClassName="bg-gradient-to-br from-indigo-400 to-purple-500"
                                        />
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-800 truncate">{req.sender?.name}</p>
                                            <p className="text-xs text-gray-500">Lvl {req.sender?.level} · {req.sender?.xp} XP</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-3 italic line-clamp-2 surface-muted px-3 py-2 rounded-lg">
                                        “{req.message}”
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => handleRequestResponse(req._id, 'accepted')}
                                                className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                            Accept
                                        </button>
                                        <button onClick={() => handleRequestResponse(req._id, 'rejected')}
                                                className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors">
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* Track tabs */}
                <div className="mb-5 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {tracks.map((track) => {
                        const trackInfo = roadmap.find((r) => r.trackName === track);
                        const isLocked = trackInfo?.status === 'locked';
                        const isActive = activeTab === track;
                        return (
                            <button
                                key={track}
                                onClick={() => !isLocked && switchTrack(track)}
                                disabled={isLocked}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 border ${
                                    isActive
                                        ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                                        : isLocked
                                            ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                            >
                                <span>{isLocked ? '🔒' : trackMeta[track]?.icon}</span>
                                <span>{track}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Track content */}
                <motion.section
                    key={activeTab}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="surface p-6 sm:p-8"
                >
                    {/* Toolbar */}
                    <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
                        <div className="flex flex-wrap items-center gap-4">
                            <div>
                                <span className="section-eyebrow">Track</span>
                                <h2 className="text-xl font-bold tracking-tight mt-1 flex items-center gap-2">
                                    <span>{trackMeta[activeTab]?.icon}</span>
                                    {activeTab} Quests
                                </h2>
                            </div>
                            {!isActiveLocked && tasks.length > 0 && (
                                <span className="pill pill-muted hidden sm:inline-flex">
                                    {completedAll}/{tasks.length} completed
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {isTopicTrack(activeTab) && (
                                <TopicSelect
                                    label="Topic"
                                    options={TOPIC_CATALOG[activeTab]}
                                    value={topic}
                                    onChange={setTopic}
                                />
                            )}
                            <Segmented label="Difficulty" options={DIFFICULTIES} value={genDifficulty} onChange={setGenDifficulty} compact />
                            <Segmented label="Count" options={[1, 3, 5]} value={genCount} onChange={setGenCount} />
                            <button onClick={handleGenerate} disabled={generating || isActiveLocked}
                                    className="btn-primary">
                                {generating ? (
                                    <>
                                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                        Generating…
                                    </>
                                ) : (
                                    <>
                                        <span>✨</span>
                                        <span>Generate AI quests</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {activeTab === 'Resume' && !isActiveLocked && (
                        <div className="surface-muted p-5 mb-6">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">📄 Resume builder resources</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-white rounded-xl p-4 border border-gray-100">
                                    <h4 className="text-sm font-bold text-gray-800 mb-2">ATS-friendly templates</h4>
                                    <ul className="text-sm text-gray-600 space-y-1">
                                        <li>• <a href="https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Jake's resume (LaTeX)</a></li>
                                        <li>• <a href="https://rxresu.me/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Reactive resume</a></li>
                                        <li>• <a href="https://novoresume.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Novoresume</a></li>
                                    </ul>
                                </div>
                                <div className="bg-white rounded-xl p-4 border border-gray-100">
                                    <h4 className="text-sm font-bold text-gray-800 mb-2">Best practices</h4>
                                    <ul className="text-sm text-gray-600 space-y-1">
                                        <li>• Use the XYZ formula for impact bullets</li>
                                        <li>• Keep it strictly to 1 page entry-level</li>
                                        <li>• Include GitHub and live project links</li>
                                        <li>• Bold relevant keywords and tech</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Body */}
                    {loadingTasks || loadingRoadmap ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="surface p-5 h-44 shimmer rounded-2xl"></div>
                            ))}
                        </div>
                    ) : isActiveLocked ? (
                        <EmptyState
                            icon="🔒" title="Track locked"
                            body={
                                activeTab === 'Resume' || activeTab === 'Interview'
                                    ? 'Complete 5 projects to unlock both Resume and Interview tracks.'
                                    : `Complete ${roadmap.find((r) => r.id === (activeTab === 'DSA' ? 'basics' : activeTab === 'Project' ? 'dsa' : 'project'))?.requiredCount || 30} tasks in the previous track to unlock ${activeTab}.`
                            }
                            action={{ label: 'View roadmap', onClick: () => navigate('/roadmap') }}
                        />
                    ) : tasks.length === 0 ? (
                        <EmptyState
                            icon="🎯"
                            title="No quests yet"
                            body={
                                isTopicTrack(activeTab) && topic
                                    ? `No questions yet for ${topic} in ${activeTab}. Try generating AI quests, or pick a different topic.`
                                    : `Generate personalized ${activeTab} challenges with AI to start earning XP.`
                            }
                            action={{ label: 'Generate quests', onClick: handleGenerate, primary: true }}
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {tasks.map((task) => (
                                <QuestCard
                                    key={task._id}
                                    task={task}
                                    isCompleting={completingId === task._id}
                                    onComplete={() => handleComplete(task._id)}
                                    onSolve={() => handleSolveIt(task)}
                                    onSubmitProject={() => handleSubmitProject(task)}
                                    onViewDetails={() => setSelectedDetailTask(task)}
                                />
                            ))}
                        </div>
                    )}
                </motion.section>
            </div>

            <CodeEditorModal
                key={selectedCodingTask?._id || 'no-task'}
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                task={selectedCodingTask}
                onComplete={handleCodeComplete}
            />

            <ProjectSubmissionModal
                key={selectedProjectTask?._id || 'no-project'}
                isOpen={isProjectModalOpen}
                onClose={() => setIsProjectModalOpen(false)}
                task={selectedProjectTask}
                onSubmitted={handleProjectSubmitted}
                mode={selectedProjectTask?.track === 'Project' ? 'zip' : 'text'}
            />

            <QuestDetailModal
                key={selectedDetailTask?._id || 'no-detail'}
                isOpen={!!selectedDetailTask}
                onClose={() => setSelectedDetailTask(null)}
                task={selectedDetailTask}
            />
        </div>
    );
}

function StatCard({ label, value, sub, accent }) {
    const tones = {
        indigo: 'from-indigo-500/10 to-indigo-500/0 text-indigo-600',
        violet: 'from-violet-500/10 to-violet-500/0 text-violet-600',
        amber: 'from-amber-500/10 to-amber-500/0 text-amber-600'
    };
    return (
        <div className={`stat-tile relative overflow-hidden bg-gradient-to-br ${tones[accent]}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
        </div>
    );
}

function TopicSelect({ label, options, value, onChange }) {
    return (
        <div className="flex items-center gap-2">
            <span className="section-eyebrow text-[10px]">{label}</span>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="bg-gray-100 hover:bg-gray-200 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 border border-transparent rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-700 outline-none transition-all cursor-pointer"
            >
                <option value="">All topics</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function Segmented({ label, options, value, onChange, compact }) {
    return (
        <div className="flex items-center gap-2">
            <span className="section-eyebrow text-[10px]">{label}</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
                {options.map((opt) => (
                    <button
                        key={opt}
                        onClick={() => onChange(opt)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                            value === opt ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {compact ? String(opt).charAt(0) : opt}
                    </button>
                ))}
            </div>
        </div>
    );
}

function EmptyState({ icon, title, body, action }) {
    return (
        <div className="text-center py-14 surface-muted rounded-2xl border-2 border-dashed">
            <div className="text-4xl mb-3">{icon}</div>
            <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{body}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    
                    className={`${action.primary ? 'btn-primary' : 'btn-ghost'} mt-5`}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

function QuestCard({ task, isCompleting, onComplete, onSolve, onSubmitProject, onViewDetails }) {
    const isCompleted = task.status === 'completed' || task.reviewStatus === 'approved';
    const isProject = task.track === 'Project';
    const needsReview = isProject || task.track === 'Resume' || task.track === 'Interview';
    const reviewStatus = task.reviewStatus || 'none';
    const showPendingRibbon = needsReview && reviewStatus === 'pending' && !isCompleted;
    const showRevisionRibbon = needsReview && reviewStatus === 'revision';
    const showRejectedRibbon = needsReview && reviewStatus === 'rejected';

    return (
        <motion.div
            whileHover={{ y: -3 }}
            className={`surface p-5 flex flex-col h-full transition-shadow relative overflow-hidden ${
                isCompleted ? 'bg-gradient-to-br from-emerald-50/40 to-white' : 'hover:shadow-lg'
            }`}
        >
            {isCompleted && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg tracking-wider">
                    COMPLETED
                </div>
            )}
            {showPendingRibbon && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg tracking-wider">
                    UNDER REVIEW
                </div>
            )}
            {showRevisionRibbon && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg tracking-wider">
                    NEEDS REVISION
                </div>
            )}
            {showRejectedRibbon && (
                <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg tracking-wider">
                    REJECTED
                </div>
            )}

            <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="pill pill-primary">Lvl {task.levelRequired}</span>
                {!task.isCore && <span className="pill pill-accent">AI generated</span>}
                {task.isCodingChallenge && !isProject && <span className="pill pill-muted">Coding</span>}
                {isProject && <span className="pill pill-warning">Project · ZIP</span>}
                {task.track === 'Resume' && <span className="pill pill-warning">Resume · Proof</span>}
                {task.track === 'Interview' && <span className="pill pill-warning">Interview · Proof</span>}
            </div>

            <button
                type="button"
                onClick={onViewDetails}
                title="Click to read the full question"
                className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded-md flex-grow cursor-pointer"
            >
                <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 mb-1.5">
                    {task.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {task.description}
                </p>
            </button>

            {showPendingRibbon && (
                <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-semibold text-amber-700">Under review by admin</span>
                </div>
            )}
            {showRevisionRibbon && task.adminFeedback && (
                <div className="mt-3 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-0.5">Revision requested</p>
                    <p className="text-xs text-orange-700 line-clamp-3 whitespace-pre-wrap leading-relaxed">{task.adminFeedback}</p>
                </div>
            )}
            {showRejectedRibbon && task.adminFeedback && (
                <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-0.5">Admin feedback</p>
                    <p className="text-xs text-rose-700 line-clamp-3 whitespace-pre-wrap leading-relaxed">{task.adminFeedback}</p>
                </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                    <span>⭐</span> {task.xpReward} XP
                </span>
                {needsReview ? (
                    <ProjectActionButton
                        isCompleted={isCompleted}
                        reviewStatus={reviewStatus}
                        track={task.track}
                        onClick={onSubmitProject}
                    />
                ) : task.isCodingChallenge ? (
                    <button onClick={onSolve}
                            className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
                                isCompleted
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-gray-900 text-white hover:bg-gray-800'
                            }`}>
                        {isCompleted ? 'Replay' : 'Solve'}
                    </button>
                ) : (
                    <button onClick={onComplete} disabled={isCompleted || isCompleting}
                            className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
                                isCompleted
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                    : isCompleting
                                        ? 'bg-indigo-100 text-indigo-700 cursor-wait'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}>
                        {isCompleted ? 'Done ✓' : isCompleting ? '…' : 'Complete'}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

function ProjectActionButton({ isCompleted, reviewStatus, track, onClick }) {
    if (isCompleted) {
        return (
            <button onClick={onClick}
                    className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                Discuss ✓
            </button>
        );
    }
    if (reviewStatus === 'pending') {
        return (
            <button onClick={onClick}
                    className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                View thread
            </button>
        );
    }
    const needsResubmit = reviewStatus === 'rejected' || reviewStatus === 'revision';
    const isZip = track === 'Project';
    const noun = isZip ? 'ZIP' : 'proof';
    const gradient = isZip
        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-orange-500/30'
        : track === 'Resume'
            ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-600 hover:to-cyan-600 shadow-cyan-500/30'
            : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-600 hover:to-pink-600 shadow-pink-500/30';
    return (
        <button onClick={onClick}
                className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all shadow-md ${
                    reviewStatus === 'rejected'
                        ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/30'
                        : reviewStatus === 'revision'
                            ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-500/30'
                            : gradient
                }`}>
            {needsResubmit ? `Resubmit ${noun}` : `Submit ${noun}`}
        </button>
    );
}
