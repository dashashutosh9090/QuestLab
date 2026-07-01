import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const MAX_GENERATION_RETRIES = 2;

// Per-track guidance for the non-coding branch. Each block constrains the
// model to produce ONE concrete deliverable shaped by a fixed section list,
// so admins reviewing submissions have a checkable rubric and learners can't
// be handed a 1-line vague prompt like "Build a social network".
const nonCodingGuidance = (track, level) => {
    switch (track) {
        case 'Project':
            return `A self-contained mini-project scoped to roughly 4-8 hours of work for a Level ${level} student. Description must be a SINGLE STRING with literal "\\n" newline escapes, containing IN THIS EXACT ORDER, separated by blank lines:
    1. "Problem Statement:" 2-4 sentences in plain English.
    2. "Functional Requirements:" 3-5 bulleted user-visible behaviours (using "- ").
    3. "Tech Constraints:" suggested stack, libraries or APIs (must be free-tier or open-source). One short paragraph.
    4. "Submission Checklist:" bulleted (using "- ") — README, GitHub link, one screenshot or recording, a 1-paragraph "what I learned" note.
    HARD RULES: never propose anything that requires paid services, custom hardware, or more than ~8 hours of work. Keep wording precise. No markdown code fences inside the description.`;
        case 'Resume':
            return `A concrete resume-improvement task with ONE specific deliverable. Invent fresh tasks shaped like these examples (do NOT reuse them verbatim): rewriting a single work-experience bullet using the XYZ formula; drafting a 3-sentence summary section for a target role; listing 5 skills under a pasted-in job description with a tag per skill. Description must be a SINGLE STRING with literal "\\n" newline escapes, containing IN THIS EXACT ORDER, separated by blank lines:
    1. "Goal:" 1 sentence.
    2. "Deliverable:" exactly what to produce, with a length cap (e.g. "one bullet, max 25 words" or "3 sentences, max 60 words").
    3. "Format Requirements:" heading or style rules the learner must follow.
    4. "Self-Check Rubric:" 3 bullets (using "- ") the learner uses to judge their own work before submitting.
    HARD RULES: never ask for an entire resume — only ONE specific section or bullet. No markdown code fences.`;
        case 'Interview':
            return `A concrete interview-prep task with ONE specific deliverable. Invent fresh tasks shaped like these examples (do NOT reuse them verbatim): a 30-second elevator pitch outline; a STAR-format answer to one behavioural prompt; a 5-bullet rough sketch of a system-design answer for a stated problem. Description must be a SINGLE STRING with literal "\\n" newline escapes, containing IN THIS EXACT ORDER, separated by blank lines:
    1. "Prompt:" the question or scenario being practiced.
    2. "Deliverable:" exactly what to produce, with a length cap (e.g. "30-second outline" or "5 bullets").
    3. "Format Requirements:" structural rules (STAR sections, time-to-deliver, talking points order).
    4. "Self-Check Rubric:" 3 bullets (using "- ") the learner uses to judge their own answer before submitting.
    HARD RULES: never ask for a full mock interview — only ONE answer or outline. No markdown code fences.`;
        default:
            return `Detailed actionable instructions for the task (1-2 sentences). Focus entirely on "${track}".`;
    }
};

const buildPrompt = (track, level, count, difficulty, extraStrictness = '', { category = null, topic = null } = {}) => {
    const isCodingChallenge = track === 'Basics' || track === 'DSA';
    const topicLine = topic
        ? `\nTOPIC LOCK: Every problem MUST be a "${topic}" problem on the "${track}" track${category ? ` (category: ${category})` : ''}. Reject any idea that does not exercise "${topic}" as the primary concept. Do NOT drift to adjacent topics.`
        : '';
    return `You are a strict learning assistant for a gamified developer platform.
Generate exactly ${count} short, actionable learning tasks with "${difficulty}" difficulty for a college student at Level ${level} for the exclusive track "${track}".
CRITICAL: These tasks MUST BE STRICTLY AND ONLY about "${track}". Do not mix topics. If the track is "Interview", only generate interview questions. If the track is "Resume", only generate resume building steps.${topicLine}
Return ONLY a valid JSON array of objects.
Each object MUST and ONLY contain:
- "title": A short string (max 6 words).
- "description": ${isCodingChallenge
    ? `A full LeetCode/HackerRank-style coding problem statement formatted as a SINGLE STRING with literal "\\n" newline escapes between sections. It MUST contain ALL of the following sections, in this exact order, separated by blank lines:
    1. Problem Statement: 2-4 sentences describing the task in plain English.
    2. "Input Format:" followed by a precise description of how input is provided via stdin (line-by-line, types, separators).
    3. "Output Format:" followed by a precise description of what to print to stdout.
    4. "Constraints:" a bulleted list (using "- ") of variable ranges and edge-case bounds.
    5. "Sample Input 1:" followed on the next line by the raw input.
    6. "Sample Output 1:" followed on the next line by the raw expected output.
    7. "Explanation:" a 1-3 sentence walkthrough of why Sample Output 1 is correct.
    Keep wording precise; never use markdown code fences inside the description.`
    : nonCodingGuidance(track, level)}
- "xpReward": An integer between 30 and 150 based on difficulty (Easy: 30-60, Medium: 60-100, Hard: 100-150).
${isCodingChallenge ? `- "testCases": An array of exactly 4 to 5 objects, each containing an "input" string (raw stdin, matching the Input Format EXACTLY — same line breaks, same separators, no extra whitespace) and an "expectedOutput" string (raw stdout, matching the Output Format).
  HARD RULES for testCases:
  * The FIRST testCase MUST be byte-for-byte equal to "Sample Input 1" / "Sample Output 1" from the description (after stripping a single trailing newline).
  * Every testCase MUST follow the SAME line/separator structure as Sample Input 1. If Sample Input 1 places M integers on a single space-separated line, every testCase MUST also place its M integers on a single space-separated line — never split them across multiple lines.
  * The remaining testCases must cover varied scenarios including at least one edge case (empty/min/max bounds).` : ''}

Ensure the format is exactly:
[
    {
        "title": "Example Title",
        "description": ${isCodingChallenge
            ? `"Given two integers A and B, compute their sum.\\n\\nInput Format:\\nA single line containing two space-separated integers A and B.\\n\\nOutput Format:\\nPrint a single integer denoting A + B.\\n\\nConstraints:\\n- -10^9 <= A, B <= 10^9\\n\\nSample Input 1:\\n1 2\\n\\nSample Output 1:\\n3\\n\\nExplanation:\\n1 + 2 = 3, which is printed on a single line."`
            : `"Example description."`},
        "xpReward": 50${isCodingChallenge ? `,
        "testCases": [
            { "input": "1 2", "expectedOutput": "3" },
            { "input": "0 0", "expectedOutput": "0" },
            { "input": "-5 5", "expectedOutput": "0" },
            { "input": "1000000000 1000000000", "expectedOutput": "2000000000" }
        ]` : ''}
    }
]
Do not include any string like \`\`\`json or \`\`\`, just the raw JSON array.${extraStrictness ? `\n\nADDITIONAL REQUIREMENTS (a previous attempt failed validation):\n${extraStrictness}` : ''}`;
};

// Strip a single trailing newline (but preserve internal whitespace) so equality
// checks aren't defeated by a stray "\n" the model added at the end of a sample.
const trimTrailingNewline = (s) => String(s ?? '').replace(/\r\n/g, '\n').replace(/\n$/, '');

const SAMPLE_INPUT_RE = /Sample Input(?:\s*1)?\s*:\s*\n([\s\S]*?)(?=\n\s*Sample Output|\n\s*Explanation|$)/i;
const SAMPLE_OUTPUT_RE = /Sample Output(?:\s*1)?\s*:\s*\n([\s\S]*?)(?=\n\s*Explanation|\n\s*Sample Input|$)/i;

export const extractSampleIO = (description = '') => {
    const inMatch = description.match(SAMPLE_INPUT_RE);
    const outMatch = description.match(SAMPLE_OUTPUT_RE);
    return {
        input: inMatch ? trimTrailingNewline(inMatch[1]) : null,
        expectedOutput: outMatch ? trimTrailingNewline(outMatch[1]) : null,
    };
};

// Returns { valid, reasons[] }. Coding tasks must declare a parseable Sample I/O
// in the description and the first testCase must match it byte-for-byte.
export const validateCodingTask = (task) => {
    const reasons = [];
    if (!task || typeof task !== 'object') return { valid: false, reasons: ['task is not an object'] };
    if (typeof task.title !== 'string' || !task.title.trim()) reasons.push('missing title');
    if (typeof task.description !== 'string' || !task.description.trim()) reasons.push('missing description');
    if (!Array.isArray(task.testCases) || task.testCases.length < 1) reasons.push('missing testCases');

    const sample = extractSampleIO(task.description || '');
    if (!sample.input || !sample.expectedOutput) {
        reasons.push('Sample Input/Output not parseable from description');
    }

    if (Array.isArray(task.testCases)) {
        for (let i = 0; i < task.testCases.length; i++) {
            const tc = task.testCases[i];
            if (typeof tc?.input !== 'string') reasons.push(`testCase[${i}].input is not a string`);
            if (typeof tc?.expectedOutput !== 'string' || !tc.expectedOutput.trim()) {
                reasons.push(`testCase[${i}].expectedOutput is empty`);
            }
        }
        const tc0 = task.testCases[0];
        if (tc0 && sample.input != null && sample.expectedOutput != null) {
            if (trimTrailingNewline(tc0.input) !== sample.input) {
                reasons.push('testCase[0].input does not match Sample Input 1');
            }
            if (trimTrailingNewline(tc0.expectedOutput) !== sample.expectedOutput) {
                reasons.push('testCase[0].expectedOutput does not match Sample Output 1');
            }
        }
    }
    return { valid: reasons.length === 0, reasons };
};

// Best-effort fixer: when retries run out, replace test 0 with the parsed sample
// and drop test cases that are structurally broken. Returns null if the task is
// unrecoverable (e.g. no parseable sample at all).
export const repairCodingTask = (task) => {
    if (!task || typeof task !== 'object') return null;
    const sample = extractSampleIO(task.description || '');
    if (!sample.input || !sample.expectedOutput) return null;

    const fixed = { ...task };
    const cleaned = Array.isArray(task.testCases) ? [...task.testCases] : [];
    const sampleTC = { input: sample.input, expectedOutput: sample.expectedOutput };
    if (cleaned.length === 0) cleaned.push(sampleTC);
    else cleaned[0] = sampleTC;

    fixed.testCases = cleaned.filter(
        (tc) =>
            tc &&
            typeof tc.input === 'string' &&
            typeof tc.expectedOutput === 'string' &&
            tc.expectedOutput.trim().length > 0
    );
    return fixed.testCases.length > 0 ? fixed : null;
};

const callGemini = async (prompt) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${API_KEY}`;
    const response = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
    }, { headers: { 'Content-Type': 'application/json' } });

    let textResponse = response.data.candidates[0].content.parts[0].text;
    textResponse = textResponse.replace(/^```json/gi, '').replace(/```$/gi, '').trim();
    return JSON.parse(textResponse);
};

export const generateTasksForTrack = async (track, level, count = 3, difficulty = 'Medium', { category = null, topic = null } = {}) => {
    const isCodingChallenge = track === 'Basics' || track === 'DSA';
    const topicTag = topic ? ` [topic=${topic}]` : '';

    let lastError = null;
    let lastTasks = null;
    let lastReasons = [];

    for (let attempt = 0; attempt <= MAX_GENERATION_RETRIES; attempt++) {
        const stricter = attempt === 0
            ? ''
            : `Attempt ${attempt + 1}: the previous response failed these checks — ${lastReasons.join('; ')}. Fix every problem.`;
        const prompt = buildPrompt(track, level, count, difficulty, stricter, { category, topic });

        try {
            const tasks = await callGemini(prompt);
            if (!Array.isArray(tasks)) throw new Error('AI did not return a JSON array');

            if (!isCodingChallenge) return tasks;

            const allReasons = [];
            const allValid = tasks.every((t) => {
                const { valid, reasons } = validateCodingTask(t);
                if (!valid) allReasons.push(`"${t?.title || 'untitled'}": ${reasons.join(', ')}`);
                return valid;
            });

            if (allValid) return tasks;

            lastTasks = tasks;
            lastReasons = allReasons;
            console.warn(`AI quest generation attempt ${attempt + 1}${topicTag} produced invalid coding tasks: ${allReasons.join(' | ')}`);
        } catch (err) {
            lastError = err;
            console.error(`AI quest generation attempt ${attempt + 1}${topicTag} failed:`, err?.response?.data || err.message);
        }
    }

    // Out of retries. If we have *something* parseable from the last attempt,
    // repair what we can rather than blowing up the whole request.
    if (Array.isArray(lastTasks) && lastTasks.length > 0) {
        const repaired = lastTasks.map(repairCodingTask).filter(Boolean);
        if (repaired.length > 0) {
            console.warn(`AI quest generation: returning ${repaired.length}/${lastTasks.length} repaired tasks after exhausting retries`);
            return repaired;
        }
    }

    console.error('AI quest generation: all retries exhausted with no recoverable tasks');
    throw new Error('AI Quest Generation Failed');
};
