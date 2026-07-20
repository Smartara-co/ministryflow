import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Application, ApplicationPayElement } from './types';

/** Renders the SAL 1 (Salary Input Form 1, Republic of The Gambia) as a
 *  printable PDF, laid out to match a real filled sample form (not the
 *  interactive Excel/VBA data-entry tool Abdul built — this mirrors the
 *  clean, static, two-page paper layout):
 *
 *  Page 1: budget/identity/employment/statutory fields, each rendered
 *  "Label: value" on an underline, plus the Established/Unestablished/
 *  Contract/Temporary status checkboxes.
 *  Page 2: Earning Elements / Deduction Elements tables (one combined
 *  "code-description" column, not split), Bank Details, and the
 *  Entity Use Only / Treasury Use Only sign-off blocks.
 *
 *  IMPORTANT: Basic Salary is never a row in the Earning Elements table on
 *  the real form — it only ever appears in its own field on page 1. Do not
 *  reintroduce it as a pay element (see actions.ts buildPayElements). */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;
const INK = rgb(0.1, 0.12, 0.14);
const FAINT = rgb(0.45, 0.48, 0.52);
const LINE = rgb(0.55, 0.58, 0.6);

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

/** "Label: value___" inline style — label then the value sitting on an
 *  underline, matching the paper form (not a stacked label-above-value). */
function field(
  ctx: Ctx,
  label: string,
  value: string | null | undefined,
  x: number,
  width: number,
) {
  const labelText = `${label}:`;
  ctx.page.drawText(labelText, { x, y: ctx.y, size: 8.5, font: ctx.bold, color: INK });
  const labelWidth = ctx.bold.widthOfTextAtSize(labelText, 8.5);
  const valueX = x + labelWidth + 5;
  const lineEnd = x + width;
  if (value) {
    ctx.page.drawText(value, {
      x: valueX,
      y: ctx.y + 1,
      size: 8.5,
      font: ctx.font,
      color: INK,
      maxWidth: Math.max(0, lineEnd - valueX),
    });
  }
  ctx.page.drawLine({
    start: { x: valueX, y: ctx.y - 2 },
    end: { x: lineEnd, y: ctx.y - 2 },
    thickness: 0.6,
    color: LINE,
  });
}

/** A row of inline fields with explicit widths (the real form's groupings
 *  aren't uniform thirds, unlike a generic table). */
function row(
  ctx: Ctx,
  fields: Array<{ label: string; value?: string | null; width: number }>,
) {
  let x = MARGIN;
  for (const f of fields) {
    field(ctx, f.label, f.value, x, f.width);
    x += f.width + 16;
  }
  ctx.y -= 22;
}

function checkbox(
  ctx: Ctx,
  label: string,
  x: number,
  y: number,
  checked: boolean,
) {
  const size = 8;
  ctx.page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    borderColor: INK,
    borderWidth: 0.8,
  });
  if (checked) {
    ctx.page.drawLine({ start: { x, y }, end: { x: x + size, y: y + size }, thickness: 0.9, color: INK });
    ctx.page.drawLine({ start: { x, y: y + size }, end: { x: x + size, y }, thickness: 0.9, color: INK });
  }
  ctx.page.drawText(label, {
    x: x + size + 5,
    y: y + 1,
    size: 8,
    font: ctx.font,
    color: INK,
  });
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

/** Earning/Deduction Elements table: one combined "code-description"
 *  column (as on the real form, e.g. "110-Risk Allowance"), Period Amount,
 *  Total Amount. Always at least 8 rows so the table looks like the paper
 *  form even when mostly blank; grows to fit more real elements. */
function elementsTable(
  ctx: Ctx,
  title: string,
  elements: ApplicationPayElement[],
) {
  sectionTitle(ctx, title);
  const descX = MARGIN;
  const descWidth = 230;
  const periodX = MARGIN + descWidth + 10;
  const periodWidth = 120;
  const totalX = periodX + periodWidth + 10;
  const totalWidth = 120;

  ctx.page.drawText('CODE/DESCRIPTION', { x: descX, y: ctx.y, size: 6.5, font: ctx.bold, color: FAINT });
  ctx.page.drawText('PERIOD AMOUNT', { x: periodX, y: ctx.y, size: 6.5, font: ctx.bold, color: FAINT });
  ctx.page.drawText('TOTAL AMOUNT', { x: totalX, y: ctx.y, size: 6.5, font: ctx.bold, color: FAINT });
  ctx.y -= 12;

  const rows = Math.max(8, elements.length);
  for (let i = 0; i < rows; i++) {
    const el = elements[i];
    if (el) {
      const label = el.code ? `${el.code}-${el.description ?? ''}` : (el.description ?? '');
      ctx.page.drawText(label, { x: descX, y: ctx.y, size: 8.5, font: ctx.font, color: INK, maxWidth: descWidth });
      ctx.page.drawText(money(el.period_amount), { x: periodX, y: ctx.y, size: 8.5, font: ctx.font, color: INK });
      ctx.page.drawText(money(el.total_amount), { x: totalX, y: ctx.y, size: 8.5, font: ctx.font, color: INK });
    }
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y - 3 },
      end: { x: totalX + totalWidth, y: ctx.y - 3 },
      thickness: 0.5,
      color: LINE,
    });
    ctx.y -= 15;
  }

  const totalPeriod = elements.reduce((s, e) => s + (e.period_amount ?? 0), 0);
  const totalAnnual = elements.reduce((s, e) => s + (e.total_amount ?? 0), 0);
  ctx.page.drawText(`Total ${title.replace(' Elements', '')}`, {
    x: descX,
    y: ctx.y,
    size: 8.5,
    font: ctx.bold,
    color: INK,
  });
  ctx.page.drawText(money(totalPeriod), { x: periodX, y: ctx.y, size: 8.5, font: ctx.bold, color: INK });
  ctx.page.drawText(money(totalAnnual), { x: totalX, y: ctx.y, size: 8.5, font: ctx.bold, color: INK });
  ctx.y -= 26;
}

export async function generateSal1Pdf(
  application: Application,
  payElements: ApplicationPayElement[],
  ministryName: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ---------------------------------------------------------------------
  // Page 1
  // ---------------------------------------------------------------------
  const page1 = doc.addPage(A4);
  const ctx: Ctx = { page: page1, font, bold, y: A4[1] - MARGIN - 10 };

  page1.drawText('REPUBLIC OF THE GAMBIA', {
    x: MARGIN,
    y: ctx.y,
    size: 13,
    font: bold,
    color: INK,
  });
  page1.drawText('SALARY INPUT FORM 1', {
    x: MARGIN,
    y: ctx.y - 18,
    size: 10.5,
    font: bold,
    color: INK,
  });
  page1.drawText(ministryName, {
    x: MARGIN,
    y: ctx.y - 32,
    size: 9,
    font,
    color: FAINT,
  });

  // "Input Type" box, top-right, matching the real form.
  const boxX = A4[0] - MARGIN - 110;
  page1.drawText('INPUT TYPE (ADD=New, MODIFY=Change)', {
    x: boxX - 150,
    y: ctx.y,
    size: 7,
    font,
    color: FAINT,
  });
  page1.drawRectangle({
    x: boxX,
    y: ctx.y - 4,
    width: 30,
    height: 14,
    borderColor: INK,
    borderWidth: 0.8,
  });
  page1.drawText('ADD', { x: boxX + 5, y: ctx.y, size: 8.5, font: bold, color: INK });
  page1.drawText(`Date: ${new Date().toISOString().slice(0, 10)}`, {
    x: boxX - 10,
    y: ctx.y - 22,
    size: 7.5,
    font,
    color: FAINT,
  });
  ctx.y -= 56;

  row(ctx, [
    { label: 'Budget Entity', value: application.budget_entity, width: 235 },
    { label: 'Sub Budget Entity', value: application.sub_budget_entity, width: 235 },
  ]);
  row(ctx, [
    { label: 'Employee No', value: application.employee_no, width: 160 },
    { label: 'Period', value: null, width: 160 },
  ]);
  ctx.y -= 6;

  row(ctx, [
    { label: 'Title', value: application.title, width: 90 },
    { label: 'Surname', value: application.surname, width: 175 },
    { label: 'First Name', value: application.first_name, width: 200 },
  ]);
  row(ctx, [
    { label: 'TIN', value: application.tin, width: 160 },
    { label: 'Date of Birth', value: application.date_of_birth, width: 160 },
    { label: 'Phone Number', value: application.mobile_phone, width: 130 },
  ]);
  row(ctx, [
    { label: 'Gender', value: application.gender, width: 160 },
    { label: 'National ID No', value: application.national_id_no, width: 160 },
    { label: 'Email', value: application.email, width: 130 },
  ]);
  ctx.y -= 6;

  // Status checkboxes: Established/Unestablished, Contract/Temporary,
  // plus Member of Parliament / Interdicted (not collected explicitly by
  // the onboarding form — left unticked; see application.member_or_partial
  // printed alongside for the reviewer's reference).
  page1.drawText('STATUS', { x: MARGIN, y: ctx.y, size: 7, font: bold, color: FAINT });
  const statusTop = ctx.y - 12;
  checkbox(ctx, 'Established', MARGIN, statusTop, application.employment_status === 'established');
  checkbox(ctx, 'Unestablished', MARGIN, statusTop - 14, application.employment_status === 'unestablished');
  checkbox(ctx, 'Contract', MARGIN + 150, statusTop, application.employment_status === 'contract');
  checkbox(ctx, 'Temporary', MARGIN + 150, statusTop - 14, application.employment_status === 'temporary');
  checkbox(ctx, 'Member of Parliament', MARGIN + 300, statusTop, false);
  checkbox(ctx, 'Interdicted', MARGIN + 300, statusTop - 14, false);
  if (application.member_or_partial) {
    page1.drawText(`(noted: ${application.member_or_partial})`, {
      x: MARGIN + 300,
      y: statusTop - 28,
      size: 7,
      font,
      color: FAINT,
    });
  }
  ctx.y = statusTop - 40;

  row(ctx, [
    { label: 'Hired From Date', value: application.hired_from_date, width: 235 },
    { label: 'Hired To Date', value: application.hired_to_date, width: 235 },
  ]);
  row(ctx, [
    { label: 'Job', value: application.job_title, width: 235 },
    { label: 'Date Joined', value: application.date_joined, width: 160 },
  ]);
  row(ctx, [
    { label: 'Grade', value: application.grade, width: 160 },
    { label: 'Location', value: application.location, width: 235 },
    {
      label: 'Liable Soc. Security',
      value: application.liable_soc_security ? 'Yes' : 'No',
      width: 100,
    },
  ]);
  row(ctx, [
    { label: 'Grade Point', value: application.grade_point, width: 160 },
    { label: 'Basic Salary', value: money(application.basic_salary), width: 160 },
    { label: 'Soc. Security No', value: application.soc_security_no, width: 160 },
  ]);
  row(ctx, [
    { label: 'Liable WOPS', value: application.liable_wops ? 'Yes' : 'No', width: 160 },
    { label: 'Increment Date', value: null, width: 235 },
  ]);
  ctx.y -= 6;

  row(ctx, [
    {
      label: 'Payment Type (Cash/Bank)',
      value: application.payment_type ?? null,
      width: 235,
    },
    {
      label: 'Tax Type (Exempt/Standard/Assessed)',
      value: application.tax_type ?? null,
      width: 235,
    },
  ]);

  page1.drawText('Please turn over', {
    x: MARGIN,
    y: MARGIN,
    size: 7.5,
    font,
    color: FAINT,
  });

  // ---------------------------------------------------------------------
  // Page 2
  // ---------------------------------------------------------------------
  const page2 = doc.addPage(A4);
  const ctx2: Ctx = { page: page2, font, bold, y: A4[1] - MARGIN - 10 };

  elementsTable(
    ctx2,
    'Earning Elements',
    payElements.filter((e) => e.element_type === 'earning'),
  );
  elementsTable(
    ctx2,
    'Deduction Elements',
    payElements.filter((e) => e.element_type === 'deduction'),
  );

  sectionTitle(ctx2, 'Bank Details');
  row(ctx2, [
    { label: 'Bank/Branch Code (Bank ID)', value: application.bank_branch_code, width: 235 },
    { label: 'Bank Account No', value: application.bank_account_no, width: 235 },
  ]);
  row(ctx2, [
    { label: 'Account Type (Current/Savings)', value: application.bank_account_type, width: 235 },
    // BBAN is not collected by the onboarding form; left blank for the
    // Accounts Office to fill in if the bank requires it.
    { label: 'BBAN', value: null, width: 235 },
  ]);
  const accountNameRowY = ctx2.y;
  row(ctx2, [{ label: 'Account Name', value: application.bank_account_name, width: 490 }]);
  ctx2.page.drawText(
    '(Only needed if the bank account name differs from the employee name above.)',
    { x: MARGIN, y: accountNameRowY - 12, size: 6.5, font, color: FAINT },
  );
  ctx2.y -= 10;

  sectionTitle(ctx2, 'Sign-off');
  const colWidth = (A4[0] - MARGIN * 2 - 30) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + 30;

  page2.drawText('ENTITY USE ONLY', { x: leftX, y: ctx2.y, size: 7.5, font: bold, color: INK });
  page2.drawText('TREASURY USE ONLY', { x: rightX, y: ctx2.y, size: 7.5, font: bold, color: INK });
  ctx2.y -= 18;

  const entityLines = ['Reference and Date of Authority', 'Prepared By and Date', 'Authorised By and Date', 'Entered By and Date'];
  const treasuryLines = ['Entered By and Date', 'Checked By and Date', 'Updated By and Date'];
  const maxLines = Math.max(entityLines.length, treasuryLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (entityLines[i]) {
      page2.drawText(`${entityLines[i]}:`, { x: leftX, y: ctx2.y, size: 8, font, color: FAINT });
      page2.drawLine({
        start: { x: leftX, y: ctx2.y - 14 },
        end: { x: leftX + colWidth, y: ctx2.y - 14 },
        thickness: 0.6,
        color: LINE,
      });
    }
    if (treasuryLines[i]) {
      page2.drawText(`${treasuryLines[i]}:`, { x: rightX, y: ctx2.y, size: 8, font, color: FAINT });
      page2.drawLine({
        start: { x: rightX, y: ctx2.y - 14 },
        end: { x: rightX + colWidth, y: ctx2.y - 14 },
        thickness: 0.6,
        color: LINE,
      });
    }
    ctx2.y -= 32;
  }

  return doc.save();
}
