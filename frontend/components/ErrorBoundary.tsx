import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
    // Send to Sentry
    Sentry.captureException(error, { extra: errorInfo as any });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <h2 style={styles.title}>Something went wrong.</h2>
            <p style={styles.message}>Please refresh the page.</p>
            <button
              onClick={() => window.location.reload()}
              style={styles.button}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)";
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.95";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.0)";
                (e.currentTarget as HTMLButtonElement).style.opacity = "1.0";
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#03000a",
    fontFamily: "'Inter', sans-serif",
    color: "#fff",
    padding: "20px",
  },
  card: {
    padding: "40px",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
    textAlign: "center" as const,
    maxWidth: "400px",
    width: "100%",
  },
  title: {
    fontSize: "24px",
    fontWeight: 600,
    marginBottom: "12px",
    background: "linear-gradient(to right, #ff2a5f, #b92eff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  message: {
    fontSize: "15px",
    color: "#a0a0ba",
    marginBottom: "24px",
    lineHeight: "1.5",
  },
  button: {
    padding: "12px 24px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(to right, #ff2a5f, #b92eff)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.2s ease, opacity 0.2s ease",
  }
};

export default ErrorBoundary;
