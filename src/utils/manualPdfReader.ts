// Adaptateur pdf.js -> indexation de manuel. Ne dépend pas de pdf.js : il
// reçoit un document déjà ouvert (interface minimale), ce qui permet de
// l'utiliser dans le navigateur comme dans un test Node.

import { indexManualPages, type ManualIndex, type ManualPageItems, type ManualTextItem } from './manualIndexer';

interface PdfTextItemLike {
  str?: string;
  transform?: ArrayLike<number>;
  width?: number;
}

interface PdfPageLike {
  getTextContent(): Promise<{ items: ReadonlyArray<unknown> }>;
}

export interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

function toTextItem(raw: unknown): ManualTextItem | null {
  const item = raw as PdfTextItemLike;
  if (typeof item.str !== 'string' || !item.transform || item.transform.length < 6) return null;
  const [a, b, c, d, e, f] = Array.from(item.transform);
  const size = Math.hypot(c, d) || Math.hypot(a, b);
  return { str: item.str.normalize('NFC'), x: e, y: f, size, width: item.width ?? 0 };
}

export async function readManualPdf(doc: PdfDocumentLike): Promise<ManualIndex> {
  const pages: ManualPageItems[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.map(toTextItem).filter((item): item is ManualTextItem => item !== null);
    pages.push({ page: pageNumber, items });
  }
  return indexManualPages(pages);
}
