import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('UI crashed:', error, info?.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="app-bg min-h-screen flex items-center justify-center p-6">
                <div className="surface max-w-md w-full p-8 text-center">
                    <div className="text-5xl mb-3">😵</div>
                    <h1 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h1>
                    <p className="text-gray-600 mb-5 text-sm">
                        The page hit an unexpected error. Try reloading — if it keeps happening, head back to the dashboard.
                    </p>
                    <pre className="text-left text-xs surface-muted rounded-lg p-3 mb-6 overflow-auto max-h-40 text-rose-700 font-mono">
                        {String(this.state.error?.message || this.state.error || 'Unknown error')}
                    </pre>
                    <div className="flex gap-3">
                        <button onClick={() => window.location.reload()} className="btn-primary flex-1">Reload</button>
                        <button
                            onClick={() => { this.handleReset(); window.location.href = '/dashboard'; }}
                            className="btn-ghost flex-1"
                        >
                            Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
