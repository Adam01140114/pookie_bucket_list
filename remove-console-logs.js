#!/usr/bin/env node

/**
 * Script to remove all console.log() statements from a file
 * Handles both single-line and multi-line console.log statements
 */

const fs = require('fs');
const path = require('path');

// Check if file path is provided
if (process.argv.length < 3) {
  console.error('Usage: node remove-console-logs.js <file-path>');
  console.error('Example: node remove-console-logs.js FormWiz GUI/generate.js');
  process.exit(1);
}

const filePath = process.argv[2];

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// Read the file
let content = fs.readFileSync(filePath, 'utf8');
const originalLength = content.length;
const originalLines = content.split('\n').length;

console.log(`📄 Processing file: ${filePath}`);
console.log(`📊 Original file size: ${originalLength} characters, ${originalLines} lines`);

// Normalize various console patterns so we can handle "all kinds" of console calls
// Examples this normalizes:
// - window.console.log(...)      -> console.log(...)
// - console   .   log(...)       -> console.log(...)
// - console?.log(...)            -> console.log(...)
// - window.console   ?.  log(...) -> console.log(...)
content = content
  // window.console.* -> console.*
  .replace(/window\.console\s*\?\.\s*/g, 'console.')
  .replace(/window\.console\s*\.\s*/g, 'console.')
  // console?.method -> console.method
  .replace(/console\s*\?\.\s*/g, 'console.')
  // console   .   method -> console.method
  .replace(/console\s*\.\s*/g, 'console.');

// Count all console statements before removal (after normalization)
// This is intentionally broad so we catch:
// - console.log / console.error / console.warn / console.debug
// - console.trace / console.info / console.dir / console.table / etc.
// - Any other custom console methods
const consoleLogPattern = /console\.[a-zA-Z_$][a-zA-Z0-9_$]*\([^)]*\);?/g;
const matches = content.match(consoleLogPattern);
const countBefore = matches ? matches.length : 0;

console.log(`🔍 Found ${countBefore} console statements (log/error/warn/debug)`);

// Remove all console statements (log, error, warn, debug)
// We need to handle:
// - Single-line: console.log("text");
// - Multi-line: console.log("text",
//              "more text");
// - Nested parentheses: console.log(fn(1, 2));
// - With comments: console.log("text"); // comment

let removedCount = 0;
let result = '';
let i = 0;

while (i < content.length) {
  // Look for the next "console." and handle ANY console method
  const consoleIndex = content.indexOf('console.', i);
  
  if (consoleIndex === -1) {
    // No more console statements, add remaining content
    result += content.substring(i);
    break;
  }
  
  // Determine where the opening parenthesis for this console call is.
  // We assume standard calls like "console.xyz(...)" and find the first "(" after "console."
  const openParenIndex = content.indexOf('(', consoleIndex);
  if (openParenIndex === -1) {
    // Malformed / unexpected, just move past "console." to avoid infinite loop
    result += content.substring(i, consoleIndex + 'console.'.length);
    i = consoleIndex + 'console.'.length;
    continue;
  }
  
  // Add content before the console statement
  result += content.substring(i, consoleIndex);
  
  // Find the matching closing parenthesis
  // We already have an opening "(", so start with depth = 1
  let depth = 1;
  let j = openParenIndex + 1;
  
  // Track parentheses to find the matching closing
  while (j < content.length) {
    const char = content[j];
    
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        // Found the closing parenthesis for console statement
        j++; // Skip the closing parenthesis
        
        // Check if there's a semicolon after (skip whitespace)
        if (j < content.length && content[j] === ';') {
          j++; // Skip the semicolon
        }
        
        // Skip any trailing whitespace
        while (j < content.length && (content[j] === ' ' || content[j] === '\t')) {
          j++;
        }
        
        // Skip the console statement
        removedCount++;
        i = j;
        break;
      }
    }
    
    j++;
  }
  
  // If we didn't find a proper closing (malformed), try to find semicolon as fallback
  if (j >= content.length || depth > 0) {
    const semicolonIndex = content.indexOf(';', consoleIndex);
    if (semicolonIndex !== -1) {
      removedCount++;
      i = semicolonIndex + 1;
    } else {
      // Can't find closing or semicolon, skip past this console statement to avoid infinite loop
      i = consoleIndex + consoleMethodLength;
    }
  }
}

content = result;

// Clean up empty lines left by removed console.log statements
// Remove lines that are now empty or only contain whitespace/comments
const lines = content.split('\n');
const cleanedLines = [];
let prevLineWasEmpty = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Skip empty lines, but keep at most one consecutive empty line
  if (trimmed === '') {
    if (!prevLineWasEmpty) {
      cleanedLines.push('');
      prevLineWasEmpty = true;
    }
    // Skip this empty line
  } else {
    cleanedLines.push(line);
    prevLineWasEmpty = false;
  }
}

content = cleanedLines.join('\n');

// Also remove excessive consecutive empty lines (more than 2)
content = content.replace(/\n\s*\n\s*\n\s*\n+/g, '\n\n');

// Write the cleaned content back to the file
fs.writeFileSync(filePath, content, 'utf8');

const finalLength = content.length;
const finalLines = content.split('\n').length;

console.log(`✅ Removed ${removedCount} console statements (log/error/warn/debug)`);
console.log(`📊 Final file size: ${finalLength} characters, ${finalLines} lines`);
console.log(`📉 Reduction: ${originalLength - finalLength} characters, ${originalLines - finalLines} lines`);
console.log(`💾 File saved: ${filePath}`);

