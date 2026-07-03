/**
 * Orion IDE — Master Language Registry (Single Source of Truth)
 *
 * All 18 executable programming languages + 6 non-executable file types.
 * Used by: execution-service, agent-service, frontend.
 *
 * Each entry:
 *   id              — unique key
 *   displayName     — human-readable name
 *   extensions      — file extensions (with dot)
 *   monacoLanguage  — Monaco Editor language ID
 *   pistonLanguage  — Piston API language name
 *   pistonVersion   — Piston runtime version
 *   runCommand      — run command template ({file} placeholder)
 *   compileCommand  — compile step if needed (null if interpreted)
 *   icon            — emoji icon
 *   color           — brand hex color
 *   fileTemplate    — default code when creating a new file
 */

const LANGUAGES = Object.freeze([
  // ── 18 Executable Languages ──────────────────────────────────────────
  {
    id: 'python', displayName: 'Python', extensions: ['.py'],
    monacoLanguage: 'python', pistonLanguage: 'python',
    pistonVersion: '3.10.0',
    runCommand: 'python {file}', compileCommand: null,
    icon: '\u{1F40D}', color: '#3572A5',
    fileTemplate: '# Python\n\ndef main():\n    print("Hello, Orion!")\n\nif __name__ == "__main__":\n    main()\n',
  },
  {
    id: 'javascript', displayName: 'JavaScript', extensions: ['.js'],
    monacoLanguage: 'javascript', pistonLanguage: 'javascript',
    pistonVersion: '18.15.0',
    runCommand: 'node {file}', compileCommand: null,
    icon: '\u{1F7E8}', color: '#F7DF1E',
    fileTemplate: '// JavaScript\n\nfunction main() {\n    console.log("Hello, Orion!");\n}\n\nmain();\n',
  },
  {
    id: 'typescript', displayName: 'TypeScript', extensions: ['.ts'],
    monacoLanguage: 'typescript', pistonLanguage: 'typescript',
    pistonVersion: '5.0.3',
    runCommand: 'ts-node {file}', compileCommand: null,
    icon: '\u{1F537}', color: '#3178C6',
    fileTemplate: '// TypeScript\n\nfunction main(): void {\n    console.log("Hello, Orion!");\n}\n\nmain();\n',
  },
  {
    id: 'java', displayName: 'Java', extensions: ['.java'],
    monacoLanguage: 'java', pistonLanguage: 'java',
    pistonVersion: '15.0.2',
    runCommand: 'java {file}', compileCommand: 'javac {file}',
    icon: '\u2615', color: '#B07219',
    fileTemplate: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Orion!");\n    }\n}\n',
  },
  {
    id: 'c', displayName: 'C', extensions: ['.c'],
    monacoLanguage: 'c', pistonLanguage: 'c',
    pistonVersion: '10.2.0',
    runCommand: './main', compileCommand: 'gcc {file} -o main',
    icon: '\u2699\uFE0F', color: '#555555',
    fileTemplate: '#include <stdio.h>\n\nint main() {\n    printf("Hello, Orion!\\n");\n    return 0;\n}\n',
  },
  {
    id: 'cpp', displayName: 'C++', extensions: ['.cpp', '.cc', '.cxx'],
    monacoLanguage: 'cpp', pistonLanguage: 'c++',
    pistonVersion: '10.2.0',
    runCommand: './main', compileCommand: 'g++ {file} -o main',
    icon: '\u26A1', color: '#F34B7D',
    fileTemplate: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, Orion!" << std::endl;\n    return 0;\n}\n',
  },
  {
    id: 'csharp', displayName: 'C#', extensions: ['.cs'],
    monacoLanguage: 'csharp', pistonLanguage: 'csharp',
    pistonVersion: '5.0.201',
    runCommand: 'dotnet-script {file}', compileCommand: null,
    icon: '\u{1F7E3}', color: '#178600',
    fileTemplate: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Orion!");\n    }\n}\n',
  },
  {
    id: 'go', displayName: 'Go', extensions: ['.go'],
    monacoLanguage: 'go', pistonLanguage: 'go',
    pistonVersion: '1.16.2',
    runCommand: 'go run {file}', compileCommand: null,
    icon: '\u{1F439}', color: '#00ADD8',
    fileTemplate: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Orion!")\n}\n',
  },
  {
    id: 'rust', displayName: 'Rust', extensions: ['.rs'],
    monacoLanguage: 'rust', pistonLanguage: 'rust',
    pistonVersion: '1.68.2',
    runCommand: './main', compileCommand: 'rustc {file} -o main',
    icon: '\u{1F980}', color: '#DEA584',
    fileTemplate: 'fn main() {\n    println!("Hello, Orion!");\n}\n',
  },
  {
    id: 'php', displayName: 'PHP', extensions: ['.php'],
    monacoLanguage: 'php', pistonLanguage: 'php',
    pistonVersion: '8.2.3',
    runCommand: 'php {file}', compileCommand: null,
    icon: '\u{1F418}', color: '#4F5D95',
    fileTemplate: '<?php\n\necho "Hello, Orion!\\n";\n',
  },
  {
    id: 'ruby', displayName: 'Ruby', extensions: ['.rb'],
    monacoLanguage: 'ruby', pistonLanguage: 'ruby',
    pistonVersion: '3.0.1',
    runCommand: 'ruby {file}', compileCommand: null,
    icon: '\u{1F48E}', color: '#701516',
    fileTemplate: '# Ruby\nputs "Hello, Orion!"\n',
  },
  {
    id: 'kotlin', displayName: 'Kotlin', extensions: ['.kt'],
    monacoLanguage: 'kotlin', pistonLanguage: 'kotlin',
    pistonVersion: '1.8.20',
    runCommand: 'java -jar main.jar', compileCommand: 'kotlinc {file} -include-runtime -d main.jar',
    icon: '\u{1F3AF}', color: '#A97BFF',
    fileTemplate: 'fun main() {\n    println("Hello, Orion!")\n}\n',
  },
  {
    id: 'swift', displayName: 'Swift', extensions: ['.swift'],
    monacoLanguage: 'swift', pistonLanguage: 'swift',
    pistonVersion: '5.3.3',
    runCommand: 'swift {file}', compileCommand: null,
    icon: '\u{1F34E}', color: '#F05138',
    fileTemplate: 'import Foundation\n\nprint("Hello, Orion!")\n',
  },
  {
    id: 'bash', displayName: 'Bash', extensions: ['.sh', '.bash'],
    monacoLanguage: 'shell', pistonLanguage: 'bash',
    pistonVersion: '5.2.0',
    runCommand: 'bash {file}', compileCommand: null,
    icon: '\u{1F5A5}\uFE0F', color: '#89E051',
    fileTemplate: '#!/bin/bash\n\necho "Hello, Orion!"\n',
  },
  {
    id: 'r', displayName: 'R', extensions: ['.r', '.R'],
    monacoLanguage: 'r', pistonLanguage: 'r',
    pistonVersion: '4.1.1',
    runCommand: 'Rscript {file}', compileCommand: null,
    icon: '\u{1F4CA}', color: '#198CE7',
    fileTemplate: '# R\ncat("Hello, Orion!\\n")\n',
  },
  {
    id: 'dart', displayName: 'Dart', extensions: ['.dart'],
    monacoLanguage: 'dart', pistonLanguage: 'dart',
    pistonVersion: '2.19.6',
    runCommand: 'dart run {file}', compileCommand: null,
    icon: '\u{1F3AF}', color: '#00B4AB',
    fileTemplate: 'void main() {\n  print("Hello, Orion!");\n}\n',
  },
  {
    id: 'lua', displayName: 'Lua', extensions: ['.lua'],
    monacoLanguage: 'lua', pistonLanguage: 'lua',
    pistonVersion: '5.4.4',
    runCommand: 'lua {file}', compileCommand: null,
    icon: '\u{1F319}', color: '#000080',
    fileTemplate: '-- Lua\nprint("Hello, Orion!")\n',
  },
  {
    id: 'perl', displayName: 'Perl', extensions: ['.pl', '.pm'],
    monacoLanguage: 'perl', pistonLanguage: 'perl',
    pistonVersion: '5.36.0',
    runCommand: 'perl {file}', compileCommand: null,
    icon: '\u{1F42A}', color: '#0298C3',
    fileTemplate: '#!/usr/bin/perl\nuse strict;\nuse warnings;\n\nprint "Hello, Orion!\\n";\n',
  },

  // ── Non-executable file types ────────────────────────────────────────
  {
    id: 'html', displayName: 'HTML', extensions: ['.html', '.htm'],
    monacoLanguage: 'html', pistonLanguage: null, pistonVersion: null,
    runCommand: null, compileCommand: null,
    icon: '\u{1F310}', color: '#E34C26', fileTemplate: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Orion</title>\n</head>\n<body>\n    <h1>Hello, Orion!</h1>\n</body>\n</html>\n',
  },
  {
    id: 'css', displayName: 'CSS', extensions: ['.css'],
    monacoLanguage: 'css', pistonLanguage: null, pistonVersion: null,
    runCommand: null, compileCommand: null,
    icon: '\u{1F3A8}', color: '#563D7C', fileTemplate: '/* CSS */\nbody {\n    font-family: sans-serif;\n    background: #0d1117;\n    color: #c9d1d9;\n}\n',
  },
  {
    id: 'json', displayName: 'JSON', extensions: ['.json'],
    monacoLanguage: 'json', pistonLanguage: null, pistonVersion: null,
    runCommand: null, compileCommand: null,
    icon: '{}', color: '#7D8590', fileTemplate: '{\n    "name": "orion-project",\n    "version": "1.0.0"\n}\n',
  },
  {
    id: 'markdown', displayName: 'Markdown', extensions: ['.md'],
    monacoLanguage: 'markdown', pistonLanguage: null, pistonVersion: null,
    runCommand: null, compileCommand: null,
    icon: '\u{1F4DD}', color: '#083FA1', fileTemplate: '# My Project\n\nBuilt with Orion IDE.\n',
  },
  {
    id: 'yaml', displayName: 'YAML', extensions: ['.yaml', '.yml'],
    monacoLanguage: 'yaml', pistonLanguage: null, pistonVersion: null,
    runCommand: null, compileCommand: null,
    icon: '\u2699\uFE0F', color: '#CB171E', fileTemplate: '# YAML\nname: orion-project\nversion: 1.0.0\n',
  },
  {
    id: 'sql', displayName: 'SQL', extensions: ['.sql'],
    monacoLanguage: 'sql', pistonLanguage: null, pistonVersion: null,
    runCommand: null, compileCommand: null,
    icon: '\u{1F5C3}\uFE0F', color: '#E38C00', fileTemplate: '-- SQL\nSELECT 1;\n',
  },
]);

// ── Lookup helpers ─────────────────────────────────────────────────────

/**
 * Find language by file extension (with or without dot).
 */
const getLanguageByExtension = (ext) => {
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`;
  return LANGUAGES.find((lang) => lang.extensions.some((e) => e.toLowerCase() === dotExt.toLowerCase())) || null;
};

/**
 * Find language by ID.
 */
const getLanguageById = (id) =>
  LANGUAGES.find((lang) => lang.id === id) || null;

/**
 * Find language by Piston language name.
 */
const getLanguageByPistonId = (pistonId) =>
  LANGUAGES.find((lang) => lang.pistonLanguage === pistonId) || null;

/**
 * Get all 18 executable languages.
 */
const getExecutableLanguages = () =>
  LANGUAGES.filter((lang) => lang.pistonLanguage !== null);

/**
 * Get language from a filename.
 */
const getLanguageFromFileName = (fileName) => {
  if (!fileName) return null;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const ext = fileName.substring(dotIndex);
  return getLanguageByExtension(ext);
};

module.exports = {
  LANGUAGES,
  getLanguageByExtension,
  getLanguageById,
  getLanguageByPistonId,
  getExecutableLanguages,
  getLanguageFromFileName,
};
