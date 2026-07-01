import express from 'express';
import {
    createCoreTask,
    deleteCoreTask,
    getCoreTasks,
    uploadInterviewResource,
    getInterviewResources,
    deleteInterviewResource,
    getProjectSubmissions,
    reviewProjectSubmission,
    getDashboardStats,
    getAdminWeeklyAnalytics,
    getAiInsights
} from '../controllers/adminController.js';
import {
    getAdminNotifications,
    markAdminNotificationRead,
    markAllAdminNotificationsRead
} from '../controllers/adminNotificationController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Admin prefix: /api/admin
router.route('/tasks')
    .post(protect, admin, createCoreTask)
    .get(protect, admin, getCoreTasks);

router.route('/tasks/:id')
    .delete(protect, admin, deleteCoreTask);

// Interview prep PDF resources
router.post('/resources', protect, admin, upload.single('file'), uploadInterviewResource);
router.get('/resources', protect, admin, getInterviewResources);
router.delete('/resources/:id', protect, admin, deleteInterviewResource);

// Project submissions (admin review queue)
router.get('/submissions', protect, admin, getProjectSubmissions);
router.post('/submissions/:id/review', protect, admin, reviewProjectSubmission);

// Aggregated dashboard counters
router.get('/stats', protect, admin, getDashboardStats);

// Weekly activity rollup for the admin charts
router.get('/analytics/weekly', protect, admin, getAdminWeeklyAnalytics);

// Computed AI-style insights for the dashboard banner
router.get('/insights', protect, admin, getAiInsights);

// Shared admin notification feed (real-time bell for the admin team)
router.get('/notifications', protect, admin, getAdminNotifications);
router.post('/notifications/read-all', protect, admin, markAllAdminNotificationsRead);
router.patch('/notifications/:id/read', protect, admin, markAdminNotificationRead);

export default router;
