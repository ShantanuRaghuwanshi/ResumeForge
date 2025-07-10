import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";

// Import pdf-parse with error handling
let pdfParse: any = null;
try {
  pdfParse = require("pdf-parse");
} catch (error) {
  console.warn("PDF parsing library not available:", error.message);
}

export interface ParsedFile {
  text: string;
  metadata: {
    filename: string;
    size: number;
    type: string;
  };
}

export async function parseFile(buffer: Buffer, filename: string, mimetype: string): Promise<ParsedFile> {
  let text = "";
  
  try {
    if (mimetype === "application/pdf") {
      // Parse PDF using pdf-parse library
      console.log(`[PDF PARSER] Processing PDF file: ${filename}, size: ${buffer.length} bytes`);
      
      if (!pdfParse) {
        throw new Error("PDF parsing library is not available. Please ensure pdf-parse is properly installed.");
      }
      
      try {
        // Create a clean buffer copy to avoid any corruption issues
        const cleanBuffer = Buffer.from(buffer);
        const pdfData = await pdfParse(cleanBuffer, {
          // Options to improve parsing
          max: 0, // Parse all pages
          version: 'default'
        });
        
        text = pdfData.text || "";
        console.log(`[PDF PARSER] Successfully extracted ${text.length} characters from PDF`);
        
        if (text.length > 0) {
          console.log(`[PDF PARSER] Text preview:`, text.substring(0, 200) + "...");
        } else {
          console.warn(`[PDF PARSER] No text extracted from PDF - file may be image-based or corrupted`);
        }
        
        // If no text was extracted, this might be a scanned PDF
        if (!text.trim()) {
          throw new Error("No text found in PDF. This may be a scanned document that requires OCR.");
        }
        
      } catch (pdfError) {
        console.error(`[PDF PARSER] PDF parsing failed:`, pdfError);
        throw new Error(`Failed to parse PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown PDF error'}`);
      }
    } else if (
      mimetype === "application/msword" ||
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // Parse DOCX using mammoth library
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mimetype === "text/plain") {
      text = buffer.toString("utf-8");
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }

    return {
      text: cleanText(text),
      metadata: {
        filename,
        size: buffer.length,
        type: mimetype,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function cleanText(text: string): string {
  return text
    .replace(/[^\x20-\x7E\n\r\t]/g, "") // Remove non-printable characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

export function validateFileType(mimetype: string): boolean {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];
  return allowedTypes.includes(mimetype);
}

export function validateFileSize(size: number): boolean {
  const maxSize = 10 * 1024 * 1024; // 10MB
  return size <= maxSize;
}
