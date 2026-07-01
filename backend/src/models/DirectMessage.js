import mongoose from 'mongoose';

const directMessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    read: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

directMessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
directMessageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });
directMessageSchema.index({ receiver: 1, read: 1 });

const DirectMessage = mongoose.model('DirectMessage', directMessageSchema);
export default DirectMessage;
