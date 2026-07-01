// Named XP tier ladder. Pure helpers — no DB access.

export const TIERS = [
    { id: 'beginner', name: 'Beginner', threshold: 0, tone: 'emerald' },
    { id: 'intermediate', name: 'Intermediate', threshold: 1000, tone: 'indigo' },
    { id: 'advanced', name: 'Advanced', threshold: 3000, tone: 'purple' },
    { id: 'expert', name: 'Expert', threshold: 7000, tone: 'amber' }
];

/**
 * Resolve the user's current tier and progress toward the next one.
 * Returns the highest tier whose threshold the user has met or passed.
 *
 * @param {number} xp  total XP
 * @returns {{
 *   id: string, name: string, threshold: number, tone: string,
 *   next: { id, name, threshold } | null,
 *   xpIntoTier: number,    // XP earned past the current tier's threshold
 *   xpToNext: number | null, // XP still needed to reach the next tier (null at top)
 *   progress: number       // 0–1 fraction toward next tier (1 at top)
 * }}
 */
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
    const xpIntoTier = safeXp - current.threshold;
    const xpToNext = next ? next.threshold - safeXp : null;
    const progress = next
        ? Math.min(1, xpIntoTier / (next.threshold - current.threshold))
        : 1;
    return {
        ...current,
        next: next ? { id: next.id, name: next.name, threshold: next.threshold } : null,
        xpIntoTier,
        xpToNext,
        progress
    };
};
