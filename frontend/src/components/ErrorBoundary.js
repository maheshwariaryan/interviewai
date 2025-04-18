// src/components/ErrorBoundary.js
import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-boundary container mx-auto p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h2>
          <p className="mb-4">We encountered an error while running the application.</p>
          
          <details className="text-left mb-4 p-4 bg-gray-100 rounded">
            <summary className="cursor-pointer mb-2">See error details</summary>
            <p className="text-red-600">{this.state.error && this.state.error.toString()}</p>
            <p className="mt-2">Component Stack:</p>
            <pre className="mt-2 p-2 bg-gray-200 overflow-auto">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
          
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => window.location.reload()}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;