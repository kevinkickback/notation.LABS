import { rm } from 'node:fs/promises';

const generatedDirectories = ['dist', 'dist-electron'];

await Promise.all(
  generatedDirectories.map((directory) =>
    rm(new URL(`../${directory}`, import.meta.url), {
      force: true,
      recursive: true,
    }),
  ),
);
