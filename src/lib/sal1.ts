import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Application, ApplicationPayElement } from './types';

/** Renders the SAL 1 (Salary Input Form 1, Republic of The Gambia) layout
 *  from an approved application and its pay elements. Field set mirrors the
 *  real form samples provided by the Ministry (CLAUDE.md §6). */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;
const INK = rgb(0.1, 0.12, 0.14);
const FAINT = rgb(0.45, 0.48, 0.52);
const LINE = rgb(0.75, 0.78, 0.8);

function money(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  return amount.toLocaleString('en-GM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

function drawLabelValue(
  ctx: Ctx,
  label: string,
  value: string | null | undefined,
  x: number,
  width: number,
) {
  ctx.page.drawText(label.toUpperCase(), {
    x,
    y: ctx.y,
    size: 6.5,
    font: ctx.font,
    color: FAINT,
  });
  ctx.page.drawText(value ?? '', {
    x,
    y: ctx.y - 11,
    size: 9,
    font: ctx.bold,
    color: INK,
    maxWidth: width,
  });
  ctx.page.drawLine({
    start: { x, y: ctx.y - 14 },
    end: { x: x + width, y: ctx.y - 14 },
    thickness: 0.5,
    color: LINE,
  });
}

function fieldRow(
  ctx: Ctx,
  fields: Array<[string, string | null | undefined]>,
) {
  const usable = A4[0] - MARGIN * 2;
  const gap = 12;
  const width = (usable - gap * (fields.length - 1)) / fields.length;
  fields.forEach(([label, value], i) => {
    drawLabelValue(ctx, label, value, MARGIN + i * (width + gap), width);
  });
  ctx.y -= 32;
}

function sectionTitle(ctx: Ctx, title: string) {
  ctx.y -= 4;
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN,
    y: ctx.y,
    size: 8.5,
    font: ctx.bold,
    color: INK,
  });
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y - 4 },
    end: { x: A4[0] - MARGIN, y: ctx.y - 4 },
    thickness: 0.8,
    color: INK,
  });
  ctx.y -= 20;
}

function elementsTable(
  ctx: Ctx,
  title: string,
  elements: ApplicationPayElement[],
) {
  sectionTitle(ctx, title);
  const cols = [
    { header: 'CODE', x: MARGIN, width: 60 },
    { header: 'DESCRIPTION', x: MARGIN + 70, width: 260 },
    { header: 'PERIOD AMOUNT (D)', x: MARGIN + 340, width: 85 },
    { header: 'TOTAL AMOUNT (D)', x: MARGIN + 435, width: 80 },
  ];
  for (const col of cols) {
    ctx.page.drawText(col.header, {
      x: col.x,
      y: ctx.y,
      size: 6.5,
      font: ctx.bold,
      color: FAINT,
    });
  }
  ctx.y -= 12;

  // The paper form has 5 line rows per table — always draw 5.
  const rows = 5;
  for (let i = 0; i < rows; i++) {
    const el = elements[i];
    if (el) {
      ctx.page.drawText(el.code ?? '', { x: cols[0].x, y: ctx.y, size: 9, font: ctx.font, color: INK });
      ctx.page.drawText(el.description ?? '', { x: cols[1].x, y: ctx.y, size: 9, font: ctx.font, color: INK, maxWidth: cols[1].width });
      ctx.page.drawText(money(el.period_amount), { x: cols[2].x, y: ctx.y, size: 9, font: ctx.font, color: INK });
      ctx.page.drawText(money(el.total_amount), { x: cols[3].x, y: ctx.y, size: 9, font: ctx.font, color: INK });
    }
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y - 3 },
      end: { x: A4[0] - MARGIN, y: ctx.y - 3 },
      thickness: 0.5,
      color: LINE,
    });
    ctx.y -= 16;
  }

  const totalPeriod = elements.reduce((s, e) => s + (e.period_amount ?? 0), 0);
  const totalAnnual = elements.reduce((s, e) => s + (e.total_amount ?? 0), 0);
  ctx.page.drawText('TOTAL', { x: cols[1].x, y: ctx.y, size: 8, font: ctx.bold, color: INK });
  ctx.page.drawText(money(totalPeriod), { x: cols[2].x, y: ctx.y, size: 9, font: ctx.bold, color: INK });
  ctx.page.drawText(money(totalAnnual), { x: cols[3].x, y: ctx.y, size: 9, font: ctx.bold, color: INK });
  ctx.y -= 26;
}

export async function generateSal1Pdf(
  application: Application,
  payElements: ApplicationPayElement[],
  ministryName: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { page, font, bold, y: A4[1] - MARGIN - 10 };

  // Header
  page.drawText('REPUBLIC OF THE GAMBIA', {
    x: MARGIN,
    y: ctx.y,
    size: 13,
    font: bold,
    color: INK,
  });
  page.drawText('SALARY INPUT FORM 1 (SAL 1)', {
    x: MARGIN,
    y: ctx.y - 18,
    size: 10.5,
    font: bold,
    color: INK,
  });
  page.drawText(ministryName, {
    x: MARGIN,
    y: ctx.y - 32,
    size: 9,
    font,
    color: FAINT,
  });
  page.drawText(`Generated ${new Date().toISOString().slice(0, 10)}`, {
    x: A4[0] - MARGIN - 130,
    y: ctx.y,
    size: 8,
    font,
    color: FAINT,
  });
  ctx.y -= 58;

  sectionTitle(ctx, 'Budget');
  fieldRow(ctx, [
    ['Budget entity', application.budget_entity],
    ['Sub budget entity', application.sub_budget_entity],
    ['Employee no.', application.employee_no],
  ]);

  sectionTitle(ctx, 'Employee details');
  fieldRow(ctx, [
    ['Title', application.title],
    ['Surname', application.surname],
    ['First name', application.first_name],
  ]);
  fieldRow(ctx, [
    ['National ID no.', application.national_id_no],
    ['Date of birth', application.date_of_birth],
    ['Gender', application.gender],
  ]);
  fieldRow(ctx, [
    ['TIN', application.tin],
    ['Mobile phone', application.mobile_phone],
    ['Email', application.email],
  ]);

  sectionTitle(ctx, 'Employment');
  fieldRow(ctx, [
    ['Job title', application.job_title],
    ['Grade', application.grade],
    ['Grade point', application.grade_point],
  ]);
  fieldRow(ctx, [
    ['Employment status', application.employment_status],
    ['Hired from', application.hired_from_date],
    ['Hired to', application.hired_to_date],
  ]);
  fieldRow(ctx, [
    ['Date joined (assumption of duty)', application.date_joined],
    ['Location', application.location],
    ['Basic salary (monthly, D)', money(application.basic_salary)],
  ]);

  sectionTitle(ctx, 'Payment & statutory');
  fieldRow(ctx, [
    ['Payment type', application.payment_type],
    ['Tax type', application.tax_type],
    ['Member / partial', application.member_or_partial],
  ]);
  fieldRow(ctx, [
    ['Liable social security', application.liable_soc_security ? 'Yes' : 'No'],
    ['Social security no.', application.soc_security_no],
    ['Liable WOPS', application.liable_wops ? 'Yes' : 'No'],
  ]);
  fieldRow(ctx, [
    ['Bank account name', application.bank_account_name],
    ['Bank account no.', application.bank_account_no],
    ['Branch code / type', [application.bank_branch_code, application.bank_account_type].filter(Boolean).join(' / ')],
  ]);

  elementsTable(
    ctx,
    'Earning elements',
    payElements.filter((e) => e.element_type === 'earning'),
  );
  elementsTable(
    ctx,
    'Deduction elements',
    payElements.filter((e) => e.element_type === 'deduction'),
  );

  // Signatures
  sectionTitle(ctx, 'Certification');
  const sigWidth = (A4[0] - MARGIN * 2 - 24) / 3;
  ['Prepared by', 'Checked by', 'Authorised by'].forEach((label, i) => {
    const x = MARGIN + i * (sigWidth + 12);
    ctx.page.drawLine({
      start: { x, y: ctx.y - 24 },
      end: { x: x + sigWidth, y: ctx.y - 24 },
      thickness: 0.5,
      color: INK,
    });
    ctx.page.drawText(`${label} / date`, {
      x,
      y: ctx.y - 34,
      size: 7,
      font: ctx.font,
      color: FAINT,
    });
  });

  return doc.save();
}
