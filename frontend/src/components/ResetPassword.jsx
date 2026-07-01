import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post(`/auth/reset-password/${token}`, { password });
            if (data.success) {
                toast.success(data.message || 'Password reset successful!');
                setTimeout(() => navigate('/'), 1500);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password');
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
                    <h2 className="text-2xl font-bold tracking-tight">Reset your password</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Enter a new password for your QuestLab account.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label" htmlFor="new-password">New password</label>
                        <div className="relative">
                            <input
                                id="new-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                className="input pr-12"
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="label" htmlFor="confirm-new-password">Confirm password</label>
                        <input
                            id="confirm-new-password"
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            className="input"
                            required
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" disabled={loading} className="btn-primary w-full">
                        {loading ? (
                            <>
                                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                Resetting…
                            </>
                        ) : 'Reset password'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
