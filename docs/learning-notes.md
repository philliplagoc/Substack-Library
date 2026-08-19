# Learning notes

This file holds the questions the developer asked while they built this project,
with short answers. The newest section is at the bottom. No code reads this file.

---

## 2026-08-19 - Milestone 0, Task 1

### What are the three items in the `.gitignore`?

```gitignore
node_modules/
.DS_Store
Thumbs.db
```

| Entry | Why |
|---|---|
| `node_modules/` | The installed dependency tree. `npm install` rebuilds it from `package-lock.json`. A commit of this folder wastes space and makes merge noise. |
| `.DS_Store` | A macOS Finder file. It holds icon positions. |
| `Thumbs.db` | The Windows equivalent. It caches image thumbnails. Windows writes this file on this machine. |

The plan's File Structure block (line 69) shows only `# node_modules`. Task 1
Step 1 gives the correct version. Write all three lines.

### What is `package.json`?

The manifest for a Node project. It sits at the root of a folder. It gives the
name of the project, the list of dependencies, the available commands, and the
module system for the files.

A folder with this file is a Node project. `npm install` looks up the folder
tree for the nearest `package.json`. It then makes `node_modules/` beside it.

Fields in `spike/package.json`:

| Field | What it does |
|---|---|
| `name` | The package identifier. It is a label here, because you do not publish this package. |
| `private: true` | It stops `npm publish`. This guards against an upload to the public registry. |
| `type: "module"` | It sets every `.js` file in the folder to ESM, so `import` and `export` work. Without it, Node reads `.js` as CommonJS and `import` throws a `SyntaxError`. |
| `scripts.test` | It defines what `npm test` runs. Here it runs `node --test`. |

`npm install --save-dev linkedom` (Task 1 Step 3) adds a `devDependencies` block
to this file. Dev dependencies help you develop and test the project. The project
does not need them to run. The `^` in `^0.18.5` accepts a compatible newer
version such as `0.18.6`. It refuses `0.19.0`.

`package-lock.json` appears at the same time. `package.json` gives the intent.
`package-lock.json` records the exact version of each package and sub-package
that npm installed, so a later `npm install` builds the same tree. Commit the
lock file. Do not commit `node_modules/`.

### Why is the test file `.mjs` and `extract.js` a plain script?

`.mjs` marks a file as ESM whatever `package.json` says. Here `type: "module"`
already does that, so the extension is a second guard.

`extract.js` uses no module syntax. It is a plain script that assigns to
`globalThis`, because Task 4 Step 5 pastes it into the DevTools console. The
console cannot run `import` or `export`.

### What is Node?

JavaScript started in the web browser. The language has no command to read a file
or to open a socket. Browsers keep those abilities away from web pages for
security.

Node.js runs the same language outside the browser and adds those abilities. It
bundles V8, the JavaScript engine from Chrome, with access to the operating
system. It gives you a `node` command for the terminal. You install Node once on
the machine. It is not a part of the project.

| | Browser | Node |
|---|---|---|
| Language | JavaScript | JavaScript |
| `document`, `window`, DOM | yes | **no** |
| Read and write files (`node:fs`) | no | yes |
| Command-line arguments, exit codes | no | yes |
| Started by | opening a page | typing `node file.js` |

### Why does the spike need Node, and why `linkedom`?

Task 4 must prove that `extractArticleMeta` reads the correct title from a
Substack page. A check by hand in the console is slow, and it fails when the
author edits the article or the network goes down.

Node reads the frozen fixture from disk instead:

```js
const html = await readFile(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
```

A browser page cannot read your disk, so only Node can run that line.

Node has no DOM. `extract.js` calls `doc.querySelector(...)`, and Node supplies
no `document` object. `linkedom` fills the gap. It reads a string of HTML and
builds a `Document` in pure JavaScript that answers `querySelector` like a
browser:

```js
return parseHTML(html).document;
```

The same `extract.js` then runs in the console against a live page and in Node
against a saved file.

### What is a Node project?

A folder that Node and `npm` treat as one unit. It holds at minimum:

```
spike/                    <- the project root
  package.json            <- the manifest that marks it a project
  node_modules/           <- the downloaded dependencies (gitignored)
  extract.test.mjs        <- your code
```

`npm` is the package manager that comes with Node. It reads `package.json`,
downloads the dependencies, and runs the named scripts.

The spike is a project inside the repository, not at the repository root. That is
why each command in the plan says `cd spike; npm test`. Run `npm test` from the
repository root and npm finds no `package.json`.

### Why Node 24?

Node 24 has a test runner built in. `node --test` replaces Jest or Vitest, and
the dev dependency list stays at one small library.

```
node --test        <- finds each *.test.mjs file, runs it, prints "# pass N"
```

Check the version before Task 1 Step 3:

```powershell
node --version
```

Install the current LTS from nodejs.org if it prints below `v24`. Older versions
give `--test` a different behavior.
