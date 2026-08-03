/**
 * Language registry — no emojis. Tabs use short labels (ext / abbr).
 */

const LANGUAGES = [
  { id: 'python', displayName: 'Python', abbr: 'PY', extensions: ['.py'], monacoLanguage: 'python', pistonLanguage: 'python', fileTemplate: 'def main():\n    print("Hello, Orion!")\n\nif __name__ == "__main__":\n    main()\n' },
  { id: 'javascript', displayName: 'JavaScript', abbr: 'JS', extensions: ['.js', '.jsx'], monacoLanguage: 'javascript', pistonLanguage: 'javascript', fileTemplate: 'function main() {\n  console.log("Hello, Orion!");\n}\n\nmain();\n' },
  { id: 'typescript', displayName: 'TypeScript', abbr: 'TS', extensions: ['.ts', '.tsx'], monacoLanguage: 'typescript', pistonLanguage: 'typescript', fileTemplate: 'function main(): void {\n  console.log("Hello, Orion!");\n}\n\nmain();\n' },
  { id: 'java', displayName: 'Java', abbr: 'JV', extensions: ['.java'], monacoLanguage: 'java', pistonLanguage: 'java', fileTemplate: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Orion!");\n    }\n}\n' },
  { id: 'c', displayName: 'C', abbr: 'C', extensions: ['.c'], monacoLanguage: 'c', pistonLanguage: 'c', fileTemplate: '#include <stdio.h>\n\nint main() {\n    printf("Hello, Orion!\\n");\n    return 0;\n}\n' },
  { id: 'cpp', displayName: 'C++', abbr: 'C++', extensions: ['.cpp', '.cc', '.cxx'], monacoLanguage: 'cpp', pistonLanguage: 'cpp', fileTemplate: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, Orion!" << std::endl;\n    return 0;\n}\n' },
  { id: 'csharp', displayName: 'C#', abbr: 'C#', extensions: ['.cs'], monacoLanguage: 'csharp', pistonLanguage: 'csharp', fileTemplate: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Orion!");\n    }\n}\n' },
  { id: 'go', displayName: 'Go', abbr: 'GO', extensions: ['.go'], monacoLanguage: 'go', pistonLanguage: 'go', fileTemplate: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Orion!")\n}\n' },
  { id: 'rust', displayName: 'Rust', abbr: 'RS', extensions: ['.rs'], monacoLanguage: 'rust', pistonLanguage: 'rust', fileTemplate: 'fn main() {\n    println!("Hello, Orion!");\n}\n' },
  { id: 'php', displayName: 'PHP', abbr: 'PHP', extensions: ['.php'], monacoLanguage: 'php', pistonLanguage: 'php', fileTemplate: '<?php\necho "Hello, Orion!\\n";\n' },
  { id: 'ruby', displayName: 'Ruby', abbr: 'RB', extensions: ['.rb'], monacoLanguage: 'ruby', pistonLanguage: 'ruby', fileTemplate: 'puts "Hello, Orion!"\n' },
  { id: 'kotlin', displayName: 'Kotlin', abbr: 'KT', extensions: ['.kt'], monacoLanguage: 'kotlin', pistonLanguage: 'kotlin', fileTemplate: 'fun main() {\n    println("Hello, Orion!")\n}\n' },
  { id: 'swift', displayName: 'Swift', abbr: 'SW', extensions: ['.swift'], monacoLanguage: 'swift', pistonLanguage: 'swift', fileTemplate: 'print("Hello, Orion!")\n' },
  { id: 'bash', displayName: 'Bash', abbr: 'SH', extensions: ['.sh', '.bash'], monacoLanguage: 'shell', pistonLanguage: 'bash', fileTemplate: '#!/bin/bash\necho "Hello, Orion!"\n' },
  { id: 'r', displayName: 'R', abbr: 'R', extensions: ['.r', '.R'], monacoLanguage: 'r', pistonLanguage: 'r', fileTemplate: 'cat("Hello, Orion!\\n")\n' },
  { id: 'dart', displayName: 'Dart', abbr: 'DT', extensions: ['.dart'], monacoLanguage: 'dart', pistonLanguage: 'dart', fileTemplate: 'void main() {\n  print("Hello, Orion!");\n}\n' },
  { id: 'lua', displayName: 'Lua', abbr: 'LUA', extensions: ['.lua'], monacoLanguage: 'lua', pistonLanguage: 'lua', fileTemplate: 'print("Hello, Orion!")\n' },
  { id: 'perl', displayName: 'Perl', abbr: 'PL', extensions: ['.pl', '.pm'], monacoLanguage: 'perl', pistonLanguage: 'perl', fileTemplate: 'print "Hello, Orion!\\n";\n' },
  { id: 'html', displayName: 'HTML', abbr: 'HTML', extensions: ['.html', '.htm'], monacoLanguage: 'html', pistonLanguage: null, fileTemplate: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>Orion</title>\n</head>\n<body>\n  <h1>Hello, Orion!</h1>\n</body>\n</html>\n' },
  { id: 'css', displayName: 'CSS', abbr: 'CSS', extensions: ['.css'], monacoLanguage: 'css', pistonLanguage: null, fileTemplate: 'body {\n  font-family: system-ui, sans-serif;\n}\n' },
  { id: 'json', displayName: 'JSON', abbr: 'JSON', extensions: ['.json'], monacoLanguage: 'json', pistonLanguage: null, fileTemplate: '{\n  "name": "orion-project"\n}\n' },
  { id: 'markdown', displayName: 'Markdown', abbr: 'MD', extensions: ['.md'], monacoLanguage: 'markdown', pistonLanguage: null, fileTemplate: '# Project\n\nBuilt with Orion IDE.\n' },
  { id: 'yaml', displayName: 'YAML', abbr: 'YML', extensions: ['.yaml', '.yml'], monacoLanguage: 'yaml', pistonLanguage: null, fileTemplate: 'name: orion-project\n' },
  { id: 'sql', displayName: 'SQL', abbr: 'SQL', extensions: ['.sql'], monacoLanguage: 'sql', pistonLanguage: null, fileTemplate: 'SELECT 1;\n' },
];

const DEFAULT_LANGUAGE = {
  id: 'plaintext',
  displayName: 'Plain Text',
  abbr: 'TXT',
  extensions: [],
  monacoLanguage: 'plaintext',
  pistonLanguage: null,
  fileTemplate: '',
};

export const getLanguageByFileName = (fileName) => {
  if (!fileName) return DEFAULT_LANGUAGE;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return DEFAULT_LANGUAGE;
  const ext = fileName.substring(dotIndex).toLowerCase();
  return LANGUAGES.find((l) => l.extensions.some((e) => e.toLowerCase() === ext)) || DEFAULT_LANGUAGE;
};

export const getLanguageByExtension = (ext) => {
  if (!ext) return DEFAULT_LANGUAGE;
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`;
  return LANGUAGES.find((l) => l.extensions.some((e) => e.toLowerCase() === dotExt.toLowerCase())) || DEFAULT_LANGUAGE;
};

export const getMonacoLanguage = (fileName) => getLanguageByFileName(fileName).monacoLanguage;
export const getDisplayName = (fileName) => getLanguageByFileName(fileName).displayName;
export const getLanguageAbbr = (fileName) => getLanguageByFileName(fileName).abbr;
export const getAllLanguages = () => LANGUAGES;
export const getExecutableLanguages = () => LANGUAGES.filter((l) => l.pistonLanguage != null);
export const getLanguageById = (id) => LANGUAGES.find((l) => l.id === id) || null;

export { LANGUAGES, DEFAULT_LANGUAGE };

/** Back-compat aliases */
export const getLanguageFromFileName = getLanguageByFileName;
export const getLanguageFromExtension = getLanguageByExtension;
