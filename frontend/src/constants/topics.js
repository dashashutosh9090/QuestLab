// Mirror of backend/src/constants/topics.js — keep the two files in sync.
// (No build-time package sharing is set up between frontend and backend, so
// the catalog is duplicated. If you add a topic here, add it on the backend too.)

export const TOPIC_CATALOG = {
    Basics: [
        'Operators',
        'Conditional Statements',
        'Loops',
        'Basic Logic Building',
        'Basic Array Operations',
        'String',
        'Basic Recursion'
    ],
    DSA: [
        'Array',
        'String',
        'Two Pointers',
        'Prefix Sum',
        'Hash Map',
        'Hash Set',
        'Stack',
        'Queue',
        'LinkedList',
        'Heap',
        'Priority Queue',
        'Binary Search',
        'Sorting Algorithms'
    ],
    Project: [
        'Web App',
        'Mobile App',
        'REST API',
        'CLI Tool',
        'Full-Stack App',
        'Data / ML Project',
        'Game',
        'Browser Extension'
    ],
    Resume: [
        'Summary / Objective',
        'Work Experience',
        'Project Bullet',
        'Skills Section',
        'Education',
        'Achievements / Awards',
        'ATS Optimization',
        'Cover Letter'
    ],
    Interview: [
        'Behavioral',
        'HR / Self-Introduction',
        'Technical Q&A',
        'System Design',
        'DSA Walkthrough',
        'Coding Round Strategy',
        'Mock Interview',
        'Salary Negotiation'
    ]
};

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const isTopicTrack = (track) =>
    Object.prototype.hasOwnProperty.call(TOPIC_CATALOG, track);

export const trackToCategory = (track) => {
    if (track === 'Basics') return 'Basic';
    if (track === 'DSA') return 'DSA';
    if (track === 'Project') return 'Project';
    if (track === 'Resume') return 'Resume';
    if (track === 'Interview') return 'Interview';
    return null;
};
