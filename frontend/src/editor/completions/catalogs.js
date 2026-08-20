/** Completion catalogs for languages without a Monaco language service. */
const L = (s) => s.trim().split(/\s+/).filter(Boolean);

export const PYTHON = {
  keywords: L('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type'),
  builtins: L('abs aiter all anext any ascii bin bool breakpoint bytearray bytes callable chr classmethod compile complex delattr dict dir divmod enumerate eval exec filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip'),
  methods: L('append clear copy count extend index insert pop remove reverse sort add difference discard intersection isdisjoint issubset issuperset union update get items keys values popitem setdefault capitalize casefold center encode endswith find format join lower lstrip partition replace rfind rsplit rstrip split splitlines startswith strip swapcase title upper zfill read readline readlines write close flush seek tell'),
  modules: L('os sys math json re random datetime time collections itertools functools typing pathlib subprocess threading asyncio argparse logging csv sqlite3 hashlib base64 urllib http socket copy pprint dataclasses enum abc io tempfile shutil glob statistics decimal numpy pandas matplotlib requests flask django fastapi sklearn scipy torch'),
  snippets: [
    { label: 'def', insertText: 'def ${1:name}(${2:args}):\n\t${3:pass}', detail: 'snippet · function' },
    { label: 'class', insertText: 'class ${1:Name}:\n\tdef __init__(self${2:}):\n\t\t${3:pass}', detail: 'snippet · class' },
    { label: 'if', insertText: 'if ${1:condition}:\n\t${2:pass}', detail: 'snippet · if' },
    { label: 'for', insertText: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}', detail: 'snippet · for' },
    { label: 'while', insertText: 'while ${1:condition}:\n\t${2:pass}', detail: 'snippet · while' },
    { label: 'try', insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}', detail: 'snippet · try/except' },
    { label: 'with', insertText: 'with ${1:expr} as ${2:var}:\n\t${3:pass}', detail: 'snippet · with' },
    { label: 'main', insertText: 'if __name__ == "__main__":\n\t${1:main()}', detail: 'snippet · main guard' },
    { label: 'listcomp', insertText: '[${1:x} for ${1:x} in ${2:iterable}]', detail: 'snippet · list comprehension' },
    { label: 'asyncdef', insertText: 'async def ${1:name}(${2:args}):\n\t${3:pass}', detail: 'snippet · async function' },
  ],
};

export const JAVASCRIPT = {
  keywords: L('break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null private protected public return static super switch this throw true try typeof var void while with yield async await of as from'),
  builtins: L('console window document globalThis navigator location history localStorage sessionStorage fetch Promise Array Object String Number Boolean Symbol BigInt Map Set WeakMap WeakSet Date Math JSON RegExp Error TypeError ReferenceError SyntaxError Function Proxy Reflect Intl URL URLSearchParams FormData Blob File FileReader AbortController Headers Request Response TextEncoder TextDecoder setTimeout setInterval clearTimeout clearInterval requestAnimationFrame queueMicrotask structuredClone atob btoa isNaN isFinite parseInt parseFloat encodeURIComponent decodeURIComponent Buffer process module exports require'),
  methods: L('log warn error info debug table time timeEnd assert clear push pop shift unshift splice slice concat join map filter reduce forEach find findIndex some every includes indexOf lastIndexOf flat flatMap sort reverse fill keys values entries then catch finally all race allSettled any resolve reject charAt concat endsWith startsWith match padStart padEnd repeat replace replaceAll search split substring toLowerCase toUpperCase trim getElementById querySelector querySelectorAll createElement appendChild addEventListener removeEventListener setAttribute getAttribute'),
  modules: L('react react-dom vue svelte next express lodash axios fs path http https url util events stream crypto os child_process zlib node:fs node:path node:url'),
  snippets: [
    { label: 'log', insertText: 'console.log(${1});', detail: 'snippet · console.log' },
    { label: 'fn', insertText: 'function ${1:name}(${2:args}) {\n\t${3}\n}', detail: 'snippet · function' },
    { label: 'afn', insertText: 'async function ${1:name}(${2:args}) {\n\t${3}\n}', detail: 'snippet · async function' },
    { label: 'arrow', insertText: 'const ${1:name} = (${2:args}) => {\n\t${3}\n};', detail: 'snippet · arrow' },
    { label: 'try', insertText: 'try {\n\t${1}\n} catch (${2:err}) {\n\t${3}\n}', detail: 'snippet · try/catch' },
    { label: 'forof', insertText: 'for (const ${1:item} of ${2:iterable}) {\n\t${3}\n}', detail: 'snippet · for…of' },
    { label: 'imp', insertText: "import ${1:name} from '${2:module}';", detail: 'snippet · import' },
    { label: 'reactfc', insertText: 'export function ${1:Component}(${2:props}) {\n\treturn (\n\t\t${3:<div />}\n\t);\n}', detail: 'snippet · React FC' },
  ],
};

export const C_LANG = {
  keywords: L('auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false NULL'),
  builtins: L('printf scanf sprintf snprintf fprintf fscanf puts getchar putchar malloc calloc realloc free memcpy memmove memset memcmp strlen strcpy strncpy strcat strncat strcmp strncmp strchr strstr atoi atol atof exit abort system fopen fclose fread fwrite fseek ftell feof perror qsort bsearch abs labs fabs sqrt pow sin cos tan log exp floor ceil round rand srand time clock stdin stdout stderr EOF size_t'),
  methods: [],
  modules: L('stdio.h stdlib.h string.h math.h ctype.h time.h stdbool.h stdint.h stddef.h assert.h errno.h limits.h float.h stdarg.h'),
  snippets: [
    { label: 'main', insertText: 'int main(void) {\n\t${1}\n\treturn 0;\n}', detail: 'snippet · main' },
    { label: 'inc', insertText: '#include <${1:stdio.h}>', detail: 'snippet · include' },
    { label: 'for', insertText: 'for (${1:int i = 0}; ${2:i < n}; ${3:i++}) {\n\t${4}\n}', detail: 'snippet · for' },
    { label: 'printf', insertText: 'printf("${1:%s}\\n"${2:, });', detail: 'snippet · printf' },
  ],
};

export const CPP = {
  keywords: L('alignas alignof and and_eq asm auto bitand bitor bool break case catch char class compl concept const consteval constexpr constinit continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false final float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq'),
  builtins: [
    ...C_LANG.builtins,
    ...L('cout cin cerr clog endl flush setw setprecision fixed scientific vector string map unordered_map set unordered_set queue stack deque list array pair tuple optional variant any shared_ptr unique_ptr weak_ptr make_shared make_unique move forward swap sort find binary_search lower_bound upper_bound max min accumulate transform for_each priority_queue bitset mutex lock_guard thread async future promise'),
  ],
  methods: L('push_back pop_back emplace_back size empty clear begin end insert erase find count at front back push pop top'),
  modules: [
    ...C_LANG.modules,
    ...L('iostream string vector map unordered_map set unordered_set queue stack deque list array algorithm numeric cmath cstdlib cstdio cstring memory utility functional sstream fstream iomanip chrono thread mutex atomic future filesystem optional variant any'),
  ],
  snippets: [
    ...C_LANG.snippets,
    { label: 'cppmain', insertText: '#include <iostream>\n\nint main() {\n\t${1:std::cout << "Hello" << std::endl;}\n\treturn 0;\n}', detail: 'snippet · C++ main' },
    { label: 'cout', insertText: 'std::cout << ${1} << std::endl;', detail: 'snippet · cout' },
    { label: 'vector', insertText: 'std::vector<${1:int}> ${2:v};', detail: 'snippet · vector' },
  ],
};

export const JAVA = {
  keywords: L('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed permits yield'),
  builtins: L('System String Integer Long Double Float Boolean Character Object Class Math Arrays Collections List ArrayList LinkedList Map HashMap TreeMap Set HashSet TreeSet Queue Deque Stack Optional Stream Collectors Files Paths Path Scanner PrintStream StringBuilder StringBuffer Thread Exception RuntimeException IOException out err in println print printf format valueOf parseInt equals hashCode toString length charAt substring indexOf contains isEmpty size add remove get put keySet values'),
  methods: L('println print printf format equals toString length charAt substring indexOf contains isEmpty size add remove get put keySet values stream map filter collect forEach'),
  modules: L('java.util java.io java.nio java.lang java.math java.time java.net java.util.stream java.util.concurrent'),
  snippets: [
    { label: 'main', insertText: 'public static void main(String[] args) {\n\t${1}\n}', detail: 'snippet · main' },
    { label: 'sout', insertText: 'System.out.println(${1});', detail: 'snippet · println' },
    { label: 'class', insertText: 'public class ${1:Name} {\n\t${2}\n}', detail: 'snippet · class' },
  ],
};

export const GO = {
  keywords: L('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota'),
  builtins: L('append cap close complex copy delete imag len make new panic print println real recover fmt Println Printf Sprintf Scanf Error Errorf strings strconv bytes bufio io os time context sync json http log errors reflect sort math rand regexp'),
  methods: L('Println Printf Sprintf Errorf Len Cap Append Copy Make New'),
  modules: L('fmt os io bufio strings strconv bytes time context sync encoding/json net/http log errors math math/rand regexp path path/filepath sort database/sql flag testing'),
  snippets: [
    { label: 'main', insertText: 'package main\n\nimport "fmt"\n\nfunc main() {\n\t${1:fmt.Println("Hello")}\n}', detail: 'snippet · main' },
    { label: 'func', insertText: 'func ${1:name}(${2:args}) ${3:error} {\n\t${4}\n}', detail: 'snippet · func' },
    { label: 'iferr', insertText: 'if err != nil {\n\treturn ${1:err}\n}', detail: 'snippet · if err' },
  ],
};

export const RUST = {
  keywords: L('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'),
  builtins: L('println print eprintln format vec String str Vec Option Result Some None Ok Err Box Rc Arc Cell RefCell HashMap HashSet unwrap expect clone to_string parse into from iter collect map filter fold find any all count sum len is_empty push pop insert remove get'),
  methods: L('unwrap expect clone to_string parse into iter collect map filter fold find any all count sum len is_empty push pop insert remove get contains_key keys values'),
  modules: L('std std::io std::fs std::collections std::sync std::thread std::time serde serde_json tokio clap anyhow thiserror regex rand'),
  snippets: [
    { label: 'main', insertText: 'fn main() {\n\t${1:println!("Hello");}\n}', detail: 'snippet · main' },
    { label: 'fn', insertText: 'fn ${1:name}(${2:args}) ${3:-> ()} {\n\t${4}\n}', detail: 'snippet · fn' },
    { label: 'match', insertText: 'match ${1:expr} {\n\t${2:pattern} => ${3:expr},\n\t_ => ${4:()},\n}', detail: 'snippet · match' },
  ],
};

export const RUBY = {
  keywords: L('BEGIN END alias and begin break case class def defined? do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield require require_relative include extend attr_reader attr_writer attr_accessor'),
  builtins: L('puts print p gets Array Hash String Integer Float Symbol Regexp File Dir IO Time Date JSON each map select reject reduce inject find any? all? include? empty? nil? size length keys values fetch merge sort reverse join split gsub sub strip chomp to_s to_i to_f to_a to_h'),
  methods: L('each map select reject reduce find include? empty? size length keys values fetch merge sort reverse join split gsub strip chomp to_s to_i to_f'),
  modules: L('json csv yaml net/http uri fileutils pathname set ostruct securerandom'),
  snippets: [
    { label: 'def', insertText: 'def ${1:name}\n\t${2}\nend', detail: 'snippet · def' },
    { label: 'class', insertText: 'class ${1:Name}\n\t${2}\nend', detail: 'snippet · class' },
    { label: 'each', insertText: '${1:collection}.each do |${2:item}|\n\t${3}\nend', detail: 'snippet · each' },
  ],
};

export const PHP = {
  keywords: L('abstract and array as break callable case catch class clone const continue declare default die do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile eval exit extends final finally fn for foreach function global goto if implements include include_once instanceof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield true false null'),
  builtins: L('echo print printf sprintf var_dump print_r isset empty unset count strlen substr str_replace preg_match preg_replace explode implode array_map array_filter array_merge in_array array_key_exists json_encode json_decode file_get_contents file_put_contents fopen fclose fread fwrite PDO DateTime Exception Error'),
  methods: L('count strlen substr explode implode array_map array_filter array_merge in_array json_encode json_decode'),
  modules: L('PDO mysqli curl json mbstring xml gd zip session'),
  snippets: [
    { label: 'php', insertText: '<?php\n${1}\n', detail: 'snippet · php tag' },
    { label: 'foreach', insertText: 'foreach (${1:$arr} as ${2:$item}) {\n\t${3}\n}', detail: 'snippet · foreach' },
    { label: 'function', insertText: 'function ${1:name}(${2:$args}) {\n\t${3}\n}', detail: 'snippet · function' },
  ],
};

export const CSHARP = {
  keywords: L('abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while async await var dynamic nameof when yield record init required'),
  builtins: L('Console WriteLine Write ReadLine String Int32 Int64 Double Boolean Object List Dictionary HashSet Queue Stack Array Enumerable Task Exception Convert Math DateTime TimeSpan Guid File Directory Path StreamReader StreamWriter HttpClient JsonSerializer StringBuilder'),
  methods: L('WriteLine Write ReadLine ToString Equals GetHashCode Length Contains IndexOf Substring Add Remove ContainsKey TryGetValue Select Where OrderBy ToList ToArray'),
  modules: L('System System.Collections.Generic System.Linq System.Threading.Tasks System.IO System.Text System.Text.Json System.Net.Http'),
  snippets: [
    { label: 'main', insertText: 'static void Main(string[] args)\n{\n\t${1}\n}', detail: 'snippet · Main' },
    { label: 'cw', insertText: 'Console.WriteLine(${1});', detail: 'snippet · WriteLine' },
    { label: 'class', insertText: 'public class ${1:Name}\n{\n\t${2}\n}', detail: 'snippet · class' },
  ],
};

export const SQL = {
  keywords: L('SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE DROP ALTER ADD COLUMN PRIMARY KEY FOREIGN REFERENCES INDEX JOIN INNER LEFT RIGHT FULL OUTER ON AS AND OR NOT IN LIKE BETWEEN IS NULL ORDER BY ASC DESC GROUP HAVING LIMIT OFFSET DISTINCT COUNT SUM AVG MIN MAX UNION ALL EXISTS CASE WHEN THEN ELSE END WITH VIEW TRIGGER PROCEDURE FUNCTION BEGIN COMMIT ROLLBACK TRANSACTION CASCADE CONSTRAINT UNIQUE CHECK DEFAULT'),
  builtins: L('COUNT SUM AVG MIN MAX COALESCE NULLIF CAST CONVERT NOW CURRENT_TIMESTAMP'),
  methods: [],
  modules: [],
  snippets: [
    { label: 'select', insertText: 'SELECT ${1:*} FROM ${2:table} WHERE ${3:1=1};', detail: 'snippet · SELECT' },
    { label: 'insert', insertText: 'INSERT INTO ${1:table} (${2:cols}) VALUES (${3:vals});', detail: 'snippet · INSERT' },
    { label: 'join', insertText: 'SELECT ${1:*}\nFROM ${2:a}\nJOIN ${3:b} ON ${2:a}.${4:id} = ${3:b}.${4:id};', detail: 'snippet · JOIN' },
  ],
};

export const SHELL = {
  keywords: L('if then else elif fi for while until do done case esac function select time in export local readonly declare unset shift return exit break continue source'),
  builtins: L('echo printf read cd pwd ls cp mv rm mkdir rmdir touch cat grep sed awk find xargs chmod chown ps kill top df du tar gzip curl wget ssh scp git npm node python pip docker export alias which type command test true false'),
  methods: [],
  modules: [],
  snippets: [
    { label: 'shebang', insertText: '#!/usr/bin/env bash\nset -euo pipefail\n${1}', detail: 'snippet · shebang' },
    { label: 'if', insertText: 'if [[ ${1:condition} ]]; then\n\t${2}\nfi', detail: 'snippet · if' },
    { label: 'for', insertText: 'for ${1:i} in ${2:items}; do\n\t${3}\ndone', detail: 'snippet · for' },
  ],
};

export const HTML = {
  keywords: L('html head body title meta link script style div span p a img ul ol li table tr td th thead tbody form input button label select option textarea nav header footer main section article aside h1 h2 h3 h4 h5 h6 br hr strong em code pre canvas video audio iframe svg path template slot dialog'),
  builtins: L('class id href src alt type name value placeholder required disabled checked readonly maxlength min max step pattern autocomplete target rel download width height style onclick onchange onsubmit'),
  methods: [],
  modules: [],
  snippets: [
    { label: 'html5', insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8" />\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t<title>${1:Document}</title>\n</head>\n<body>\n\t${2}\n</body>\n</html>', detail: 'snippet · HTML5' },
    { label: 'div', insertText: '<div class="${1}">\n\t${2}\n</div>', detail: 'snippet · div' },
  ],
};

export const CSS = {
  keywords: L('color background background-color background-image border border-radius margin padding width height min-width max-width min-height max-height display flex grid position top right bottom left z-index overflow font-size font-family font-weight line-height text-align text-decoration justify-content align-items gap flex-direction flex-wrap grid-template-columns opacity visibility cursor transition transform animation box-shadow outline object-fit white-space content'),
  builtins: L('flex grid block inline inline-block none relative absolute fixed sticky center space-between space-around flex-start flex-end column row wrap nowrap auto inherit initial unset transparent solid dashed hidden visible scroll ellipsis cover contain pointer'),
  methods: [],
  modules: [],
  snippets: [
    { label: 'flexcenter', insertText: 'display: flex;\njustify-content: center;\nalign-items: center;', detail: 'snippet · flex center' },
    { label: 'grid', insertText: 'display: grid;\ngrid-template-columns: repeat(${1:3}, 1fr);\ngap: ${2:1rem};', detail: 'snippet · grid' },
  ],
};

export const JSON_LANG = {
  keywords: [],
  builtins: L('true false null'),
  methods: [],
  modules: [],
  snippets: [
    { label: 'object', insertText: '{\n\t"${1:key}": ${2:"value"}\n}', detail: 'snippet · object' },
    { label: 'array', insertText: '[\n\t${1}\n]', detail: 'snippet · array' },
  ],
};

export const YAML = {
  keywords: L('true false null yes no on off'),
  builtins: [],
  methods: [],
  modules: [],
  snippets: [
    { label: 'map', insertText: '${1:key}:\n  ${2:nested}: ${3:value}', detail: 'snippet · map' },
    { label: 'list', insertText: '- ${1:item}\n- ${2:item}', detail: 'snippet · list' },
  ],
};

export const MARKDOWN = {
  keywords: [],
  builtins: [],
  methods: [],
  modules: [],
  snippets: [
    { label: 'h1', insertText: '# ${1:Heading}', detail: 'snippet · H1' },
    { label: 'h2', insertText: '## ${1:Heading}', detail: 'snippet · H2' },
    { label: 'link', insertText: '[${1:text}](${2:url})', detail: 'snippet · link' },
    { label: 'code', insertText: '```${1:lang}\n${2}\n```', detail: 'snippet · code fence' },
    { label: 'todo', insertText: '- [ ] ${1:task}', detail: 'snippet · todo' },
  ],
};

export const KOTLIN = {
  keywords: L('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while by catch constructor delegate dynamic field file finally get import init param property receiver set setparam where actual abstract annotation companion const crossinline data enum expect external final infix inline inner internal lateinit noinline open operator out override private protected public reified sealed suspend tailrec vararg'),
  builtins: L('println print listOf mutableListOf mapOf mutableMapOf setOf mutableSetOf arrayOf emptyList emptyMap emptySet require check lazy TODO String Int Long Double Float Boolean Any Unit Nothing List Map Set'),
  methods: L('map filter forEach let also apply run with takeIf takeUnless isEmpty size get put add remove contains'),
  modules: L('kotlin kotlin.collections kotlin.io kotlinx.coroutines'),
  snippets: [
    { label: 'main', insertText: 'fun main() {\n\t${1:println("Hello")}\n}', detail: 'snippet · main' },
    { label: 'fun', insertText: 'fun ${1:name}(${2:args}): ${3:Unit} {\n\t${4}\n}', detail: 'snippet · fun' },
  ],
};

export const SWIFT = {
  keywords: L('associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break as break case catch continue default defer do else fallthrough for guard if in repeat return throw switch where while Any Self false is nil super self true try throws async await actor'),
  builtins: L('print String Int Double Float Bool Array Dictionary Set Optional Result Error URL Data Date UUID Codable Encodable Decodable'),
  methods: L('append insert remove map filter reduce forEach contains isEmpty count sorted'),
  modules: L('Foundation UIKit SwiftUI Combine AppKit'),
  snippets: [
    { label: 'main', insertText: 'import Foundation\n\nprint("${1:Hello}")', detail: 'snippet · main' },
    { label: 'func', insertText: 'func ${1:name}(${2:args}) ${3:-> Void} {\n\t${4}\n}', detail: 'snippet · func' },
  ],
};

/** Monaco language id → catalog */
export const CATALOGS = {
  python: PYTHON,
  javascript: JAVASCRIPT,
  typescript: JAVASCRIPT,
  c: C_LANG,
  cpp: CPP,
  java: JAVA,
  go: GO,
  rust: RUST,
  ruby: RUBY,
  php: PHP,
  csharp: CSHARP,
  sql: SQL,
  shell: SHELL,
  html: HTML,
  css: CSS,
  scss: CSS,
  json: JSON_LANG,
  yaml: YAML,
  markdown: MARKDOWN,
  kotlin: KOTLIN,
  swift: SWIFT,
};
