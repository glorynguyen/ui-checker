// No `vscode` import — all VS Code surface area is injected via FileEnumeratorDeps so this
// module can be loaded and tested with plain tsx outside of the extension host.

export interface Uri {
  readonly fsPath: string;
}

export interface WorkspaceConfiguration {
  get<T>(section: string): T | undefined;
}

export interface FileEnumeratorDeps {
  getConfiguration(section: string): WorkspaceConfiguration;
  findFiles(include: string, exclude: string): Promise<Uri[]>;
  readFile(uri: Uri): Promise<Uint8Array>;
}

export interface SearchableFile {
  uri: Uri;
  filePath: string;
  content: string;
}

const DEFAULT_EXTENSIONS = ['tsx', 'jsx', 'ts', 'vue', 'svelte', 'astro', 'html', 'css', 'scss', 'less'];

const SAFETY_EXCLUDES = [
  '**/node_modules/**',
  '**/.next/**',
  '**/coverage/**',
  '**/dist/**',
  '**/out/**',
  '**/.turbo/**',
  '**/.git/**',
  '**/build/**',
];

const DEFAULT_MAX_FILE_SIZE = 1_048_576; // 1 MB

function buildExcludeGlob(
  filesExclude: Record<string, boolean>,
  searchExclude: Record<string, boolean>,
  additionalExcludes: string[]
): string {
  const fromVscode = [
    ...Object.entries(filesExclude).filter(([, v]) => v).map(([k]) => k),
    ...Object.entries(searchExclude).filter(([, v]) => v).map(([k]) => k),
  ];
  const all = [...new Set([...SAFETY_EXCLUDES, ...fromVscode, ...additionalExcludes])];
  return `{${all.join(',')}}`;
}

export async function enumerateSearchableFiles(deps: FileEnumeratorDeps): Promise<SearchableFile[]> {
  const bridgeConfig = deps.getConfiguration('ui-checker-bridge');
  const filesConfig  = deps.getConfiguration('files');
  const searchConfig = deps.getConfiguration('search');

  const extensions       = bridgeConfig.get<string[]>('searchExtensions')        ?? DEFAULT_EXTENSIONS;
  const additionalExcludes = bridgeConfig.get<string[]>('additionalExcludePatterns') ?? [];
  const maxFileSize      = bridgeConfig.get<number>('maxFileSize')                 ?? DEFAULT_MAX_FILE_SIZE;

  const filesExclude  = filesConfig.get<Record<string, boolean>>('exclude')  ?? {};
  const searchExclude = searchConfig.get<Record<string, boolean>>('exclude') ?? {};

  const includeGlob = `**/*.{${extensions.join(',')}}`;
  const excludeGlob = buildExcludeGlob(filesExclude, searchExclude, additionalExcludes);

  const uris = await deps.findFiles(includeGlob, excludeGlob);

  const decoder = new TextDecoder();
  const results: SearchableFile[] = [];

  for (const uri of uris) {
    try {
      const bytes = await deps.readFile(uri);
      if (bytes.byteLength > maxFileSize) continue;
      results.push({ uri, filePath: uri.fsPath, content: decoder.decode(bytes) });
    } catch {
      // skip unreadable files (locked, binary, permission denied)
    }
  }

  return results;
}
