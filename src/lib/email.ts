import 'server-only';
import { STATUS_LABELS } from './status';
import type { ApplicationStatus } from './types';

/** Workflow notifications via the Resend REST API (free tier: 3,000/month).
 *  No SDK — one fetch call. Failing to send never fails the workflow: the
 *  status change is the source of truth, email is best-effort. */

// smartara.co is verified in the project's Resend account, which lifts the
// test-mode "own inbox only" delivery restriction. Swap to a ministry-owned
// domain (e.g. mail.moh.gov.gm) if/when MoH IT verifies one.
const FROM = 'MinistryFlow <noreply@smartara.co>';

const STATUS_MESSAGES: Partial<
  Record<ApplicationStatus, { subject: string; body: (c?: string | null) => string }>
> = {
  submitted: {
    subject: 'Application received',
    body: () =>
      'Your onboarding application has been received and is awaiting review by the Accounts Office.',
  },
  under_review: {
    subject: 'Application under review',
    body: () => 'Your onboarding application is now being reviewed.',
  },
  needs_correction: {
    subject: 'Corrections requested on your application',
    body: (comments) =>
      `The Accounts Office has requested corrections before your application can proceed.\n\nReviewer comments:\n${comments ?? '(see your dashboard)'}\n\nPlease sign in, make the corrections, and resubmit.`,
  },
  rejected: {
    subject: 'Application rejected',
    body: (comments) =>
      `Your onboarding application has been rejected.\n\nReviewer comments:\n${comments ?? '(see your dashboard)'}`,
  },
  approved: {
    subject: 'Application approved',
    body: () =>
      'Your onboarding application has been approved. Your salary input (SAL 1) form will be processed by the Accounts Office.',
  },
};

export async function sendStatusEmail(options: {
  to: string;
  applicantName: string | null;
  status: ApplicationStatus;
  comments?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const message = STATUS_MESSAGES[options.status];
  if (!message) return;
  if (!apiKey) {
    console.warn(
      `RESEND_API_KEY not set — skipped "${message.subject}" email to ${options.to}`,
    );
    return;
  }

  const greeting = options.applicantName ? `Dear ${options.applicantName},` : 'Hello,';
  const text = [
    greeting,
    '',
    message.body(options.comments),
    '',
    `Application status: ${STATUS_LABELS[options.status]}`,
    '',
    'MinistryFlow — Government Staff Onboarding',
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [options.to],
        subject: `MinistryFlow: ${message.subject}`,
        text,
      }),
    });
    if (!res.ok) {
      console.error('Resend API error', res.status, await res.text());
    }
  } catch (error) {
    console.error('Failed to send status email', error);
  }
}
