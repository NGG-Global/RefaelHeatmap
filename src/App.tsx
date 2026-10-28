import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { isConfigured } from "./platform/env";
import { SimplePage } from "./platform/SimplePage";

// Route-level code splitting: each screen is its own chunk.
const ParticipantPage = lazy(() => import("./modules/heatmap/participant/ParticipantPage"));
const DisplayPage = lazy(() => import("./modules/heatmap/display/DisplayPage"));
const HostPage = lazy(() => import("./modules/heatmap/host/HostPage"));

export default function App() {
  if (!isConfigured) {
    return <SimplePage title="NGG Platform" body="Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY." />;
  }
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/v/:shortCode" element={<ParticipantPage />} />
          <Route path="/heatmap/display/:eventId" element={<DisplayPage />} />
          <Route path="/heatmap/host" element={<HostPage />} />
          <Route path="*" element={<SimplePage title="NGG Platform" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
