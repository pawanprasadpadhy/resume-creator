import { Component } from "react";
import { AlertIcon } from "./Icons.jsx";

// Catches render errors so a bug shows a message instead of unmounting the
// whole app (which leaves a blank dark page). Changing `resetKey` - e.g. the
// markdown being edited - clears the error and tries rendering again.
export default class ErrorBoundary extends Component {
	state = { error: null };

	static getDerivedStateFromError(error) {
		return { error };
	}

	componentDidCatch(error, info) {
		console.error("Render error:", error, info?.componentStack);
	}

	componentDidUpdate(prevProps) {
		if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
			this.setState({ error: null });
		}
	}

	render() {
		if (!this.state.error) return this.props.children;
		if (this.props.fallback) return this.props.fallback;

		return (
			<div className="error-fallback" role="alert">
				<AlertIcon size={22} />
				<strong>{this.props.title || "Something went wrong."}</strong>
				<span>{this.props.hint || "Try reloading the page."}</span>
				{this.props.showReload && (
					<button
						className="btn btn-primary"
						onClick={() => window.location.reload()}
					>
						Reload
					</button>
				)}
			</div>
		);
	}
}
