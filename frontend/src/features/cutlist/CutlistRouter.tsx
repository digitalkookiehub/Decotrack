import { Routes, Route } from "react-router-dom";
import { CutlistPage } from "./CutlistPage";
import { CutJobForm } from "./CutJobForm";
import { CutJobDetail } from "./CutJobDetail";

export function CutlistRouter() {
  return (
    <Routes>
      <Route index element={<CutlistPage />} />
      <Route path="jobs" element={<CutJobForm />} />
      <Route path="jobs/new" element={<CutJobForm />} />
      <Route path="jobs/:id" element={<CutJobDetail />} />
      <Route path="jobs/:id/edit" element={<CutJobForm />} />
    </Routes>
  );
}
