import express from 'express';
import {
    getTasks,
    generateAIQuests,
    completeTask,
    getLeaderboard,
    getMentors,
    sendMentorRequest,
    getRoadmap,
    getReceivedMentorRequests,
    respondToMentorRequest,
    getConnections,
    getDirectMessages,
    removeConnection,
    markDirectMessagesRead,
    getRoomMessages,
    getInterviewResources,
    submitProjectZip,
    submitProofText,
    getBadgeCatalog,
    getMyProgression,
    getMyWeeklyAnalytics
} from '../controllers/gamificationController.js';
import { submitCode } from '../controllers/codeExecutionController.js';
import { listComments, addComment } from '../controllers/commentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { aiGenerationLimiter, codeSubmitLimiter } from '../middleware/rateLimiter.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/tasks', getTasks);
router.post('/tasks/generate', aiGenerationLimiter, generateAIQuests);
router.post('/tasks/:id/complete', completeTask);
router.post('/tasks/:id/submit-code', codeSubmitLimiter, submitCode);
router.post('/tasks/:taskId/submit-project', upload.single('file'), submitProjectZip);
router.post('/tasks/:taskId/submit-proof', submitProofText);

router.get('/leaderboard', getLeaderboard);
router.get('/roadmap', getRoadmap);

// Mentorship
router.get('/mentors', getMentors);
router.post('/mentors/request', sendMentorRequest);
router.get('/mentor-requests', getReceivedMentorRequests);
router.patch('/mentor-requests/:id', respondToMentorRequest);
router.get('/connections', getConnections);
router.delete('/connections/:id', removeConnection);
router.get('/dm/:partnerId', getDirectMessages);
router.post('/dm/:partnerId/read', markDirectMessagesRead);

// Study rooms
router.get('/rooms/:room/messages', getRoomMessages);

// Interview prep PDF resources (learner-facing list)
router.get('/resources', getInterviewResources);

// Gamification progression (tier + earned badges) and badge catalog
router.get('/badges', getBadgeCatalog);
router.get('/progression', getMyProgression);

// 7-day learner activity rollup (completions + XP per day)
router.get('/analytics/me', getMyWeeklyAnalytics);

// Submission comment threads (learner + admin can read/write the thread on
// any UserTask the learner owns).
router.get('/submissions/:userTaskId/comments', listComments);
router.post('/submissions/:userTaskId/comments', addComment);

export default router;
