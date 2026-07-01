import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';

const langOptions = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'c++', label: 'C++' },
    { value: 'c', label: 'C' },
    { value: 'java', label: 'Java' }
];

const defaults = {
    javascript: '// JavaScript solution\n',
    python: '# Python solution\n',
    'c++': '// C++ solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n  return 0;\n}\n',
    c: '// C solution\n#include <stdio.h>\n\nint main() {\n  return 0;\n}\n',
    java: '// Java solution\npublic class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n'
};

const CodeEditorModal = ({ isOpen, onClose, task, onComplete }) => {
    // The parent keys this modal on `task._id`, so swapping tasks remounts the
    // component and these lazy initializers re-seed state from the new task —
    // no setState-in-effect dance needed to "react" to a task change.
    const initialLang = task?.savedLanguage || 'javascript';
    const [language, setLanguage] = useState(initialLang);
    const [codesByLanguage, setCodesByLanguage] = useState(() => {
        const savedCode = task?.savedCode || '';
        return savedCode ? { ...defaults, [initialLang]: savedCode } : defaults;
    });
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);

    const prevOpenRef = useRef(isOpen);
    useEffect(() => {
        // Clear stale test results only when the modal transitions from open → closed,
        // so reopening doesn't flash old pass/fail badges before the next run.
        if (prevOpenRef.current && !isOpen) {
            setResults(null);
        }
        prevOpenRef.current = isOpen;
    }, [isOpen]);

    const handleEditorChange = (value) => {
        setCodesByLanguage((prev) => ({ ...prev, [language]: value ?? '' }));
    };

    const handleLanguageChange = (newLang) => {
        setLanguage(newLang);
        setResults(null);
    };

    const handleSubmit = async () => {
        setLoading(true);
        setResults(null);
        try {
            const currentCode = codesByLanguage[language];
            const res = await api.post(`/gamification/tasks/${task._id}/submit-code`, {
                code: currentCode, language
            });
            setResults(res.data);
            if (res.data.success && res.data.allPassed) {
                toast.success('All test cases passed');
                onComplete(res.data, currentCode, language);
            } else {
                toast.error(res.data.message || 'Some test cases failed');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Code execution failed');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !task) return null;

    const passedCount = results?.results?.filter((r) => r.passed).length || 0;
    const totalCount = results?.results?.length || 0;
    const allPassed = results?.allPassed;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-gray-900/70 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-2xl w-full max-w-[1400px] h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-white/30"
                    >
                        {/* Header */}
                        <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg flex-shrink-0">
                                    💻
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base sm:text-lg font-bold truncate">{task.title}</h2>
                                    <p className="text-xs text-gray-400">Coding challenge · ⭐ {task.xpReward} XP</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {results && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        allPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                    }`}>
                                        {passedCount}/{totalCount} passing
                                    </span>
                                )}
                                <button onClick={onClose}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                        title="Close">
                                    ✕
                                </button>
                            </div>
                        </header>

                        {/* Body */}
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50">
                            {/* Left: description + results */}
                            <aside className="w-full md:w-[380px] p-5 border-r border-gray-200 overflow-y-auto bg-white">
                                <div className="mb-5">
                                    <span className="section-eyebrow">Description</span>
                                    <p className="text-sm text-gray-700 leading-relaxed mt-2 whitespace-pre-wrap">{task.description}</p>
                                </div>

                                <div className="surface-muted p-3 mb-5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500 font-semibold uppercase tracking-wider">Reward</span>
                                        <span className="pill pill-warning">⭐ {task.xpReward} XP</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs mt-2">
                                        <span className="text-gray-500 font-semibold uppercase tracking-wider">Level</span>
                                        <span className="pill pill-primary">Lvl {task.levelRequired}</span>
                                    </div>
                                </div>

                                {results && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="section-eyebrow">Test results</span>
                                            <span className={`text-xs font-bold ${allPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {allPassed ? '✓ All passed' : `${passedCount}/${totalCount} passing`}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {results.results?.map((tc, i) => (
                                                <div key={i} className={`rounded-xl p-3 border ${
                                                    tc.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                                                }`}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-bold text-gray-700">Test {tc.testCase}</span>
                                                        <span className={`text-xs font-bold ${tc.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                            {tc.passed ? '✓ PASSED' : '✗ FAILED'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs space-y-1.5 font-mono">
                                                        <ResultLine label="Input" value={tc.input} />
                                                        <ResultLine label="Expected" value={tc.expected} />
                                                        {!tc.passed && (
                                                            <ResultLine label="Actual" value={tc.actual || '(no output)'} highlight />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </aside>

                            {/* Right: editor */}
                            <main className="flex-1 flex flex-col overflow-hidden">
                                <div className="bg-gray-800 px-4 py-2.5 flex justify-between items-center flex-shrink-0 border-b border-gray-700">
                                    <select
                                        value={language}
                                        onChange={(e) => handleLanguageChange(e.target.value)}
                                        className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 outline-none cursor-pointer hover:bg-gray-600 transition-colors font-medium focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {langOptions.map((l) => (
                                            <option key={l.value} value={l.value}>{l.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-500/30"
                                    >
                                        {loading ? (
                                            <>
                                                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                                Running…
                                            </>
                                        ) : (
                                            <>
                                                <span>▶</span>
                                                Run tests
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="flex-1">
                                    <Editor
                                        height="100%"
                                        language={language === 'c++' ? 'cpp' : language}
                                        theme="vs-dark"
                                        value={codesByLanguage[language]}
                                        onChange={handleEditorChange}
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 14,
                                            padding: { top: 16, bottom: 16 },
                                            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                            fontLigatures: true,
                                            cursorBlinking: 'smooth',
                                            smoothScrolling: true,
                                            scrollBeyondLastLine: false,
                                            roundedSelection: true,
                                            renderLineHighlight: 'all'
                                        }}
                                    />
                                </div>
                            </main>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

function ResultLine({ label, value, highlight }) {
    return (
        <div className="flex gap-2">
            <span className="text-gray-500 font-sans font-semibold w-16 flex-shrink-0">{label}:</span>
            <code className={`flex-1 break-all ${highlight ? 'text-rose-700 bg-rose-100/60 px-1.5 rounded' : 'text-gray-700'}`}>
                {value || '∅'}
            </code>
        </div>
    );
}

export default CodeEditorModal;
