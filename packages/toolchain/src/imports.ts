import ts from 'typescript';

/** One module reference found in a source file, with its 1-based line. */
export interface ImportReference {
  readonly specifier: string;
  readonly line: number;
  /** The argument of `import()` or `require()` is not a literal, so it cannot be checked. */
  readonly computed?: true;
}

const SCRIPT_KINDS: Readonly<Record<string, ts.ScriptKind>> = {
  '.tsx': ts.ScriptKind.TSX,
  '.jsx': ts.ScriptKind.JSX,
  '.js': ts.ScriptKind.JS,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
};

/**
 * Lists every module a file refers to by walking its syntax tree: import and export
 * declarations of every form (including `export * as ns from` and `export type *`),
 * `import x = require()`, `import()`, `require()`, `require.resolve()`,
 * `import.meta.resolve()`, type-level `import('x')`, `declare module 'x'` and
 * triple-slash `path` and `types` references. A call whose argument is not a literal is
 * returned with `computed: true`. Specifiers inside comments and strings are not reported.
 */
export function findImports(sourceText: string, fileName = 'source.ts'): ImportReference[] {
  const extension = /\.[cm]?[jt]sx?$/.exec(fileName)?.[0] ?? '.ts';
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    SCRIPT_KINDS[extension] ?? ts.ScriptKind.TS,
  );
  const found: ImportReference[] = [];
  const lineAt = (pos: number): number => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  const add = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) {
      found.push({ specifier: node.text, line: lineAt(node.getStart(sourceFile)) });
    } else {
      found.push({
        specifier: node.getText(sourceFile),
        line: lineAt(node.getStart(sourceFile)),
        computed: true,
      });
    }
  };

  // `path` references are file paths even without a leading `./`; `types` references name packages.
  for (const ref of sourceFile.referencedFiles) {
    const specifier = /^\.{0,2}\//.test(ref.fileName) ? ref.fileName : `./${ref.fileName}`;
    found.push({ specifier, line: lineAt(ref.pos) });
  }
  for (const ref of sourceFile.typeReferenceDirectives) {
    found.push({ specifier: ref.fileName, line: lineAt(ref.pos) });
  }

  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      add(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    } else if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) {
      add(node.name);
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (ts.isLiteralTypeNode(argument)) add(argument.literal);
    } else if (ts.isCallExpression(node) && isModuleCall(node)) {
      const [first] = node.arguments;
      if (first !== undefined) add(first);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found.sort((a, b) => a.line - b.line);
}

/** `import(x)`, `require(x)`, `require.resolve(x)` and `import.meta.resolve(x)`. */
function isModuleCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (callee.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (ts.isIdentifier(callee)) return callee.text === 'require';
  if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'resolve') {
    const target = callee.expression;
    return (
      (ts.isIdentifier(target) && target.text === 'require') ||
      (ts.isMetaProperty(target) && target.keywordToken === ts.SyntaxKind.ImportKeyword)
    );
  }
  return false;
}
