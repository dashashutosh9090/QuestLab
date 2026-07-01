/* eslint-disable react-refresh/only-export-components */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AuthCard from './components/AuthCard';
import Dashboard from './components/Dashboard';
import Leaderboard from './components/Leaderboard';
import MentorSearch from './components/MentorSearch';
import StudyRooms from './components/StudyRooms';
import Roadmap from './components/Roadmap';
import Connections from './components/Connections';

import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './components/AdminDashboard';
import Profile from './components/Profile';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import InterviewPrep from './components/InterviewPrep';
import ResumeBuilder from './components/ResumeBuilder';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<AuthCard />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute learnerOnly={true}>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/leaderboard"
                    element={
                        <ProtectedRoute learnerOnly={true}>
                            <Leaderboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/mentors"
                    element={
                        <ProtectedRoute learnerOnly={true}>
                            <MentorSearch />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/roadmap"
                    element={
                        <ProtectedRoute learnerOnly={true}>
                            <Roadmap />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/study-rooms"
                    element={
                        <ProtectedRoute learnerOnly={true}>
                            <StudyRooms />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/connections"
                    element={
                        <ProtectedRoute learnerOnly={true}>
                            <Connections />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute adminOnly={true}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/resume"
                    element={
                        <ProtectedRoute learnerOnly={true}>
                            <ResumeBuilder />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/interview"
                    element={
                        <ProtectedRoute learnerOnly={true}>
                            <InterviewPrep />
                        </ProtectedRoute>
                    }
                />
            </Routes>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3500,
                    style: {
                        background: 'rgba(255,255,255,0.96)',
                        backdropFilter: 'blur(14px)',
                        color: '#1f2233',
                        borderRadius: '12px',
                        padding: '0.75rem 1rem',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        border: '1px solid rgba(99, 102, 241, 0.18)',
                        boxShadow: '0 12px 32px -8px rgba(99, 102, 241, 0.18), 0 1px 3px rgba(15, 18, 60, 0.06)'
                    },
                    success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } }
                }}
            />
        </Router>
    );
}

export default App;