import { Suspense } from "react";

function Fallback() {
  return (
    <div className="flex min-h-64 items-center justify-center text-sm text-second/60">
      Memuat...
    </div>
  );
}

export default function CameraIdLayout({ children }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>;
}
