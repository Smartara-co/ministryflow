'use client';

import { useRef, useState, useTransition } from 'react';
import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_CONFIG,
  MAX_FILE_SIZE_BYTES,
  type DocType,
} from '@/lib/documents';
import {
  hasParserForDocType,
  parseFieldsForDocType,
  type ExtractedField,
} from '@/lib/ocr/parseDocumentFields';
import type { DocumentRow } from '@/lib/types';
import { deleteDocument, uploadDocument, type ActionResult } from '../../actions';
import { DocumentInsights } from './DocumentInsights';

function fileNameFromPath(path: string): string {
  const base = path.split('/').pop() ?? path;
  // Strip the timestamp prefix added on upload.
  return base.replace(/^\d+_/, '');
}

function UploadRow({
  docType,
  documents,
  editable,
}: {
  docType: DocType;
  documents: DocumentRow[];
  editable: boolean;
}) {
  const config = DOCUMENT_CONFIG[docType];
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [insights, setInsights] = useState<ExtractedField[] | null>(null);

  const complete = documents.length >= 1;
  const canAddMore = editable && documents.length < config.maxFiles;

  function handleUpload(file: File) {
    setResult(null);
    setInsights(null);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setResult({ ok: false, message: 'File is larger than the 5MB limit.' });
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setResult({ ok: false, message: 'Only PDF, JPEG, and PNG files are accepted.' });
      return;
    }
    const data = new FormData();
    data.set('doc_type', docType);
    data.set('file', file);
    startTransition(async () => {
      setResult(await uploadDocument(data));
      if (inputRef.current) inputRef.current.value = '';
    });

    // Best-effort, purely additive: never blocks or affects the upload
    // above. Only runs for document types with a defined parser.
    if (hasParserForDocType(docType)) {
      setScanning(true);
      import('@/lib/ocr/extractText')
        .then(({ extractTextFromFile }) => extractTextFromFile(file))
        .then((text) => {
          const fields = parseFieldsForDocType(docType, text);
          setInsights(fields.length > 0 ? fields : null);
        })
        .catch(() => setInsights(null))
        .finally(() => setScanning(false));
    }
  }

  function handleDelete(id: string) {
    setResult(null);
    startTransition(async () => {
      setResult(await deleteDocument(id));
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {config.label}
            <span
              className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                complete
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {complete ? 'Uploaded' : 'Required'}
            </span>
          </p>
          {config.hint && <p className="mt-1 text-xs text-slate-500">{config.hint}</p>}
        </div>
        {canAddMore && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_MIME_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-emerald-700 px-4 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
            >
              {pending ? 'Uploading…' : documents.length > 0 ? 'Add file' : 'Upload'}
            </button>
          </div>
        )}
      </div>

      {documents.length > 0 && (
        <ul className="mt-4 space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <span className="truncate">{fileNameFromPath(doc.storage_path)}</span>
              {editable && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleDelete(doc.id)}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {result && !result.ok && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.message}
        </p>
      )}

      {scanning && (
        <p className="mt-3 text-xs text-slate-500">Scanning document for details…</p>
      )}
      {insights && insights.length > 0 && <DocumentInsights fields={insights} />}
    </div>
  );
}

export function DocumentsManager({
  documents,
  requiredTypes,
  editable,
}: {
  documents: DocumentRow[];
  requiredTypes: DocType[];
  editable: boolean;
}) {
  return (
    <div className="space-y-4">
      {!editable && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Your application has been submitted — documents can no longer be
          changed unless corrections are requested.
        </p>
      )}
      {requiredTypes.map((docType) => (
        <UploadRow
          key={docType}
          docType={docType}
          editable={editable}
          documents={documents.filter((d) => d.doc_type === docType)}
        />
      ))}
    </div>
  );
}
