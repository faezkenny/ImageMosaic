"use client";
import React from "react";

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="min-h-dvh flex items-center justify-center p-8"
                    style={{ background: "var(--color-bg)" }}>
                    <div className="glass-card p-8 max-w-md w-full text-center flex flex-col gap-4">
                        <div className="text-4xl">⚠️</div>
                        <h2 className="text-lg font-bold text-[var(--color-text)]">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-[var(--color-muted)]">
                            {this.state.error?.message ?? "An unexpected error occurred."}
                        </p>
                        <button
                            onClick={this.handleReset}
                            className="mx-auto px-6 py-2.5 rounded-xl font-bold text-sm text-white"
                            style={{ background: "linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to))" }}
                        >
                            Try again
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
