import { useState } from "react";
import { FileTextIcon, LockIcon, SpinnerIcon } from "./Icons.jsx";

export default function UnlockScreen({ onUnlock }) {
	const [key, setKey] = useState("");
	const [status, setStatus] = useState("idle"); // idle | checking | invalid | offline

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!key.trim()) return;
		setStatus("checking");
		try {
			const ok = await onUnlock(key.trim());
			if (!ok) setStatus("invalid");
		} catch {
			setStatus("offline");
		}
	};

	return (
		<div className="unlock-screen">
			<form className="unlock-card" onSubmit={handleSubmit}>
				<span className="brand-mark unlock-mark">
					<FileTextIcon size={20} />
				</span>
				<h1 className="unlock-title">Resume Creator</h1>
				<p className="unlock-sub">
					Enter your access key to open your resumes.
				</p>

				<label className="unlock-field">
					<LockIcon size={15} />
					<input
						type="password"
						autoComplete="current-password"
						placeholder="Access key"
						value={key}
						onChange={(e) => {
							setKey(e.target.value);
							if (status !== "checking") setStatus("idle");
						}}
						autoFocus
					/>
				</label>

				{status === "invalid" && (
					<p className="unlock-error">That key isn't valid.</p>
				)}
				{status === "offline" && (
					<p className="unlock-error">
						Could not reach the server. It may be waking up, please
						try again.
					</p>
				)}

				<button
					className="btn btn-primary unlock-submit"
					type="submit"
					disabled={status === "checking" || !key.trim()}
				>
					{status === "checking" && <SpinnerIcon size={15} />}
					{status === "checking" ? "Checking…" : "Unlock"}
				</button>
			</form>
		</div>
	);
}
