import rateLimit from 'express-rate-limit';

const standardOpts = {
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' }
};

export const authLimiter = rateLimit({
    ...standardOpts,
    windowMs: 15 * 60 * 1000,
    max: 20
});

export const registerLimiter = rateLimit({
    ...standardOpts,
    windowMs: 60 * 60 * 1000,
    max: 10
});

export const aiGenerationLimiter = rateLimit({
    ...standardOpts,
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'AI generation limit reached. Try again in an hour.' }
});

export const codeSubmitLimiter = rateLimit({
    ...standardOpts,
    windowMs: 60 * 1000,
    max: 30
});
