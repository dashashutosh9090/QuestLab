import AdminNotification from '../models/AdminNotification.js';

// Centralised admin fanout: write a shared AdminNotification row and emit
// `admin:notification` to the `admins` socket room (joined in
// io.on('connection') in backend/index.js). Mirrors how
// commentController.fanoutComment broadcasts — never throws so callers don't
// need defensive try/catch around every site.
export const adminNotify = async (io, { title, message = '', type, meta = {} } = {}) => {
    if (!title || !type) return null;
    let row = null;
    try {
        row = await AdminNotification.create({ title, message, type, meta });
    } catch (err) {
        console.error('⚠ adminNotify: failed to persist row:', err);
    }
    try {
        if (io && row) {
            io.to('admins').emit('admin:notification', {
                _id: row._id.toString(),
                title: row.title,
                message: row.message,
                type: row.type,
                meta: row.meta || {},
                isRead: false,
                createdAt: row.createdAt.toISOString()
            });
        } else if (io && !row) {
            // Persistence failed but we still want the live signal.
            io.to('admins').emit('admin:notification', {
                _id: `live-${Date.now()}`,
                title,
                message,
                type,
                meta,
                isRead: false,
                createdAt: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('⚠ adminNotify: failed to emit:', err);
    }
    return row;
};

export default adminNotify;
