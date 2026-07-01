import mongoose from 'mongoose';

const interviewResourceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    language: {
        type: String,
        required: true,
        enum: ['All', 'MERN Stack', 'Python', 'JavaScript', 'Java', 'C++', 'C']
    },
    fileUrl: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const InterviewResource = mongoose.model('InterviewResource', interviewResourceSchema);
export default InterviewResource;
