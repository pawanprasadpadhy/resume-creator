import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary
      title="Resume Creator hit a problem."
      hint="Your uploads are saved in this browser. Reload to continue."
      showReload
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
