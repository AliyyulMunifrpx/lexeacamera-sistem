"use client";

import { useParams } from "next/navigation";
import ReportDetailView from "../../../../../components/owner/report-detail-view.jsx";

export default function OwnerDailyReportDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  return <ReportDetailView id={id} role="owner" />;
}
