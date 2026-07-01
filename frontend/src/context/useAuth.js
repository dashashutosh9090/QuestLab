import { createContext, useContext } from 'react';

// Shared auth context — kept in a non-component file so AuthContext.jsx can
// stay HMR-friendly under react-refresh/only-export-components.
export const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
