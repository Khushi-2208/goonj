import pdf from 'pdf-parse';
import axios from 'axios';
import { convert } from 'html-to-text';
import https from 'https';

/**
 * Extracts raw text content from an uploaded PDF file buffer.
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = await pdf(pdfBuffer);
    return data.text || '';
  } catch (error) {
    console.error('Error parsing PDF content:', error);
    throw new Error('Failed to parse PDF document text.');
  }
}

/**
 * Crawls a website link, fetches the HTML page, and converts it to formatted clean text.
 * Strips out navigation, scripts, styling, header, and footer tags.
 */
export async function extractTextFromUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    if (typeof response.data !== 'string') {
      throw new Error('Received non-HTML response from URL.');
    }

    const text = convert(response.data, {
      wordwrap: 120,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'nav', format: 'skip' },
        { selector: 'footer', format: 'skip' },
        { selector: 'header', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'iframe', format: 'skip' }
      ]
    });

    return text || '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error scraping url ${url}:`, message);
    throw new Error(`Failed to crawl URL: ${message}`);
  }
}

/**
 * Splits a long text body into semantic chunks of roughly targetSize characters.
 * Integrates an overlap region to avoid breaking sentences or context near chunk boundaries.
 */
export function chunkText(text: string, chunkSize: number = 800, overlap: number = 200): string[] {
  // Split by double line breaks first to identify natural paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If adding this paragraph keeps the chunk size reasonable, append it
    if (currentChunk.length + trimmed.length <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    } else {
      // Otherwise, save the current chunk
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If the individual paragraph itself is massive, slice it using a sliding window
      if (trimmed.length > chunkSize) {
        let start = 0;
        while (start < trimmed.length) {
          const slice = trimmed.slice(start, start + chunkSize);
          chunks.push(slice);
          start += chunkSize - overlap;
        }
        currentChunk = '';
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
