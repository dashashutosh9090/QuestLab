import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema({
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
    }
}, {
    timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function () {
    try {
        // Only hash if password is modified or new
        if (!this.isModified('password')) {
            return;
        }

        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        console.error('❌ Error hashing admin password:', error);
        throw error;
    }
});

// Compare password method
adminSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('❌ Error comparing admin password:', error);
        return false;
    }
};

const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
