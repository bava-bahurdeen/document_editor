"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Class component acting as an Error Boundary to catch React crashes.
 */
export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl max-w-md mx-auto my-12 text-center text-slate-100">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
          <h2 className="text-xl font-bold mb-2">Application Crash</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {this.state.error?.message || "An unexpected rendering exception was caught."}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow transition-all duration-150"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
