import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            if (!token) throw new Error("No token extracted");
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Role is derived from which collection holds the id, NOT from
            // `decoded.role`. This prevents a forged token (with a stolen
            // JWT_SECRET and a guessed admin _id) from being trusted as admin
            // just because the token's role claim says so.
            let user = await Admin.findById(decoded.id).select('-password');
            let role = 'admin';
            if (!user) {
                user = await User.findById(decoded.id).select('-password');
                role = 'user';
            }

            if (!user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            user.role = role;
            req.user = user;
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Not authorized as an admin' });
    }
};

export const generateToken = (id, role = 'user') => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};