import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(folder, name), 'utf8');
const stripImports = (source) => source.replace(/^import[^\n]*\n/gm, '');
const stripExports = (source) => source.replace(/^export\s+/gm, '');

const configSource = stripExports(read('config.js'));
const supabaseSource = stripExports(stripImports(read('supabase.js')));
const authSource = stripImports(read('auth.js'));
const portalSource = stripImports(read('portal.js'));

const bundle = [
  '/* Generated from config.js, supabase.js, auth.js, and portal.js. Rebuild with node build-file-dashboard.mjs. */',
  '(function(){\n' + configSource + '\nglobalThis.RankRightConfig={SUPABASE_URL:SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:SUPABASE_PUBLISHABLE_KEY,PROJECT_REF:PROJECT_REF};\n})();',
  '(function(){\nconst SUPABASE_URL=globalThis.RankRightConfig.SUPABASE_URL;\nconst SUPABASE_PUBLISHABLE_KEY=globalThis.RankRightConfig.SUPABASE_PUBLISHABLE_KEY;\n' + supabaseSource + '\nglobalThis.RankRightAuth=Auth;\nglobalThis.RankRightDB=DB;\nglobalThis.RankRightFiles=WorkspaceFiles;\n})();',
  "if(document.querySelector('#auth-form')){(function(){\nconst Auth=globalThis.RankRightAuth;\n" + authSource + '\n})();}',
  "if(document.body.dataset.dashboardRole){(function(){\nconst Auth=globalThis.RankRightAuth;\nconst DB=globalThis.RankRightDB;\nconst WorkspaceFiles=globalThis.RankRightFiles;\nconst PROJECT_REF=globalThis.RankRightConfig.PROJECT_REF;\n" + portalSource + '\n})();}'
].join('\n\n');

writeFileSync(resolve(folder, 'dashboard-file.js'), bundle, 'utf8');
console.log('Built dashboard-file.js for standard and file URL loading.');
