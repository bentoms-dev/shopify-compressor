import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      skipLibCheck: true,
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true,
  noExternal: [],
  esbuildOptions(options) {
    options.packages = 'external';
  },
});
