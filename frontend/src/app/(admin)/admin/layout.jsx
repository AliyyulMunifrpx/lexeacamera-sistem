import AdminShell from "../../../components/admin/sidebar.jsx";
import AuthGuard from "../../../components/auth/guard.jsx";

export default function AdminLayout({ children }) {
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
