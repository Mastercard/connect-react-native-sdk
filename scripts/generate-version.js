const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');

const constantsContent = `// This file is auto-generated via scripts/generate-version.js which is run via pre-build step in npm run build
export const SDK_VERSION = '${packageJson.version}';
`;

fs.writeFileSync(path.join(__dirname, '../src/version.ts'), constantsContent);

console.log('Versions file generated successfully.');
