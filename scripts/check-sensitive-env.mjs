import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

const ignoredDirectories = new Set([
  '.git',
  'dist',
  'node_modules',
]);

const ignoredFiles = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
  '.env.test',
]);

const allowedFiles = new Set([
  '.env.example',
  'docs/DEPLOIEMENT.md',
  'docs/SUPABASE.md',
  'docs/MULTISITE.md',
  'docs/TESTS_MANUELS.md',
  'scripts/check-sensitive-env.mjs',
]);

const allowedUrlPlaceholders = new Set([
  'https://<projet-test>.supabase.co',
  'https://xxxx.supabase.co',
]);

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.map',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
]);

const checks = [
  {
    label: 'Supabase URL hardcodee',
    pattern: /https:\/\/[a-z0-9-]+\.supabase\.co/gi,
    allowMatch: (match) => allowedUrlPlaceholders.has(match),
  },
  {
    label: 'Cle service_role exposee en VITE',
    pattern: /(?:^|\s|["'])VITE_SUPABASE_SERVICE_ROLE_KEY\s*=/gi,
  },
  {
    label: 'JWT Supabase probable',
    pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  },
  {
    label: 'Cle OpenAI probable',
    pattern: /sk-[A-Za-z0-9_-]{20,}/g,
  },
];

const getExtension = (filePath) => {
  const index = filePath.lastIndexOf('.');
  return index === -1 ? '' : filePath.slice(index).toLowerCase();
};

const walk = (directory) => {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    const relativePath = relative(root, fullPath).replaceAll('\\', '/');

    if (stats.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        files.push(...walk(fullPath));
      }
      continue;
    }

    if (!stats.isFile()) continue;
    if (ignoredFiles.has(entry)) continue;
    if (!textExtensions.has(getExtension(entry))) continue;

    files.push({ fullPath, relativePath });
  }

  return files;
};

const findings = [];

for (const file of walk(root)) {
  const content = readFileSync(file.fullPath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, lineIndex) => {
    for (const check of checks) {
      check.pattern.lastIndex = 0;
      let match;

      while ((match = check.pattern.exec(line)) !== null) {
        if (check.allowMatch?.(match[0])) continue;
        if (allowedFiles.has(file.relativePath) && check.label === 'Cle service_role exposee en VITE') continue;

        findings.push({
          file: file.relativePath,
          line: lineIndex + 1,
          label: check.label,
        });
      }
    }
  });
}

const builtFindings = [];
const distDirectory = join(root, 'dist');

if (existsSync(distDirectory)) {
  const builtFiles = walk(distDirectory);
  const secretPatterns = [
    { label: 'Nom de secret serveur dans le bundle', pattern: /(?:SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|sb_secret_[A-Za-z0-9_-]{16,})/g },
    { label: 'Clé OpenAI probable dans le bundle', pattern: /sk-[A-Za-z0-9_-]{20,}/g },
    { label: 'Clé privée probable dans le bundle', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  ];

  for (const file of builtFiles) {
    if (file.relativePath.endsWith('.map')) {
      builtFindings.push({ file: file.relativePath, label: 'Source map publiée' });
      continue;
    }

    const content = readFileSync(file.fullPath, 'utf8');
    for (const check of secretPatterns) {
      check.pattern.lastIndex = 0;
      if (check.pattern.test(content)) {
        builtFindings.push({ file: file.relativePath, label: check.label });
      }
    }

    const jwtPattern = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;
    for (const token of content.match(jwtPattern) ?? []) {
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
        if (payload.role === 'service_role') {
          builtFindings.push({ file: file.relativePath, label: 'JWT service_role dans le bundle' });
        }
      } catch {
        // Une chaîne ressemblant à un JWT mais invalide n'est pas une preuve de secret.
      }
    }
  }
}

if (findings.length > 0 || builtFindings.length > 0) {
  console.error('Variables sensibles ou URLs hardcodees detectees :');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.label}`);
  }
  for (const finding of builtFindings) {
    console.error(`- ${finding.file} ${finding.label}`);
  }
  process.exit(1);
}

console.log(`Aucun secret ni URL Supabase hardcodee detecte${existsSync(distDirectory) ? ' dans les sources ou le bundle' : ' dans les sources'}.`);
