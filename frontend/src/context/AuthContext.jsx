import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { AuthContext } from './useAuth';

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    // Lazy-init from localStorage so initial loading matches the token's
    // presence and we don't have to setLoading(false) inside the boot effect.
    const [loading, setLoading] = useState(() => !!localStorage.getItem('token'));
    const [selectedRole, setSelectedRole] = useState('user'); // 'user' or 'admin'


    useEffect(() => {
        if (localStorage.getItem('token')) {
            (async () => {
                try {
                    const { data } = await api.get('/auth/profile');
                    if (data.success) {
                        setUser(data.user);
                    }
                } catch (error) {
                    console.error('Error loading user:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, []);

    const login = async (email, password) => {
        try {
            // Send the active welcome-screen tab so the backend can reject
            // admin-on-learner-tab (or vice versa) instead of just inferring
            // role from which collection holds the email.
            const { data } = await api.post('/auth/login', { email, password, role: selectedRole });

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
                toast.success(data.message, {
                    icon: '🎮',
                    duration: 4000
                });
                return { success: true, user: data.user };
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Login failed';
            toast.error(message, {
                icon: '❌',
                duration: 4000
            });
            return { success: false, message };
        }
    };

    const register = async (name, email, password, adminKey) => {
        try {
            const { data } = await api.post('/auth/register', {
                name,
                email,
                password,
                role: selectedRole,
                ...(selectedRole === 'admin' ? { adminKey } : {})
            });

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
                toast.success(data.message, {
                    icon: '🎉',
                    duration: 4000
                });
                return { success: true, user: data.user };
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Registration failed';
            toast.error(message, {
                icon: '❌',
                duration: 4000
            });
            return { success: false, message };
        }
    };

    const googleLogin = async (idToken) => {
        try {
            const { data } = await api.post('/auth/google', { idToken, role: selectedRole });

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
                toast.success(data.message, {
                    icon: '🚀',
                    duration: 4000
                });
                return { success: true, user: data.user };
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Google login failed';
            toast.error(message, {
                icon: '❌',
                duration: 4000
            });
            return { success: false, message };
        }
    };

    const updateProfile = async (profileData) => {
        try {
            const { data } = await api.put('/auth/profile', profileData);
            if (data.success) {
                // Update local storage and context
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
                toast.success('Profile updated successfully!', { icon: '✨' });
                return { success: true };
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to update profile';
            toast.error(message, { icon: '❌' });
            return { success: false, message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        toast.success('Logged out successfully! See you soon!', {
            icon: '👋',
            duration: 3000
        });
    };

    const value = {
        user,
        setUser,
        loading,
        selectedRole,
        setSelectedRole,
        login,
        register,
        googleLogin,
        updateProfile,
        logout,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;