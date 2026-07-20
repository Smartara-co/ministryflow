/**
 * Browser-only OCR pipeline: PDFs are rasterized to an image (first page)
 * via pdfjs-dist, then run through tesseract.js. Both libraries are
 * dynamically imported so they never bloat a page's initial bundle — this
 * only runs when a document with a known parser (see parseDocumentFields.ts)
 * is selected on the documents page.
 *
 * Never import this from a Server Component — it uses `document`/`canvas`.
 * Every caller must treat failure as normal (network hiccup, corrupt file,
 * blocked CDN) and fall back to a plain upload with no suggestions; OCR is
 * a convenience layer, never a requirement for uploading.
 */

async function pdfFirstPageToImageBlob(file: File): Promise<Blob> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  await page.render({ canvasContext: context, viewport, canvas }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob() returned null'));
    }, 'image/png');
  });
}

export async function extractTextFromFile(file: File): Promise<string> {
  const imageSource: Blob | File =
    file.type === 'application/pdf' ? await pdfFirstPageToImageBlob(file) : file;

  const Tesseract = await import('tesseract.js');
  const { data } = await Tesseract.recognize(imageSource, 'eng');
  return data.text;
}
