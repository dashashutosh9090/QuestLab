import mongoose from 'mongoose';

// Comments live on a single UserTask (a submission thread). Author fields
// are denormalized — the project has both a `User` and an `Admin` collection,
// and a single `ref` can't span both, so we capture name/role/avatar at write
// time and read them straight back without populate.
const commentSchema = new mongoose.Schema({
    userTask: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserTask',
        required: true,
        index: true
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    authorName: {
        type: String,
        required: true,
        trim: true
    },
    authorRole: {
        type: String,
        enum: ['user', 'admin'],
        required: true
    },
    authorAvatar: {
        type: String,
        default: null
    },
    body: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000
    }
}, {
    timestamps: true
});

// Compound index supports the dominant read pattern: thread for a UserTask,
// chronological order.
commentSchema.index({ userTask: 1, createdAt: 1 });

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
