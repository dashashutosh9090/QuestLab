import axios from 'axios';
import Task from '../models/Task.js';
import UserTask from '../models/UserTask.js';
import { applyXpAndStreak } from './gamificationController.js';
import { adminNotify } from '../utils/adminNotify.js';

// Normalize for comparison: unify line endings, strip trailing whitespace from
// each line, and trim leading/trailing blank lines. Tolerant enough that "2.0\n"
// vs "2.0 \n" doesn't fail a correct submission, strict enough that "2" vs "3"
// still fails.
const normalizeOutput = (value = '') =>
    String(value)
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/^\n+|\n+$/g, '');

// Ensure stdin ends with a newline. Many beginner solutions use input() in a
// loop or rely on a final newline to terminate the last line — without it
// runtimes raise EOFError on otherwise-correct programs.
const normalizeStdin = (value) => {
    if (value == null) return '';
    let s = String(value).replace(/\r\n/g, '\n');
    if (!s.endsWith('\n')) s += '\n';
    return s;
};

let wandboxConfigCache = null;
async function getWandboxCompilers() {
    if (wandboxConfigCache) return wandboxConfigCache;
    try {
        const { data } = await axios.get('https://wandbox.org/api/list.json');
        wandboxConfigCache = {
            'python': data.find(c => c.language === 'Python' && c.name.startsWith('cpython-3'))?.name || 
                      data.find(c => c.language === 'Python' && c.name.startsWith('cpython-'))?.name,
            'javascript': data.find(c => c.language === 'JavaScript' && c.name.startsWith('nodejs-'))?.name,
            'java': data.find(c => c.language === 'Java' && c.name.startsWith('openjdk-'))?.name,
            'c++': data.find(c => c.language === 'C++' && c.name.startsWith('gcc-'))?.name,
            'c': data.find(c => c.language === 'C' && c.name.startsWith('gcc-'))?.name
        };
        console.log('Dynamically loaded Wandbox compilers:', wandboxConfigCache);
        return wandboxConfigCache;
    } catch (err) {
        console.error('Failed to load compiler list', err.message);
        return {};
    }
}

// @desc    Submit code for evaluation against test cases
// @route   POST /api/gamification/tasks/:id/submit-code
export const submitCode = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, language } = req.body;

        if (typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ success: false, message: 'Code is required' });
        }
        if (code.length > 50000) {
            return res.status(400).json({ success: false, message: 'Code exceeds 50,000 character limit' });
        }

        // 1. Fetch Task
        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        // Enforce level gate consistent with completeTask.
        if ((task.levelRequired || 1) > (req.user.level || 1)) {
            return res.status(403).json({
                success: false,
                message: `Reach Level ${task.levelRequired} to attempt this challenge.`
            });
        }
        if (task.generatedFor && String(task.generatedFor) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'This challenge does not belong to you.' });
        }

        if (!task.isCodingChallenge || !task.testCases || task.testCases.length === 0) {
            return res.status(400).json({ success: false, message: 'This task lacks test cases.' });
        }

        const config = await getWandboxCompilers();
        const compiler = config[language];
        if (!compiler) return res.status(400).json({ success: false, message: 'Unsupported language' });

        // Defer the completion lookup until after cheap validations so non-coding
        // or unsupported-language requests don't hit the DB unnecessarily.
        const existingCompletion = await UserTask.findOne({ user: req.user._id, task: id, status: 'completed' });
        const isFirstTimeCompletion = !existingCompletion;

        let passedTests = 0;
        let results = [];

        // 2. Evaluate against each test case (Piston only — no local fallback,
        // running untrusted code on the host without a sandbox is unsafe).
        for (let i = 0; i < task.testCases.length; i++) {
            const tc = task.testCases[i];
            let output = '';
            let passed = false;
            let expected = normalizeOutput(tc.expectedOutput);
            let isError = false;

            try {
                const executeRes = await axios.post('https://wandbox.org/api/compile.json', {
                    compiler: compiler,
                    code: code,
                    stdin: normalizeStdin(tc.input)
                }, { timeout: 15000, headers: { 'Content-Type': 'application/json' } });

                const data = executeRes.data;

                if (data?.compiler_error) {
                    isError = true;
                    output = `Error: ${normalizeOutput(data.compiler_error)}`;
                } else {
                    output = normalizeOutput(data?.program_message || '');
                }

                passed = !isError && output === expected;
            } catch (apiError) {
                console.error('Wandbox execution unavailable:', apiError.message);
                if (apiError.response) {
                    console.error('Wandbox status:', apiError.response.status);
                    console.error('Wandbox body:', JSON.stringify(apiError.response.data));
                }
                console.error('Wandbox compiler used:', compiler);
                return res.status(503).json({
                    success: false,
                    message: 'Code execution service is temporarily unavailable. Please try again in a moment.'
                });
            }

            results.push({
                testCase: i + 1,
                input: tc.input,
                expected: expected,
                actual: isError ? `Error: ${output}` : output,
                passed: passed
            });

            if (passed) passedTests++;
        }

        const allPassed = passedTests === task.testCases.length;

        // 4. Persistence logic
        if (allPassed) {
            let xpAwarded = 0;
            let leveledUp = false;
            let newUserStats = null;

            // Always save the latest passing solution.
            // Only flip `completed` (and thus award XP) atomically the first time.
            const flipResult = await UserTask.findOneAndUpdate(
                { user: req.user._id, task: id, status: { $ne: 'completed' } },
                {
                    $set: {
                        status: 'completed',
                        completedAt: new Date(),
                        code,
                        language
                    },
                    $setOnInsert: { user: req.user._id, task: id }
                },
                { upsert: true, new: true, rawResult: true }
            ).catch((err) => {
                if (err && err.code === 11000) return null;
                throw err;
            });

            const justCompleted = !!flipResult && isFirstTimeCompletion;

            if (!justCompleted) {
                // Already completed previously — just refresh stored code.
                await UserTask.updateOne(
                    { user: req.user._id, task: id },
                    { $set: { code, language } }
                );
            }

            if (justCompleted) {
                const stats = await applyXpAndStreak(req.user._id, task.xpReward, req.app.get('io'));
                xpAwarded = task.xpReward;
                leveledUp = stats.leveledUp;
                newUserStats = { xp: stats.xp, level: stats.level, streak: stats.streak };

                await adminNotify(req.app.get('io'), {
                    title: 'Coding challenge solved',
                    message: `${req.user.name || 'A learner'} passed all tests for ${task.title}`,
                    type: 'task_completion',
                    meta: {
                        userId: String(req.user._id),
                        userName: req.user.name || '',
                        taskTitle: task.title,
                        track: task.track,
                        xp: task.xpReward,
                        language
                    }
                });
            }

            return res.json({
                success: true,
                allPassed: true,
                message: justCompleted ? 'All test cases passed!' : 'Solution verified!',
                results,
                xpAwarded,
                leveledUp,
                newUser: newUserStats
            });
        } else {
            return res.json({
                success: true,
                allPassed: false,
                message: `Passed ${passedTests}/${task.testCases.length} test cases.`,
                results
            });
        }

    } catch (error) {
        console.error('Code execution error:', error);
        res.status(500).json({ success: false, message: 'Server error during execution' });
    }
};
