import { AppShell } from '@/components/AppShell';
import { requireRole } from '@/lib/auth';

export default async function ApplicantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole('applicant');

  return (
    <AppShell
      areaLabel="Staff onboarding"
      userName={session.profile.full_name ?? session.email}
      navLinks={[
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/application', label: 'My application' },
        { href: '/application/documents', label: 'Documents' },
      ]}
    >
      {children}
    </AppShell>
  );
}
