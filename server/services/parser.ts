import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Since pdf-parse has ES module import issues, we'll use a subprocess approach
async function parsePdfWithSubprocess(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // Write buffer to temporary file
    const tempPath = `/tmp/temp_pdf_${Date.now()}.pdf`;
    fs.writeFileSync(tempPath, buffer);
    
    // Use Node.js subprocess to call pdf-parse
    const nodeScript = `
      const fs = require('fs');
      const pdfParse = require('pdf-parse');
      
      async function extractText() {
        try {
          const buffer = fs.readFileSync('${tempPath}');
          const data = await pdfParse(buffer);
          console.log(JSON.stringify({ success: true, text: data.text }));
        } catch (error) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        }
      }
      
      extractText();
    `;
    
    exec(`node -e "${nodeScript}"`, (error, stdout, stderr) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      if (error) {
        reject(new Error(`PDF parsing failed: ${error.message}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          resolve(result.text);
        } else {
          reject(new Error(result.error));
        }
      } catch (parseError) {
        reject(new Error(`Failed to parse PDF extraction result: ${parseError}`));
      }
    });
  });
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
      // Parse PDF using subprocess approach to avoid ES module import issues
      console.log(`[PDF PARSER] Processing PDF file: ${filename}, size: ${buffer.length} bytes`);
      
      try {
        console.log(`[PDF PARSER] Calling subprocess PDF parser...`);
        text = await parsePdfWithSubprocess(buffer);
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
