import OwnerShell from "../../../components/owner/sidebar.jsx";
import AuthGuard from "../../../components/auth/guard.jsx";

export default function AdminLayout({ children }) {
  return (
    <AuthGuard role="OWNER">
      <OwnerShell>{children}</OwnerShell>
    </AuthGuard>
  );
}
