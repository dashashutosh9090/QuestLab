import Comment from '../models/Comment.js';
import UserTask from '../models/UserTask.js';

// Single-source-of-truth gate: a learner can read/write comments on their own
// UserTask; any admin can on any UserTask. Used by both endpoints.
const canAccess = (req, userTask) => {
    if (req.user?.role === 'admin') return true;
    return String(userTask.user) === String(req.user._id);
};

// Fan a new comment out to interested sockets.
//   - Learner side (room `user:<learnerId>`) — always.
//   - Every admin (room `admins`)            — always.
// Both sides receive their own comments back too. The frontend dedupes by
// _id so the optimistic post merges cleanly.
const fanoutComment = (io, userTask, comment) => {
    if (!io) return;
    try {
        const payload = { userTask: String(userTask._id), comment };
        io.to(`user:${userTask.user}`).emit('receive_comment', payload);
        io.to('admins').emit('receive_comment', payload);
    } catch (err) {
        console.error('⚠ Failed to emit receive_comment:', err);
    }
};

// @desc    List the comment thread for a single submission.
// @route   GET /api/gamification/submissions/:userTaskId/comments
export const listComments = async (req, res) => {
    try {
        const { userTaskId } = req.params;
        const userTask = await UserTask.findById(userTaskId).select('user');
        if (!userTask) {
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }
        if (!canAccess(req, userTask)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        const comments = await Comment.find({ userTask: userTaskId }).sort({ createdAt: 1 });
        res.json({ success: true, comments });
    } catch (error) {
        console.error('❌ Error listing comments:', error);
        res.status(500).json({ success: false, message: 'Server error fetching comments' });
    }
};

// @desc    Post a new comment to a submission thread.
// @route   POST /api/gamification/submissions/:userTaskId/comments
export const addComment = async (req, res) => {
    try {
        const { userTaskId } = req.params;
        const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

        if (!body) {
            return res.status(400).json({ success: false, message: 'Comment body is required' });
        }
        if (body.length > 5000) {
            return res.status(400).json({ success: false, message: 'Comment must be 5000 characters or less' });
        }

        const userTask = await UserTask.findById(userTaskId).select('user');
        if (!userTask) {
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }
        if (!canAccess(req, userTask)) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const role = req.user?.role === 'admin' ? 'admin' : 'user';
        const comment = await Comment.create({
            userTask: userTaskId,
            authorId: req.user._id,
            authorName: req.user.name || (role === 'admin' ? 'Admin' : 'Learner'),
            authorRole: role,
            authorAvatar: req.user.avatar || null,
            body
        });

        fanoutComment(req.app.get('io'), userTask, comment.toObject());

        res.status(201).json({ success: true, comment });
    } catch (error) {
        console.error('❌ Error adding comment:', error);
        res.status(500).json({ success: false, message: 'Server error posting comment' });
    }
};
