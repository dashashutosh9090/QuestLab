import { motion } from 'framer-motion';

// Floor for the chart's scale denominator. Below this threshold, bar heights
// remain proportional to the floor (so 1 submission ≠ 4 submissions visually);
// above it, the chart auto-scales to the dataset's max. 5 keeps small counts
// distinguishable without dwarfing busier days.
const DEFAULT_MIN_SCALE = 5;

/**
 * Lightweight weekly bar chart — flex column-row, one bar per data point.
 *
 * Props:
 *   data       — [{ label: string, ...numeric fields }] (length expected = 7)
 *   getValue   — (d) => number selecting which field drives the bar height
 *   barClass   — Tailwind classes applied to the bar fill (gradient / color)
 *   valueLabel — short label used in the hover title attribute
 *   height     — chart area height in px (default 140)
 *   formatValue— (n) => string for the under-bar number (default toLocaleString)
 *   showValues — render the numeric value beneath each bar (default true)
 *   minScale   — minimum denominator for height calculation; the chart only
 *                normalizes to the dataset's max once values exceed it.
 *                Without a floor, a single submission and four submissions
 *                both render as 100% of the chart height.
 */
export default function WeeklyBars({
    data = [],
    getValue,
    barClass = 'bg-gradient-to-t from-indigo-500 to-purple-500',
    valueLabel = 'value',
    height = 140,
    formatValue = (n) => Number(n).toLocaleString(),
    showValues = true,
    minScale = DEFAULT_MIN_SCALE
}) {
    if (!Array.isArray(data) || data.length === 0) {
        return (
            <div className="text-center text-xs text-gray-400 py-8">
                No activity yet.
            </div>
        );
    }

    const values = data.map(getValue);
    const max = Math.max(minScale, ...values);

    return (
        <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
            {data.map((d, i) => {
                const v = getValue(d);
                const pct = (v / max) * 100;
                return (
                    <div key={i} className="flex-1 h-full flex flex-col items-center min-w-0">
                        <div className="w-full flex-1 flex items-end">
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${pct}%` }}
                                transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }}
                                title={`${d.label}: ${v} ${valueLabel}`}
                                className={`w-full ${barClass} rounded-t-lg ${v === 0 ? 'opacity-25' : ''}`}
                                style={{ minHeight: v === 0 ? 4 : 8 }}
                            />
                        </div>
                        <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">{d.label}</div>
                        {showValues && (
                            <div className="text-xs font-bold tabular-nums text-gray-700 mt-0.5">{formatValue(v)}</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
