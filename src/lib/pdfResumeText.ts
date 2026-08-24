import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfResumeTextItem = {
  height: number;
  pageNumber: number;
  str: string;
  width: number;
  x: number;
  y: number;
};

export type PdfResumePreviewPage = {
  height: number;
  image: string;
  pageNumber: number;
  textItems: PdfResumeTextItem[];
  width: number;
};

export async function extractResumeTextFromPdf(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Upload a PDF resume file.');
  }

  const buffer = await file.arrayBuffer();
  const pdfDocument = await pdfjs.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  const previewPages: PdfResumePreviewPage[] = [];
  const previewImages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.35 });
    const content = await page.getTextContent();
    const textItems = content.items
      .filter((item): item is typeof item & { height?: number; str: string; transform: number[]; width?: number } => 'str' in item && typeof item.str === 'string' && item.str.trim().length > 0 && 'transform' in item && Array.isArray(item.transform))
      .map((item) => {
        const [, , , itemHeight, itemX, itemY] = pdfjs.Util.transform(viewport.transform, item.transform);
        return {
          height: Math.max(Math.abs(itemHeight || item.height || 10), 8),
          pageNumber,
          str: item.str.replace(/\s+/g, ' ').trim(),
          width: Math.max((item.width ?? item.str.length * 5) * 1.35, 8),
          x: itemX,
          y: itemY - Math.max(Math.abs(itemHeight || item.height || 10), 8)
        };
      });
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pageTexts.push(text);
    if (pageNumber <= 3 && typeof window !== 'undefined') {
      const canvas = window.document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const image = canvas.toDataURL('image/png');
        previewImages.push(image);
        previewPages.push({
          height: canvas.height,
          image,
          pageNumber,
          textItems: textItems.filter((item) => item.x >= 0 && item.y >= 0 && item.x <= canvas.width && item.y <= canvas.height),
          width: canvas.width
        });
      }
    }
  }

  return {
    pageCount: pdfDocument.numPages,
    previewImages,
    previewPages,
    text: pageTexts.join('\n\n').trim()
  };
}
