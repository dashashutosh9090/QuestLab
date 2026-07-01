import dns from 'dns';
// Force Google DNS to resolve MongoDB Atlas SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import gamificationRoutes from './src/routes/gamificationRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import User from './src/models/User.js';
import Admin from './src/models/Admin.js';
import MentorRequest from './src/models/MentorRequest.js';
import DirectMessage from './src/models/DirectMessage.js';
import RoomMessage from './src/models/RoomMessage.js';
import { roomAccessGate } from './src/controllers/gamificationController.js';

dotenv.config();

// Check required environment variables
if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in .env file');
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET is not defined in .env file');
    process.exit(1);
}

// Connect to MongoDB
try {
    await connectDB();
    console.log('✅ MongoDB Connected successfully');
} catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
}

const app = express();
const server = createServer(app);

// Security: set standard HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true
    }
});

// Notification fan-out: server-to-client wire event is `receive_notification`,
// scoped to the `user:<id>` private room joined on connect (see io.on('connection')
// below). Controllers reach this via `req.app.get('io').send_notification(...)`.
io.send_notification = (userId, payload) => {
    if (!userId) return;
    io.to(`user:${userId}`).emit('receive_notification', payload);
};

// Make the io instance available to HTTP controllers (e.g. for cross-channel
// emits from REST endpoints into a learner's socket room).
app.set('io', io);

app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Whitelist of allowed study room IDs (must match frontend StudyRooms list).
const STUDY_ROOMS = new Set(['basics', 'dsa', 'project', 'resume', 'interview']);

// Deterministic DM room name independent of who initiates.
const dmRoomName = (a, b) => `dm:${[String(a), String(b)].sort().join(':')}`;

const hasMentorshipBetween = async (userIdA, userIdB) => {
    const connection = await MentorRequest.findOne({
        $or: [
            { sender: userIdA, receiver: userIdB },
            { sender: userIdB, receiver: userIdA }
        ],
        status: 'accepted'
    });
    return !!connection;
};

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error('Auth token required'));
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Role is derived from which collection holds the id — never trusted
        // from `decoded.role`. Mirrors authMiddleware.protect so HTTP and
        // socket paths agree.
        let account = await Admin.findById(decoded.id).select('name avatar');
        let role = 'admin';
        if (!account) {
            account = await User.findById(decoded.id).select('name avatar unlockAllTracks');
            role = 'user';
        }
        if (!account) return next(new Error('Account not found'));

        socket.userId = String(decoded.id);
        socket.userRole = role;
        socket.userName = account.name || 'User';
        socket.userAvatar = account.avatar || null;
        socket.unlockAllTracks = !!account.unlockAllTracks;
        next();
    } catch (err) {
        console.error('Socket auth failed:', err.message);
        next(new Error('Invalid auth token'));
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.userName} (${socket.id})`);
    // Personal channel for cross-page notifications (DM badges, etc.)
    socket.join(`user:${socket.userId}`);
    // Shared admin channel — used by comment-thread fanout so any open admin
    // dashboard or review drawer hears new comments without polling.
    if (socket.userRole === 'admin') socket.join('admins');

    socket.on('join_room', async (room) => {
        if (typeof room !== 'string' || !STUDY_ROOMS.has(room)) {
            socket.emit('room_error', { message: 'Invalid room' });
            return;
        }
        try {
            const gate = await roomAccessGate(socket.userId, room, socket.unlockAllTracks);
            if (!gate.allowed) {
                socket.emit('room_error', { message: gate.reason || 'Room locked' });
                return;
            }
        } catch (err) {
            console.error('join_room gate error:', err);
            socket.emit('room_error', { message: 'Could not verify room access' });
            return;
        }
        const currentRooms = Array.from(socket.rooms);
        currentRooms.forEach((r) => { if (r !== socket.id && STUDY_ROOMS.has(r)) socket.leave(r); });
        socket.join(room);
        console.log(`👥 ${socket.userName} joined room "${room}"`);
    });

    socket.on('leave_room', (room) => {
        if (typeof room !== 'string' || !STUDY_ROOMS.has(room)) return;
        if (socket.rooms.has(room)) {
            socket.leave(room);
            console.log(`👋 ${socket.userName} left room "${room}"`);
        }
    });

    socket.on('send_message', async (data) => {
        try {
            if (!data || typeof data.room !== 'string' || typeof data.text !== 'string') return;
            if (!STUDY_ROOMS.has(data.room)) {
                socket.emit('room_error', { message: 'Invalid room' });
                return;
            }
            if (!socket.rooms.has(data.room)) {
                socket.emit('room_error', { message: 'Join the room before sending messages' });
                return;
            }
            const trimmed = data.text.trim();
            if (!trimmed) return;

            const created = await RoomMessage.create({
                room: data.room,
                sender: socket.userId,
                text: trimmed.slice(0, 1000)
            });
            const populated = await created.populate('sender', 'name avatar');

            const payload = {
                _id: populated._id,
                room: populated.room,
                userId: populated.sender ? String(populated.sender._id) : socket.userId,
                author: populated.sender?.name || socket.userName,
                senderAvatar: populated.sender?.avatar || null,
                text: populated.text,
                time: new Date(populated.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: populated.createdAt
            };
            io.to(data.room).emit('receive_message', payload);
        } catch (err) {
            console.error('send_message error:', err);
            socket.emit('room_error', { message: 'Could not send message' });
        }
    });

    socket.on('join_dm', async (partnerId) => {
        try {
            if (typeof partnerId !== 'string' || !partnerId) {
                socket.emit('dm_error', { message: 'Invalid partner' });
                return;
            }
            if (partnerId === socket.userId) {
                socket.emit('dm_error', { message: 'Cannot DM yourself' });
                return;
            }
            const allowed = await hasMentorshipBetween(socket.userId, partnerId);
            if (!allowed) {
                socket.emit('dm_error', { message: 'No active mentorship with this user' });
                return;
            }
            const room = dmRoomName(socket.userId, partnerId);
            Array.from(socket.rooms).forEach((r) => {
                if (r !== socket.id && r.startsWith('dm:') && r !== room) socket.leave(r);
            });
            socket.join(room);
            console.log(`💬 ${socket.userName} joined DM ${room}`);
        } catch (err) {
            console.error('join_dm error:', err);
            socket.emit('dm_error', { message: 'Could not join chat' });
        }
    });

    socket.on('send_dm', async (data) => {
        try {
            if (!data || typeof data.partnerId !== 'string' || typeof data.text !== 'string') return;
            const trimmed = data.text.trim();
            if (!trimmed) return;
            const allowed = await hasMentorshipBetween(socket.userId, data.partnerId);
            if (!allowed) {
                socket.emit('dm_error', { message: 'No active mentorship' });
                return;
            }
            const dm = await DirectMessage.create({
                sender: socket.userId,
                receiver: data.partnerId,
                text: trimmed.slice(0, 1000)
            });
            const payload = {
                _id: dm._id,
                sender: socket.userId,
                senderName: socket.userName,
                receiver: data.partnerId,
                text: dm.text,
                createdAt: dm.createdAt
            };
            const room = dmRoomName(socket.userId, data.partnerId);
            io.to(room).emit('receive_dm', payload);
            // Also notify the receiver's personal room so their unread badge updates
            // even if they don't currently have this DM room open.
            io.to(`user:${data.partnerId}`).emit('dm_notification', {
                from: socket.userId,
                fromName: socket.userName,
                preview: dm.text.slice(0, 80)
            });
        } catch (err) {
            console.error('send_dm error:', err);
            socket.emit('dm_error', { message: 'Could not send message' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.userName} (${socket.id})`);
    });
});

// Routes
// Rate-limit auth endpoints to prevent brute-force attacks
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,                  // limit each IP to 50 requests per window
    standardHeaders: true,    // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
    message: { success: false, message: 'Too many requests, please try again after 15 minutes' }
});
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => res.json({ message: 'Backend API is running!' }));

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
});