import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/useAuth';
import CommentsThread from './CommentsThread';

const fmtSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Accepted client-side. Backend has the final say (uploadMiddleware fileFilter).
const ACCEPTED_EXTENSIONS = ['.zip', '.pdf', '.doc', '.docx', '.ppt', '.pptx'];
const ACCEPTED_MIMES = new Set([
    'application/zip',
    'application/x-zip-compressed',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB matches the multer limit
const GITHUB_URL_RE = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?.*$/i;

// Per-track theming so Resume / Interview / Project submissions look distinct
// even though they share this single modal.
const THEME_BY_TRACK = {
    Project: { from: 'from-amber-500', to: 'to-orange-500', focusRing: 'focus:ring-amber-100', focusBorder: 'focus:border-amber-300', shadow: 'shadow-orange-500/30', icon: '🛠️', label: 'Project submission' },
    Resume: { from: 'from-sky-500', to: 'to-cyan-500', focusRing: 'focus:ring-sky-100', focusBorder: 'focus:border-sky-300', shadow: 'shadow-cyan-500/30', icon: '📄', label: 'Resume submission' },
    Interview: { from: 'from-rose-500', to: 'to-pink-500', focusRing: 'focus:ring-rose-100', focusBorder: 'focus:border-rose-300', shadow: 'shadow-pink-500/30', icon: '💼', label: 'Interview submission' }
};
const DEFAULT_THEME = THEME_BY_TRACK.Project;

const MIN_PROOF_CHARS = 50;
const MAX_PROOF_CHARS = 2000;

const ProjectSubmissionModal = ({ isOpen, onClose, task, onSubmitted, mode = 'zip' }) => {
    const { user } = useAuth();
    // Zip-mode state
    const [file, setFile] = useState(null);
    const [githubLink, setGithubLink] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);
    // Text-mode state
    const [submissionText, setSubmissionText] = useState('');
    const [submissionUrl, setSubmissionUrl] = useState('');
    // Shared
    const [uploading, setUploading] = useState(false);

    const theme = THEME_BY_TRACK[task?.track] || DEFAULT_THEME;
    const isTextMode = mode === 'text';

    // Reset transient state when the modal closes; pre-fill prior values when
    // it opens so revision-resubmits don't wipe the learner's previous answers.
    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setUploadProgress(0);
            setDragOver(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            setGithubLink(task?.githubLink || '');
            setSubmissionText(task?.submissionText || '');
            setSubmissionUrl(task?.submissionUrl && !/\.(zip|pdf|docx?|pptx?|jpe?g|png|gif|webp)$/i.test(task.submissionUrl)
                ? task.submissionUrl
                : '');
        }
    }, [isOpen, task?.githubLink, task?.submissionText, task?.submissionUrl]);

    if (!task) return null;

    const validateAndSet = (f) => {
        if (!f) return;
        const ext = (f.name.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
        const isAccepted = ACCEPTED_MIMES.has(f.type) || ACCEPTED_EXTENSIONS.includes(ext);
        if (!isAccepted) {
            toast.error('Allowed: ZIP, PDF, DOC/DOCX, PPT/PPTX');
            return;
        }
        if (f.size > MAX_FILE_SIZE) {
            toast.error('File exceeds the 50 MB cap');
            return;
        }
        setFile(f);
    };

    const handleFileChange = (e) => validateAndSet(e.target.files?.[0]);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        validateAndSet(e.dataTransfer.files?.[0]);
    };

    const handleZipSubmit = async () => {
        if (!file) {
            toast.error('Choose a file first');
            return;
        }
        const trimmedLink = githubLink.trim();
        if (trimmedLink && !GITHUB_URL_RE.test(trimmedLink)) {
            toast.error('GitHub link must look like https://github.com/user/repo');
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        try {
            const fd = new FormData();
            fd.append('file', file);
            if (trimmedLink) fd.append('githubLink', trimmedLink);
            const { data } = await api.post(
                `/gamification/tasks/${task._id}/submit-project`,
                fd,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (e) => {
                        if (e.total) {
                            const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
                            setUploadProgress(pct);
                        } else {
                            setUploadProgress(95);
                        }
                    }
                }
            );
            setUploadProgress(100);
            if (data.success) {
                toast.success('Submitted — awaiting admin review');
                onSubmitted?.(data.userTask);
                onClose();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Submission failed');
        } finally {
            setUploading(false);
        }
    };

    const handleTextSubmit = async () => {
        const trimmedText = submissionText.trim();
        if (trimmedText.length < MIN_PROOF_CHARS) {
            toast.error(`Submission must be at least ${MIN_PROOF_CHARS} characters`);
            return;
        }
        if (trimmedText.length > MAX_PROOF_CHARS) {
            toast.error(`Submission must be at most ${MAX_PROOF_CHARS} characters`);
            return;
        }
        const trimmedUrl = submissionUrl.trim();
        if (trimmedUrl) {
            try { new URL(trimmedUrl); }
            catch { toast.error('Provide a valid URL or leave it blank'); return; }
        }
        setUploading(true);
        try {
            const { data } = await api.post(`/gamification/tasks/${task._id}/submit-proof`, {
                submissionText: trimmedText,
                submissionUrl: trimmedUrl
            });
            if (data.success) {
                toast.success('Submitted — awaiting admin review');
                onSubmitted?.(data.userTask);
                onClose();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Submission failed');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = () => (isTextMode ? handleTextSubmit() : handleZipSubmit());

    const showRejectionFeedback = (task.reviewStatus === 'rejected' || task.reviewStatus === 'revision') && task.adminFeedback;
    const feedbackHeading = task.reviewStatus === 'revision' ? 'Revision requested' : 'Admin feedback';
    const canUpload = task.reviewStatus === 'none' || task.reviewStatus === 'rejected' || task.reviewStatus === 'revision';
    const isPending = task.reviewStatus === 'pending';
    const isApproved = task.reviewStatus === 'approved' || task.status === 'completed';
    const userTaskId = task.userTaskId;
    const charCount = submissionText.length;
    const submitDisabled = uploading || (isTextMode
        ? submissionText.trim().length < MIN_PROOF_CHARS
        : !file);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-gray-900/70 backdrop-blur-md"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-white/40 max-h-[92vh] flex flex-col"
                    >
                        <header className={`bg-gradient-to-r ${theme.from} ${theme.to} text-white px-6 py-5 flex items-center justify-between`}>
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-lg flex-shrink-0">
                                    {theme.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{theme.label}</p>
                                    <h2 className="text-base sm:text-lg font-bold truncate">{task.title}</h2>
                                </div>
                            </div>
                            <button onClick={onClose}
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                                title="Close">
                                ✕
                            </button>
                        </header>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {canUpload && !isTextMode && (
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    Bundle your project as a ZIP, PDF, DOC, or PPT. An admin will review your work and award
                                    <span className="font-bold text-amber-600"> {task.xpReward} XP</span> on approval.
                                </p>
                            )}
                            {canUpload && isTextMode && (
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    Describe what you did in <strong>{MIN_PROOF_CHARS}–{MAX_PROOF_CHARS} characters</strong> — what you built/answered, what you decided, what you learned. Optionally link to a live document, recording, or hosted artifact. An admin will review and award
                                    <span className="font-bold text-indigo-600"> {task.xpReward} XP</span> on approval.
                                </p>
                            )}

                            {isPending && (
                                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse mt-1.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Under review</p>
                                            <p className="text-sm text-amber-800 leading-relaxed">
                                                Your submission is in the admin's review queue. You'll get notified when there's an update — keep the conversation going below if you have notes to share.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isApproved && (
                                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-emerald-500 text-lg leading-none mt-0.5">✓</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Approved</p>
                                            <p className="text-sm text-emerald-800 leading-relaxed">
                                                Submission approved — <strong>{task.xpReward} XP</strong> credited. Use the discussion below to follow up with the reviewer.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showRejectionFeedback && (
                                <div className={`rounded-2xl p-4 ${task.reviewStatus === 'revision' ? 'bg-orange-50 border border-orange-200' : 'bg-rose-50 border border-rose-200'}`}>
                                    <div className="flex items-start gap-2.5">
                                        <span className={`mt-0.5 ${task.reviewStatus === 'revision' ? 'text-orange-500' : 'text-rose-500'}`}>⚠</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${task.reviewStatus === 'revision' ? 'text-orange-600' : 'text-rose-600'}`}>{feedbackHeading}</p>
                                            <p className={`text-sm whitespace-pre-wrap leading-relaxed ${task.reviewStatus === 'revision' ? 'text-orange-700' : 'text-rose-700'}`}>{task.adminFeedback}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {canUpload && !isTextMode && (
                            <label
                                onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => { if (!uploading) handleDrop(e); else e.preventDefault(); }}
                                className={`block rounded-2xl border-2 border-dashed p-7 text-center transition-all ${
                                    uploading
                                        ? 'border-gray-200 bg-gray-50/60 cursor-not-allowed'
                                        : dragOver
                                            ? 'border-amber-400 bg-amber-50/70 cursor-pointer'
                                            : 'border-gray-200 bg-gray-50/60 hover:border-amber-300 hover:bg-amber-50/40 cursor-pointer'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={ACCEPTED_EXTENSIONS.join(',')}
                                    onChange={handleFileChange}
                                    disabled={uploading}
                                    className="hidden"
                                />
                                <div className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl mb-3">📦</div>
                                {file ? (
                                    <>
                                        <p className="text-sm font-bold text-gray-900 truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {fmtSize(file.size)}{!uploading && ' · click to change'}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold text-gray-900">Drop your file here</p>
                                        <p className="text-xs text-gray-500 mt-1">or click to browse · ZIP, PDF, DOC, PPT · max 50 MB</p>
                                    </>
                                )}
                            </label>
                            )}

                            {canUpload && !isTextMode && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    GitHub repository <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                            <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
                                        </svg>
                                    </span>
                                    <input
                                        type="url"
                                        value={githubLink}
                                        onChange={(e) => setGithubLink(e.target.value)}
                                        placeholder="https://github.com/your-username/repo"
                                        disabled={uploading}
                                        className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-amber-300 focus:ring-4 focus:ring-amber-100 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-all disabled:opacity-60"
                                    />
                                </div>
                            </div>
                            )}

                            {canUpload && isTextMode && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Your submission <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            value={submissionText}
                                            onChange={(e) => setSubmissionText(e.target.value)}
                                            disabled={uploading}
                                            rows={8}
                                            maxLength={MAX_PROOF_CHARS}
                                            placeholder="Walk the admin through your work. What did you produce / answer? What decisions did you make? What would you do differently next time?"
                                            className={`w-full bg-gray-50 border border-transparent focus:bg-white ${theme.focusBorder} focus:ring-4 ${theme.focusRing} rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-all disabled:opacity-60 resize-y leading-relaxed`}
                                        />
                                        <div className="flex items-center justify-between mt-1">
                                            <span className={`text-[11px] font-semibold ${charCount < MIN_PROOF_CHARS ? 'text-rose-500' : 'text-gray-400'}`}>
                                                {charCount < MIN_PROOF_CHARS ? `${MIN_PROOF_CHARS - charCount} more characters needed` : 'Looks good'}
                                            </span>
                                            <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                                                {charCount} / {MAX_PROOF_CHARS}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Reference link <span className="text-gray-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="url"
                                            value={submissionUrl}
                                            onChange={(e) => setSubmissionUrl(e.target.value)}
                                            placeholder="https://drive.google.com/... or https://your-resume.com"
                                            disabled={uploading}
                                            className={`w-full bg-gray-50 border border-transparent focus:bg-white ${theme.focusBorder} focus:ring-4 ${theme.focusRing} rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-all disabled:opacity-60`}
                                        />
                                    </div>
                                </>
                            )}

                            {uploading && !isTextMode && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-gray-700">Uploading…</span>
                                        <span className="font-bold text-amber-600 tabular-nums">{uploadProgress}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={false}
                                            animate={{ width: `${uploadProgress}%` }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                            className={`h-full bg-gradient-to-r ${theme.from} ${theme.to} rounded-full`}
                                        />
                                    </div>
                                </div>
                            )}

                            {userTaskId && (
                                <div className="pt-3 border-t border-gray-100">
                                    <CommentsThread
                                        userTaskId={userTaskId}
                                        currentUser={user ? { _id: user._id, role: user.role } : null}
                                        maxHeight={200}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
                            {canUpload ? (
                                <>
                                    <button
                                        onClick={onClose}
                                        type="button"
                                        disabled={uploading}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitDisabled}
                                        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r ${theme.from} ${theme.to} hover:brightness-110 text-white text-sm font-bold shadow-lg ${theme.shadow} disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                                    >
                                        {uploading
                                            ? (isTextMode ? 'Submitting…' : `Uploading ${uploadProgress}%`)
                                            : 'Submit for review'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={onClose}
                                    type="button"
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default ProjectSubmissionModal;
