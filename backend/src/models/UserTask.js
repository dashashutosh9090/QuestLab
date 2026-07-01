import mongoose from 'mongoose';

const userTaskSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    },
    completedAt: {
        type: Date
    },
    code: {
        type: String,
        default: ''
    },
    language: {
        type: String,
        default: ''
    },
    submissionUrl: {
        type: String
    },
    githubLink: {
        type: String,
        default: ''
    },
    submissionText: {
        type: String,
        default: '',
        maxlength: 2000
    },
    reviewStatus: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected', 'revision'],
        default: 'none'
    },
    adminFeedback: {
        type: String
    },
    submittedAt: {
        type: Date,
        default: null
    },
    submitCount: {
        type: Number,
        default: 0,
        min: 0
    },
    marksObtained: {
        type: Number,
        default: 0,
        min: 0
    },
    xpEarned: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

// A user can only have one instance of a specific task
userTaskSchema.index({ user: 1, task: 1 }, { unique: true });

const UserTask = mongoose.model('UserTask', userTaskSchema);
export default UserTask;
