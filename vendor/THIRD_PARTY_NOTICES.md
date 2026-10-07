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
