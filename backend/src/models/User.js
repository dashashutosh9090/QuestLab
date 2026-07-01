import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    level: {
        type: Number,
        default: 1
    },
    xp: {
        type: Number,
        default: 0
    },
    streak: {
        type: Number,
        default: 0
    },
    lastActiveAt: {
        type: Date,
        default: null
    },
    avatar: {
        type: String,
        default: null
    },
    bio: {
        type: String,
        default: ''
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // Only required for Google users
    },
    unlockAllTracks: {
        type: Boolean,
        default: false
    },
    badges: {
        type: [String],
        default: []
    },
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpire: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Hash password before saving - CORRECTED VERSION
userSchema.pre('save', async function () {
    try {
        // Only hash if password is modified or new
        if (!this.isModified('password')) {
            return;
        }

        console.log('🔐 Hashing password for user:', this.email);

        // Generate salt and hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(this.password, salt);

        // Replace plain password with hashed password
        this.password = hashedPassword;

        console.log('✅ Password hashed successfully');
    } catch (error) {
        console.error('❌ Error hashing password:', error);
        throw error;
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('❌ Error comparing password:', error);
        return false;
    }
};

const User = mongoose.model('User', userSchema);
export default User;