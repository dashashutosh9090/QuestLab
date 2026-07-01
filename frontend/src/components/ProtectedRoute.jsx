import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const ProtectedRoute = ({ children, adminOnly = false, learnerOnly = false }) => {
    const { isAuthenticated, loading, user } = useAuth();

    if (loading) {
        return (
            <div className="app-bg min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg float-slow">
                        G
                    </div>
                    <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                    <p className="text-sm text-gray-500">Loading your quest log…</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/" />;
    }

    if (adminOnly && user?.role !== 'admin') {
        return <Navigate to="/dashboard" />;
    }

    if (learnerOnly && user?.role === 'admin') {
        return <Navigate to="/admin" replace />;
    }

    return children;
};

export default ProtectedRoute;
