import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import Navbar from './Navbar';

const blankForm = {
    name: '',
    role: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    summary: '',
    skills: '',
    education: '',
    experience: '',
    projects: '',
    certifications: ''
};

export default function ResumeBuilder() {
    const [unlocked, setUnlocked] = useState(null); // null = loading
    const [form, setForm] = useState(blankForm);

    useEffect(() => {
        let cancelled = false;
        api.get('/gamification/roadmap')
            .then((res) => {
                if (cancelled) return;
                const node = (res.data?.roadmap || []).find((n) => n.id === 'resume');
                setUnlocked(node ? node.status !== 'locked' : false);
            })
            .catch(() => { if (!cancelled) setUnlocked(false); });
        return () => { cancelled = true; };
    }, []);

    const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const handleExport = (e) => {
        e.preventDefault();
        window.print();
    };

    const displayName = form.name.trim() || 'Your Name';
    const displayRole = form.role.trim() || 'Your Role / Headline';
    const contactItems = [
        { value: form.email.trim(), icon: 'email' },
        { value: form.phone.trim(), icon: 'phone' },
        { value: form.location.trim(), icon: 'location' },
        { value: form.linkedin.trim(), icon: 'linkedin' },
        { value: form.github.trim(), icon: 'github' }
    ].filter((c) => c.value);

    const skillChips = form.skills
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

    return (
        <div className="app-bg pb-16 print:bg-white print:pb-0">
            <div className="print:hidden">
                <Navbar />
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 print:max-w-none print:px-0 print:py-0">
                {/* HERO */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="hero-card p-6 sm:p-8 mb-6 print:hidden relative overflow-hidden"
                >
                    <div aria-hidden className="absolute -top-24 -right-20 w-72 h-72 bg-gradient-to-br from-indigo-300 to-purple-300 rounded-full opacity-25 blur-3xl pointer-events-none" />
                    <div aria-hidden className="absolute -bottom-28 -left-20 w-64 h-64 bg-gradient-to-br from-pink-300 to-amber-300 rounded-full opacity-20 blur-3xl pointer-events-none" />
                    <div className="relative">
                        <span className="section-eyebrow">Stage 4</span>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
                            Resume <span className="text-gradient">builder</span>
                        </h1>
                        <p className="text-gray-600 mt-2 max-w-xl">
                            Edit on the left, watch it render live on the right, then export to PDF — all from your browser.
                        </p>
                    </div>
                </motion.div>

                {unlocked === null ? (
                    <div className="surface h-72 shimmer rounded-2xl print:hidden" />
                ) : !unlocked ? (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="surface p-10 sm:p-12 text-center print:hidden"
                    >
                        <div className="text-6xl mb-4">🔒</div>
                        <h3 className="section-title text-lg mb-2">Resume track is locked</h3>
                        <p className="text-sm text-gray-500 max-w-md mx-auto">
                            Complete the Project track first — ship 5 project quests to unlock the resume builder.
                        </p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:gap-0">
                        {/* LEFT — FORM */}
                        <motion.form
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            onSubmit={handleExport}
                            className="surface p-5 sm:p-7 print:hidden h-fit lg:sticky lg:top-24 space-y-6"
                        >
                            {/* CONTACT */}
                            <div>
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3 flex items-center gap-2">
                                    <span className="w-5 h-px bg-gray-300" />
                                    Contact
                                </h3>
                                <div className="space-y-3.5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="label" htmlFor="resume-name">Name</label>
                                            <input
                                                id="resume-name" type="text" value={form.name}
                                                onChange={handleChange('name')} placeholder="Jane Doe"
                                                className="input" maxLength={120}
                                            />
                                        </div>
                                        <div>
                                            <label className="label" htmlFor="resume-role">Role / Headline</label>
                                            <input
                                                id="resume-role" type="text" value={form.role}
                                                onChange={handleChange('role')} placeholder="Full-Stack Engineer"
                                                className="input" maxLength={120}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="label" htmlFor="resume-email">Email</label>
                                            <input
                                                id="resume-email" type="email" value={form.email}
                                                onChange={handleChange('email')} placeholder="jane@example.com"
                                                className="input" maxLength={160}
                                            />
                                        </div>
                                        <div>
                                            <label className="label" htmlFor="resume-phone">Phone</label>
                                            <input
                                                id="resume-phone" type="tel" value={form.phone}
                                                onChange={handleChange('phone')} placeholder="+91 98765 43210"
                                                className="input" maxLength={40}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="label" htmlFor="resume-location">Location</label>
                                            <input
                                                id="resume-location" type="text" value={form.location}
                                                onChange={handleChange('location')} placeholder="Bhubaneswar, IN"
                                                className="input" maxLength={120}
                                            />
                                        </div>
                                        <div>
                                            <label className="label" htmlFor="resume-linkedin">LinkedIn</label>
                                            <input
                                                id="resume-linkedin" type="text" value={form.linkedin}
                                                onChange={handleChange('linkedin')} placeholder="linkedin.com/in/janedoe"
                                                className="input" maxLength={160}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label" htmlFor="resume-github">GitHub</label>
                                        <input
                                            id="resume-github" type="text" value={form.github}
                                            onChange={handleChange('github')} placeholder="github.com/janedoe"
                                            className="input" maxLength={160}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SUMMARY */}
                            <div className="border-t border-gray-100 pt-5">
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3 flex items-center gap-2">
                                    <span className="w-5 h-px bg-gray-300" />
                                    Professional summary
                                </h3>
                                <div>
                                    <label className="label" htmlFor="resume-summary">
                                        Summary <span className="text-gray-400 font-normal normal-case tracking-normal">(2–3 sentences for your target role)</span>
                                    </label>
                                    <textarea
                                        id="resume-summary" value={form.summary}
                                        onChange={handleChange('summary')}
                                        placeholder="Full-stack engineer with 2 years of experience shipping React + Node products. Strong eye for performance and DX. Looking for a backend-leaning role on a small product team."
                                        className="input min-h-[92px] resize-y" maxLength={600}
                                    />
                                </div>
                            </div>

                            {/* STORY */}
                            <div className="border-t border-gray-100 pt-5">
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3 flex items-center gap-2">
                                    <span className="w-5 h-px bg-gray-300" />
                                    Story
                                </h3>
                                <div className="space-y-3.5">
                                    <div>
                                        <label className="label" htmlFor="resume-skills">
                                            Skills <span className="text-gray-400 font-normal normal-case tracking-normal">(comma-separated)</span>
                                        </label>
                                        <textarea
                                            id="resume-skills" value={form.skills}
                                            onChange={handleChange('skills')}
                                            placeholder="React, Node.js, PostgreSQL, AWS, system design…"
                                            className="input min-h-[72px] resize-y" maxLength={1000}
                                        />
                                    </div>
                                    <div>
                                        <label className="label" htmlFor="resume-education">Education</label>
                                        <textarea
                                            id="resume-education" value={form.education}
                                            onChange={handleChange('education')}
                                            placeholder={'B.Tech in Computer Science — IIIT Bhubaneswar (2022–2026)\nGPA: 8.7 / 10\nRelevant coursework: DSA, OS, DBMS, Distributed Systems'}
                                            className="input min-h-[100px] resize-y" maxLength={1500}
                                        />
                                    </div>
                                    <div>
                                        <label className="label" htmlFor="resume-experience">Experience</label>
                                        <textarea
                                            id="resume-experience" value={form.experience}
                                            onChange={handleChange('experience')}
                                            placeholder={'Software Engineer Intern — ACME Corp (2024)\n• Built the realtime notifications service\n• Reduced API latency by 40%'}
                                            className="input min-h-[140px] resize-y" maxLength={4000}
                                        />
                                    </div>
                                    <div>
                                        <label className="label" htmlFor="resume-projects">Projects</label>
                                        <textarea
                                            id="resume-projects" value={form.projects}
                                            onChange={handleChange('projects')}
                                            placeholder={'QuestLab — gamified learning platform\n• Realtime study rooms with Socket.IO\n• 5k+ MAU during beta'}
                                            className="input min-h-[140px] resize-y" maxLength={4000}
                                        />
                                    </div>
                                    <div>
                                        <label className="label" htmlFor="resume-certifications">
                                            Certifications & Awards
                                        </label>
                                        <textarea
                                            id="resume-certifications" value={form.certifications}
                                            onChange={handleChange('certifications')}
                                            placeholder={'AWS Certified Cloud Practitioner (2024)\nSmart India Hackathon — finalist (2023)\n• Built an early-warning flood alert system'}
                                            className="input min-h-[110px] resize-y" maxLength={2000}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
                                <p className="text-xs text-gray-500 sm:flex-1">
                                    Tip: in the print dialog, choose <span className="font-semibold text-gray-700">Save as PDF</span>.
                                </p>
                                <button type="submit" className="btn-primary w-full sm:w-auto justify-center inline-flex items-center">
                                    <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 9V2h12v7" />
                                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                        <path d="M6 14h12v8H6z" />
                                    </svg>
                                    Export to PDF
                                </button>
                            </div>
                        </motion.form>

                        {/* RIGHT — LIVE A4 PREVIEW */}
                        <div id="resume-preview" className="lg:pl-2 print:p-0">
                            <div className="bg-white shadow-2xl rounded-md md:aspect-[1/1.414] p-6 sm:p-10 md:p-12 text-gray-900 ring-1 ring-gray-200/60 print:shadow-none print:rounded-none print:p-0 print:m-0 print:aspect-auto print:ring-0 md:overflow-hidden">
                                <div className="h-full w-full flex flex-col print:p-12">
                                    {/* Header */}
                                    <header className="border-b-2 border-gray-900 pb-3 mb-5">
                                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{displayName}</h1>
                                        <p className="text-sm text-gray-700 mt-1 font-medium">{displayRole}</p>
                                        {contactItems.length > 0 && (
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
                                                {contactItems.map((c, i) => (
                                                    <span key={`${c.icon}-${i}`} className="inline-flex items-center gap-1.5">
                                                        {c.icon === 'email' && (
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                                                <path d="m22 7-10 5L2 7" />
                                                            </svg>
                                                        )}
                                                        {c.icon === 'phone' && (
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                            </svg>
                                                        )}
                                                        {c.icon === 'location' && (
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                                                                <circle cx="12" cy="10" r="3" />
                                                            </svg>
                                                        )}
                                                        {c.icon === 'linkedin' && (
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
                                                                <rect x="2" y="9" width="4" height="12" />
                                                                <circle cx="4" cy="4" r="2" />
                                                            </svg>
                                                        )}
                                                        {c.icon === 'github' && (
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                                                            </svg>
                                                        )}
                                                        {c.value}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </header>

                                    {/* Summary */}
                                    {form.summary.trim() && (
                                        <section className="mb-5">
                                            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 border-b border-gray-200 pb-1 mb-2">
                                                Summary
                                            </h2>
                                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{form.summary}</p>
                                        </section>
                                    )}

                                    {/* Skills */}
                                    <section className="mb-5">
                                        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 border-b border-gray-200 pb-1 mb-2">
                                            Skills
                                        </h2>
                                        {skillChips.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {skillChips.map((s, i) => (
                                                    <span
                                                        key={`${s}-${i}`}
                                                        className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-800 print:bg-transparent print:border print:border-gray-300"
                                                    >
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-300 italic">Your skills will appear here…</p>
                                        )}
                                    </section>

                                    {/* Education */}
                                    <section className="mb-5">
                                        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 border-b border-gray-200 pb-1 mb-2">
                                            Education
                                        </h2>
                                        {form.education.trim() ? (
                                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{form.education}</p>
                                        ) : (
                                            <p className="text-sm text-gray-300 italic">Add your degree, school, and any relevant coursework…</p>
                                        )}
                                    </section>

                                    {/* Experience */}
                                    <section className="mb-5">
                                        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 border-b border-gray-200 pb-1 mb-2">
                                            Experience
                                        </h2>
                                        {form.experience.trim() ? (
                                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{form.experience}</p>
                                        ) : (
                                            <p className="text-sm text-gray-300 italic">Add roles, internships, or freelance work…</p>
                                        )}
                                    </section>

                                    {/* Projects */}
                                    <section className="mb-5">
                                        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 border-b border-gray-200 pb-1 mb-2">
                                            Projects
                                        </h2>
                                        {form.projects.trim() ? (
                                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{form.projects}</p>
                                        ) : (
                                            <p className="text-sm text-gray-300 italic">List the projects you've shipped…</p>
                                        )}
                                    </section>

                                    {/* Certifications & Awards */}
                                    {form.certifications.trim() && (
                                        <section>
                                            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 border-b border-gray-200 pb-1 mb-2">
                                                Certifications & Awards
                                            </h2>
                                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{form.certifications}</p>
                                        </section>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Print isolation */}
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    html, body { background: #fff !important; }
                }
            `}</style>
        </div>
    );
}
