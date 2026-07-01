import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTier } from '../utils/tier';
import Avatar from './Avatar';

// Tone → pastel pill classes for the tier badge. Kept colocated with the
// backend tier service's tone names (emerald/indigo/purple/amber).
const TIER_PILL = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    purple: 'bg-purple-50 text-purple-700 ring-purple-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200'
};

export default function ProfileSummaryCard({ user }) {
    if (!user) return null;
    const tier = getTier(user.xp || 0);
    const memberSince = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
        : null;
    const pillClass = TIER_PILL[tier.tone] || TIER_PILL.emerald;
    const badgeCount = Array.isArray(user.badges) ? user.badges.length : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="surface mb-6 p-4 sm:p-5"
        >
            <div className="flex items-center gap-4 flex-wrap">
                <Avatar
                    user={user}
                    className="w-14 h-14 rounded-2xl ring-2 ring-white shadow-sm flex-shrink-0"
                    initialsClassName="text-lg font-bold text-white"
                />


                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 truncate text-base sm:text-[17px]">{user.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ring-1 ${pillClass}`}>
                            {tier.name}
                        </span>
                        {badgeCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider ring-1 ring-amber-200">
                                🏅 {badgeCount}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                        {user.email}{memberSince && ` · Member since ${memberSince}`}
                    </p>
                </div>

                <Link
                    to="/profile"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors flex-shrink-0"
                >
                    Edit profile →
                </Link>
            </div>
        </motion.div>
    );
}
