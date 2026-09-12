import { rm } from 'node:fs/promises';

const APP_BUILD_DIRECTORIES = ['dist', 'dist-electron'];

await Promise.all(
  APP_BUILD_DIRECTORIES.map((directory) =>
    rm(new URL(`../${directory}`, import.meta.url), {
      force: true,
      recursive: true,
    }),
  ),
);
