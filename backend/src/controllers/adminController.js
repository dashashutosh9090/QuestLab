import Task from '../models/Task.js';
import InterviewResource from '../models/InterviewResource.js';
import UserTask from '../models/UserTask.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { applyXpAndStreak } from './gamificationController.js';
import { sendReviewEmail } from '../services/emailService.js';
import {
    isTopicTrack,
    isValidTopic,
    isValidDifficulty,
    trackToCategory,
    TOPIC_CATALOG
} from '../constants/topics.js';

const ALLOWED_LANGUAGES = ['All', 'MERN Stack', 'Python', 'JavaScript', 'Java', 'C++', 'C'];

// @desc    Create a new core task
// @route   POST /api/admin/tasks
export const createCoreTask = async (req, res) => {
    try {
        const {
            title,
            description,
            xpReward,
            levelRequired,
            track,
            isCodingChallenge,
            testCases,
            courseName,
            dueDate,
            totalMarks,
            topic,
            difficulty
        } = req.body;

        if (!title || !description || !track) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        // Basics/DSA practice tasks must be tagged with a topic + difficulty so the
        // learner-side dashboard filter can find them. Other tracks ignore these.
        let resolvedCategory = null;
        let resolvedTopic = null;
        let resolvedDifficulty = null;
        if (isTopicTrack(track)) {
            if (!topic || !isValidTopic(track, topic)) {
                return res.status(400).json({
                    success: false,
                    message: `Topic is required for ${track} tasks. Valid topics: ${TOPIC_CATALOG[track].join(', ')}`
                });
            }
            if (!difficulty || !isValidDifficulty(difficulty)) {
                return res.status(400).json({
                    success: false,
                    message: 'Difficulty must be Easy, Medium, or Hard'
                });
            }
            resolvedCategory = trackToCategory(track);
            resolvedTopic = topic;
            resolvedDifficulty = difficulty;
        }

        if (typeof title !== 'string' || title.length > 200) {
            return res.status(400).json({ success: false, message: 'Title must be 200 characters or less' });
        }
        if (typeof description !== 'string' || description.length > 5000) {
            return res.status(400).json({ success: false, message: 'Description must be 5000 characters or less' });
        }

        let cleanTestCases = [];
        if (testCases) {
            if (!Array.isArray(testCases)) {
                return res.status(400).json({ success: false, message: 'testCases must be an array' });
            }
            if (testCases.length > 50) {
                return res.status(400).json({ success: false, message: 'A task can have at most 50 test cases' });
            }
            for (const tc of testCases) {
                const input = typeof tc?.input === 'string' ? tc.input : '';
                const expected = typeof tc?.expectedOutput === 'string' ? tc.expectedOutput : '';
                if (input.length > 5000 || expected.length > 5000) {
                    return res.status(400).json({ success: false, message: 'Each test case input/output must be 5000 characters or less' });
                }
                cleanTestCases.push({ input, expectedOutput: expected });
            }
        }

        // Optional metadata: validate the date string and clamp marks. An invalid
        // dueDate string falls back to null instead of 400ing — the field is
        // optional and a bad value shouldn't block task creation.
        let parsedDueDate = null;
        if (dueDate) {
            const d = new Date(dueDate);
            if (!Number.isNaN(d.getTime())) parsedDueDate = d;
        }
        const cleanCourseName = typeof courseName === 'string' ? courseName.trim().slice(0, 200) : '';
        const cleanTotalMarks = Math.min(Math.max(parseInt(totalMarks, 10) || 100, 0), 10000);

        const task = await Task.create({
            title,
            description,
            xpReward: Math.min(Math.max(parseInt(xpReward, 10) || 50, 0), 10000),
            levelRequired: Math.min(Math.max(parseInt(levelRequired, 10) || 1, 1), 100),
            track,
            isCore: true,
            isCodingChallenge: isCodingChallenge || false,
            testCases: cleanTestCases,
            courseName: cleanCourseName,
            dueDate: parsedDueDate,
            totalMarks: cleanTotalMarks,
            createdBy: req.user?._id || null,
            category: resolvedCategory,
            topic: resolvedTopic,
            difficulty: resolvedDifficulty
        });

        res.status(201).json({ success: true, message: 'Core task created successfully', task });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error creating core task' });
    }
};

// @desc    Delete a core task
// @route   DELETE /api/admin/tasks/:id
export const deleteCoreTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        await task.deleteOne();
        res.json({ success: true, message: 'Task removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error deleting task' });
    }
};

// @desc    Get all core tasks (for management)
// @route   GET /api/admin/tasks
export const getCoreTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ isCore: true }).sort({ createdAt: -1 });
        res.json({ success: true, tasks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Upload an interview prep resource (PDF)
// @route   POST /api/admin/resources
export const uploadInterviewResource = async (req, res) => {
    try {
        const { title, language } = req.body;
        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }
        if (!ALLOWED_LANGUAGES.includes(language)) {
            return res.status(400).json({ success: false, message: 'Invalid language' });
        }
        if (!req.file || !req.file.path) {
            return res.status(400).json({ success: false, message: 'PDF file is required' });
        }

        const resource = await InterviewResource.create({
            title: title.trim().slice(0, 200),
            language,
            fileUrl: req.file.path
        });

        res.status(201).json({ success: true, message: 'Resource uploaded', resource });
    } catch (error) {
        console.error('❌ Error uploading interview resource:', error);
        res.status(500).json({ success: false, message: 'Server error uploading resource' });
    }
};

// @desc    List interview prep resources
// @route   GET /api/admin/resources
export const getInterviewResources = async (req, res) => {
    try {
        const resources = await InterviewResource.find().sort({ createdAt: -1 });
        res.json({ success: true, resources });
    } catch (error) {
        console.error('❌ Error fetching interview resources:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    List all pending project submissions for admin review
// @route   GET /api/admin/submissions
export const getProjectSubmissions = async (req, res) => {
    try {
        const submissions = await UserTask.find({ reviewStatus: 'pending' })
            .populate('user', 'name email avatar')
            .populate('task', 'title xpReward dueDate courseName totalMarks track')
            .sort({ updatedAt: -1 });

        // Derive submissionStatus per row: 'late' if submitted after the task's
        // due date, otherwise 'submitted'. ('missing' is computed elsewhere — it
        // applies to (user, task) pairs that have no UserTask row at all.)
        const enriched = submissions.map((doc) => {
            const obj = doc.toObject();
            const due = obj.task?.dueDate ? new Date(obj.task.dueDate) : null;
            const submittedAt = obj.submittedAt ? new Date(obj.submittedAt) : new Date(obj.updatedAt);
            obj.submissionStatus = (due && submittedAt && submittedAt > due) ? 'late' : 'submitted';
            return obj;
        });

        res.json({ success: true, submissions: enriched });
    } catch (error) {
        console.error('❌ Error fetching project submissions:', error);
        res.status(500).json({ success: false, message: 'Server error fetching submissions' });
    }
};

// @desc    Approve or reject a project submission
// @route   POST /api/admin/submissions/:id/review
export const reviewProjectSubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, feedback } = req.body;

        if (!['approved', 'rejected', 'revision'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be "approved", "rejected", or "revision"' });
        }

        const userTask = await UserTask.findById(id).populate('task', 'title xpReward');
        if (!userTask) {
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }
        if (userTask.reviewStatus !== 'pending') {
            return res.status(400).json({ success: false, message: 'This submission has already been reviewed' });
        }

        const taskTitle = userTask.task?.title || 'your project';
        const xpReward = userTask.task?.xpReward || 0;
        const cleanFeedback = typeof feedback === 'string' ? feedback : '';

        // Per-status copy + persistence rules. Approval is the only path that
        // credits XP and flips the underlying task to completed. Email subject
        // / body are owned by the email service templates, not built here.
        let notificationTitle, notificationMessage, notificationType;

        if (status === 'approved') {
            userTask.reviewStatus = 'approved';
            userTask.status = 'completed';
            userTask.completedAt = new Date();
            userTask.xpEarned = xpReward;
            if (typeof feedback === 'string') userTask.adminFeedback = feedback;
            await userTask.save();

            await applyXpAndStreak(userTask.user, userTask.task.xpReward, req.app.get('io'));

            notificationTitle = `Project approved: ${taskTitle}`;
            notificationMessage = cleanFeedback
                ? `You earned ${xpReward} XP. Admin note: ${cleanFeedback}`
                : `You earned ${xpReward} XP for ${taskTitle}.`;
            notificationType = 'approval';
        } else if (status === 'revision') {
            userTask.reviewStatus = 'revision';
            userTask.adminFeedback = cleanFeedback;
            await userTask.save();

            notificationTitle = `Revision requested: ${taskTitle}`;
            notificationMessage = cleanFeedback
                ? `Please revise and resubmit. Admin feedback: ${cleanFeedback}`
                : 'Please review your submission and resubmit with the requested changes.';
            notificationType = 'revision';
        } else {
            // status === 'rejected'
            userTask.reviewStatus = 'rejected';
            userTask.adminFeedback = cleanFeedback;
            await userTask.save();

            notificationTitle = `Project rejected: ${taskTitle}`;
            notificationMessage = cleanFeedback
                ? `Admin feedback: ${cleanFeedback}`
                : 'Your submission was rejected. Please contact the instructor for next steps.';
            notificationType = 'rejection';
        }

        // Persist the notification (failure must not roll back the review — XP
        // for an approval is already credited at this point). Capture the saved
        // doc so the socket payload can carry its real _id, letting the client
        // mark-read directly without a refetch round-trip.
        let savedNotification = null;
        try {
            savedNotification = await Notification.create({
                user: userTask.user,
                title: notificationTitle,
                message: notificationMessage,
                type: notificationType
            });
        } catch (notifErr) {
            console.error('⚠ Failed to create notification:', notifErr);
        }

        // Real-time push to the student's private `user:<id>` socket room. Only
        // sockets authenticated as that user can be in the room (see io.on
        // 'connection' in index.js), so payloads stay scoped to the submitter.
        try {
            const io = req.app.get('io');
            if (io && typeof io.send_notification === 'function') {
                io.send_notification(userTask.user, {
                    _id: savedNotification?._id?.toString(),
                    title: notificationTitle,
                    message: notificationMessage,
                    type: notificationType,
                    isRead: false,
                    xpEarned: status === 'approved' ? xpReward : 0,
                    createdAt: savedNotification?.createdAt?.toISOString() || new Date().toISOString()
                });
            }
        } catch (socketErr) {
            console.error('⚠ Failed to emit notification socket event:', socketErr);
        }

        // Broadcast to every open admin tab so the reviewed row leaves their
        // pending queue without a refresh. No AdminNotification row — admins
        // just performed this action themselves, so a bell entry would only
        // be noise.
        try {
            const io = req.app.get('io');
            io?.to('admins').emit('admin:submission_reviewed', {
                submissionId: String(userTask._id),
                status,
                reviewerId: String(req.user?._id || ''),
                reviewerName: req.user?.name || 'An admin',
                taskTitle,
                userId: String(userTask.user)
            });
        } catch (socketErr) {
            console.error('⚠ admin:submission_reviewed emit failed:', socketErr);
        }

        // Email delivery (Resend if configured, console.log fallback otherwise).
        // Awaited so any logging happens before we respond, but the service is
        // designed to never throw — a delivery failure must not roll back the
        // review or the credited XP.
        try {
            const student = await User.findById(userTask.user).select('email name');
            if (student?.email) {
                await sendReviewEmail({
                    to: student.email,
                    name: student.name,
                    type: status,
                    taskTitle,
                    xpReward,
                    feedback: cleanFeedback
                });
            }
        } catch (emailErr) {
            console.error('⚠ Failed to send review email:', emailErr);
        }

        res.json({ success: true, message: `Submission ${status}`, userTask });
    } catch (error) {
        console.error('❌ Error reviewing project submission:', error);
        res.status(500).json({ success: false, message: 'Server error reviewing submission' });
    }
};

// @desc    Delete an interview prep resource
// @route   DELETE /api/admin/resources/:id
export const deleteInterviewResource = async (req, res) => {
    try {
        const resource = await InterviewResource.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }
        await resource.deleteOne();
        res.json({ success: true, message: 'Resource removed' });
    } catch (error) {
        console.error('❌ Error deleting interview resource:', error);
        res.status(500).json({ success: false, message: 'Server error deleting resource' });
    }
};

// @desc    Computed AI-style insights for the admin banner.
// @route   GET /api/admin/insights
//
// Each insight is a small, deterministic heuristic over the live DB — not an
// LLM call. Returned in priority order (warn → positive → info) so the
// frontend can pick the most pressing item to lead the carousel.
export const getAiInsights = async (req, res) => {
    try {
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date();
        const weekAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
        const twoWeeksAgo = new Date(now.getTime() - 2 * SEVEN_DAYS_MS);

        const insights = [];

        // Run the four heuristics in parallel — they're all read-only, no
        // ordering dependencies.
        const [
            inactiveCount,
            latePredictorAgg,
            topPerformerAgg,
            thisWeekCompletions,
            lastWeekCompletions
        ] = await Promise.all([
            // (1) Disengagement risk: hasn't been active in a week. Either an
            // explicit lastActiveAt older than 7d, or a never-active account
            // that's existed for at least a week (so we don't flag fresh signups).
            User.countDocuments({
                $or: [
                    { lastActiveAt: { $lt: weekAgo } },
                    { lastActiveAt: null, createdAt: { $lt: weekAgo } }
                ]
            }),

            // (2) Late-submission probability: per-user historical late rate
            // (submittedAt > task.dueDate). Users with ≥3 due-dated submissions
            // and a late rate ≥ 50% are flagged. Pure history, no ML.
            UserTask.aggregate([
                { $match: { submittedAt: { $ne: null } } },
                {
                    $lookup: {
                        from: 'tasks',
                        localField: 'task',
                        foreignField: '_id',
                        as: 'taskDoc'
                    }
                },
                { $unwind: '$taskDoc' },
                { $match: { 'taskDoc.dueDate': { $ne: null } } },
                {
                    $group: {
                        _id: '$user',
                        total: { $sum: 1 },
                        late: {
                            $sum: {
                                $cond: [{ $gt: ['$submittedAt', '$taskDoc.dueDate'] }, 1, 0]
                            }
                        }
                    }
                },
                { $match: { total: { $gte: 3 } } },
                {
                    $project: {
                        total: 1,
                        late: 1,
                        lateRate: { $divide: ['$late', '$total'] }
                    }
                },
                { $match: { lateRate: { $gte: 0.5 } } },
                { $count: 'count' }
            ]),

            // (3) Top performer this week: highest XP earned across completions
            // since weekAgo, joined back to User for a name.
            UserTask.aggregate([
                { $match: { status: 'completed', completedAt: { $gte: weekAgo } } },
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
                    $group: {
                        _id: '$user',
                        weeklyXp: { $sum: '$taskDoc.xpReward' },
                        completions: { $sum: 1 }
                    }
                },
                { $sort: { weeklyXp: -1 } },
                { $limit: 1 },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'userDoc'
                    }
                },
                { $unwind: '$userDoc' },
                { $project: { weeklyXp: 1, completions: 1, name: '$userDoc.name' } }
            ]),

            // (4a) Completion volume this week
            UserTask.countDocuments({
                status: 'completed',
                completedAt: { $gte: weekAgo }
            }),

            // (4b) Completion volume last week
            UserTask.countDocuments({
                status: 'completed',
                completedAt: { $gte: twoWeeksAgo, $lt: weekAgo }
            })
        ]);

        // (1) Inactivity insight
        if (inactiveCount > 0) {
            insights.push({
                id: 'inactive',
                icon: '⏸',
                severity: 'warn',
                text: `${inactiveCount} learner${inactiveCount === 1 ? '' : 's'} ${inactiveCount === 1 ? 'has' : 'have'} been inactive for 7+ days. Consider sending a re-engagement nudge.`
            });
        }

        // (2) Late-submission risk
        const lateRiskCount = latePredictorAgg[0]?.count || 0;
        if (lateRiskCount > 0) {
            insights.push({
                id: 'late_risk',
                icon: '⚠',
                severity: 'warn',
                text: `${lateRiskCount} student${lateRiskCount === 1 ? '' : 's'} ${lateRiskCount === 1 ? 'has' : 'have'} a high probability of late submission based on history (50%+ historical late rate).`
            });
        }

        // (3) Top performer
        const top = topPerformerAgg[0];
        if (top) {
            insights.push({
                id: 'top_performer',
                icon: '🚀',
                severity: 'positive',
                text: `${top.name} is leading this week with ${(top.weeklyXp || 0).toLocaleString()} XP across ${top.completions} task${top.completions === 1 ? '' : 's'}.`
            });
        }

        // (4) Completion-rate trend (≥5% delta only — noise floor)
        if (lastWeekCompletions > 0) {
            const deltaPct = Math.round(((thisWeekCompletions - lastWeekCompletions) / lastWeekCompletions) * 100);
            if (Math.abs(deltaPct) >= 5) {
                insights.push({
                    id: 'trend',
                    icon: deltaPct > 0 ? '📈' : '📉',
                    severity: deltaPct > 0 ? 'positive' : 'info',
                    text: `Completion rate ${deltaPct > 0 ? 'improved' : 'dipped'} by ${Math.abs(deltaPct)}% versus last week (${thisWeekCompletions} vs ${lastWeekCompletions}).`
                });
            }
        } else if (thisWeekCompletions > 0) {
            insights.push({
                id: 'trend_first',
                icon: '🌱',
                severity: 'positive',
                text: `${thisWeekCompletions} completion${thisWeekCompletions === 1 ? '' : 's'} this week — first week of activity, momentum is building.`
            });
        }

        // Empty-state fallback so the carousel always has something to show.
        if (insights.length === 0) {
            insights.push({
                id: 'empty',
                icon: '✨',
                severity: 'info',
                text: 'All quiet on the platform. Insights will surface here as learners start submitting work.'
            });
        }

        // Priority sort — warn first, positive next, info last.
        const order = { warn: 0, positive: 1, info: 2 };
        insights.sort((a, b) => order[a.severity] - order[b.severity]);

        res.json({ success: true, insights });
    } catch (error) {
        console.error('❌ Error computing AI insights:', error);
        res.status(500).json({ success: false, message: 'Server error computing insights' });
    }
};

// Build a 7-day window starting at midnight 6 days ago through end-of-today.
// Returned as { weekStart: Date, days: [{ date, label, ymd }] } so the
// aggregation post-processor can fill in zero-buckets for empty days.
const buildWeekFrame = () => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const ymd = d.toISOString().slice(0, 10);
        days.push({
            ymd,
            label: d.toLocaleDateString(undefined, { weekday: 'short' }),
            date: d.toISOString()
        });
    }
    return { weekStart, days };
};

// @desc    7-day rolling submission activity for the admin dashboard
// @route   GET /api/admin/analytics/weekly
export const getAdminWeeklyAnalytics = async (req, res) => {
    try {
        const { weekStart, days } = buildWeekFrame();

        // One aggregation, grouped per UTC calendar day, with conditional
        // counters per review status. UTC matches `submittedAt` storage; clients
        // re-format to local in the chart label.
        const grouped = await UserTask.aggregate([
            { $match: { submittedAt: { $gte: weekStart } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
                    total: { $sum: 1 },
                    approved: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'approved'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'rejected'] }, 1, 0] } },
                    revision: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'revision'] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'pending'] }, 1, 0] } }
                }
            }
        ]);

        const byDay = new Map(grouped.map((g) => [g._id, g]));
        const series = days.map(({ ymd, label, date }) => {
            const e = byDay.get(ymd);
            return {
                date,
                ymd,
                label,
                total: e?.total || 0,
                approved: e?.approved || 0,
                rejected: e?.rejected || 0,
                revision: e?.revision || 0,
                pending: e?.pending || 0
            };
        });

        const summary = series.reduce((acc, d) => ({
            total: acc.total + d.total,
            approved: acc.approved + d.approved,
            rejected: acc.rejected + d.rejected,
            revision: acc.revision + d.revision,
            pending: acc.pending + d.pending
        }), { total: 0, approved: 0, rejected: 0, revision: 0, pending: 0 });

        res.json({ success: true, days: series, summary });
    } catch (error) {
        console.error('❌ Error fetching admin weekly analytics:', error);
        res.status(500).json({ success: false, message: 'Server error fetching analytics' });
    }
};

// @desc    Aggregated assignment/submission counters for the admin dashboard
// @route   GET /api/admin/stats
export const getDashboardStats = async (req, res) => {
    try {
        // One $facet round-trip yields every counter we need:
        //   - totalAssignments: every UserTask row a learner has touched
        //   - submitted: anything past the "none" review state (pending OR resolved)
        //   - pendingReview / approved / rejected: bucketed by reviewStatus
        const [agg] = await UserTask.aggregate([
            {
                $facet: {
                    totalAssignments: [{ $count: 'count' }],
                    submitted: [
                        { $match: { reviewStatus: { $in: ['pending', 'approved', 'rejected', 'revision'] } } },
                        { $count: 'count' }
                    ],
                    pendingReview: [
                        { $match: { reviewStatus: 'pending' } },
                        { $count: 'count' }
                    ],
                    approved: [
                        { $match: { reviewStatus: 'approved' } },
                        { $count: 'count' }
                    ],
                    rejected: [
                        { $match: { reviewStatus: 'rejected' } },
                        { $count: 'count' }
                    ],
                    // "Late" = a submission whose submittedAt timestamp is past the task's
                    // dueDate. Joins UserTask → Task once and skips rows without a due date.
                    lateSubmissions: [
                        {
                            $match: {
                                reviewStatus: { $in: ['pending', 'approved', 'rejected', 'revision'] },
                                submittedAt: { $ne: null }
                            }
                        },
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
                                $expr: { $gt: ['$submittedAt', '$taskDoc.dueDate'] }
                            }
                        },
                        { $count: 'count' }
                    ]
                }
            }
        ]);

        const pluck = (bucket) => agg?.[bucket]?.[0]?.count || 0;

        res.json({
            success: true,
            stats: {
                totalAssignments: pluck('totalAssignments'),
                submitted: pluck('submitted'),
                pendingReview: pluck('pendingReview'),
                approved: pluck('approved'),
                rejected: pluck('rejected'),
                lateSubmissions: pluck('lateSubmissions')
            }
        });
    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Server error fetching dashboard stats' });
    }
};
