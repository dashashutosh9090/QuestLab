import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/forgot-password', { email });
            if (data.success) {
                toast.success(data.message || 'Reset link sent! Check your inbox.');
                setSent(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-bg min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="surface p-8 sm:p-10 w-full max-w-md"
            >
                <Link
                    to="/"
                    className="text-xs font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-6"
                >
                    ← Back to login
                </Link>

                <div className="mb-6">
                    <h2 className="text-2xl font-bold tracking-tight">
                        {sent ? 'Check your email' : 'Forgot password?'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {sent
                            ? 'We sent a password reset link to your inbox. It expires in 15 minutes.'
                            : "Enter the email address linked to your account and we'll send a reset link."}
                    </p>
                </div>

                {sent ? (
                    <div className="text-center">
                        <div className="text-5xl mb-4">📧</div>
                        <p className="text-sm text-gray-600 mb-6">
                            Didn't receive it? Check your spam folder, or try again below.
                        </p>
                        <button
                            onClick={() => setSent(false)}
                            className="btn-ghost w-full"
                        >
                            Send again
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label" htmlFor="forgot-email">Email</label>
                            <input
                                id="forgot-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="input"
                                required
                                disabled={loading}
                            />
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary w-full">
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                    Sending…
                                </>
                            ) : 'Send reset link'}
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
