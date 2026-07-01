import AdminNotification from '../models/AdminNotification.js';

// Admin notifications are a shared, team-wide feed — there's no per-recipient
// gate because every admin sees the same list. The route layer enforces the
// admin role via `protect, admin` middleware.

// @desc    List recent admin notifications + unread count.
// @route   GET /api/admin/notifications
export const getAdminNotifications = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const [notifications, unreadCount] = await Promise.all([
            AdminNotification.find().sort({ createdAt: -1 }).limit(limit),
            AdminNotification.countDocuments({ isRead: false })
        ]);
        res.json({ success: true, notifications, unreadCount });
    } catch (error) {
        console.error('❌ Error fetching admin notifications:', error);
        res.status(500).json({ success: false, message: 'Server error fetching admin notifications' });
    }
};

// @desc    Mark a single admin notification as read.
// @route   PATCH /api/admin/notifications/:id/read
export const markAdminNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await AdminNotification.updateOne(
            { _id: id },
            { $set: { isRead: true } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error marking admin notification read:', error);
        res.status(500).json({ success: false, message: 'Server error updating notification' });
    }
};

// @desc    Mark every unread admin notification as read.
// @route   POST /api/admin/notifications/read-all
export const markAllAdminNotificationsRead = async (req, res) => {
    try {
        const result = await AdminNotification.updateMany(
            { isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ success: true, modified: result.modifiedCount || 0 });
    } catch (error) {
        console.error('❌ Error marking all admin notifications read:', error);
        res.status(500).json({ success: false, message: 'Server error updating notifications' });
    }
};
