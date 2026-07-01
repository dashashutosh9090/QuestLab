import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Navbar from './Navbar';
import WeeklyBars from './charts/WeeklyBars';
import CommentsThread from './CommentsThread';
import { TOPIC_CATALOG, DIFFICULTIES, isTopicTrack, trackToCategory } from '../constants/topics';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const tracks = ['Basics', 'DSA', 'Project', 'Resume', 'Interview'];
const resourceLanguages = ['All', 'MERN Stack', 'Python', 'JavaScript', 'Java', 'C++', 'C'];

const trackPalette = {
    Basics: 'bg-emerald-50 text-emerald-600',
    DSA: 'bg-indigo-50 text-indigo-600',
    Project: 'bg-amber-50 text-amber-600',
    Resume: 'bg-sky-50 text-sky-600',
    Interview: 'bg-rose-50 text-rose-600'
};

const inputCls =
    'w-full bg-gray-50 border border-transparent focus:bg-white focus:border-pink-300 focus:ring-4 focus:ring-pink-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none placeholder:text-gray-400 text-gray-800';

const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

const primaryBtnCls =
    'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-pink-500/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all';

const cardCls =
    'bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 sm:p-8';

// Strict semantic colors for the review-status badge.
const STATUS_BADGE = {
    approved: { label: 'Approved', classes: 'bg-green-100 text-green-700' },
    pending: { label: 'Pending', classes: 'bg-amber-100 text-amber-700' },
    rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
    revision: { label: 'Needs Revision', classes: 'bg-orange-100 text-orange-700' },
    submitted: { label: 'Submitted', classes: 'bg-blue-100 text-blue-700' }
};

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'resources' | 'submissions'
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('All');

    // Interview-resource upload state
    const [resources, setResources] = useState([]);
    const [resourceForm, setResourceForm] = useState({ title: '', language: 'All' });
    const [resourceFile, setResourceFile] = useState(null);
    const [resourceUploading, setResourceUploading] = useState(false);
    const [resourcesLoading, setResourcesLoading] = useState(false);

    // Project-submission review queue state
    const [submissions, setSubmissions] = useState([]);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [feedbackBySubmission, setFeedbackBySubmission] = useState({});
    const [reviewingId, setReviewingId] = useState(null);

    // Aggregated assignment counters for the top metrics grid
    const [dashboardStats, setDashboardStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    // 7-day rolling activity for the weekly chart
    const [weekly, setWeekly] = useState(null);
    const [weeklyLoading, setWeeklyLoading] = useState(true);

    // Computed AI insights for the top banner
    const [insights, setInsights] = useState([]);
    const [insightIdx, setInsightIdx] = useState(0);

    // Currently-open submission in the review drawer (null = drawer closed)
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    // Secondary chip filter for the Existing Tasks list. Only applied when the
    // primary `filter` is a topic track (Basics/DSA) — null = show all topics.
    const [topicFilter, setTopicFilter] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        xpReward: 50,
        levelRequired: 1,
        track: 'Basics',
        isCodingChallenge: false,
        testCasesText: '',
        courseName: '',
        dueDate: '',
        totalMarks: 100,
        topic: TOPIC_CATALOG.Basics[0],
        difficulty: 'Easy'
    });

    const blankForm = {
        title: '',
        description: '',
        xpReward: 50,
        levelRequired: 1,
        track: 'Basics',
        isCodingChallenge: false,
        testCasesText: '',
        courseName: '',
        dueDate: '',
        totalMarks: 100,
        topic: TOPIC_CATALOG.Basics[0],
        difficulty: 'Easy'
    };


    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/admin/tasks');
                if (data.success) setTasks(data.tasks);
            } catch (e) {
                console.error('Error fetching core tasks:', e);
            }
        })();
    }, []);

    // Fetch aggregated dashboard stats once on mount.
    useEffect(() => {
        let cancelled = false;
        setStatsLoading(true);
        api.get('/admin/stats')
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success) setDashboardStats(data.stats);
            })
            .catch((e) => {
                if (cancelled) return;
                console.error('Error fetching dashboard stats:', e);
            })
            .finally(() => { if (!cancelled) setStatsLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Refetch the 7-day rolling activity rollup. Called on mount and whenever
    // submission activity changes (new arrivals, reviews) so the bar chart
    // tracks the live state instead of freezing on its initial snapshot.
    const refreshWeekly = useCallback(() => {
        return api.get('/admin/analytics/weekly')
            .then(({ data }) => {
                if (data.success) setWeekly(data);
            })
            .catch((e) => {
                console.error('Error fetching admin weekly analytics:', e);
            });
    }, []);

    useEffect(() => {
        let cancelled = false;
        setWeeklyLoading(true);
        api.get('/admin/analytics/weekly')
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success) setWeekly(data);
            })
            .catch((e) => {
                if (cancelled) return;
                console.error('Error fetching admin weekly analytics:', e);
            })
            .finally(() => { if (!cancelled) setWeeklyLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Fetch computed insights for the top banner carousel.
    useEffect(() => {
        let cancelled = false;
        api.get('/admin/insights')
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success && Array.isArray(data.insights)) {
                    setInsights(data.insights);
                    setInsightIdx(0);
                }
            })
            .catch((e) => {
                if (cancelled) return;
                console.error('Error fetching insights:', e);
            });
        return () => { cancelled = true; };
    }, []);

    // Auto-advance the insights carousel every 7s — but only if there's more
    // than one. Manual paging (dot click) resets the cycle below.
    useEffect(() => {
        if (insights.length <= 1) return undefined;
        const id = setInterval(() => {
            setInsightIdx((i) => (i + 1) % insights.length);
        }, 7000);
        return () => clearInterval(id);
    }, [insights.length, insightIdx]);

    // Initial counts fetch so the tab badges (Interview Resources / Project
    // Submissions) show the real numbers on mount instead of 0. The
    // activeTab-gated effects below still refetch on each tab open for
    // freshness, but they no longer gate the badge counts.
    useEffect(() => {
        let cancelled = false;
        api.get('/admin/resources')
            .then(({ data }) => {
                if (cancelled || !data?.success) return;
                setResources(data.resources || []);
            })
            .catch((e) => console.error('Initial resources fetch failed:', e));
        api.get('/admin/submissions')
            .then(({ data }) => {
                if (cancelled || !data?.success) return;
                setSubmissions(data.submissions || []);
            })
            .catch((e) => console.error('Initial submissions fetch failed:', e));
        return () => { cancelled = true; };
    }, []);

    // Lazy-load resources the first time the Interview Resources tab opens.
    useEffect(() => {
        if (activeTab !== 'resources') return;
        let cancelled = false;
        setResourcesLoading(true);
        api.get('/admin/resources')
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success) setResources(data.resources);
            })
            .catch((e) => {
                if (cancelled) return;
                console.error('Error fetching interview resources:', e);
                toast.error('Failed to load resources');
            })
            .finally(() => { if (!cancelled) setResourcesLoading(false); });
        return () => { cancelled = true; };
    }, [activeTab]);

    // Auto-close the review drawer once its underlying row leaves the queue
    // (which only happens after a successful approve/reject). On error, the row
    // remains so the drawer stays open for the admin to retry.
    useEffect(() => {
        if (!selectedSubmission) return;
        const stillExists = submissions.some((s) => s._id === selectedSubmission._id);
        if (!stillExists) setSelectedSubmission(null);
    }, [submissions, selectedSubmission]);

    // Refetch the pending submission queue every time the tab opens — admins
    // expect a fresh list when they navigate here.
    useEffect(() => {
        if (activeTab !== 'submissions') return;
        let cancelled = false;
        setSubmissionsLoading(true);
        api.get('/admin/submissions')
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success) setSubmissions(data.submissions || []);
            })
            .catch((e) => {
                if (cancelled) return;
                console.error('Error fetching project submissions:', e);
                toast.error('Failed to load submissions');
            })
            .finally(() => { if (!cancelled) setSubmissionsLoading(false); });
        return () => { cancelled = true; };
    }, [activeTab]);

    // Live dashboard sync: prepend new submissions and drop reviewed ones from
    // the queue without a refetch. Navbar handles the user-facing toast via
    // the `admin:notification` channel — this listener is silent state sync.
    useEffect(() => {
        if (user?.role !== 'admin') return undefined;
        const token = localStorage.getItem('token');
        if (!token) return undefined;

        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        socket.on('admin:submission_new', (payload) => {
            const sub = payload?.submission;
            if (!sub?._id) return;
            setSubmissions((prev) => {
                const idx = prev.findIndex((s) => String(s._id) === String(sub._id));
                if (idx === -1) return [sub, ...prev];
                // Resubmission: row is already pending, refresh in place so the
                // submittedAt / submitCount surface the latest attempt.
                const next = prev.slice();
                next[idx] = sub;
                return next;
            });
            if (!payload?.isResubmit) {
                setDashboardStats((prev) =>
                    prev ? { ...prev, pendingReviews: (prev.pendingReviews || 0) + 1 } : prev
                );
            }
            // Today's bar moved — refresh the chart from the server.
            refreshWeekly();
        });

        socket.on('admin:submission_reviewed', (payload) => {
            const id = payload?.submissionId;
            if (!id) return;
            let removed = false;
            setSubmissions((prev) => {
                const next = prev.filter((s) => String(s._id) !== String(id));
                removed = next.length !== prev.length;
                return next;
            });
            if (removed) {
                setDashboardStats((prev) =>
                    prev ? { ...prev, pendingReviews: Math.max(0, (prev.pendingReviews || 0) - 1) } : prev
                );
            }
            // Status distribution for the day changed (pending → approved/etc.).
            refreshWeekly();
        });

        return () => {
            socket.off('admin:submission_new');
            socket.off('admin:submission_reviewed');
            socket.disconnect();
        };
    }, [user, refreshWeekly]);

    const handleFeedbackChange = (id, value) => {
        setFeedbackBySubmission((prev) => ({ ...prev, [id]: value }));
    };

    const handleReviewSubmission = async (id, status) => {
        const feedback = (feedbackBySubmission[id] || '').trim();
        if ((status === 'rejected' || status === 'revision') && !feedback) {
            toast.error(status === 'revision'
                ? 'Please describe what needs revision'
                : 'Please leave feedback when rejecting');
            return;
        }
        setReviewingId(id);
        try {
            const { data } = await api.post(`/admin/submissions/${id}/review`, { status, feedback });
            if (data.success) {
                toast.success(`Submission ${status}`);
                setSubmissions((prev) => prev.filter((s) => s._id !== id));
                setFeedbackBySubmission((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
                // The reviewing admin's own action won't always echo back via
                // the `admin:submission_reviewed` socket (own-tab filtering
                // varies by gateway), so explicitly refresh the chart here.
                refreshWeekly();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to record review');
        } finally {
            setReviewingId(null);
        }
    };

    const handleResourceFieldChange = (e) => {
        const { name, value } = e.target;
        setResourceForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleResourceFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        if (file && file.type !== 'application/pdf') {
            toast.error('Only PDF files are allowed');
            e.target.value = '';
            setResourceFile(null);
            return;
        }
        setResourceFile(file);
    };

    const handleResourceSubmit = async (e) => {
        e.preventDefault();
        if (!resourceForm.title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (!resourceFile) {
            toast.error('Please select a PDF file');
            return;
        }

        const fd = new FormData();
        fd.append('title', resourceForm.title.trim());
        fd.append('language', resourceForm.language);
        fd.append('file', resourceFile);

        setResourceUploading(true);
        try {
            const { data } = await api.post('/admin/resources', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (data.success) {
                toast.success('Resource uploaded');
                setResources((prev) => [data.resource, ...prev]);
                setResourceForm({ title: '', language: 'All' });
                setResourceFile(null);
                // Reset the native <input type="file"> as well.
                const fileInput = document.getElementById('resource-file-input');
                if (fileInput) fileInput.value = '';
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setResourceUploading(false);
        }
    };

    const handleResourceDelete = async (id) => {
        if (!window.confirm('Delete this resource?')) return;
        try {
            const { data } = await api.delete(`/admin/resources/${id}`);
            if (data.success) {
                toast.success('Resource deleted');
                setResources((prev) => prev.filter((r) => r._id !== id));
            }
        } catch {
            toast.error('Failed to delete resource');
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        // When the admin switches Track, snap topic to the first valid one for
        // the new track so we never POST a topic that doesn't belong (e.g.,
        // leaving "Array" selected after flipping from DSA to Basics).
        if (name === 'track') {
            const nextTopic = isTopicTrack(value) ? TOPIC_CATALOG[value][0] : '';
            setFormData((prev) => ({ ...prev, track: value, topic: nextTopic }));
            return;
        }
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            title: formData.title,
            description: formData.description,
            xpReward: formData.xpReward,
            levelRequired: formData.levelRequired,
            track: formData.track,
            isCodingChallenge: formData.isCodingChallenge,
            courseName: formData.courseName,
            dueDate: formData.dueDate || null,
            totalMarks: formData.totalMarks
        };

        if (isTopicTrack(formData.track)) {
            payload.topic = formData.topic;
            payload.difficulty = formData.difficulty;
        }

        if (formData.isCodingChallenge) {
            let parsed;
            try {
                parsed = JSON.parse(formData.testCasesText);
            } catch {
                toast.error('Test cases must be valid JSON');
                return;
            }
            const isValidShape =
                Array.isArray(parsed) &&
                parsed.length > 0 &&
                parsed.every((tc) => typeof tc?.input === 'string' && typeof tc?.expectedOutput === 'string');
            if (!isValidShape) {
                toast.error('Provide a non-empty array of {input, expectedOutput} string pairs');
                return;
            }
            payload.testCases = parsed;
        }

        setLoading(true);
        try {
            const { data } = await api.post('/admin/tasks', payload);
            if (data.success) {
                toast.success('Core task created');
                setTasks([data.task, ...tasks]);
                setFormData(blankForm);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create task');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this core task?')) return;
        try {
            const { data } = await api.delete(`/admin/tasks/${id}`);
            if (data.success) {
                toast.success('Task deleted');
                setTasks(tasks.filter((t) => t._id !== id));
            }
        } catch {
            toast.error('Failed to delete task');
        }
    };

    const handleLogout = () => { logout(); navigate('/'); };

    const visibleTasks = (filter === 'All' ? tasks : tasks.filter((t) => t.track === filter))
        .filter((t) => (isTopicTrack(filter) && topicFilter ? t.topic === topicFilter : true));

    const navItems = [
        {
            id: 'tasks',
            label: 'Manage Tasks',
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="3" />
                    <path d="M8 9h8M8 13h8M8 17h5" />
                </svg>
            )
        },
        {
            id: 'resources',
            label: 'Interview Resources',
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M9 13h6M9 17h6" />
                </svg>
            )
        },
        {
            id: 'submissions',
            label: 'Project Submissions',
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
                </svg>
            )
        }
    ];

    const stats = dashboardStats || {};
    const metricCards = [
        { label: 'Total Assignments', value: stats.totalAssignments ?? 0, accent: 'from-indigo-400 to-purple-500', iconBg: 'bg-indigo-50 text-indigo-600', icon: '📚' },
        { label: 'Submitted', value: stats.submitted ?? 0, accent: 'from-sky-400 to-cyan-500', iconBg: 'bg-sky-50 text-sky-600', icon: '📤' },
        { label: 'Pending Review', value: stats.pendingReview ?? 0, accent: 'from-amber-400 to-orange-500', iconBg: 'bg-amber-50 text-amber-600', icon: '⏳' },
        { label: 'Approved', value: stats.approved ?? 0, accent: 'from-emerald-400 to-teal-500', iconBg: 'bg-emerald-50 text-emerald-600', icon: '✅' },
        { label: 'Rejected', value: stats.rejected ?? 0, accent: 'from-rose-400 to-pink-500', iconBg: 'bg-rose-50 text-rose-600', icon: '✕' },
        { label: 'Late Submissions', value: stats.lateSubmissions ?? 0, accent: 'from-red-400 to-orange-500', iconBg: 'bg-red-50 text-red-600', icon: '⚠' }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-pink-50/30">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
                {/* HEADER STRIP */}
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-500 mb-1">Admin · Curriculum console</div>
                        <h1 className="text-3xl sm:text-[32px] font-bold text-gray-900 tracking-tight leading-tight">
                            Welcome back, admin.
                        </h1>
                        <p className="text-sm text-gray-500 mt-1.5 max-w-xl">
                            A live snapshot of every assignment, submission, and review across QuestLab.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            Admin mode
                        </span>
                        <button
                            onClick={handleLogout}
                            className="text-xs font-semibold text-gray-400 hover:text-rose-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Sign out →
                        </button>
                    </div>
                </div>

                {/* AI INSIGHTS BANNER — computed against live DB, rotates every 7s */}
                {(() => {
                    const active = insights[insightIdx] || null;
                    const sevTone = active?.severity === 'warn'
                        ? { wrap: 'from-rose-50 to-orange-50 border-rose-100', label: 'text-rose-600', tile: 'text-rose-500' }
                        : active?.severity === 'positive'
                            ? { wrap: 'from-emerald-50 to-teal-50 border-emerald-100', label: 'text-emerald-700', tile: 'text-emerald-500' }
                            : { wrap: 'from-purple-50 to-pink-50 border-purple-100', label: 'text-purple-600', tile: 'text-purple-500' };
                    const labelText = active?.severity === 'warn'
                        ? 'AI Alert'
                        : active?.severity === 'positive'
                            ? 'AI Highlight'
                            : 'AI Insight';
                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35 }}
                            className={`bg-gradient-to-r ${sevTone.wrap} border rounded-[24px] p-5 sm:p-6 mb-6 relative overflow-hidden`}
                        >
                            <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-30 blur-3xl pointer-events-none" />
                            <div className="flex items-start gap-4 relative">
                                <div className={`w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl flex-shrink-0 ${sevTone.tile}`}>
                                    {active?.icon || '✨'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-bold uppercase tracking-[0.18em] mb-1 ${sevTone.label}`}>{labelText}</p>
                                    <AnimatePresence mode="wait">
                                        <motion.p
                                            key={active?.id || 'placeholder'}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            transition={{ duration: 0.25 }}
                                            className="text-sm sm:text-[15px] text-gray-800 leading-relaxed"
                                        >
                                            {active?.text || 'Crunching the numbers…'}
                                        </motion.p>
                                    </AnimatePresence>

                                    {insights.length > 1 && (
                                        <div className="flex items-center gap-2 mt-3">
                                            {insights.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setInsightIdx(i)}
                                                    aria-label={`Show insight ${i + 1}`}
                                                    className={`h-1.5 rounded-full transition-all ${
                                                        i === insightIdx
                                                            ? 'w-6 bg-gray-700'
                                                            : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                                                    }`}
                                                />
                                            ))}
                                            <span className="ml-1 text-[10px] font-semibold text-gray-400 tabular-nums">
                                                {insightIdx + 1}/{insights.length}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })()}

                {/* METRICS GRID */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
                    {metricCards.map(({ label, value, accent, iconBg, icon }) => (
                        <motion.div
                            key={label}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-4 sm:p-5 relative overflow-hidden"
                        >
                            <div className={`w-10 h-10 rounded-2xl ${iconBg} flex items-center justify-center text-base mb-3`}>
                                {icon}
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 leading-none">{label}</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 tabular-nums">
                                {statsLoading && !dashboardStats ? (
                                    <span className="inline-block w-12 h-7 bg-gray-100 rounded animate-pulse" />
                                ) : value.toLocaleString()}
                            </p>
                            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${accent} opacity-70`} />
                        </motion.div>
                    ))}
                </div>

                {/* WEEKLY ACTIVITY */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 }}
                    className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-5 sm:p-6 mb-8"
                >
                    <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-purple-500 mb-1">Past 7 days</p>
                            <h2 className="text-lg font-bold text-gray-900">Submission activity</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {weekly?.summary?.total ?? 0} submissions · {weekly?.summary?.approved ?? 0} approved · {weekly?.summary?.pending ?? 0} pending
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Approved {weekly?.summary?.approved ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Pending {weekly?.summary?.pending ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-[11px] font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                Revision {weekly?.summary?.revision ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-[11px] font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Rejected {weekly?.summary?.rejected ?? 0}
                            </span>
                        </div>
                    </div>

                    {weeklyLoading && !weekly ? (
                        <div className="h-[180px] bg-gray-50 rounded-xl animate-pulse" />
                    ) : (
                        <WeeklyBars
                            data={weekly?.days || []}
                            getValue={(d) => d.total}
                            barClass="bg-gradient-to-t from-purple-400 to-pink-400"
                            valueLabel="submissions"
                            height={160}
                        />
                    )}
                </motion.div>

                {/* TAB BAR */}
                <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-2 mb-6 flex gap-1 overflow-x-auto scrollbar-hide">
                    {navItems.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const count = tab.id === 'tasks'
                            ? tasks.length
                            : tab.id === 'resources'
                                ? resources.length
                                : submissions.length;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-pink-500/30'
                                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                <span className={isActive ? 'text-white' : 'text-gray-400'}>{tab.icon}</span>
                                <span>{tab.label}</span>
                                <span className={`hidden sm:inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full ${
                                    isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <AnimatePresence mode="wait">
                        {activeTab === 'tasks' && (
                            <motion.div
                                key="tasks-pane"
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6"
                            >
                                {/* Form card */}
                                <aside className={`${cardCls} h-fit xl:sticky xl:top-24`}>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-pink-500/30">
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 5v14M5 12h14" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900">New core task</h2>
                                            <p className="text-xs text-gray-500">Authored, every learner sees it.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className={labelCls}>Title</label>
                                            <input type="text" name="title" value={formData.title} onChange={handleChange}
                                                placeholder="Implement bubble sort"
                                                className={inputCls} maxLength={200} required />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Description</label>
                                            <textarea name="description" value={formData.description} onChange={handleChange}
                                                placeholder="Describe what learners need to do…"
                                                rows="4" className={`${inputCls} resize-none`} maxLength={5000} required />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>XP reward</label>
                                                <input type="number" name="xpReward" value={formData.xpReward} onChange={handleChange}
                                                    className={inputCls} min={0} max={10000} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Level required</label>
                                                <input type="number" name="levelRequired" value={formData.levelRequired} onChange={handleChange}
                                                    className={inputCls} min={1} max={100} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Track</label>
                                            <select name="track" value={formData.track} onChange={handleChange} className={inputCls}>
                                                {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        {isTopicTrack(formData.track) && (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className={labelCls}>Category</label>
                                                        <select disabled value={trackToCategory(formData.track) || ''}
                                                            className={`${inputCls} bg-gray-100 cursor-not-allowed text-gray-500`}>
                                                            <option value={trackToCategory(formData.track) || ''}>
                                                                {trackToCategory(formData.track)}
                                                            </option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>Difficulty</label>
                                                        <select name="difficulty" value={formData.difficulty}
                                                            onChange={handleChange} className={inputCls} required>
                                                            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={labelCls}>Topic</label>
                                                    <select name="topic" value={formData.topic}
                                                        onChange={handleChange} className={inputCls} required>
                                                        {TOPIC_CATALOG[formData.track].map((t) =>
                                                            <option key={t} value={t}>{t}</option>
                                                        )}
                                                    </select>
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <label className={labelCls}>Course name</label>
                                            <input
                                                type="text"
                                                name="courseName"
                                                value={formData.courseName}
                                                onChange={handleChange}
                                                placeholder="e.g. CS101 — Foundations"
                                                className={inputCls}
                                                maxLength={200}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>Due date</label>
                                                <input
                                                    type="date"
                                                    name="dueDate"
                                                    value={formData.dueDate}
                                                    onChange={handleChange}
                                                    className={inputCls}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Total marks</label>
                                                <input
                                                    type="number"
                                                    name="totalMarks"
                                                    value={formData.totalMarks}
                                                    onChange={handleChange}
                                                    className={inputCls}
                                                    min={0}
                                                    max={10000}
                                                />
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-3 bg-gray-50 px-3.5 py-2.5 rounded-xl cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                name="isCodingChallenge"
                                                checked={formData.isCodingChallenge}
                                                onChange={handleChange}
                                                className="h-4 w-4 rounded border-gray-300 text-pink-500 focus:ring-pink-300"
                                            />
                                            <span className="text-sm font-semibold text-gray-700">Coding challenge</span>
                                            <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-gray-400">Tests</span>
                                        </label>
                                        {formData.isCodingChallenge && (
                                            <div>
                                                <label className={labelCls}>Test cases (JSON)</label>
                                                <textarea
                                                    name="testCasesText"
                                                    value={formData.testCasesText}
                                                    onChange={handleChange}
                                                    placeholder={'[\n  {"input": "1 2", "expectedOutput": "3"},\n  {"input": "5 7", "expectedOutput": "12"}\n]'}
                                                    rows="6"
                                                    className={`${inputCls} resize-none font-mono text-xs`}
                                                    required
                                                />
                                                <p className="text-[11px] text-gray-500 mt-1.5">Array of {'{input, expectedOutput}'} string pairs.</p>
                                            </div>
                                        )}
                                        <button type="submit" disabled={loading} className={primaryBtnCls}>
                                            {loading ? (
                                                <>
                                                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                                    Creating…
                                                </>
                                            ) : 'Create core task'}
                                        </button>
                                    </form>
                                </aside>

                                {/* List card */}
                                <div className={cardCls}>
                                    <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900">Existing tasks</h2>
                                            <p className="text-xs text-gray-500 mt-0.5">{tasks.length} total · {visibleTasks.length} shown</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {['All', ...tracks].map((t) => (
                                                <button key={t} onClick={() => { setFilter(t); setTopicFilter(null); }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                        filter === t
                                                            ? 'bg-gray-900 text-white'
                                                            : 'text-gray-500 hover:bg-gray-50'
                                                    }`}>
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {isTopicTrack(filter) && (
                                        <div className="flex flex-wrap gap-1.5 -mt-2 mb-4">
                                            <button onClick={() => setTopicFilter(null)}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                                    topicFilter === null
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}>
                                                All topics
                                            </button>
                                            {TOPIC_CATALOG[filter].map((t) => (
                                                <button key={t} onClick={() => setTopicFilter(t)}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                                        topicFilter === t
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                    }`}>
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {visibleTasks.length === 0 ? (
                                        <div className="text-center py-16 bg-gray-50/70 rounded-2xl border-2 border-dashed border-gray-200">
                                            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl mx-auto mb-3">📭</div>
                                            <p className="text-gray-700 font-bold">No tasks in this track yet</p>
                                            <p className="text-sm text-gray-500 mt-1">Use the form to add your first one.</p>
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {visibleTasks.map((task) => {
                                                const palette = trackPalette[task.track] || 'bg-gray-50 text-gray-500';
                                                return (
                                                    <li key={task._id} className="py-4 flex items-start gap-4 group">
                                                        <div className={`w-10 h-10 rounded-full ${palette} flex items-center justify-center flex-shrink-0`}>
                                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="m9 11 3 3L22 4" />
                                                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                                            </svg>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="font-semibold text-gray-900 truncate">{task.title}</h3>
                                                            <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{task.description}</p>
                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${palette}`}>{task.track}</span>
                                                                {task.topic && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">{task.topic}</span>}
                                                                {task.difficulty && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-fuchsia-50 text-fuchsia-600">{task.difficulty}</span>}
                                                                {task.courseName && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 truncate max-w-[160px]" title={task.courseName}>{task.courseName}</span>}
                                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-600">{task.xpReward} XP</span>
                                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-50 text-gray-500">Lvl {task.levelRequired}</span>
                                                                {task.dueDate && (
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-50 text-orange-600">
                                                                        Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                    </span>
                                                                )}
                                                                {task.isCodingChallenge && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-600">Coding</span>}
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleDelete(task._id)}
                                                            className="self-center text-xs font-semibold text-gray-400 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                                            Delete
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'resources' && (
                            <motion.div
                                key="resources-pane"
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6"
                            >
                                {/* Upload card */}
                                <aside className={`${cardCls} h-fit xl:sticky xl:top-24`}>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-pink-500/30">
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <path d="M17 8 12 3 7 8" />
                                                <path d="M12 3v12" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900">Upload PDF</h2>
                                            <p className="text-xs text-gray-500">Lands in the Interview Prep library.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleResourceSubmit} className="space-y-4">
                                        <div>
                                            <label className={labelCls}>Title</label>
                                            <input
                                                type="text"
                                                name="title"
                                                value={resourceForm.title}
                                                onChange={handleResourceFieldChange}
                                                placeholder="System Design Cheatsheet"
                                                className={inputCls}
                                                maxLength={200}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Language</label>
                                            <select
                                                name="language"
                                                value={resourceForm.language}
                                                onChange={handleResourceFieldChange}
                                                className={inputCls}
                                            >
                                                {resourceLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>PDF file</label>
                                            <input
                                                id="resource-file-input"
                                                type="file"
                                                accept="application/pdf,.pdf"
                                                onChange={handleResourceFileChange}
                                                className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-pink-600 file:cursor-pointer`}
                                                required
                                            />
                                            <p className="text-[11px] text-gray-500 mt-1.5">Max 10 MB. PDFs only.</p>
                                        </div>
                                        <button type="submit" disabled={resourceUploading} className={primaryBtnCls}>
                                            {resourceUploading ? (
                                                <>
                                                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                                    Uploading…
                                                </>
                                            ) : 'Upload resource'}
                                        </button>
                                    </form>
                                </aside>

                                {/* List card */}
                                <div className={cardCls}>
                                    <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900">Uploaded resources</h2>
                                            <p className="text-xs text-gray-500 mt-0.5">{resources.length} live in the learner library</p>
                                        </div>
                                    </div>

                                    {resourcesLoading ? (
                                        <div className="text-center py-14 text-gray-400 text-sm">Loading resources…</div>
                                    ) : resources.length === 0 ? (
                                        <div className="text-center py-16 bg-gray-50/70 rounded-2xl border-2 border-dashed border-gray-200">
                                            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl mx-auto mb-3">📄</div>
                                            <p className="text-gray-700 font-bold">No resources uploaded yet</p>
                                            <p className="text-sm text-gray-500 mt-1">Use the form to add your first PDF.</p>
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {resources.map((r) => (
                                                <li key={r._id} className="py-4 flex items-center gap-4 group">
                                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                            <path d="M14 2v6h6" />
                                                        </svg>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="font-semibold text-gray-900 truncate">{r.title}</h3>
                                                        <div className="flex items-center flex-wrap gap-2 mt-0.5">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-600">{r.language}</span>
                                                            <span className="text-xs text-gray-400">·</span>
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                            <a
                                                                href={r.fileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs font-semibold text-pink-600 hover:text-pink-700 inline-flex items-center gap-0.5 transition-colors"
                                                            >
                                                                View PDF
                                                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleResourceDelete(r._id)}
                                                        className="text-xs font-semibold text-gray-400 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        Delete
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'submissions' && (
                            <motion.div
                                key="submissions-pane"
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white rounded-[24px] border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden"
                            >
                                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <h2 className="text-base font-semibold text-gray-900">Project submissions</h2>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {submissions.length} pending {submissions.length === 1 ? 'review' : 'reviews'}
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-xs font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Awaiting action
                                    </span>
                                </div>

                                {submissionsLoading ? (
                                    <div className="text-center py-16 text-sm text-gray-400">Loading submissions…</div>
                                ) : submissions.length === 0 ? (
                                    <div className="text-center py-20 px-6">
                                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl mx-auto mb-3">📭</div>
                                        <p className="font-semibold text-gray-700">Inbox zero</p>
                                        <p className="text-sm text-gray-500 mt-1">No pending project submissions to review.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50/60 border-b border-gray-200">
                                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Student</th>
                                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Assignment</th>
                                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Course</th>
                                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Date</th>
                                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Submission</th>
                                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Review</th>
                                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">XP</th>
                                                    <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {submissions.map((sub) => {
                                                    const userName = sub.user?.name || 'Learner';
                                                    const userEmail = sub.user?.email || '';
                                                    const taskTitle = sub.task?.title || 'Untitled task';
                                                    const courseName = sub.task?.courseName || sub.task?.track || '—';
                                                    const xp = sub.task?.xpReward || 0;
                                                    const date = sub.submittedAt
                                                        ? new Date(sub.submittedAt)
                                                        : (sub.updatedAt ? new Date(sub.updatedAt) : null);
                                                    const reviewStatus = sub.reviewStatus || 'pending';
                                                    const reviewBadge = STATUS_BADGE[reviewStatus] || STATUS_BADGE.pending;
                                                    const submissionStatus = sub.submissionStatus || 'submitted';
                                                    const submissionBadge = submissionStatus === 'late'
                                                        ? { label: 'Late', classes: 'bg-red-100 text-red-700' }
                                                        : { label: 'Submitted', classes: 'bg-blue-100 text-blue-700' };
                                                    return (
                                                        <tr key={sub._id} className="hover:bg-gray-50/60 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                                                        {userName.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-medium text-gray-900 truncate">{userName}</p>
                                                                        {userEmail && <p className="text-xs text-gray-500 truncate">{userEmail}</p>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-gray-700 truncate max-w-[220px]" title={taskTitle}>{taskTitle}</p>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-500 truncate max-w-[160px]" title={courseName}>{courseName}</td>
                                                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                                                {date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${submissionBadge.classes}`}>
                                                                    {submissionBadge.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${reviewBadge.classes}`}>
                                                                    {reviewBadge.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700 font-medium tabular-nums whitespace-nowrap">⭐ {xp}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => setSelectedSubmission(sub)}
                                                                    className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors"
                                                                >
                                                                    Review
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </motion.div>
                        )}
                </AnimatePresence>
            </main>

            {/* Review drawer — opens from the right when a submission's "Review" is clicked */}
            <AnimatePresence>
                {selectedSubmission && (() => {
                    const sub = selectedSubmission;
                    const userName = sub.user?.name || 'Learner';
                    const userEmail = sub.user?.email || '';
                    const taskTitle = sub.task?.title || 'Untitled task';
                    const xp = sub.task?.xpReward || 0;
                    const date = sub.submittedAt ? new Date(sub.submittedAt) : (sub.updatedAt ? new Date(sub.updatedAt) : null);
                    const reviewing = reviewingId === sub._id;
                    const feedback = feedbackBySubmission[sub._id] || '';
                    const status = sub.reviewStatus || 'pending';
                    const badge = STATUS_BADGE[status] || STATUS_BADGE.pending;
                    const githubLink = sub.githubLink || '';
                    // Derive a sensible filename from the Cloudinary URL — the public_id
                    // is `<basename>_<timestamp>.<ext>` so the trailing path segment is
                    // already a usable filename. Falls back to "submission" if absent.
                    const submissionUrl = sub.submissionUrl || '';
                    const fileName = submissionUrl
                        ? decodeURIComponent(submissionUrl.split('/').pop() || 'submission')
                        : 'submission';
                    const fileExt = (fileName.match(/\.[^.]+$/)?.[0] || '').toLowerCase().replace('.', '');
                    const fileTypeLabel = fileExt ? fileExt.toUpperCase() : 'FILE';
                    // Inline-previewable types. Cloudinary serves both at the
                    // raw URL — PDFs render in an iframe, images in <img>.
                    // ZIP / DOC / PPT can't render in-browser, so they stay
                    // download-only.
                    const isImagePreview = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
                    const isPdfPreview = fileExt === 'pdf';
                    const hasInlinePreview = (isImagePreview || isPdfPreview) && submissionUrl;
                    // Project submissions ship a Cloudinary file URL (recognized extension);
                    // Resume / Interview submissions ship plain text plus an optional
                    // reference URL with no file extension. Branch the UI accordingly.
                    const isRecognizedFile = !!fileExt && /^(zip|pdf|docx?|pptx?|jpe?g|png|gif|webp)$/i.test(fileExt);
                    const hasFile = !!submissionUrl && isRecognizedFile;
                    const submissionText = sub.submissionText || '';
                    const hasTextProof = submissionText.length > 0;
                    const referenceUrl = (!hasFile && submissionUrl) ? submissionUrl : '';

                    return (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-[80] bg-gray-900/40 backdrop-blur-sm flex justify-end"
                            onClick={() => setSelectedSubmission(null)}
                        >
                            <motion.aside
                                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden border-l border-gray-200"
                            >
                                <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Review submission</p>
                                        <h2 className="text-base font-semibold text-gray-900 truncate mt-0.5">{taskTitle}</h2>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSubmission(null)}
                                        className="w-8 h-8 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center"
                                        aria-label="Close"
                                    >
                                        ✕
                                    </button>
                                </header>

                                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                                    {/* Student row */}
                                    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-md">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                            {userName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-gray-900 truncate">{userName}</p>
                                            {userEmail && <p className="text-xs text-gray-500 truncate">{userEmail}</p>}
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${badge.classes}`}>
                                            {badge.label}
                                        </span>
                                    </div>

                                    {/* Meta grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="border border-gray-200 rounded-md px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Submitted</p>
                                            <p className="text-sm text-gray-900 mt-1">
                                                {date ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </p>
                                        </div>
                                        <div className="border border-gray-200 rounded-md px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Reward</p>
                                            <p className="text-sm text-gray-900 mt-1 font-medium tabular-nums">⭐ {xp} XP</p>
                                        </div>
                                    </div>

                                    {/* File preview / download — Project submissions only */}
                                    {hasFile && (
                                    <div className="border border-gray-200 rounded-md p-4">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Submission file</p>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <path d="M14 2v6h6" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900 truncate" title={fileName}>{fileName}</p>
                                                <p className="text-xs text-gray-500">{fileTypeLabel} · click to download or open in a new tab</p>
                                            </div>
                                            <a
                                                href={sub.submissionUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors flex-shrink-0"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <path d="m7 10 5 5 5-5" />
                                                    <path d="M12 15V3" />
                                                </svg>
                                                Download
                                            </a>
                                        </div>
                                    </div>
                                    )}

                                    {/* Text proof — Resume / Interview submissions only */}
                                    {hasTextProof && (
                                        <div className="border border-gray-200 rounded-md p-4">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Submission text</p>
                                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{submissionText}</p>
                                        </div>
                                    )}

                                    {/* Generic reference link — Resume / Interview submissions only */}
                                    {referenceUrl && (
                                        <div className="border border-gray-200 rounded-md p-4">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Reference link</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-md bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-gray-900 truncate" title={referenceUrl}>{referenceUrl}</p>
                                                </div>
                                                <a
                                                    href={referenceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors flex-shrink-0"
                                                >
                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M7 17 17 7" />
                                                        <path d="M7 7h10v10" />
                                                    </svg>
                                                    Open
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Inline preview for previewable types — PDFs and images render
                                        in-place; everything else stays download-only above. */}
                                    {hasInlinePreview && (
                                        <div className="border border-gray-200 rounded-md overflow-hidden">
                                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Preview</p>
                                                <a
                                                    href={sub.submissionUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] font-medium text-gray-500 hover:text-gray-700 inline-flex items-center gap-0.5 transition-colors"
                                                >
                                                    Open in new tab
                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M7 17 17 7" /><path d="M7 7h10v10" />
                                                    </svg>
                                                </a>
                                            </div>
                                            {isPdfPreview ? (
                                                <iframe
                                                    src={sub.submissionUrl}
                                                    title={fileName}
                                                    className="w-full h-[420px] bg-gray-100"
                                                />
                                            ) : (
                                                <div className="bg-gray-50 flex items-center justify-center" style={{ minHeight: 200 }}>
                                                    <img
                                                        src={sub.submissionUrl}
                                                        alt={fileName}
                                                        className="max-w-full max-h-[420px] object-contain"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* GitHub repo (optional, surfaces only when the learner provided it) */}
                                    {githubLink && (
                                        <div className="border border-gray-200 rounded-md p-4">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">GitHub repository</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-md bg-gray-900 text-white flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                                        <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-gray-900 truncate" title={githubLink}>
                                                        {githubLink.replace(/^https?:\/\/(www\.)?github\.com\//i, '')}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">{githubLink}</p>
                                                </div>
                                                <a
                                                    href={githubLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors flex-shrink-0"
                                                >
                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M7 17 17 7" />
                                                        <path d="M7 7h10v10" />
                                                    </svg>
                                                    Open
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Feedback textarea — formal review note that ships with the
                                        approve/reject action. Different from the discussion thread
                                        below, which is for back-and-forth chatter. */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-900">Review notes / feedback</label>
                                        <p className="text-xs text-gray-500 mt-0.5">Required when requesting revision or rejecting.</p>
                                        <textarea
                                            value={feedback}
                                            onChange={(e) => handleFeedbackChange(sub._id, e.target.value)}
                                            placeholder="Share what worked, what to fix, and any next steps…"
                                            rows={6}
                                            maxLength={2000}
                                            className="mt-2 w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none resize-none transition-colors"
                                        />
                                        <p className="mt-1 text-[11px] text-gray-400 tabular-nums text-right">{feedback.length}/2000</p>
                                    </div>

                                    <div className="pt-4 border-t border-gray-100">
                                        <CommentsThread
                                            userTaskId={sub._id}
                                            currentUser={user ? { _id: user._id, role: user.role } : null}
                                        />
                                    </div>
                                </div>

                                {/* Action buttons — wired to existing handleReviewSubmission */}
                                <footer className="px-6 py-4 border-t border-gray-200 space-y-2">
                                    <button
                                        onClick={() => handleReviewSubmission(sub._id, 'approved')}
                                        disabled={reviewing}
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {reviewing ? (
                                            <>
                                                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                                Saving…
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m5 12 5 5L20 7" />
                                                </svg>
                                                Approve & Award {xp} XP
                                            </>
                                        )}
                                    </button>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleReviewSubmission(sub._id, 'revision')}
                                            disabled={reviewing}
                                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 12a9 9 0 1 0 9-9" />
                                                <path d="M3 4v8h8" />
                                            </svg>
                                            Request Revision
                                        </button>
                                        <button
                                            onClick={() => handleReviewSubmission(sub._id, 'rejected')}
                                            disabled={reviewing}
                                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 6 6 18M6 6l12 12" />
                                            </svg>
                                            Reject
                                        </button>
                                    </div>
                                </footer>
                            </motion.aside>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
};

export default AdminDashboard;
