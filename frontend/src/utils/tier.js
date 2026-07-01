// Mirrors backend/src/services/tierService.js. Kept in sync by hand — the
// thresholds are stable and the alternative is hitting /gamification/progression
// on every page that wants to render a tier pill.

const TIERS = [
    { id: 'beginner', name: 'Beginner', threshold: 0, tone: 'emerald' },
    { id: 'intermediate', name: 'Intermediate', threshold: 1000, tone: 'indigo' },
    { id: 'advanced', name: 'Advanced', threshold: 3000, tone: 'purple' },
    { id: 'expert', name: 'Expert', threshold: 7000, tone: 'amber' }
];

export const getTier = (xp = 0) => {
    const safeXp = Math.max(0, Number(xp) || 0);
    let current = TIERS[0];
    let next = null;
    for (let i = 0; i < TIERS.length; i++) {
        if (safeXp >= TIERS[i].threshold) {
            current = TIERS[i];
            next = TIERS[i + 1] || null;
        } else {
            break;
        }
    }
    return { ...current, next };
};
