const EXT = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', pyw: 'python',
  json: 'json', ipynb: 'json', html: 'html', htm: 'html',
  css: 'css', scss: 'scss',
  md: 'markdown', markdown: 'markdown',
  sh: 'shell', bash: 'shell',
  go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'c', hpp: 'cpp',
  yml: 'yaml', yaml: 'yaml',
  sql: 'sql', xml: 'xml',
  rb: 'ruby', php: 'php', cs: 'csharp', kt: 'kotlin', swift: 'swift',
};

const PISTON = {
  py: { languageId: 'python', pistonLanguage: 'python', fileTemplate: 'print("Hello, Orion!")\n' },
  pyw: { languageId: 'python', pistonLanguage: 'python', fileTemplate: 'print("Hello, Orion!")\n' },
  js: { languageId: 'javascript', pistonLanguage: 'javascript', fileTemplate: 'console.log("Hello, Orion!");\n' },
  jsx: { languageId: 'javascript', pistonLanguage: 'javascript', fileTemplate: 'console.log("Hello, Orion!");\n' },
  mjs: { languageId: 'javascript', pistonLanguage: 'javascript', fileTemplate: 'console.log("Hello, Orion!");\n' },
  cjs: { languageId: 'javascript', pistonLanguage: 'javascript', fileTemplate: 'console.log("Hello, Orion!");\n' },
  ts: { languageId: 'typescript', pistonLanguage: 'typescript', fileTemplate: 'console.log("Hello, Orion!");\n' },
  tsx: { languageId: 'typescript', pistonLanguage: 'typescript', fileTemplate: 'console.log("Hello, Orion!");\n' },
  go: { languageId: 'go', pistonLanguage: 'go', fileTemplate: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, Orion!")\n}\n' },
  java: { languageId: 'java', pistonLanguage: 'java', fileTemplate: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, Orion!");\n  }\n}\n' },
  c: { languageId: 'c', pistonLanguage: 'c', fileTemplate: '#include <stdio.h>\n\nint main(void) {\n  printf("Hello, Orion!\\n");\n  return 0;\n}\n' },
  cpp: { languageId: 'cpp', pistonLanguage: 'c++', fileTemplate: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, Orion!" << std::endl;\n  return 0;\n}\n' },
  cc: { languageId: 'cpp', pistonLanguage: 'c++', fileTemplate: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, Orion!" << std::endl;\n  return 0;\n}\n' },
  cxx: { languageId: 'cpp', pistonLanguage: 'c++', fileTemplate: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, Orion!" << std::endl;\n  return 0;\n}\n' },
  rs: { languageId: 'rust', pistonLanguage: 'rust', fileTemplate: 'fn main() {\n  println!("Hello, Orion!");\n}\n' },
  rb: { languageId: 'ruby', pistonLanguage: 'ruby', fileTemplate: 'puts "Hello, Orion!"\n' },
  php: { languageId: 'php', pistonLanguage: 'php', fileTemplate: '<?php\necho "Hello, Orion!\\n";\n' },
  cs: { languageId: 'csharp', pistonLanguage: 'csharp', fileTemplate: 'using System;\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, Orion!");\n  }\n}\n' },
  sh: { languageId: 'bash', pistonLanguage: 'bash', fileTemplate: 'echo "Hello, Orion!"\n' },
  bash: { languageId: 'bash', pistonLanguage: 'bash', fileTemplate: 'echo "Hello, Orion!"\n' },
};

export function getMonacoLanguage(filename = '') {
  const ext = String(filename).split('.').pop()?.toLowerCase() || '';
  return EXT[ext] || 'plaintext';
}

export function getLanguageByFileName(filename = '') {
  const ext = String(filename).split('.').pop()?.toLowerCase() || '';
  return PISTON[ext] || { languageId: 'python', pistonLanguage: 'python', fileTemplate: '' };
}

export function getLanguageAbbr(filename = '') {
  const ext = String(filename).split('.').pop()?.toUpperCase() || 'TXT';
  return ext.slice(0, 4);
}
