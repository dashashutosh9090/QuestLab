import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { motion } from 'framer-motion';
import api from '../api/axios';
import Navbar from './Navbar';
import WeeklyBars from './charts/WeeklyBars';
import Avatar from './Avatar';

const TIER_TONE = {
    emerald: { ring: 'ring-emerald-200', bar: 'from-emerald-400 to-teal-500', tile: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    indigo: { ring: 'ring-indigo-200', bar: 'from-indigo-400 to-purple-500', tile: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
    purple: { ring: 'ring-purple-200', bar: 'from-purple-400 to-pink-500', tile: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
    amber: { ring: 'ring-amber-200', bar: 'from-amber-400 to-orange-500', tile: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' }
};
const BADGE_TONE = {
    amber: { tile: 'bg-amber-50 text-amber-700', ring: 'ring-amber-200' },
    rose: { tile: 'bg-rose-50 text-rose-700', ring: 'ring-rose-200' },
    purple: { tile: 'bg-purple-50 text-purple-700', ring: 'ring-purple-200' },
    indigo: { tile: 'bg-indigo-50 text-indigo-700', ring: 'ring-indigo-200' },
    sky: { tile: 'bg-sky-50 text-sky-700', ring: 'ring-sky-200' }
};

const Profile = () => {
    const { user, updateProfile } = useAuth();

    const [formData, setFormData] = useState({
        name: user?.name || '',
        bio: user?.bio || '',
        avatar: user?.avatar || ''
    });
    const [avatarFile, setAvatarFile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progression, setProgression] = useState(null);
    const [progressionLoading, setProgressionLoading] = useState(false);
    const [weekly, setWeekly] = useState(null);
    const [weeklyLoading, setWeeklyLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                bio: user.bio || '',
                avatar: user.avatar || ''
            });
        }
    }, [user]);

    // Fetch tier + badge progression for learners. Admins don't earn badges so
    // we skip the call entirely for them.
    useEffect(() => {
        if (!user || user.role === 'admin') return undefined;
        let cancelled = false;
        setProgressionLoading(true);
        api.get('/gamification/progression')
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success) setProgression(data);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load progression:', err);
            })
            .finally(() => { if (!cancelled) setProgressionLoading(false); });
        return () => { cancelled = true; };
    }, [user]);

    // Fetch the 7-day rolling activity (completions + XP per day).
    useEffect(() => {
        if (!user || user.role === 'admin') return undefined;
        let cancelled = false;
        setWeeklyLoading(true);
        api.get('/gamification/analytics/me')
            .then(({ data }) => {
                if (cancelled) return;
                if (data.success) setWeekly(data);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load weekly analytics:', err);
            })
            .finally(() => { if (!cancelled) setWeeklyLoading(false); });
        return () => { cancelled = true; };
    }, [user]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const submitData = new FormData();
        submitData.append('name', formData.name);
        submitData.append('bio', formData.bio);
        // Only send avatar when the user actually changed something. Otherwise the
        // backend's `else if (avatar !== undefined)` branch would clobber an
        // existing uploaded image with whatever string sits in the URL field.
        if (avatarFile) {
            submitData.append('avatarFile', avatarFile);
        } else if (formData.avatar !== (user.avatar || '')) {
            submitData.append('avatar', formData.avatar);
        }

        const result = await updateProfile(submitData);
        if (result.success) setIsEditing(false);
        setLoading(false);
    };

    if (!user) {
        return (
            <div className="app-bg">
                <Navbar />
                <div className="p-12 text-center text-gray-500">Loading profile…</div>
            </div>
        );
    }

    const isAdmin = user.role === 'admin';

    return (
        <div className="app-bg pb-16">
            <Navbar />
            <div className="max-w-3xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="surface overflow-hidden"
                >
                    {/* Cover */}
                    <div
                        className="h-40 relative"
                        style={{
                            background: isAdmin
                                ? 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)'
                                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)'
                        }}
                    >
                        <div className="absolute inset-0 opacity-30 mix-blend-overlay"
                             style={{
                                 backgroundImage:
                                     'radial-gradient(600px 240px at 20% 0%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(400px 220px at 90% 100%, rgba(255,255,255,0.3), transparent 60%)'
                             }}></div>
                    </div>

                    <div className="px-6 sm:px-10 pb-10 -mt-16">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                            <div className="relative">
                                <Avatar
                                    user={user}
                                    className="w-32 h-32 rounded-2xl ring-4 ring-white shadow-lg bg-white"
                                    initialsClassName="text-4xl font-bold text-white"
                                    placeholderClassName="bg-gradient-to-br from-indigo-500 to-purple-500"
                                />

                                <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ring-2 ring-white ${
                                    isAdmin ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}></span>
                            </div>

                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} className="btn-ghost">
                                    Edit profile
                                </button>
                            )}
                        </div>

                        {isEditing ? (
                            <form onSubmit={handleSubmit} className="space-y-5 mt-6">
                                <div>
                                    <label className="label">Display name</label>
                                    <input type="text" name="name" value={formData.name} onChange={handleChange}
                                           className="input" maxLength={60} required disabled={loading} />
                                </div>
                                <div>
                                    <label className="label">Bio</label>
                                    <textarea name="bio" value={formData.bio} onChange={handleChange} rows="4"
                                              maxLength={500}
                                              placeholder="Tell us a little about yourself…"
                                              className="input resize-none" disabled={loading} />
                                    <p className="text-xs text-gray-400 mt-1 text-right">{formData.bio.length}/500</p>
                                </div>
                                <div>
                                    <label className="label">Avatar URL</label>
                                    <input type="url" name="avatar" value={formData.avatar} onChange={handleChange}
                                           placeholder="https://example.com/avatar.png"
                                           className="input" disabled={loading} />
                                    <p className="text-xs text-gray-500 mt-1">Or upload a local image:</p>
                                    <input type="file" accept="image/*"
                                           onChange={(e) => setAvatarFile(e.target.files[0])}
                                           className="mt-2 w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                           disabled={loading} />
                                </div>

                                <div className="flex gap-3 pt-3 border-t border-gray-100">
                                    <button type="submit" disabled={loading} className="btn-primary flex-1">
                                        {loading ? 'Saving…' : 'Save changes'}
                                    </button>
                                    <button type="button"
                                            onClick={() => {
                                                setFormData({ name: user.name || '', bio: user.bio || '', avatar: user.avatar || '' });
                                                setAvatarFile(null);
                                                setIsEditing(false);
                                            }}
                                            disabled={loading} className="btn-ghost flex-1">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="mt-5 space-y-6">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
                                        <span className={`pill ${isAdmin ? 'pill-danger' : 'pill-primary'}`}>
                                            {isAdmin ? 'Administrator' : 'Learner'}
                                        </span>
                                    </div>
                                    <p className="text-gray-500 mt-1">{user.email}</p>
                                </div>

                                <div>
                                    <span className="section-eyebrow">About</span>
                                    {user.bio ? (
                                        <p className="text-gray-700 leading-relaxed mt-1.5 whitespace-pre-wrap">{user.bio}</p>
                                    ) : (
                                        <p className="text-gray-400 italic mt-1.5">No bio yet — click "Edit profile" to add one.</p>
                                    )}
                                </div>

                                {!isAdmin && (
                                    <div className="grid grid-cols-3 gap-3 pt-6 border-t border-gray-100">
                                        <ProfileStat label="Level" value={user.level || 1} accent="indigo" />
                                        <ProfileStat label="Total XP" value={(user.xp || 0).toLocaleString()} accent="violet" />
                                        <ProfileStat label="Streak" value={`${user.streak || 0}d`} sub="🔥" accent="amber" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>

                {!isAdmin && !isEditing && (
                    <>
                        <TierCard tier={progression?.tier} loading={progressionLoading && !progression} xp={user.xp || 0} />
                        <ActivityCard weekly={weekly} loading={weeklyLoading && !weekly} />
                        <BadgeShelf badges={progression?.badges} loading={progressionLoading && !progression} />
                    </>
                )}
            </div>
        </div>
    );
};

function TierCard({ tier, loading, xp }) {
    if (loading) {
        return <div className="surface mt-6 p-6 h-32 shimmer rounded-2xl" />;
    }
    if (!tier) return null;
    const tone = TIER_TONE[tier.tone] || TIER_TONE.emerald;
    const pct = Math.round((tier.progress || 0) * 100);
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="surface mt-6 p-6 sm:p-7"
        >
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ring-2 ${tone.tile} ${tone.ring}`}>
                        🎖️
                    </div>
                    <div>
                        <span className="section-eyebrow">Current tier</span>
                        <h3 className="text-xl font-bold tracking-tight mt-0.5">{tier.name}</h3>
                    </div>
                </div>
                <span className={`pill ${tier.tone === 'amber' ? 'pill-warning' : tier.tone === 'purple' ? 'pill-accent' : tier.tone === 'indigo' ? 'pill-primary' : 'pill-success'}`}>
                    {(xp || 0).toLocaleString()} XP
                </span>
            </div>

            {tier.next ? (
                <>
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1.5">
                        <span>Progress to {tier.next.name}</span>
                        <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                            className={`h-full bg-gradient-to-r ${tone.bar} rounded-full`}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        {tier.xpToNext.toLocaleString()} XP to reach <strong>{tier.next.name}</strong>.
                    </p>
                </>
            ) : (
                <div className={`rounded-xl p-3 flex items-center gap-2 ${tone.tile}`}>
                    <span>🏆</span>
                    <span className="text-sm font-semibold">Top tier reached — you've maxed out the ladder.</span>
                </div>
            )}
        </motion.div>
    );
}

function ActivityCard({ weekly, loading }) {
    if (loading) {
        return <div className="surface mt-6 p-6 h-48 shimmer rounded-2xl" />;
    }
    if (!weekly) return null;
    const { days = [], totals = { completions: 0, xp: 0 } } = weekly;
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="surface mt-6 p-6 sm:p-7"
        >
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                <div>
                    <span className="section-eyebrow">Past 7 days</span>
                    <h3 className="text-xl font-bold tracking-tight mt-0.5">Your activity</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold tabular-nums">
                        ✓ {totals.completions} completed
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold tabular-nums">
                        ⭐ {totals.xp} XP
                    </span>
                </div>
            </div>
            <WeeklyBars
                data={days}
                getValue={(d) => d.completions}
                barClass="bg-gradient-to-t from-indigo-400 to-purple-500"
                valueLabel="completions"
                height={140}
            />
        </motion.div>
    );
}

function BadgeShelf({ badges, loading }) {
    if (loading) {
        return <div className="surface mt-6 p-6 h-40 shimmer rounded-2xl" />;
    }
    if (!Array.isArray(badges) || badges.length === 0) return null;
    const earned = badges.filter((b) => b.earned).length;
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="surface mt-6 p-6 sm:p-7"
        >
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                <div>
                    <span className="section-eyebrow">Badges</span>
                    <h3 className="text-xl font-bold tracking-tight mt-0.5">Your shelf</h3>
                </div>
                <span className="pill pill-muted tabular-nums">{earned}/{badges.length} earned</span>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {badges.map((b) => {
                    const tone = BADGE_TONE[b.tone] || BADGE_TONE.indigo;
                    return (
                        <li
                            key={b.id}
                            className={`relative rounded-2xl border p-4 text-center transition-all ${
                                b.earned
                                    ? `bg-white border-gray-100 shadow-sm hover:shadow-md`
                                    : 'bg-gray-50 border-dashed border-gray-200 opacity-70'
                            }`}
                        >
                            <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl mb-2 ${
                                b.earned ? `${tone.tile} ring-2 ${tone.ring}` : 'bg-gray-100 text-gray-400'
                            }`}>
                                {b.earned ? b.icon : '🔒'}
                            </div>
                            <p className={`text-sm font-bold leading-tight ${b.earned ? 'text-gray-900' : 'text-gray-500'}`}>
                                {b.name}
                            </p>
                            <p className="text-[11px] text-gray-500 leading-snug mt-1 line-clamp-2" title={b.description}>
                                {b.description}
                            </p>
                            {b.earned && (
                                <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                                    ✓
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </motion.div>
    );
}

function ProfileStat({ label, value, sub, accent }) {
    const color = {
        indigo: 'text-indigo-600',
        violet: 'text-violet-600',
        amber: 'text-amber-600'
    }[accent];
    return (
        <div className="surface-muted p-4 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</div>
            <div className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>
                {value} {sub && <span className="text-base">{sub}</span>}
            </div>
        </div>
    );
}

export default Profile;
