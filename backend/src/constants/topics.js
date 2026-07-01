// Single source of truth for the per-track topic taxonomy used by both the
// admin task-authoring form and the learner practice dashboard.
// Mirrored at frontend/src/constants/topics.js — keep the two files in sync.

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

// True for any track that has a topic list in the catalog. Currently every
// track does — the helper stays so call sites read intentionally and so a
// future "untagged" track can opt out by simply not appearing in TOPIC_CATALOG.
export const isTopicTrack = (track) =>
    Object.prototype.hasOwnProperty.call(TOPIC_CATALOG, track);

// Track name → stored category value. Kept explicit so future re-organization
// (splitting DSA into Linear / Non-Linear, etc.) doesn't require a migration.
export const trackToCategory = (track) => {
    if (track === 'Basics') return 'Basic';
    if (track === 'DSA') return 'DSA';
    if (track === 'Project') return 'Project';
    if (track === 'Resume') return 'Resume';
    if (track === 'Interview') return 'Interview';
    return null;
};

export const isValidTopic = (track, topic) => {
    if (!isTopicTrack(track)) return false;
    return TOPIC_CATALOG[track].includes(topic);
};

export const isValidDifficulty = (difficulty) => DIFFICULTIES.includes(difficulty);
