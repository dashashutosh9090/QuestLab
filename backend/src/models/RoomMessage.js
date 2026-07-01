import mongoose from 'mongoose';

const roomMessageSchema = new mongoose.Schema({
    room: {
        type: String,
        required: true,
        enum: ['basics', 'dsa', 'project', 'resume', 'interview'],
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    }
}, {
    timestamps: true
});

roomMessageSchema.index({ room: 1, createdAt: -1 });

const RoomMessage = mongoose.model('RoomMessage', roomMessageSchema);
export default RoomMessage;
