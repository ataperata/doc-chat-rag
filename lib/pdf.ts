import { extractText } from "unpdf";
import { HttpError } from "@/lib/http";
import type { PageText } from "@/lib/types";

export async function extractPdfPages(data: Uint8Array): Promise<PageText[]> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);

  let extracted: { text: string | string[] };
  try {
    extracted = await extractText(copy, { mergePages: false });
  } catch (error) {
    console.error(error);
    throw new HttpError("That PDF could not be read.", 422);
  }

  const pageTexts = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  const pages = pageTexts.map((text, index) => ({
    pageNumber: index + 1,
    text: text ?? "",
  }));

  if (!pages.some((page) => page.text.trim().length > 0)) {
    throw new HttpError(
      "No text could be extracted. Scanned image PDFs need an OCR pass first.",
      422,
    );
  }

  return pages;
}
