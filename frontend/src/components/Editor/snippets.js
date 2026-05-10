/**
 * Orion IDE — Monaco Language Snippets
 *
 * Common code snippets for all 18 programming languages.
 * Register with Monaco's CompletionItemProvider.
 */

const SNIPPETS = {
  python: [
    { label: 'def', insertText: 'def ${1:function_name}(${2:args}):\n    ${3:pass}', detail: 'Function definition' },
    { label: 'class', insertText: 'class ${1:ClassName}:\n    def __init__(self${2:, args}):\n        ${3:pass}', detail: 'Class definition' },
    { label: 'for', insertText: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}', detail: 'For loop' },
    { label: 'if', insertText: 'if ${1:condition}:\n    ${2:pass}', detail: 'If statement' },
    { label: 'print', insertText: 'print(${1:"Hello, Orion!"})', detail: 'Print function' },
    { label: 'import', insertText: 'import ${1:module}', detail: 'Import module' },
    { label: 'try', insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    ${3:print(e)}', detail: 'Try/except' },
    { label: 'main', insertText: 'def main():\n    ${1:pass}\n\nif __name__ == "__main__":\n    main()', detail: 'Main function' },
  ],

  javascript: [
    { label: 'func', insertText: 'function ${1:name}(${2:params}) {\n    ${3}\n}', detail: 'Function' },
    { label: 'arrow', insertText: 'const ${1:name} = (${2:params}) => {\n    ${3}\n};', detail: 'Arrow function' },
    { label: 'log', insertText: 'console.log(${1:"Hello, Orion!"});', detail: 'Console log' },
    { label: 'for', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:arr}.length; ${1:i}++) {\n    ${3}\n}', detail: 'For loop' },
    { label: 'forof', insertText: 'for (const ${1:item} of ${2:arr}) {\n    ${3}\n}', detail: 'For...of loop' },
    { label: 'if', insertText: 'if (${1:condition}) {\n    ${2}\n}', detail: 'If statement' },
    { label: 'async', insertText: 'async function ${1:name}(${2:params}) {\n    ${3}\n}', detail: 'Async function' },
    { label: 'class', insertText: 'class ${1:Name} {\n    constructor(${2:params}) {\n        ${3}\n    }\n}', detail: 'Class' },
  ],

  typescript: [
    { label: 'interface', insertText: 'interface ${1:Name} {\n    ${2:key}: ${3:type};\n}', detail: 'Interface' },
    { label: 'type', insertText: 'type ${1:Name} = ${2:type};', detail: 'Type alias' },
    { label: 'func', insertText: 'function ${1:name}(${2:params}: ${3:type}): ${4:void} {\n    ${5}\n}', detail: 'Typed function' },
    { label: 'arrow', insertText: 'const ${1:name} = (${2:params}: ${3:type}): ${4:void} => {\n    ${5}\n};', detail: 'Typed arrow' },
    { label: 'enum', insertText: 'enum ${1:Name} {\n    ${2:Value},\n}', detail: 'Enum' },
    { label: 'class', insertText: 'class ${1:Name} {\n    constructor(private ${2:prop}: ${3:type}) {}\n}', detail: 'Class' },
  ],

  java: [
    { label: 'main', insertText: 'public static void main(String[] args) {\n    ${1}\n}', detail: 'Main method' },
    { label: 'sout', insertText: 'System.out.println(${1:"Hello, Orion!"});', detail: 'Print to stdout' },
    { label: 'class', insertText: 'public class ${1:ClassName} {\n    ${2}\n}', detail: 'Class' },
    { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}', detail: 'For loop' },
    { label: 'if', insertText: 'if (${1:condition}) {\n    ${2}\n}', detail: 'If statement' },
    { label: 'try', insertText: 'try {\n    ${1}\n} catch (${2:Exception} e) {\n    ${3:e.printStackTrace();}\n}', detail: 'Try/catch' },
  ],

  c: [
    { label: 'main', insertText: 'int main() {\n    ${1}\n    return 0;\n}', detail: 'Main function' },
    { label: 'printf', insertText: 'printf("${1:%s}\\n"${2:, arg});', detail: 'Printf' },
    { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}', detail: 'For loop' },
    { label: 'if', insertText: 'if (${1:condition}) {\n    ${2}\n}', detail: 'If statement' },
    { label: 'include', insertText: '#include <${1:stdio.h}>', detail: 'Include header' },
    { label: 'struct', insertText: 'typedef struct {\n    ${1:int field};\n} ${2:Name};', detail: 'Struct' },
  ],

  cpp: [
    { label: 'main', insertText: 'int main() {\n    ${1}\n    return 0;\n}', detail: 'Main function' },
    { label: 'cout', insertText: 'std::cout << ${1:"Hello"} << std::endl;', detail: 'Cout print' },
    { label: 'class', insertText: 'class ${1:Name} {\npublic:\n    ${1:Name}() {}\n    ~${1:Name}() {}\n};', detail: 'Class' },
    { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}', detail: 'For loop' },
    { label: 'vector', insertText: 'std::vector<${1:int}> ${2:vec};', detail: 'Vector' },
    { label: 'include', insertText: '#include <${1:iostream}>', detail: 'Include' },
  ],

  csharp: [
    { label: 'main', insertText: 'static void Main(string[] args)\n{\n    ${1}\n}', detail: 'Main method' },
    { label: 'cw', insertText: 'Console.WriteLine(${1:"Hello, Orion!"});', detail: 'Console.WriteLine' },
    { label: 'class', insertText: 'public class ${1:Name}\n{\n    ${2}\n}', detail: 'Class' },
    { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++)\n{\n    ${3}\n}', detail: 'For loop' },
    { label: 'prop', insertText: 'public ${1:string} ${2:Name} { get; set; }', detail: 'Property' },
    { label: 'if', insertText: 'if (${1:condition})\n{\n    ${2}\n}', detail: 'If statement' },
  ],

  go: [
    { label: 'main', insertText: 'func main() {\n    ${1}\n}', detail: 'Main function' },
    { label: 'fmt', insertText: 'fmt.Println(${1:"Hello, Orion!"})', detail: 'Println' },
    { label: 'func', insertText: 'func ${1:name}(${2:params}) ${3:error} {\n    ${4}\n}', detail: 'Function' },
    { label: 'for', insertText: 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n    ${3}\n}', detail: 'For loop' },
    { label: 'if', insertText: 'if ${1:err} != nil {\n    ${2:return err}\n}', detail: 'If err' },
    { label: 'struct', insertText: 'type ${1:Name} struct {\n    ${2:Field} ${3:string}\n}', detail: 'Struct' },
  ],

  rust: [
    { label: 'main', insertText: 'fn main() {\n    ${1}\n}', detail: 'Main function' },
    { label: 'println', insertText: 'println!("${1:Hello, Orion!}");', detail: 'Println macro' },
    { label: 'fn', insertText: 'fn ${1:name}(${2:params}) -> ${3:()} {\n    ${4}\n}', detail: 'Function' },
    { label: 'let', insertText: 'let ${1:mut }${2:name} = ${3:value};', detail: 'Let binding' },
    { label: 'struct', insertText: 'struct ${1:Name} {\n    ${2:field}: ${3:String},\n}', detail: 'Struct' },
    { label: 'match', insertText: 'match ${1:value} {\n    ${2:pattern} => ${3:{}},\n    _ => ${4:{}},\n}', detail: 'Match expression' },
  ],

  php: [
    { label: 'echo', insertText: 'echo "${1:Hello, Orion!}\\n";', detail: 'Echo' },
    { label: 'func', insertText: 'function ${1:name}(${2:$params}) {\n    ${3}\n}', detail: 'Function' },
    { label: 'class', insertText: 'class ${1:Name} {\n    public function __construct() {\n        ${2}\n    }\n}', detail: 'Class' },
    { label: 'for', insertText: 'for ($${1:i} = 0; $${1:i} < ${2:n}; $${1:i}++) {\n    ${3}\n}', detail: 'For loop' },
    { label: 'foreach', insertText: 'foreach ($${1:arr} as $${2:item}) {\n    ${3}\n}', detail: 'Foreach' },
  ],

  ruby: [
    { label: 'def', insertText: 'def ${1:method_name}\n  ${2}\nend', detail: 'Method' },
    { label: 'class', insertText: 'class ${1:Name}\n  def initialize\n    ${2}\n  end\nend', detail: 'Class' },
    { label: 'puts', insertText: 'puts "${1:Hello, Orion!}"', detail: 'Puts print' },
    { label: 'each', insertText: '${1:arr}.each do |${2:item}|\n  ${3}\nend', detail: 'Each loop' },
    { label: 'if', insertText: 'if ${1:condition}\n  ${2}\nend', detail: 'If statement' },
  ],

  kotlin: [
    { label: 'main', insertText: 'fun main() {\n    ${1}\n}', detail: 'Main function' },
    { label: 'println', insertText: 'println(${1:"Hello, Orion!"})', detail: 'Println' },
    { label: 'fun', insertText: 'fun ${1:name}(${2:params}): ${3:Unit} {\n    ${4}\n}', detail: 'Function' },
    { label: 'class', insertText: 'class ${1:Name}(${2:val prop: Type}) {\n    ${3}\n}', detail: 'Class' },
    { label: 'for', insertText: 'for (${1:item} in ${2:collection}) {\n    ${3}\n}', detail: 'For loop' },
  ],

  swift: [
    { label: 'print', insertText: 'print("${1:Hello, Orion!}")', detail: 'Print' },
    { label: 'func', insertText: 'func ${1:name}(${2:params}) -> ${3:Void} {\n    ${4}\n}', detail: 'Function' },
    { label: 'class', insertText: 'class ${1:Name} {\n    init() {\n        ${2}\n    }\n}', detail: 'Class' },
    { label: 'for', insertText: 'for ${1:item} in ${2:collection} {\n    ${3}\n}', detail: 'For loop' },
    { label: 'guard', insertText: 'guard ${1:condition} else {\n    ${2:return}\n}', detail: 'Guard statement' },
  ],

  shell: [
    { label: 'shebang', insertText: '#!/bin/bash\n\n${1}', detail: 'Bash shebang' },
    { label: 'echo', insertText: 'echo "${1:Hello, Orion!}"', detail: 'Echo' },
    { label: 'if', insertText: 'if [ ${1:condition} ]; then\n    ${2}\nfi', detail: 'If statement' },
    { label: 'for', insertText: 'for ${1:item} in ${2:list}; do\n    ${3}\ndone', detail: 'For loop' },
    { label: 'func', insertText: '${1:function_name}() {\n    ${2}\n}', detail: 'Function' },
  ],

  r: [
    { label: 'func', insertText: '${1:name} <- function(${2:args}) {\n    ${3}\n}', detail: 'Function' },
    { label: 'cat', insertText: 'cat("${1:Hello, Orion!}\\n")', detail: 'Cat print' },
    { label: 'for', insertText: 'for (${1:i} in ${2:1:10}) {\n    ${3}\n}', detail: 'For loop' },
    { label: 'if', insertText: 'if (${1:condition}) {\n    ${2}\n}', detail: 'If statement' },
    { label: 'plot', insertText: 'plot(${1:x}, ${2:y}, main="${3:Title}")', detail: 'Plot' },
  ],

  dart: [
    { label: 'main', insertText: 'void main() {\n  ${1}\n}', detail: 'Main function' },
    { label: 'print', insertText: 'print(${1:"Hello, Orion!"});', detail: 'Print' },
    { label: 'class', insertText: 'class ${1:Name} {\n  ${1:Name}();\n  ${2}\n}', detail: 'Class' },
    { label: 'func', insertText: '${1:void} ${2:name}(${3:params}) {\n  ${4}\n}', detail: 'Function' },
    { label: 'for', insertText: 'for (var ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3}\n}', detail: 'For loop' },
  ],

  lua: [
    { label: 'print', insertText: 'print(${1:"Hello, Orion!"})', detail: 'Print' },
    { label: 'func', insertText: 'function ${1:name}(${2:args})\n    ${3}\nend', detail: 'Function' },
    { label: 'for', insertText: 'for ${1:i} = 1, ${2:10} do\n    ${3}\nend', detail: 'For loop' },
    { label: 'if', insertText: 'if ${1:condition} then\n    ${2}\nend', detail: 'If statement' },
    { label: 'local', insertText: 'local ${1:name} = ${2:value}', detail: 'Local variable' },
  ],

  perl: [
    { label: 'print', insertText: 'print "${1:Hello, Orion!}\\n";', detail: 'Print' },
    { label: 'sub', insertText: 'sub ${1:name} {\n    my (${2:$args}) = @_;\n    ${3}\n}', detail: 'Subroutine' },
    { label: 'for', insertText: 'for my $${1:i} (0..${2:9}) {\n    ${3}\n}', detail: 'For loop' },
    { label: 'foreach', insertText: 'foreach my $${1:item} (@${2:arr}) {\n    ${3}\n}', detail: 'Foreach' },
    { label: 'if', insertText: 'if (${1:condition}) {\n    ${2}\n}', detail: 'If statement' },
  ],
};

/**
 * Register all snippets with Monaco for a given language.
 * Call after Monaco is loaded.
 *
 * @param {object} monaco — Monaco namespace
 */
export const registerAllSnippets = (monaco) => {
  if (!monaco) return;

  Object.entries(SNIPPETS).forEach(([monacoLang, snippets]) => {
    monaco.languages.registerCompletionItemProvider(monacoLang, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: snippets.map((s) => ({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: s.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: s.detail,
            range,
          })),
        };
      },
    });
  });
};

export default SNIPPETS;
