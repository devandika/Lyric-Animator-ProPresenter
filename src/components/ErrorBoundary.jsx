import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI Error caught by boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "30px", background: "#181b22", color: "#f87171", fontFamily: "monospace" }}>
          <h2 style={{ color: "#ef4444" }}>⚠️ Terjadi Error pada Komponen Tampilan</h2>
          <pre style={{ background: "#0d0f14", padding: "16px", borderRadius: "8px", overflowX: "auto", color: "#fca5a5" }}>
            {this.state.error?.toString()}
          </pre>
          <details style={{ marginTop: "14px", color: "#94a3b8" }}>
            <summary>Lihat Stack Trace</summary>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </details>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{ marginTop: "16px", padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            Pulihkan Tampilan
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
