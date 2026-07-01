import express from 'express';
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Every notification action requires an authenticated user — the controller
// scopes all queries to req.user._id.
router.use(protect);

router.get('/', getNotifications);
router.post('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);

export default router;
