import User from '../models/User.js';
import UserTask from '../models/UserTask.js';
import Notification from '../models/Notification.js';
import { adminNotify } from '../utils/adminNotify.js';

// Public badge catalog. Frontend reads this same shape via the catalog endpoint
// so locked badges can render without hitting "what's this?" gaps.
export const BADGES = {
    fast_learner: {
        id: 'fast_learner',
        name: 'Fast Learner',
        description: 'Reach Level 5 within 7 days of signing up',
        icon: '⚡',
        tone: 'amber'
    },
    consistent_performer: {
        id: 'consistent_performer',
        name: 'Consistent Performer',
        description: 'Hit a 7-day learning streak',
        icon: '🔥',
        tone: 'rose'
    },
    project_master: {
        id: 'project_master',
        name: 'Project Master',
        description: 'Get 5 project submissions approved',
        icon: '🛠️',
        tone: 'purple'
    },
    quiz_champion: {
        id: 'quiz_champion',
        name: 'Quiz Champion',
        description: 'Solve 25 coding challenges',
        icon: '🧠',
        tone: 'indigo'
    },
    early_bird: {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Submit a project at least 24 hours before its deadline',
        icon: '🌅',
        tone: 'sky'
    }
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Each predicate receives:
//   user      — fresh User document (Mongoose, with badges[])
//   metrics   — lazy snapshot of derived counts (see buildMetrics)
//   context   — { trigger, taskId, ... } the caller passed in
// Returns true when the badge should be granted.
const PREDICATES = {
    fast_learner: (user) => {
        if ((user.level || 1) < 5) return false;
        if (!user.createdAt) return false;
        return Date.now() - new Date(user.createdAt).getTime() <= 7 * DAY_MS;
    },
    consistent_performer: (user) => (user.streak || 0) >= 7,
    project_master: async (user, metrics) => (await metrics.approvedProjects()) >= 5,
    quiz_champion: async (user, metrics) => (await metrics.completedCodingTasks()) >= 25,
    early_bird: async (user, metrics) => (await metrics.hasEarlySubmission())
};

// Lazy aggregations — only run if a predicate asks for them. Each result is
// cached for the lifetime of one checkAndAwardBadges call.
const buildMetrics = (userId) => {
    let approvedProjectsCache;
    let completedCodingCache;
    let earlyBirdCache;
    return {
        async approvedProjects() {
            if (approvedProjectsCache !== undefined) return approvedProjectsCache;
            const result = await UserTask.aggregate([
                { $match: { user: userId, reviewStatus: 'approved' } },
                {
                    $lookup: {
                        from: 'tasks',
                        localField: 'task',
                        foreignField: '_id',
                        as: 'taskDoc'
                    }
                },
                { $unwind: '$taskDoc' },
                { $match: { 'taskDoc.track': 'Project' } },
                { $count: 'count' }
            ]);
            approvedProjectsCache = result[0]?.count || 0;
            return approvedProjectsCache;
        },
        async completedCodingTasks() {
            if (completedCodingCache !== undefined) return completedCodingCache;
            const result = await UserTask.aggregate([
                { $match: { user: userId, status: 'completed' } },
                {
                    $lookup: {
                        from: 'tasks',
                        localField: 'task',
                        foreignField: '_id',
                        as: 'taskDoc'
                    }
                },
                { $unwind: '$taskDoc' },
                { $match: { 'taskDoc.isCodingChallenge': true } },
                { $count: 'count' }
            ]);
            completedCodingCache = result[0]?.count || 0;
            return completedCodingCache;
        },
        async hasEarlySubmission() {
            if (earlyBirdCache !== undefined) return earlyBirdCache;
            const result = await UserTask.aggregate([
                { $match: { user: userId, submittedAt: { $ne: null } } },
                {
                    $lookup: {
                        from: 'tasks',
                        localField: 'task',
                        foreignField: '_id',
                        as: 'taskDoc'
                    }
                },
                { $unwind: '$taskDoc' },
                {
                    $match: {
                        'taskDoc.dueDate': { $ne: null },
                        // submittedAt at least 24h before dueDate
                        $expr: {
                            $gte: [
                                { $subtract: ['$taskDoc.dueDate', '$submittedAt'] },
                                DAY_MS
                            ]
                        }
                    }
                },
                { $limit: 1 }
            ]);
            earlyBirdCache = result.length > 0;
            return earlyBirdCache;
        }
    };
};

/**
 * Evaluate every badge predicate the user hasn't earned yet, persist any new
 * earns, and fire a system notification per earn. Always resolves — never
 * throws — so callers can safely await without a try/catch wrapping every
 * gamification touchpoint.
 *
 * @param {string|ObjectId} userId
 * @param {Object} [context] caller context (trigger name, taskId, etc.) — passed to predicates if they care
 * @param {import('socket.io').Server} [io] optional io instance for live badge notifications
 * @returns {Promise<string[]>} ids of badges newly awarded this call
 */
export const checkAndAwardBadges = async (userId, context = {}, io = null) => {
    if (!userId) return [];
    try {
        const user = await User.findById(userId);
        if (!user) return [];

        const owned = new Set(user.badges || []);
        const candidates = Object.values(BADGES).filter((b) => !owned.has(b.id));
        if (candidates.length === 0) return [];

        const metrics = buildMetrics(user._id);
        const newlyEarned = [];
        for (const badge of candidates) {
            const predicate = PREDICATES[badge.id];
            if (!predicate) continue;
            try {
                const result = await predicate(user, metrics, context);
                if (result) newlyEarned.push(badge);
            } catch (err) {
                console.error(`⚠ Badge predicate failed (${badge.id}):`, err);
            }
        }
        if (newlyEarned.length === 0) return [];

        // Atomic add of all newly-earned badge ids. $addToSet avoids duplicates
        // even if two checks race on the same trigger.
        await User.updateOne(
            { _id: user._id },
            { $addToSet: { badges: { $each: newlyEarned.map((b) => b.id) } } }
        );

        // Fire one celebratory notification per badge — DB row + socket push.
        // Do not let a notification failure cancel the award.
        for (const badge of newlyEarned) {
            try {
                const notif = await Notification.create({
                    user: user._id,
                    title: `Badge unlocked: ${badge.name}`,
                    message: `${badge.icon} ${badge.description}`,
                    type: 'system'
                });
                if (io && typeof io.send_notification === 'function') {
                    io.send_notification(user._id, {
                        _id: notif._id.toString(),
                        title: `Badge unlocked: ${badge.name}`,
                        message: `${badge.icon} ${badge.description}`,
                        type: 'system',
                        isRead: false,
                        badgeId: badge.id,
                        createdAt: notif.createdAt.toISOString()
                    });
                }

                // Mirror to the shared admin feed.
                await adminNotify(io, {
                    title: `Badge unlocked by ${user.name || 'a learner'}`,
                    message: `${badge.icon} ${badge.name}`,
                    type: 'badge_unlock',
                    meta: {
                        userId: String(user._id),
                        userName: user.name || '',
                        badgeId: badge.id,
                        badgeName: badge.name
                    }
                });
            } catch (notifErr) {
                console.error(`⚠ Failed to notify for badge ${badge.id}:`, notifErr);
            }
        }

        return newlyEarned.map((b) => b.id);
    } catch (err) {
        console.error('⚠ checkAndAwardBadges failed:', err);
        return [];
    }
};
