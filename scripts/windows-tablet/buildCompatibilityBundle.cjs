const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'windows/TabletCompatibility/x64/Release');

const build = async () => {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['src/app/CompatibilityEntry.js'],
    platform: 'browser',
    bundle: true,
    target: 'edge120',
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: { 'react-native': path.join(root, 'src/app/compatibilityReactNative.js') },
    define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
    outfile: path.join(output, 'compatibility.bundle'),
    minify: true,
  });
  const picker = await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['src/features/remote-support/ltscScreenPeerPage.ts'],
    bundle: true,
    format: 'esm',
    write: false,
  });
  const url = `data:text/javascript;base64,${Buffer.from(picker.outputFiles[0].contents).toString('base64')}`;
  const { default: pickerPage } = await import(url);
  fs.writeFileSync(path.join(output, 'session-picker.html'), pickerPage);
};

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
