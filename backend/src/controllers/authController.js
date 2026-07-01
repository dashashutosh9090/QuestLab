import crypto from 'crypto';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import { generateToken } from '../middleware/authMiddleware.js';
import { OAuth2Client } from 'google-auth-library';
import sendEmail from '../utils/sendEmail.js';
import { adminNotify } from '../utils/adminNotify.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const registerUser = async (req, res) => {
    try {
        const { name, email, password, role, adminKey } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const userExists = await User.findOne({ email });
        const adminExists = await Admin.findOne({ email });

        if (userExists || adminExists) {
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }

        // Admin registration requires the server-side ADMIN_SIGNUP_KEY.
        // Without a matching key, fall back to a regular user account.
        let assignedRole = 'user';
        if (role === 'admin') {
            if (!process.env.ADMIN_SIGNUP_KEY || adminKey !== process.env.ADMIN_SIGNUP_KEY) {
                return res.status(403).json({ success: false, message: 'Invalid admin signup key' });
            }
            assignedRole = 'admin';
        }

        let user;
        if (assignedRole === 'admin') {
            user = await Admin.create({ name, email, password });
        } else {
            user = await User.create({ name, email, password });
        }

        if (user) {
            // Notify admin team about new learner signups only — admin-creates-admin
            // is gated by ADMIN_SIGNUP_KEY and shouldn't surface as a "new learner".
            if (assignedRole === 'user') {
                await adminNotify(req.app.get('io'), {
                    title: 'New learner joined',
                    message: `${user.name} (${user.email}) signed up`,
                    type: 'user_signup',
                    meta: { userId: String(user._id), userName: user.name, email: user.email }
                });
            }

            res.status(201).json({
                success: true,
                message: '🎉 Registration successful! Welcome!',
                token: generateToken(user._id, assignedRole),
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: assignedRole,
                    bio: user.bio,
                    avatar: user.avatar,
                    ...(assignedRole === 'user' && { level: user.level, xp: user.xp, streak: user.streak })
                }
            });
        }
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        // The welcome screen owns the role tab; default to 'user' if a stale
        // client omits the field so an admin can never sneak in via a stripped
        // request body.
        const requestedRole = role === 'admin' ? 'admin' : 'user';
        const primaryModel = requestedRole === 'admin' ? Admin : User;
        const otherModel = requestedRole === 'admin' ? User : Admin;

        let user = await primaryModel.findOne({ email });

        if (!user) {
            // If the email lives in the OTHER collection, point the user at the
            // right tab instead of leaving them stuck on a generic 401.
            const otherAccount = await otherModel.findOne({ email }).select('_id');
            if (otherAccount) {
                return res.status(403).json({
                    success: false,
                    message: requestedRole === 'admin'
                        ? 'This account is a Learner. Switch to the Learner tab to sign in.'
                        : 'This account is an Admin. Switch to the Admin tab to sign in.'
                });
            }
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Block password login for Google-linked accounts. Google sign-up creates
        // a low-entropy random password the user never set; allowing it as a
        // valid credential would turn it into a brute-force surface.
        if (user.googleId) {
            return res.status(400).json({
                success: false,
                message: 'This account uses Google sign-in. Please log in with Google.'
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        res.json({
            success: true,
            message: '🎮 Login successful!',
            token: generateToken(user._id, requestedRole),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: requestedRole,
                bio: user.bio,
                avatar: user.avatar,
                ...(requestedRole === 'user' && { level: user.level, xp: user.xp, streak: user.streak })
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
    }
};

export const getUserProfile = async (req, res) => {
    try {
        const userObj = { ...req.user.toObject(), role: req.user.role };
        delete userObj.password;
        
        res.json({ success: true, user: userObj });
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const { name, bio, avatar } = req.body;
        const role = req.user.role;
        const userId = req.user._id;

        let user;
        if (role === 'admin') {
            user = await Admin.findById(userId);
        } else {
            user = await User.findById(userId);
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
                return res.status(400).json({ success: false, message: 'Name must be 1-60 characters' });
            }
            user.name = name.trim();
        }
        if (bio !== undefined) {
            if (typeof bio !== 'string' || bio.length > 500) {
                return res.status(400).json({ success: false, message: 'Bio must be 500 characters or less' });
            }
            user.bio = bio;
        }

        if (req.file) {
            const fileUrl = req.file.path;
            user.avatar = fileUrl;
        } else if (avatar !== undefined) {
            user.avatar = avatar;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: role,
                bio: user.bio,
                avatar: user.avatar,
                ...(role === 'user' && { level: user.level, xp: user.xp, streak: user.streak })
            }
        });

    } catch (error) {
        console.error('❌ Profile update error:', error);
        res.status(500).json({ success: false, message: 'Server error during profile update' });
    }
};

export const googleLogin = async (req, res) => {
    try {
        const { idToken, role } = req.body;
        if (!idToken) return res.status(400).json({ success: false, message: 'Google ID Token is required' });

        const ticket = await client.verifyIdToken({ idToken: idToken, audience: process.env.GOOGLE_CLIENT_ID });
        const { name, email, sub: googleId, picture } = ticket.getPayload();

        // Same tab-gating logic as loginUser: only look in the collection that
        // matches the requested role, point users at the other tab when their
        // account lives there.
        const requestedRole = role === 'admin' ? 'admin' : 'user';
        const primaryModel = requestedRole === 'admin' ? Admin : User;
        const otherModel = requestedRole === 'admin' ? User : Admin;
        const assignedRole = requestedRole;

        let user = await primaryModel.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            const otherAccount = await otherModel.findOne({ $or: [{ googleId }, { email }] }).select('_id');
            if (otherAccount) {
                return res.status(403).json({
                    success: false,
                    message: requestedRole === 'admin'
                        ? 'This Google account is a Learner. Switch to the Learner tab to sign in.'
                        : 'This Google account is an Admin. Switch to the Admin tab to sign in.'
                });
            }

            if (requestedRole === 'admin') {
                // No silent admin creation via Google — admins must go through
                // /register with ADMIN_SIGNUP_KEY.
                return res.status(403).json({
                    success: false,
                    message: 'No admin account is linked to this Google identity. Contact a site owner.'
                });
            }

            // Learner auto-create (existing behavior).
            const pwd = Math.random().toString(36).slice(-10);
            user = await User.create({ name, email, googleId, avatar: picture, password: pwd });

            await adminNotify(req.app.get('io'), {
                title: 'New learner joined',
                message: `${user.name} (${user.email}) signed up via Google`,
                type: 'user_signup',
                meta: { userId: String(user._id), userName: user.name, email: user.email, provider: 'google' }
            });
        } else if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }

        res.json({
            success: true,
            message: '🎉 Google login successful!',
            token: generateToken(user._id, assignedRole),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: assignedRole,
                bio: user.bio,
                avatar: user.avatar,
                ...(assignedRole === 'user' && { level: user.level, xp: user.xp, streak: user.streak })
            }
        });
    } catch (error) {
        console.error('❌ Google Auth Error:', error);
        res.status(500).json({ success: false, message: 'Google authentication failed', error: error.message });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide an email address' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with that email' });
        }

        // Generate a 20-byte hex token and hash it for secure DB storage
        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
        await user.save();

        // Send the UNHASHED token in the email so the user can present it back
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        const message = `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your QuestLab account.</p>
            <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
            <p style="margin-top:16px;color:#666;">If you didn't request this, you can safely ignore this email.</p>
        `;

        await sendEmail({ email: user.email, subject: 'QuestLab — Password Reset', message });

        res.json({ success: true, message: 'Password reset email sent' });
    } catch (error) {
        console.error('❌ Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again later.' });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        // Hash the token from the URL to match against the stored hash
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.json({ success: true, message: 'Password reset successful. You can now log in with your new password.' });
    } catch (error) {
        console.error('❌ Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error during password reset' });
    }
};
