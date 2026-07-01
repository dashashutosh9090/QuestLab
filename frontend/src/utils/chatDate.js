// WhatsApp-style date helpers for chat surfaces.
//
//   formatChatDay   → human label for a date pill (Today / Yesterday / Tuesday / May 7, 2026)
//   dayKey          → YYYY-MM-DD bucket for grouping messages, keyed in local time
//                     so the user's "Today" matches what they see on the wall clock.

const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const startOfLocalDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatChatDay = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';

    const now = new Date();
    if (isSameDay(d, now)) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(d, yesterday)) return 'Yesterday';

    // Within the past 6 days — show the weekday name. WhatsApp does this so a
    // recent thread reads "Tuesday / Wednesday / Thursday" instead of dates.
    const diffMs = startOfLocalDay(now).getTime() - startOfLocalDay(d).getTime();
    if (diffMs > 0 && diffMs < 7 * DAY_MS) {
        return d.toLocaleDateString(undefined, { weekday: 'long' });
    }

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const dayKey = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Convenience: just HH:MM in the user's locale, used for bubble timestamps.
export const formatChatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
