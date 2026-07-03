/**
 * Orion IDE — Frontend Language Map
 *
 * Frontend-compatible version of the shared language registry.
 * Provides lookups by filename, extension, and ID.
 */

const LANGUAGES = [
  // ── 18 Executable Languages ──────────────────────────────────────────
  { id: 'python', displayName: 'Python', extensions: ['.py'], monacoLanguage: 'python', pistonLanguage: 'python', icon: '\u{1F40D}', color: '#3572A5', fileTemplate: '# Python\n\ndef main():\n    print("Hello, Orion!")\n\nif __name__ == "__main__":\n    main()\n' },
  { id: 'javascript', displayName: 'JavaScript', extensions: ['.js', '.jsx'], monacoLanguage: 'javascript', pistonLanguage: 'javascript', icon: '\u{1F7E8}', color: '#F7DF1E', fileTemplate: '// JavaScript\n\nfunction main() {\n    console.log("Hello, Orion!");\n}\n\nmain();\n' },
  { id: 'typescript', displayName: 'TypeScript', extensions: ['.ts', '.tsx'], monacoLanguage: 'typescript', pistonLanguage: 'typescript', icon: '\u{1F537}', color: '#3178C6', fileTemplate: '// TypeScript\n\nfunction main(): void {\n    console.log("Hello, Orion!");\n}\n\nmain();\n' },
  { id: 'java', displayName: 'Java', extensions: ['.java'], monacoLanguage: 'java', pistonLanguage: 'java', icon: '\u2615', color: '#B07219', fileTemplate: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Orion!");\n    }\n}\n' },
  { id: 'c', displayName: 'C', extensions: ['.c'], monacoLanguage: 'c', pistonLanguage: 'c', icon: '\u2699\uFE0F', color: '#555555', fileTemplate: '#include <stdio.h>\n\nint main() {\n    printf("Hello, Orion!\\n");\n    return 0;\n}\n' },
  { id: 'cpp', displayName: 'C++', extensions: ['.cpp', '.cc', '.cxx'], monacoLanguage: 'cpp', pistonLanguage: 'cpp', icon: '\u26A1', color: '#F34B7D', fileTemplate: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, Orion!" << std::endl;\n    return 0;\n}\n' },
  { id: 'csharp', displayName: 'C#', extensions: ['.cs'], monacoLanguage: 'csharp', pistonLanguage: 'csharp', icon: '\u{1F7E3}', color: '#178600', fileTemplate: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Orion!");\n    }\n}\n' },
  { id: 'go', displayName: 'Go', extensions: ['.go'], monacoLanguage: 'go', pistonLanguage: 'go', icon: '\u{1F439}', color: '#00ADD8', fileTemplate: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Orion!")\n}\n' },
  { id: 'rust', displayName: 'Rust', extensions: ['.rs'], monacoLanguage: 'rust', pistonLanguage: 'rust', icon: '\u{1F980}', color: '#DEA584', fileTemplate: 'fn main() {\n    println!("Hello, Orion!");\n}\n' },
  { id: 'php', displayName: 'PHP', extensions: ['.php'], monacoLanguage: 'php', pistonLanguage: 'php', icon: '\u{1F418}', color: '#4F5D95', fileTemplate: '<?php\n\necho "Hello, Orion!\\n";\n' },
  { id: 'ruby', displayName: 'Ruby', extensions: ['.rb'], monacoLanguage: 'ruby', pistonLanguage: 'ruby', icon: '\u{1F48E}', color: '#701516', fileTemplate: '# Ruby\nputs "Hello, Orion!"\n' },
  { id: 'kotlin', displayName: 'Kotlin', extensions: ['.kt'], monacoLanguage: 'kotlin', pistonLanguage: 'kotlin', icon: '\u{1F3AF}', color: '#A97BFF', fileTemplate: 'fun main() {\n    println("Hello, Orion!")\n}\n' },
  { id: 'swift', displayName: 'Swift', extensions: ['.swift'], monacoLanguage: 'swift', pistonLanguage: 'swift', icon: '\u{1F34E}', color: '#F05138', fileTemplate: 'import Foundation\n\nprint("Hello, Orion!")\n' },
  { id: 'bash', displayName: 'Bash', extensions: ['.sh', '.bash'], monacoLanguage: 'shell', pistonLanguage: 'bash', icon: '\u{1F5A5}\uFE0F', color: '#89E051', fileTemplate: '#!/bin/bash\n\necho "Hello, Orion!"\n' },
  { id: 'r', displayName: 'R', extensions: ['.r', '.R'], monacoLanguage: 'r', pistonLanguage: 'r', icon: '\u{1F4CA}', color: '#198CE7', fileTemplate: '# R\ncat("Hello, Orion!\\n")\n' },
  { id: 'dart', displayName: 'Dart', extensions: ['.dart'], monacoLanguage: 'dart', pistonLanguage: 'dart', icon: '\u{1F3AF}', color: '#00B4AB', fileTemplate: 'void main() {\n  print("Hello, Orion!");\n}\n' },
  { id: 'lua', displayName: 'Lua', extensions: ['.lua'], monacoLanguage: 'lua', pistonLanguage: 'lua', icon: '\u{1F319}', color: '#000080', fileTemplate: '-- Lua\nprint("Hello, Orion!")\n' },
  { id: 'perl', displayName: 'Perl', extensions: ['.pl', '.pm'], monacoLanguage: 'perl', pistonLanguage: 'perl', icon: '\u{1F42A}', color: '#0298C3', fileTemplate: '#!/usr/bin/perl\nuse strict;\nuse warnings;\n\nprint "Hello, Orion!\\n";\n' },

  // ── Non-executable ───────────────────────────────────────────────────
  { id: 'html', displayName: 'HTML', extensions: ['.html', '.htm'], monacoLanguage: 'html', pistonLanguage: null, icon: '\u{1F310}', color: '#E34C26', fileTemplate: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Orion</title>\n</head>\n<body>\n    <h1>Hello, Orion!</h1>\n</body>\n</html>\n' },
  { id: 'css', displayName: 'CSS', extensions: ['.css'], monacoLanguage: 'css', pistonLanguage: null, icon: '\u{1F3A8}', color: '#563D7C', fileTemplate: '/* CSS */\nbody {\n    font-family: sans-serif;\n}\n' },
  { id: 'json', displayName: 'JSON', extensions: ['.json'], monacoLanguage: 'json', pistonLanguage: null, icon: '{}', color: 'var(--text-muted)', fileTemplate: '{\n    "name": "orion-project"\n}\n' },
  { id: 'markdown', displayName: 'Markdown', extensions: ['.md'], monacoLanguage: 'markdown', pistonLanguage: null, icon: '\u{1F4DD}', color: '#083FA1', fileTemplate: '# My Project\n\nBuilt with Orion IDE.\n' },
  { id: 'yaml', displayName: 'YAML', extensions: ['.yaml', '.yml'], monacoLanguage: 'yaml', pistonLanguage: null, icon: '\u2699\uFE0F', color: '#CB171E', fileTemplate: '# YAML\nname: orion-project\n' },
  { id: 'sql', displayName: 'SQL', extensions: ['.sql'], monacoLanguage: 'sql', pistonLanguage: null, icon: '\u{1F5C3}\uFE0F', color: '#E38C00', fileTemplate: '-- SQL\nSELECT 1;\n' },
];

const DEFAULT_LANGUAGE = { id: 'plaintext', displayName: 'Plain Text', extensions: [], monacoLanguage: 'plaintext', pistonLanguage: null, icon: 'TXT', color: 'var(--text-muted)', fileTemplate: '' };

/**
 * Get language by filename.
 */
export const getLanguageByFileName = (fileName) => {
  if (!fileName) return DEFAULT_LANGUAGE;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return DEFAULT_LANGUAGE;
  const ext = fileName.substring(dotIndex).toLowerCase();
  return LANGUAGES.find((l) => l.extensions.some((e) => e.toLowerCase() === ext)) || DEFAULT_LANGUAGE;
};

/**
 * Get language by extension (with or without dot).
 */
export const getLanguageByExtension = (ext) => {
  if (!ext) return DEFAULT_LANGUAGE;
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`;
  return LANGUAGES.find((l) => l.extensions.some((e) => e.toLowerCase() === dotExt.toLowerCase())) || DEFAULT_LANGUAGE;
};

/**
 * Get Monaco language ID from filename.
 */
export const getMonacoLanguage = (fileName) => getLanguageByFileName(fileName).monacoLanguage;

/**
 * Get display name from filename.
 */
export const getDisplayName = (fileName) => getLanguageByFileName(fileName).displayName;

/**
 * Get all languages.
 */
export const getAllLanguages = () => LANGUAGES;

/**
 * Get all executable languages.
 */
export const getExecutableLanguages = () => LANGUAGES.filter((l) => l.pistonLanguage !== null);

/**
 * Get language by ID.
 */
export const getLanguageById = (id) => LANGUAGES.find((l) => l.id === id) || null;

// Legacy compat
export const getLanguageFromFileName = getLanguageByFileName;
export const getLanguageFromExtension = getLanguageByExtension;
export { LANGUAGES, DEFAULT_LANGUAGE };
