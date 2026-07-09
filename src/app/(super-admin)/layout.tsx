import { AppShell } from '@/components/AppShell';
import { requireRole } from '@/lib/auth';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole('super_admin');

  return (
    <AppShell
      areaLabel="Super administrator"
      userName={session.profile.full_name ?? session.email}
      navLinks={[{ href: '/super-admin', label: 'Overview' }]}
    >
      {children}
    </AppShell>
  );
}
