import Notification from '../models/Notification.js';

// @desc    List the current user's notifications, newest first, plus unread count.
// @route   GET /api/notifications
export const getNotifications = async (req, res) => {
    try {
        // Cap at 50 newest entries — the bell dropdown only shows recent ones,
        // and an unbounded list would be expensive for power users.
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ user: req.user._id })
                .sort({ createdAt: -1 })
                .limit(limit),
            Notification.countDocuments({ user: req.user._id, isRead: false })
        ]);

        res.json({ success: true, notifications, unreadCount });
    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Server error fetching notifications' });
    }
};

// @desc    Mark a single notification as read.
// @route   PATCH /api/notifications/:id/read
export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        // updateOne with the user gate ensures one user can't mark another's
        // notifications as read by guessing IDs.
        const result = await Notification.updateOne(
            { _id: id, user: req.user._id },
            { $set: { isRead: true } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error marking notification read:', error);
        res.status(500).json({ success: false, message: 'Server error updating notification' });
    }
};

// @desc    Mark every unread notification for the current user as read.
// @route   POST /api/notifications/read-all
export const markAllNotificationsRead = async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { user: req.user._id, isRead: false },
            { $set: { isRead: true } }
        );

        res.json({ success: true, modified: result.modifiedCount || 0 });
    } catch (error) {
        console.error('❌ Error marking all notifications read:', error);
        res.status(500).json({ success: false, message: 'Server error updating notifications' });
    }
};
