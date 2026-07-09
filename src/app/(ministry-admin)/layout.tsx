import { AppShell } from '@/components/AppShell';
import { requireRole } from '@/lib/auth';

export default async function MinistryAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole('ministry_admin');

  return (
    <AppShell
      areaLabel="Accounts Office — application review"
      userName={session.profile.full_name ?? session.email}
      navLinks={[{ href: '/admin', label: 'Applications' }]}
    >
      {children}
    </AppShell>
  );
}
