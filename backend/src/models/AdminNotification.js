import mongoose from 'mongoose';

// Shared admin-team notification feed. Unlike user-scoped `Notification` rows,
// these have no recipient — every admin sees the same list, and `isRead` is
// a team-wide flag. That trade-off keeps v1 simple; per-admin read state can
// be layered on later via a `readBy` set if multi-admin coordination is needed.
const adminNotificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['submission', 'user_signup', 'task_completion', 'badge_unlock', 'system'],
        required: true
    },
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

adminNotificationSchema.index({ isRead: 1, createdAt: -1 });

const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);
export default AdminNotification;
