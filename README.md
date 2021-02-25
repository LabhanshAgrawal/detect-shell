# detect-shell

Detect [shells](https://en.wikipedia.org/wiki/Shell_(computing)) available on the system (based on vscode's [implementation](https://github.com/microsoft/vscode/blob/master/src/vs/workbench/contrib/terminal/node/terminal.ts))

[![npm](https://img.shields.io/npm/v/detect-shell?style=for-the-badge)](https://www.npmjs.com/package/detect-shell)
[![unpkg](https://img.shields.io/badge/dynamic/json?label=unpkg&query=$.version&url=https%3A%2F%2Funpkg.com%2Fdetect-shell%40latest%2Fpackage.json&style=for-the-badge&color=orange)](https://unpkg.com/detect-shell@latest/)

## Install

```
$ npm install --save detect-shell
```

## Usage

```js
const {detectAvailableShells} = require('detect-shell');

detectAvailableShells().then((shells) => {
  console.log(shells);
});

// output
[
  { label: 'bash', path: '/bin/bash' },
  { label: 'csh', path: '/bin/csh' },
  { label: 'dash', path: '/bin/dash' },
  { label: 'ksh', path: '/bin/ksh' },
  { label: 'sh', path: '/bin/sh' },
  { label: 'tcsh', path: '/bin/tcsh' },
  { label: 'zsh', path: '/bin/zsh' },
  { label: 'pwsh', path: '/usr/local/bin/pwsh' }
]
```
