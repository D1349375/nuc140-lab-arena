# BSP source provenance

`bsp/` is a selected, unmodified subset of the user-supplied
`Nu-LB-NUC140_BSP3.00.004_v1.4.5.zip`, used by the classroom Nu-LB-NUC140
projects. It contains Nuvoton peripheral drivers, educational board libraries,
CMSIS headers, ARM startup assembly, and seven original GPIO sample projects.

Original copyrights and notices remain in the files. Nuvoton and ARM/CMSIS
materials retain their respective terms; the application's MIT license does
not relicense these third-party files. The supplied CMSIS licence agreement
is retained under `bsp/Library/CMSIS/`.

Hardware export retains this baseline and overlays the learner's edited files
in a private exported bundle. Platform simulation headers are separate and
never included in hardware exports.

## Monaco Editor

The editing workbench bundles Microsoft Monaco Editor 0.57.0 from the official
`monaco-editor` npm package. Its C tokenizer, editor features, Traditional
Chinese messages, codicon font and editor worker are distributed locally under
`web/assets/editor`. The MIT licence is retained as `LICENSE.txt` in that
directory, with bundled notices in `editor.js.LEGAL.txt`.

The source integration is `web/editor.js`; `tools/build-editor.mjs` reproduces
the bundle using the pinned dependencies in `package-lock.json`. Monaco is not
part of exported Keil projects.

## Course question screenshots

`web/assets/problems` contains cropped screenshots rendered from the user's
supplied Lab PowerPoint files. Original course wording, diagrams and examples
are preserved. The source slide indexes and crop coordinates are recorded in
that directory's `SOURCES.md`. The application's MIT licence does not relicense
the original course materials.
