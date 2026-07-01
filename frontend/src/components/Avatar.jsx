import { useState, useEffect } from 'react';

// Shared avatar renderer with graceful fallback. Shows the user's image when
// `avatar` resolves; falls back to a gradient-initials tile if the URL is
// missing OR loads with an error (e.g. legacy /uploads/* paths, deleted
// Cloudinary assets). All variants in the app (round/rounded/sized/ringed)
// are driven by `className` so call sites stay self-describing.
export default function Avatar({
    user,
    className = '',
    initialsClassName = 'text-base font-bold text-white',
    placeholderClassName = 'bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500',
    alt
}) {
    const [errored, setErrored] = useState(false);

    // Reset error state if the URL itself changes — otherwise updating a
    // user's avatar would leave the component permanently stuck on initials.
    useEffect(() => { setErrored(false); }, [user?.avatar]);

    const name = user?.name || '';
    const initial = name.charAt(0).toUpperCase() || '?';

    if (user?.avatar && !errored) {
        return (
            <img
                src={user.avatar}
                alt={alt ?? name}
                className={`object-cover ${className}`}
                onError={() => setErrored(true)}
            />
        );
    }

    return (
        <div
            className={`flex items-center justify-center ${placeholderClassName} ${className}`}
            aria-label={alt ?? name}
        >
            <span className={initialsClassName}>{initial}</span>
        </div>
    );
}
