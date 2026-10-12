import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const consumer = mkdtempSync(join(tmpdir(), 'steady-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const command = (file, args, cwd = consumer) =>
  execFileSync(file, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const install = (...packages) =>
  command(npm, [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...packages,
  ]);

try {
  const [packed] = JSON.parse(
    command(
      npm,
      ['pack', '--ignore-scripts', '--json', '--pack-destination', consumer],
      root,
    ),
  );
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(packed.version, manifest.version);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  install(join(consumer, packed.filename));
  writeFileSync(
    join(consumer, 'core.mjs'),
    `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createTask, createNavigation } from '@oddurs/steady';
const require = createRequire(import.meta.url);
assert.throws(() => require.resolve('react'), /Cannot find module/);
assert.equal(typeof require('@oddurs/steady').createMutation, 'function');
const task = createTask((input) => input + 1, { debounceMs: 1000 });
const pending = task.run(2);
assert.equal(task.getSnapshot().isScheduled, true);
task.flush();
assert.deepEqual(await pending, { status: 'success', data: 3 });
let requests = 0;
const nav = createNavigation((path) => { requests++; return path; }, { initial: { destination: '/', data: 'Home' }, prefetch: {} });
await nav.prefetch('/next');
await nav.navigate('/next');
assert.equal(requests, 1);
assert.equal(nav.getSnapshot().current, '/next');
nav.dispose();
task.dispose();
`,
  );
  command(process.execPath, ['core.mjs']);
  console.log(
    'Packed core: ESM, CommonJS, debounce, prefetch, and no React dependency passed.',
  );

  for (const file of ['index.js', 'index.cjs']) {
    const entry = readFileSync(
      join(consumer, 'node_modules/@oddurs/steady/dist/react', file),
      'utf8',
    );
    assert.match(entry, /^['"]use client['"];/);
  }

  writeFileSync(
    join(consumer, 'react.mjs'),
    `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createElement, version } from 'react';
import { renderToString } from 'react-dom/server';
import { useTask, useNavigation, useMutation } from '@oddurs/steady/react';
const require = createRequire(import.meta.url);
assert.equal(typeof require('@oddurs/steady/react').useNavigation, 'function');
function Example() {
  const task = useTask(() => 'next', { initialData: 'initial', debounceMs: 250 });
  const nav = useNavigation((path) => path, { initial: { destination: '/', data: 'Home' }, prefetch: {} });
  const mutation = useMutation((value) => value, { initialData: false });
  return createElement('p', null, task.data + ':' + nav.current + ':' + mutation.data);
}
assert.equal(renderToString(createElement(Example)), '<p>initial:/:false</p>');
console.log('Packed React ' + version + ': ESM, CommonJS, and SSR passed.');
`,
  );
  const installedReact = JSON.parse(
    readFileSync(join(root, 'node_modules/react/package.json'), 'utf8'),
  ).version;
  for (const version of ['18.3.1', installedReact]) {
    install(`react@${version}`, `react-dom@${version}`);
    process.stdout.write(command(process.execPath, ['react.mjs']));
  }

  const reactTypes = JSON.parse(
    readFileSync(join(root, 'node_modules/@types/react/package.json'), 'utf8'),
  ).version;
  install(`@types/react@${reactTypes}`);
  const source = `
import { createNavigation, createTask, type PrefetchResult } from '@oddurs/steady';
import { useTask, useNavigation } from '@oddurs/steady/react';
const nav = createNavigation((path) => path.length, { initial: { destination: '/', data: 0 }, prefetch: {} });
const data: number = nav.getSnapshot().data.data;
const prefetch: Promise<PrefetchResult<number>> = nav.prefetch('/next');
const task = createTask((n: number) => n + 1, { debounceMs: 250 });
task.flush();
const scheduled: boolean = task.getSnapshot().isScheduled;
function Example() {
  const state = useTask((q: string) => q.length, { debounceMs: 150 });
  state.flush();
  const navigation = useNavigation((path) => path, { initial: { destination: '/', data: 'Home' }, prefetch: {} });
  const committed: string = navigation.data.data;
  return committed;
}
`;
  writeFileSync(join(consumer, 'consumer.mts'), source);
  writeFileSync(join(consumer, 'consumer.cts'), source);
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
      },
      include: ['consumer.mts', 'consumer.cts'],
    }),
  );
  command(process.execPath, [
    join(root, 'node_modules/typescript/bin/tsc'),
    '--project',
    join(consumer, 'tsconfig.json'),
  ]);
  console.log(
    'Packed declarations: strict NodeNext ESM and CommonJS consumers passed.',
  );
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
