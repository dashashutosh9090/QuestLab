import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    xpReward: {
        type: Number,
        required: true,
        default: 50
    },
    levelRequired: {
        type: Number,
        default: 1
    },
    track: {
        type: String,
        enum: ['Basics', 'DSA', 'Project', 'Resume', 'Interview'],
        required: true
    },
    isCore: {
        type: Boolean,
        default: false // Core tasks are predefined, non-core are AI generated
    },
    isCodingChallenge: {
        type: Boolean,
        default: false
    },
    testCases: [
        {
            input: String,
            expectedOutput: String
        }
    ],
    generatedFor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Null if it's a global task, set if uniquely generated for a user
    },
    courseName: {
        type: String,
        default: '',
        trim: true
    },
    dueDate: {
        type: Date,
        default: null
    },
    totalMarks: {
        type: Number,
        default: 100,
        min: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    },
    category: {
        type: String,
        enum: ['Basic', 'DSA', 'Project', 'Resume', 'Interview', null],
        default: null
    },
    topic: {
        // Validated against TOPIC_CATALOG in the controller rather than via an
        // enum so adding a new topic doesn't require a schema migration.
        type: String,
        default: null,
        trim: true
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard', null],
        default: null
    }
}, {
    timestamps: true
});

taskSchema.index({ isCore: 1, track: 1, category: 1, topic: 1, difficulty: 1 });

const Task = mongoose.model('Task', taskSchema);
export default Task;
