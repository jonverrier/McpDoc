/**
 * 
 * This module provides functionality for detecting and validating Mermaid diagram types.
 * It uses the mermaid.js library to parse diagram text and determine the diagram type
 * (e.g. flowchart, sequence diagram, C4 context diagram etc).
 * 
 * The main function detectMermaidDiagramType takes a string containing Mermaid markdown
 * and returns the detected diagram type as a string, or an empty string if invalid.
 * 
 * Copyright Jon Verrier, 2025
 */


import mermaid from "mermaid";
import { Builder, until, By } from "selenium-webdriver";
import * as fs from 'fs/promises';
import { generatePreviewHtml } from "./PreviewMermaid.js";

export const noErrors = "No errors";
mermaid.initialize({
   startOnLoad: true
});

/**
 * Detects the type of Mermaid diagram from the provided text
 * @param mermaidText The mermaid diagram text to analyze, with or without code fence markers
 * @returns The detected diagram type (e.g. 'flowchart-v2', 'sequence', 'c4') if valid, empty string if invalid
 */
export async function detectMermaidDiagramType(mermaidText: string): Promise<string> {

   const parsed = mermaidText.replace(/```mermaid\n|```/g, '').trim();
   let detected = "";

   try {
      detected = mermaid.detectType(parsed);
      if (detected.length > 0) {
         return detected;
      }
      else {
         return "";
      }
   }
   catch (error) {
      return "";
   }
}

/**
 * Parses a mermaid diagram text and validates its syntax
 * @param mermaidText The mermaid diagram text to parse, with or without code fence markers
 * @returns "No errors" if valid, otherwise returns error message with line numbers
 */
/* This version is superseded by the one below that uses Selenium to detect parse errors in a real browser session */
export async function parseMermaid(mermaidText: string): Promise<string>  {
   const parsed = mermaidText.replace(/```mermaid\n|```/g, '').trim();

   if (parsed.length === 0) {
      return "Empty diagram";
   }

   try {      
      await mermaid.parse(parsed, {suppressErrors : false});
      return noErrors;
   }
   catch (error: any) {
      if (error.message) {
         // DOMPurify.addHook is not a function is a known issue
         // See: https://github.com/mermaid-js/mermaid/issues/5204#issuecomment-1961715774 
         if (error.message.includes("DOMPurify.addHook is not a function")) {
            return noErrors;
         }
         else {
            return error.message;
         }
      }
      // Fallback for other types of errors
      return `Unknown error.`;
   }
}

export async function parseMermaidInBrowser(mermaidText: string): Promise<string> {
   const parsed = mermaidText.replace(/```mermaid\n|```/g, '').trim();

   if (parsed.length === 0) {
      return "Empty diagram";
   }

   try {
      // Create a basic HTML page with mermaid diagram
      const html = generatePreviewHtml(parsed);

      // Use Selenium to load and check the HTML
      const driver = await new Builder().forBrowser('chrome').build();
      const tempFile = `${process.env.TEMP || '/tmp'}/preview-${Date.now()}.html`;

      try {
         // Write HTML to temporary file and load it
         await fs.writeFile(tempFile, html);
         await driver.get(`file://${tempFile}`);

         // Wait for potential error messages to appear
         await driver.wait(until.elementLocated(By.css('body')), 5000);

         // Look for syntax error messages
         const errorElements = await driver.findElements(By.xpath("//*[contains(text(),'Syntax error')]"));
         if (errorElements.length > 0) {
            const errorText = await errorElements[0].getText();
            return errorText.trim();
         }

         // Wait 5 seconds to allow diagram to render and any errors to appear visually
         await new Promise(resolve => setTimeout(resolve, 5000));

      } finally {
         await driver.quit();
         // Clean up temp file
         await fs.unlink(tempFile);
      }

      return noErrors;

   } catch (error: any) {
      return `Error parsing diagram: ${error.message || 'Unknown error'}`;
   }
}
