import mongoose from 'mongoose';
import Task from '../models/Task.js';
import UserTask from '../models/UserTask.js';
import User from '../models/User.js';
import MentorRequest from '../models/MentorRequest.js';
import DirectMessage from '../models/DirectMessage.js';
import RoomMessage from '../models/RoomMessage.js';
import InterviewResource from '../models/InterviewResource.js';
import { generateTasksForTrack, validateCodingTask, repairCodingTask } from '../services/AIQuestGenerator.js';
import { checkAndAwardBadges, BADGES } from '../services/badgeService.js';
import { getTier } from '../services/tierService.js';
import { adminNotify } from '../utils/adminNotify.js';
import {
    isTopicTrack,
    isValidTopic,
    isValidDifficulty,
    trackToCategory
} from '../constants/topics.js';

// XP rule constants — single source of truth so Profile/dashboard copy stays
// in sync with award logic.
export const SUBMIT_XP_BONUS = 20;
export const EARLY_SUBMISSION_BONUS = 30;
const EARLY_SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;

// Study-room → prerequisite-track gating. Mirrors the unlock thresholds in getRoadmap.
const ROOM_PREREQS = {
    basics: null,
    dsa: { track: 'Basics', count: 30 },
    project: { track: 'DSA', count: 30 },
    resume: { track: 'Project', count: 5 },
    interview: { track: 'Project', count: 5 }
};

export const roomAccessGate = async (userId, room, bypassLock = false) => {
    if (!Object.prototype.hasOwnProperty.call(ROOM_PREREQS, room)) {
        return { allowed: false, reason: 'Invalid room' };
    }
    if (bypassLock) return { allowed: true };
    const prereq = ROOM_PREREQS[room];
    if (!prereq) return { allowed: true };

    const uid = userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));
    const stats = await UserTask.aggregate([
        { $match: { user: uid, status: 'completed' } },
        { $lookup: { from: 'tasks', localField: 'task', foreignField: '_id', as: 't' } },
        { $unwind: '$t' },
        { $match: { 't.track': prereq.track } },
        { $count: 'count' }
    ]);
    const count = stats[0]?.count || 0;
    if (count < prereq.count) {
        return {
            allowed: false,
            reason: `Complete ${prereq.count} ${prereq.track} tasks to unlock this room (${count}/${prereq.count}).`
        };
    }
    return { allowed: true };
};

// Get available tasks
export const getTasks = async (req, res) => {
    try {
        const { track, category, topic, difficulty } = req.query;
        let query = {
            $or: [
                { isCore: true },
                { generatedFor: req.user._id }
            ]
        };

        if (track && track !== 'All') {
            query.track = track;
        }

        // Topic-level filters only apply to the practice tracks (Basics, DSA).
        // Silently ignored for Project/Resume/Interview to avoid empty results
        // if a stale filter is still set when the learner switches tracks.
        if (isTopicTrack(track)) {
            if (category) query.category = category;
            if (topic) query.topic = topic;
            if (difficulty && isValidDifficulty(difficulty)) query.difficulty = difficulty;
        }

        const tasks = await Task.find(query).sort({ createdAt: -1 });

        // Pull every UserTask record for this user (not just completed) so we can also
        // surface project review state on quests that are mid-review.
        const userTasks = await UserTask.find({ user: req.user._id });
        const userTaskMap = userTasks.reduce((acc, curr) => {
            acc[curr.task.toString()] = curr;
            return acc;
        }, {});

        const tasksWithStatus = tasks.map(t => {
            const taskObj = t.toObject();
            const ut = userTaskMap[taskObj._id.toString()];
            taskObj.status = ut?.status === 'completed' ? 'completed' : 'pending';
            taskObj.savedCode = ut?.code || '';
            taskObj.savedLanguage = ut?.language || '';
            taskObj.reviewStatus = ut?.reviewStatus || 'none';
            taskObj.adminFeedback = ut?.adminFeedback || '';
            taskObj.submissionUrl = ut?.submissionUrl || '';
            taskObj.githubLink = ut?.githubLink || '';
            taskObj.submissionText = ut?.submissionText || '';
            // Surface the UserTask id so the learner UI can thread comments
            // by submission (per-user) rather than per-task (cross-user).
            taskObj.userTaskId = ut?._id ? String(ut._id) : null;
            return taskObj;
        });

        res.json({ success: true, tasks: tasksWithStatus });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching tasks' });
    }
};

// Generate AI quests
export const generateAIQuests = async (req, res) => {
    try {
        const { track, count, difficulty, topic } = req.body;
        if (!track) return res.status(400).json({ success: false, message: 'Track is required' });

        // For practice tracks, validate the optional topic so we don't tag
        // generated questions with a bogus value that breaks the dashboard filter.
        let resolvedTopic = null;
        let resolvedCategory = null;
        if (isTopicTrack(track) && topic) {
            if (!isValidTopic(track, topic)) {
                return res.status(400).json({ success: false, message: `Invalid topic for ${track}` });
            }
            resolvedTopic = topic;
            resolvedCategory = trackToCategory(track);
        }
        const resolvedDifficulty = isValidDifficulty(difficulty) ? difficulty : 'Medium';

        const aiTasks = await generateTasksForTrack(
            track,
            req.user.level || 1,
            count || 3,
            resolvedDifficulty,
            { category: resolvedCategory, topic: resolvedTopic }
        );

        const isCodingChallenge = track === 'Basics' || track === 'DSA';

        // Final guard: even after the generator's retries+repair, refuse to
        // persist a coding task whose first test case contradicts its declared
        // Sample I/O. Try one repair pass and drop anything still broken so the
        // user gets fewer-but-valid quests rather than a buggy one.
        const safeTasks = isCodingChallenge
            ? aiTasks.flatMap((t) => {
                if (validateCodingTask(t).valid) return [t];
                const repaired = repairCodingTask(t);
                if (repaired && validateCodingTask(repaired).valid) return [repaired];
                console.warn(`Dropping unrecoverable AI coding task "${t?.title || 'untitled'}" before save`);
                return [];
            })
            : aiTasks;

        if (safeTasks.length === 0) {
            return res.status(502).json({ success: false, message: 'AI returned no usable tasks. Please try again.' });
        }

        // Save these tasks for the specific user
        const savedTasks = await Promise.all(safeTasks.map(async (taskData) => {
            // Clamp AI-supplied XP to the documented 30-150 range so a hallucinated
            // value can't grant absurd progress.
            const safeXp = Math.min(Math.max(parseInt(taskData.xpReward, 10) || 50, 30), 150);
            return await Task.create({
                ...taskData,
                xpReward: safeXp,
                track,
                levelRequired: req.user.level || 1,
                isCore: false,
                isCodingChallenge,
                testCases: taskData.testCases || [],
                generatedFor: req.user._id,
                category: resolvedCategory,
                topic: resolvedTopic,
                difficulty: isTopicTrack(track) ? resolvedDifficulty : null
            });
        }));

        res.json({ success: true, message: 'Tasks generated successfully', tasks: savedTasks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'AI generation failed' });
    }
};

// Complete task and handle logic (XP/Leveling)
export const completeTask = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        // Coding challenges must go through the test-runner endpoint.
        if (task.isCodingChallenge) {
            return res.status(400).json({
                success: false,
                message: 'This is a coding challenge — submit a passing solution to complete it.'
            });
        }

        // Project / Resume / Interview tasks require admin verification —
        // they cannot be self-completed by the learner. This closes the
        // XP-farming hole where AI-generated Resume/Interview quests used to
        // award XP on a single click with zero proof.
        if (task.track === 'Resume' || task.track === 'Interview' || task.track === 'Project') {
            return res.status(400).json({
                success: false,
                message: task.track === 'Project'
                    ? 'Submit your project for admin review to complete this task.'
                    : 'Submit your work for admin review to complete this task.'
            });
        }

        // Enforce level gate: a Level 1 user cannot claim a Level 100 task.
        if ((task.levelRequired || 1) > (req.user.level || 1)) {
            return res.status(403).json({
                success: false,
                message: `Reach Level ${task.levelRequired} to complete this quest.`
            });
        }

        // AI-generated tasks may only be completed by the user they were generated for.
        if (task.generatedFor && String(task.generatedFor) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'This quest does not belong to you.' });
        }

        // Atomic: only matches if no completed record exists yet, then flips status to completed.
        // The unique (user, task) index plus this filter guarantees only one request awards XP.
        const updated = await UserTask.findOneAndUpdate(
            { user: req.user._id, task: id, status: { $ne: 'completed' } },
            {
                $set: { status: 'completed', completedAt: new Date() },
                $setOnInsert: { user: req.user._id, task: id }
            },
            { upsert: true, new: true, rawResult: true }
        ).catch((err) => {
            if (err && err.code === 11000) return null; // Duplicate key = already completed
            throw err;
        });

        if (!updated) {
            return res.status(400).json({ success: false, message: 'Task already completed' });
        }

        const user = await applyXpAndStreak(req.user._id, task.xpReward, req.app.get('io'));

        await adminNotify(req.app.get('io'), {
            title: 'Task completed',
            message: `${req.user.name || 'A learner'} completed ${task.title}`,
            type: 'task_completion',
            meta: {
                userId: String(req.user._id),
                userName: req.user.name || '',
                taskTitle: task.title,
                track: task.track,
                xp: task.xpReward
            }
        });

        res.json({
            success: true,
            message: 'Task completed!',
            xpAwarded: task.xpReward,
            leveledUp: user.leveledUp,
            newUser: { xp: user.xp, level: user.level, streak: user.streak }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error completing task' });
    }
};

// Apply XP, leveling, and streak update atomically (no read-modify-write race).

// IST-stable "calendar day" delta. The audience is in India, so we anchor
// the day boundary to +05:30 instead of UTC. Pure UTC math collapsed two
// adjacent IST days (e.g. 23:35 IST and 04:00 IST next morning) into the
// same UTC date and broke the streak. Anchoring to IST fixes that.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const dayDiff = (a, b) => {
    const ai = new Date(a.getTime() + IST_OFFSET_MS);
    const bi = new Date(b.getTime() + IST_OFFSET_MS);
    const da = Date.UTC(ai.getUTCFullYear(), ai.getUTCMonth(), ai.getUTCDate());
    const db = Date.UTC(bi.getUTCFullYear(), bi.getUTCMonth(), bi.getUTCDate());
    return Math.round((db - da) / (24 * 60 * 60 * 1000));
};

export const applyXpAndStreak = async (userId, xpReward, io = null) => {
    // Step 1: read current state (snapshot only used to compute the new streak value).
    const snapshot = await User.findById(userId).select('xp level streak lastActiveAt');
    if (!snapshot) throw new Error('User not found');

    const now = new Date();
    const lastActive = snapshot.lastActiveAt ? new Date(snapshot.lastActiveAt) : null;

    let newStreak;
    if (!lastActive) {
        newStreak = 1;
    } else {
        const dayDelta = dayDiff(lastActive, now);
        if (dayDelta <= 0) {
            // Same UTC day (or clock went backwards) — keep the streak as-is.
            newStreak = snapshot.streak || 1;
        } else if (dayDelta === 1) {
            newStreak = (snapshot.streak || 0) + 1;
        } else {
            // Missed at least one full UTC day — reset.
            newStreak = 1;
        }
    }

    // Step 2: atomic increment for XP and absolute set for streak/lastActiveAt.
    // $inc on xp prevents lost updates when two completions race.
    const updated = await User.findByIdAndUpdate(
        userId,
        {
            $inc: { xp: xpReward },
            $set: { streak: newStreak, lastActiveAt: now }
        },
        { new: true }
    ).select('xp level streak');

    // Step 3: derive level from the post-increment xp; flip atomically so two
    // racing completions don't both claim "leveled up". Only the request whose
    // newLevel actually exceeds the persisted level wins; any later racer
    // sees the level already at newLevel and gets leveledUp:false.
    const newLevel = Math.floor(updated.xp / 500) + 1;
    let leveledUp = false;
    if (newLevel > updated.level) {
        const flip = await User.updateOne(
            { _id: userId, level: { $lt: newLevel } },
            { $set: { level: newLevel } }
        );
        if (flip.modifiedCount > 0) {
            updated.level = newLevel;
            leveledUp = true;
        } else {
            // Another request already flipped — re-read so we return the truth.
            const fresh = await User.findById(userId).select('level');
            if (fresh) updated.level = fresh.level;
        }
    }

    // Step 4: badge sweep on every XP credit. Cheap when the user already
    // owns all relevant badges (one User read + a Set check). Errors are
    // swallowed inside the service so this can't 500 the calling endpoint.
    checkAndAwardBadges(userId, { trigger: 'xp', leveledUp, newStreak }, io).catch((err) =>
        console.error('⚠ post-XP badge check failed:', err)
    );

    return { xp: updated.xp, level: updated.level, streak: updated.streak, leveledUp };
};

// Get Leaderboard
export const getLeaderboard = async (req, res) => {
    try {
        const topUsers = await User.find().sort({ xp: -1 }).limit(10).select('name xp level avatar streak');
        res.json({ success: true, leaderboard: topUsers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching leaderboard' });
    }
};

// Get Mentors with the current user's relationship state per mentor
export const getMentors = async (req, res) => {
    try {
        const userId = req.user._id;
        const userLevel = req.user.level || 1;

        // Always include accepted-connection partners even if they no longer
        // satisfy the +2 level gap (mentee may have out-leveled the mentor).
        const accepted = await MentorRequest.find({
            $or: [{ sender: userId }, { receiver: userId }],
            status: 'accepted'
        }).select('sender receiver');
        const connectedIds = accepted.map((r) =>
            String(r.sender) === String(userId) ? r.receiver : r.sender
        );

        const mentors = await User.find({
            _id: { $ne: userId },
            $or: [
                { level: { $gte: userLevel + 2 } },
                { _id: { $in: connectedIds } }
            ]
        }).select('name xp level avatar');
        const mentorIds = mentors.map((m) => m._id);

        const requests = await MentorRequest.find({
            $or: [
                { sender: userId, receiver: { $in: mentorIds } },
                { sender: { $in: mentorIds }, receiver: userId }
            ]
        }).sort({ updatedAt: -1 });

        const stateByMentor = new Map();
        for (const r of requests) {
            const other = String(r.sender) === String(userId) ? String(r.receiver) : String(r.sender);
            if (stateByMentor.has(other)) continue; // most-recent wins (sorted desc)
            stateByMentor.set(other, {
                status: r.status,
                outgoing: String(r.sender) === String(userId)
            });
        }

        const enriched = mentors.map((m) => {
            const rel = stateByMentor.get(String(m._id));
            let relationship = 'none';
            if (rel) {
                if (rel.status === 'accepted') relationship = 'connected';
                else if (rel.status === 'pending' && rel.outgoing) relationship = 'pending';
                // rejected or incoming-pending → 'none' (allow send)
            }
            return { ...m.toObject(), relationship };
        });

        res.json({ success: true, mentors: enriched });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching mentors' });
    }
};

// Send mentor request
export const sendMentorRequest = async (req, res) => {
    try {
        const { receiverId, message } = req.body;

        if (!receiverId) {
            return res.status(400).json({ success: false, message: 'receiverId is required' });
        }
        if (receiverId.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot send a mentor request to yourself' });
        }
        if (typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ success: false, message: 'A message is required' });
        }
        if (message.length > 500) {
            return res.status(400).json({ success: false, message: 'Message must be 500 characters or less' });
        }
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ success: false, message: 'Mentor not found' });
        }

        // Enforce the +2 level gap server-side; the frontend filter alone is bypassable.
        const senderLevel = req.user.level || 1;
        const receiverLevel = receiver.level || 1;
        if (receiverLevel < senderLevel + 2) {
            return res.status(400).json({
                success: false,
                message: 'Mentor must be at least 2 levels above you'
            });
        }

        // Block any existing relationship in either direction (pending or accepted).
        const existingActive = await MentorRequest.findOne({
            $or: [
                { sender: req.user._id, receiver: receiverId },
                { sender: receiverId, receiver: req.user._id }
            ],
            status: { $in: ['pending', 'accepted'] }
        });
        if (existingActive) {
            const msg = existingActive.status === 'accepted'
                ? 'You are already connected with this mentor'
                : 'A request is already pending with this mentor';
            return res.status(400).json({ success: false, message: msg });
        }

        const newReq = await MentorRequest.create({
            sender: req.user._id,
            receiver: receiverId,
            message: message.trim()
        });

        res.json({ success: true, message: 'Mentor request sent!', request: newReq });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error sending request' });
    }
};

// Get Roadmap data
export const getRoadmap = async (req, res) => {
    try {
        const userId = req.user._id;

        // Count completed tasks per track for this user
        const completionStats = await UserTask.aggregate([
            { $match: { user: userId, status: 'completed' } },
            {
                $lookup: {
                    from: 'tasks',
                    localField: 'task',
                    foreignField: '_id',
                    as: 'taskDetails'
                }
            },
            { $unwind: '$taskDetails' },
            {
                $group: {
                    _id: '$taskDetails.track',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsMap = completionStats.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        const rawRoadmap = [
            { id: 'basics', trackName: 'Basics', title: 'Basics', description: 'Programming fundamentals' },
            { id: 'dsa', trackName: 'DSA', title: 'Data Structures & Algorithms', description: 'Core problem solving skills' },
            { id: 'project', trackName: 'Project', title: 'Projects', description: 'Build real-world applications' },
            { id: 'resume', trackName: 'Resume', title: 'Resume Building', description: 'Craft your professional profile' },
            { id: 'interview', trackName: 'Interview', title: 'Interview Prep', description: 'Ace the technical interviews' }
        ];

        // Roadmap unlocking logic:
        // 1. Basics is always unlocked.
        // 2. DSA unlocks if Basics >= 30.
        // 3. Project unlocks if DSA >= 30.
        // 4. Resume & Interview both unlock if Project >= 5.

        const bypassLock = !!req.user.unlockAllTracks;

        const roadmapWithStatus = rawRoadmap.map((node) => {
            const count = statsMap[node.trackName] || 0;
            let status = 'locked';
            let requiredCount = 30; // Default

            if (node.id === 'basics') {
                status = count >= 30 ? 'completed' : 'unlocked';
            } else if (node.id === 'dsa') {
                const basicsCount = statsMap['Basics'] || 0;
                if (basicsCount >= 30 || bypassLock) {
                    status = count >= 30 ? 'completed' : 'unlocked';
                }
            } else if (node.id === 'project') {
                requiredCount = 5;
                const dsaCount = statsMap['DSA'] || 0;
                if (dsaCount >= 30 || bypassLock) {
                    status = count >= 5 ? 'completed' : 'unlocked';
                }
            } else if (node.id === 'resume' || node.id === 'interview') {
                requiredCount = 5;
                const projectCount = statsMap['Project'] || 0;
                if (projectCount >= 5 || bypassLock) {
                    status = count >= 5 ? 'completed' : 'unlocked';
                }
            }

            return { ...node, status, completedCount: count, requiredCount };
        });

        res.json({ success: true, roadmap: roadmapWithStatus });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching roadmap' });
    }
};

// Get received mentor requests
export const getReceivedMentorRequests = async (req, res) => {
    try {
        const requests = await MentorRequest.find({ receiver: req.user._id, status: 'pending' })
            .populate('sender', 'name email avatar level xp')
            .sort({ createdAt: -1 });
        
        res.json({ success: true, requests });
    } catch (error) {
        console.error('❌ Error fetching mentor requests:', error);
        res.status(500).json({ success: false, message: 'Server error fetching requests' });
    }
};

// Accept or Reject mentor request
export const respondToMentorRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'accepted' or 'rejected'

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const request = await MentorRequest.findById(id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Ensure ONLY the receiver can respond
        if (request.receiver.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to respond to this request' });
        }

        request.status = status;
        await request.save();

        res.json({
            success: true,
            message: `Request ${status} successfully!`,
            request
        });
    } catch (error) {
        console.error('❌ Error responding to mentor request:', error);
        res.status(500).json({ success: false, message: 'Server error updating request' });
    }
};

// List all accepted mentorship connections for the current user (as mentor or mentee)
export const getConnections = async (req, res) => {
    try {
        const userId = req.user._id;
        const accepted = await MentorRequest.find({
            $or: [{ sender: userId }, { receiver: userId }],
            status: 'accepted'
        })
            .populate('sender', 'name email avatar level xp')
            .populate('receiver', 'name email avatar level xp')
            .sort({ updatedAt: -1 });

        // Compute unread counts grouped by sender (partner) in one query
        const unreadAgg = await DirectMessage.aggregate([
            { $match: { receiver: userId, read: false } },
            { $group: { _id: '$sender', count: { $sum: 1 } } }
        ]);
        const unreadBySender = new Map(unreadAgg.map((u) => [String(u._id), u.count]));

        // Dedupe by partner so legacy duplicate accepted rows don't double up the UI.
        const seenPartners = new Set();
        const connections = accepted
            .filter((r) => r.sender && r.receiver)
            .map((r) => {
                const isMentor = String(r.receiver._id) === String(userId);
                const partner = isMentor ? r.sender : r.receiver;
                return { r, isMentor, partner };
            })
            .filter(({ partner }) => {
                const key = String(partner._id);
                if (seenPartners.has(key)) return false;
                seenPartners.add(key);
                return true;
            })
            .map(({ r, isMentor, partner }) => ({
                _id: r._id,
                role: isMentor ? 'mentor' : 'mentee',
                partner: {
                    _id: partner._id,
                    name: partner.name,
                    email: partner.email,
                    avatar: partner.avatar,
                    level: partner.level,
                    xp: partner.xp
                },
                unreadCount: unreadBySender.get(String(partner._id)) || 0,
                connectedAt: r.updatedAt
            }));

        res.json({ success: true, connections });
    } catch (error) {
        console.error('❌ Error fetching connections:', error);
        res.status(500).json({ success: false, message: 'Server error fetching connections' });
    }
};

// Remove an accepted mentorship connection (and clear DM history with that partner)
export const removeConnection = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const connection = await MentorRequest.findById(id);
        if (!connection) {
            return res.status(404).json({ success: false, message: 'Connection not found' });
        }
        if (connection.status !== 'accepted') {
            return res.status(400).json({ success: false, message: 'Not an active connection' });
        }
        const isParticipant =
            String(connection.sender) === String(userId) ||
            String(connection.receiver) === String(userId);
        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const partnerId = String(connection.sender) === String(userId)
            ? connection.receiver
            : connection.sender;

        // Remove ALL accepted MentorRequest rows between this pair, not just the one
        // the client referenced — this also heals legacy duplicates from before the
        // duplicate-accepted guard was in place.
        await MentorRequest.deleteMany({
            $or: [
                { sender: userId, receiver: partnerId },
                { sender: partnerId, receiver: userId }
            ],
            status: 'accepted'
        });
        await DirectMessage.deleteMany({
            $or: [
                { sender: userId, receiver: partnerId },
                { sender: partnerId, receiver: userId }
            ]
        });

        res.json({ success: true, message: 'Connection removed', partnerId });
    } catch (error) {
        console.error('❌ Error removing connection:', error);
        res.status(500).json({ success: false, message: 'Server error removing connection' });
    }
};

// Mark all messages from a specific partner as read
export const markDirectMessagesRead = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const userId = req.user._id;

        const result = await DirectMessage.updateMany(
            { sender: partnerId, receiver: userId, read: false },
            { $set: { read: true } }
        );

        res.json({ success: true, modified: result.modifiedCount || 0 });
    } catch (error) {
        console.error('❌ Error marking messages read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get last 50 messages for a study room (gated by track completion)
export const getRoomMessages = async (req, res) => {
    try {
        const { room } = req.params;
        const gate = await roomAccessGate(req.user._id, room, !!req.user.unlockAllTracks);
        if (!gate.allowed) {
            return res.status(403).json({ success: false, message: gate.reason });
        }

        const docs = await RoomMessage.find({ room })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('sender', 'name avatar')
            .lean();

        const messages = docs.reverse().map((m) => ({
            _id: m._id,
            room: m.room,
            userId: m.sender ? String(m.sender._id) : '',
            author: m.sender?.name || 'User',
            senderAvatar: m.sender?.avatar || null,
            text: m.text,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: m.createdAt
        }));

        res.json({ success: true, messages });
    } catch (error) {
        console.error('❌ Error fetching room messages:', error);
        res.status(500).json({ success: false, message: 'Server error fetching room messages' });
    }
};

// Fan a freshly upserted submission row out to admin sockets. Two channels:
//   - `admin:submission_new` for the AdminDashboard queue (silent state sync)
//   - `admin:notification`   for the navbar bell (via adminNotify → DB + emit)
// The populate shape matches getProjectSubmissions so the dashboard can
// prepend the row without a refetch.
const fanoutAdminSubmission = async (io, userTask) => {
    try {
        const populated = await UserTask.findById(userTask._id)
            .populate('user', 'name email avatar')
            .populate('task', 'title xpReward dueDate courseName totalMarks track')
            .lean();
        if (!populated) return;
        const due = populated.task?.dueDate ? new Date(populated.task.dueDate) : null;
        const sAt = populated.submittedAt
            ? new Date(populated.submittedAt)
            : new Date(populated.updatedAt);
        populated.submissionStatus = (due && sAt && sAt > due) ? 'late' : 'submitted';

        const isResub = (userTask.submitCount || 0) > 1;
        if (io) {
            io.to('admins').emit('admin:submission_new', {
                submission: populated,
                isResubmit: isResub
            });
        }
        await adminNotify(io, {
            title: isResub
                ? `Resubmission: ${populated.task?.title || 'Task'}`
                : `New submission: ${populated.task?.title || 'Task'}`,
            message: `${populated.user?.name || 'A learner'} submitted (${populated.task?.track || 'Task'})`,
            type: 'submission',
            meta: {
                submissionId: String(populated._id),
                userId: String(populated.user?._id || ''),
                userName: populated.user?.name || '',
                taskTitle: populated.task?.title || '',
                track: populated.task?.track || '',
                isResubmit: isResub
            }
        });
    } catch (err) {
        console.error('⚠ fanoutAdminSubmission failed:', err);
    }
};

// Submit a project ZIP for admin review (Project track)
export const submitProjectZip = async (req, res) => {
    try {
        const { taskId } = req.params;

        if (!req.file || !req.file.path) {
            return res.status(400).json({ success: false, message: 'A ZIP file is required' });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // AI-generated tasks are scoped to a single user.
        if (task.generatedFor && String(task.generatedFor) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'This quest does not belong to you.' });
        }

        const githubLink = typeof req.body?.githubLink === 'string' ? req.body.githubLink.trim() : '';
        const submittedAt = new Date();

        // Atomic upsert + counter bump. submitCount lets us tell first submit
        // from resubmits without a separate read — `submitCount === 1` after
        // the update means this was the first submission for this (user,task).
        const userTask = await UserTask.findOneAndUpdate(
            { user: req.user._id, task: taskId },
            {
                $set: {
                    submissionUrl: req.file.path,
                    githubLink,
                    reviewStatus: 'pending',
                    adminFeedback: '',
                    submittedAt
                },
                $inc: { submitCount: 1 },
                $setOnInsert: { user: req.user._id, task: taskId, status: 'pending' }
            },
            { upsert: true, new: true }
        );

        // XP bonuses are first-submission-only so a learner can't farm XP by
        // re-uploading the same ZIP. Both bonuses stack with the eventual
        // approval reward.
        let bonusXp = 0;
        const reasons = [];
        if (userTask.submitCount === 1) {
            bonusXp += SUBMIT_XP_BONUS;
            reasons.push(`+${SUBMIT_XP_BONUS} XP for submitting`);

            const dueDate = task.dueDate ? new Date(task.dueDate) : null;
            if (dueDate && (dueDate.getTime() - submittedAt.getTime()) >= EARLY_SUBMISSION_WINDOW_MS) {
                bonusXp += EARLY_SUBMISSION_BONUS;
                reasons.push(`+${EARLY_SUBMISSION_BONUS} XP early-bird bonus`);
            }
        }

        let updatedUserStats = null;
        if (bonusXp > 0) {
            try {
                const stats = await applyXpAndStreak(req.user._id, bonusXp, req.app.get('io'));
                await UserTask.updateOne(
                    { _id: userTask._id },
                    { $inc: { xpEarned: bonusXp } }
                );
                updatedUserStats = { xp: stats.xp, level: stats.level, streak: stats.streak };
            } catch (xpErr) {
                console.error('⚠ Failed to award submission bonus XP:', xpErr);
            }
        }

        // Badge evaluation (e.g. early_bird): never blocks the response.
        try {
            await checkAndAwardBadges(req.user._id, { trigger: 'submission', taskId }, req.app.get('io'));
        } catch (badgeErr) {
            console.error('⚠ Badge check failed after submission:', badgeErr);
        }

        // Admin fanout — new pending row appears live in every open admin tab.
        await fanoutAdminSubmission(req.app.get('io'), userTask);

        res.json({
            success: true,
            message: 'Submission received — pending admin review.',
            userTask,
            xpAwarded: bonusXp,
            xpReasons: reasons,
            newUser: updatedUserStats
        });
    } catch (error) {
        console.error('❌ Error submitting project ZIP:', error);
        res.status(500).json({ success: false, message: 'Server error submitting project' });
    }
};

// Submit text/URL proof for admin review — used by Resume & Interview tracks
// instead of submitProjectZip (no file, no multer). Mirrors that flow exactly:
// upsert UserTask with reviewStatus='pending', award first-submission XP bonus,
// then surface in the same admin queue.
export const submitProofText = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { submissionText, submissionUrl } = req.body || {};

        const text = typeof submissionText === 'string' ? submissionText.trim() : '';
        if (text.length < 50 || text.length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Submission must be between 50 and 2000 characters.'
            });
        }
        const url = typeof submissionUrl === 'string' ? submissionUrl.trim() : '';
        if (url) {
            try { new URL(url); }
            catch { return res.status(400).json({ success: false, message: 'Provide a valid URL or leave it blank.' }); }
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        if (task.track !== 'Resume' && task.track !== 'Interview') {
            return res.status(400).json({
                success: false,
                message: 'This endpoint only accepts Resume and Interview submissions.'
            });
        }

        if (task.generatedFor && String(task.generatedFor) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'This quest does not belong to you.' });
        }

        const submittedAt = new Date();
        const userTask = await UserTask.findOneAndUpdate(
            { user: req.user._id, task: taskId },
            {
                $set: {
                    submissionText: text,
                    submissionUrl: url,
                    reviewStatus: 'pending',
                    adminFeedback: '',
                    submittedAt
                },
                $inc: { submitCount: 1 },
                $setOnInsert: { user: req.user._id, task: taskId, status: 'pending' }
            },
            { upsert: true, new: true }
        );

        let bonusXp = 0;
        const reasons = [];
        if (userTask.submitCount === 1) {
            bonusXp += SUBMIT_XP_BONUS;
            reasons.push(`+${SUBMIT_XP_BONUS} XP for submitting`);
            const dueDate = task.dueDate ? new Date(task.dueDate) : null;
            if (dueDate && (dueDate.getTime() - submittedAt.getTime()) >= EARLY_SUBMISSION_WINDOW_MS) {
                bonusXp += EARLY_SUBMISSION_BONUS;
                reasons.push(`+${EARLY_SUBMISSION_BONUS} XP early-bird bonus`);
            }
        }

        let updatedUserStats = null;
        if (bonusXp > 0) {
            try {
                const stats = await applyXpAndStreak(req.user._id, bonusXp, req.app.get('io'));
                await UserTask.updateOne({ _id: userTask._id }, { $inc: { xpEarned: bonusXp } });
                updatedUserStats = { xp: stats.xp, level: stats.level, streak: stats.streak };
            } catch (xpErr) {
                console.error('⚠ Failed to award submission bonus XP:', xpErr);
            }
        }

        try {
            await checkAndAwardBadges(req.user._id, { trigger: 'submission', taskId }, req.app.get('io'));
        } catch (badgeErr) {
            console.error('⚠ Badge check failed after submission:', badgeErr);
        }

        // Admin fanout — new pending row appears live in every open admin tab.
        await fanoutAdminSubmission(req.app.get('io'), userTask);

        res.json({
            success: true,
            message: 'Submission received — pending admin review.',
            userTask,
            xpAwarded: bonusXp,
            xpReasons: reasons,
            newUser: updatedUserStats
        });
    } catch (error) {
        console.error('❌ Error submitting proof text:', error);
        res.status(500).json({ success: false, message: 'Server error submitting proof' });
    }
};

// Get interview prep resources (PDFs uploaded by admins) for learners
export const getInterviewResources = async (req, res) => {
    try {
        const resources = await InterviewResource.find().sort({ createdAt: -1 });
        res.json({ success: true, resources });
    } catch (error) {
        console.error('❌ Error fetching interview resources:', error);
        res.status(500).json({ success: false, message: 'Server error fetching resources' });
    }
};

// Get DM history with a specific connection partner
export const getDirectMessages = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const userId = req.user._id;

        const connection = await MentorRequest.findOne({
            $or: [
                { sender: userId, receiver: partnerId },
                { sender: partnerId, receiver: userId }
            ],
            status: 'accepted'
        });
        if (!connection) {
            return res.status(403).json({ success: false, message: 'No active mentorship with this user' });
        }

        const messages = await DirectMessage.find({
            $or: [
                { sender: userId, receiver: partnerId },
                { sender: partnerId, receiver: userId }
            ]
        })
            .sort({ createdAt: 1 })
            .limit(200);

        res.json({ success: true, messages });
    } catch (error) {
        console.error('❌ Error fetching direct messages:', error);
        res.status(500).json({ success: false, message: 'Server error fetching messages' });
    }
};

// Catalog of every badge (id, name, description, icon, tone). Public to any
// authenticated user — frontend uses this to render locked badges.
export const getBadgeCatalog = async (req, res) => {
    res.json({ success: true, badges: Object.values(BADGES) });
};

// @desc    7-day rolling activity for the current learner
// @route   GET /api/gamification/analytics/me
export const getMyWeeklyAnalytics = async (req, res) => {
    try {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        // One pipeline does both groupings: per-day completion count and the
        // matching XP sum (joined to Task to read xpReward).
        const grouped = await UserTask.aggregate([
            {
                $match: {
                    user: req.user._id,
                    status: 'completed',
                    completedAt: { $gte: weekStart }
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
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
                    completions: { $sum: 1 },
                    xp: { $sum: '$taskDoc.xpReward' }
                }
            }
        ]);

        const byDay = new Map(grouped.map((g) => [g._id, g]));
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const ymd = d.toISOString().slice(0, 10);
            const e = byDay.get(ymd);
            days.push({
                date: d.toISOString(),
                ymd,
                label: d.toLocaleDateString(undefined, { weekday: 'short' }),
                completions: e?.completions || 0,
                xp: e?.xp || 0
            });
        }

        const totals = days.reduce((acc, d) => ({
            completions: acc.completions + d.completions,
            xp: acc.xp + d.xp
        }), { completions: 0, xp: 0 });

        res.json({ success: true, days, totals });
    } catch (error) {
        console.error('❌ Error fetching learner weekly analytics:', error);
        res.status(500).json({ success: false, message: 'Server error fetching analytics' });
    }
};

// Progression snapshot for the current user: XP/level/streak (already on the
// User doc), plus derived tier info and the earned-badges list cross-joined
// with the catalog. One call drives the Profile tier card + badge shelf.
export const getMyProgression = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('xp level streak badges createdAt');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const tier = getTier(user.xp || 0);
        const earnedSet = new Set(user.badges || []);
        const badges = Object.values(BADGES).map((b) => ({ ...b, earned: earnedSet.has(b.id) }));

        res.json({
            success: true,
            xp: user.xp || 0,
            level: user.level || 1,
            streak: user.streak || 0,
            tier,
            badges
        });
    } catch (error) {
        console.error('❌ Error fetching progression:', error);
        res.status(500).json({ success: false, message: 'Server error fetching progression' });
    }
};
