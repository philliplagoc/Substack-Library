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

### What is `linkedom`?

An npm package. It builds a DOM from a string of HTML in pure JavaScript, so code
outside a browser can call `querySelector` and read `textContent`.

```js
import { parseHTML } from 'linkedom';

const { document } = parseHTML('<h1 class="title">Hello</h1>');
document.querySelector('.title').textContent;   // 'Hello'
```

It supplies the parts of the DOM that read a document. It omits the parts that
need a browser engine.

| Ability | `linkedom` |
| --- | --- |
| `querySelector`, `getAttribute`, `textContent`, `innerHTML` | Yes |
| `<meta>`, `<script type="application/ld+json">`, `<time datetime>` | Yes |
| Layout, `getComputedStyle`, `getBoundingClientRect` | No |
| Runs `<script>` tags in the page | No |
| Fetches images, styles, or XHR | No |

Three packages do this job at different sizes:

| Package | What it is | Cost |
| --- | --- | --- |
| `cheerio` | jQuery-style selectors over a parse tree. Not a DOM. | Smallest. Browser code does not run against it. |
| `linkedom` | A DOM with the standard property names. | Small and fast. Not a full browser. |
| `jsdom` | A browser simulation. Runs scripts, parses CSS, fires events. | Large and slow. |

The spike takes the middle one. `spike/extract.js` runs in two places: the
DevTools console against a live Substack page, and `node --test` against a saved
fixture. The line `doc.querySelector('h1.post-title')` must work in both.
`cheerio` forces a second version of the code. `jsdom` adds seconds to each test
run and executes the Substack scripts inside the fixture.

The fixtures are frozen HTML files. Nothing in them must run, so the browser
simulation adds no value here.

See also "Why does the spike need Node, and why `linkedom`?" above.

### What is `spike/extract.test.mjs` and what is the point of it?

The automated test file for `spike/extract.js`. The name holds three decisions:

| Part | Meaning |
| --- | --- |
| `extract` | Names the file under test. |
| `.test` | The discovery pattern. `node --test` scans for `*.test.mjs` and `*.test.js`, then runs each match in its own process. |
| `.mjs` | Marks the file as an ES module, so `import` works. |

Task 1 Step 4 puts a smoke test in it. That test checks `linkedom`, not your code:

```js
test('linkedom parses HTML into a Document', () => {
  const { document } = parseHTML('<html><head><title>Hi</title></head><body></body></html>');
  assert.equal(document.title, 'Hi');
});
```

It proves that Node 24 runs, that `npm test` finds the file, that ESM resolves,
and that `linkedom` installed. Find those failures now, before Task 4 adds a
broken selector to the list of suspects.

Task 4 Step 1 replaces it with the fixture harness. The harness reads
`fixtures/manifest.json`, makes one test for each captured article, parses the
frozen HTML with `linkedom`, and compares `extractArticleMeta(doc)` against the
values recorded by hand:

```js
for (const entry of manifest.filter((e) => e.kind === 'article')) {
  test(`extractArticleMeta: ${entry.file}`, async () => {
    const doc = await loadFixture(entry.file);
    const meta = extractArticleMeta(doc);
    assert.equal(meta.title, entry.expected.title);
    // ...
  });
}
```

The `for` loop runs at import time, not inside a test. `node --test` collects
tests while the module executes, so the fixture count sets the test count. Add a
fixture and you get a test. Edit no code.

The point: Substack publishes no API and makes no promise about its HTML. A
renamed CSS class makes the extension save cards with a `null` title, and no
error appears. This file is the tripwire. `npm test` names the fixture and the
field that broke.

The fixtures make that possible. A test against the live site fails when the
author edits the post, when the network drops, or when Substack tries a new
layout. A frozen file changes when you replace it.

An empty `extract.test.mjs` reports `pass 1`. `node --test` counts the file as
one test, and a file that does nothing does nothing without an error. Task 4
Step 2 tells you to run the test before you write `extract.js` and to confirm it
fails with `Cannot find module './extract.js'`. A test you never watched fail can
assert nothing at all.

### What is the DOM?

DOM is short for Document Object Model. HTML on disk is text. The browser reads
that text and builds a tree of objects in memory. The tree is the DOM.

```html
<article>
  <h1 class="post-title">Hello</h1>
  <p>First line.</p>
</article>
```

becomes:

```
article
├── h1.post-title
│   └── #text "Hello"
└── p
    └── #text "First line."
```

Nesting in the text becomes parent and child links in the tree. Each node is an
object with properties such as `textContent` and `className`, and methods such as
`querySelector` and `getAttribute`. `document.querySelector('h1')` searches the
tree and returns a live object.

Two results matter for this project.

The DOM is not the HTML file. The browser downloads the text one time and builds
the tree. After that, JavaScript edits the tree, and the text stays as it was.
Substack sends a near-empty shell and fills the tree with JavaScript, so "View
source" shows little and the DOM holds the article. `spike/capture-fixture.js`
runs in the DevTools console for this reason.

The DOM is also an interface. The name covers the tree and the standard method
names that work on it. Any tool can supply those names.

### What does it mean that `linkedom` builds a DOM from a string of HTML?

A browser does two jobs: it parses text into a tree, then it paints the tree on
the screen. `linkedom` does the first job and skips the second.

```js
import { parseHTML } from 'linkedom';

const { document } = parseHTML('<h1 class="post-title">Hello</h1>');
document.querySelector('.post-title').textContent;   // 'Hello'
```

Give it a string. Get back an object with `querySelector`, `getAttribute`,
`children`, and the other standard names. It paints nothing, opens no window,
runs no script from that HTML, and makes no network request.

Node has no `document` global. Node runs servers and command-line tools, and no
web page exists inside it. Without `linkedom`, this line has no tree to search:

```js
const el = doc.querySelector('h1.post-title');
```

With `linkedom`, `spike/extract.js` runs in two places without an edit. In the
console, `doc` is the browser tree. In `extract.test.mjs`, `doc` is a tree that
`linkedom` built from a fixture file.

### What is an npm package? Is it the same as a Python package?

The idea matches. Someone publishes reusable code to a public registry, you
declare what you want, and a tool downloads it. The vocabulary maps across:

| Python | npm | Job |
| --- | --- | --- |
| PyPI | npm registry | The public index |
| `pip`, `uv` | `npm` | The installer |
| `pyproject.toml` | `package.json` | Declares what you want |
| `uv.lock`, `poetry.lock` | `package-lock.json` | Records what you got |
| `site-packages/` | `node_modules/` | Where the code lands |
| `dependency-groups` | `devDependencies` | Needed to build and test, not to run |
| `import bs4` | `import { parseHTML } from 'linkedom'` | Using it |

Two differences matter.

Isolation is a directory, not a mode you turn on. Python asks you to create a
virtual environment and activate it, and `pip install` hits the system Python
when you forget. npm puts `node_modules/` inside the project folder, and that is
the whole mechanism. Node resolves `import 'linkedom'` by looking for
`./node_modules/linkedom`, then the parent directory, up to the filesystem root.
`spike/node_modules/` is why each command says `cd spike; npm test`.

npm permits two versions of one package in one project. Python allows one
version of `requests` per environment, and two libraries that want different
versions give you a conflict to solve. npm nests instead: package A keeps its
copy in `A/node_modules/`, and package B keeps a different copy. Fewer
conflicts, larger install directories.

The spike shows the second point. One package went into `package.json`:

```
spike/node_modules/
  boolbase       css-what        dom-serializer   domutils   htmlparser2   uhyphen
  css-select     cssom           domelementtype   entities   linkedom
  domhandler     html-escaper    nth-check
```

Fourteen directories. `linkedom` needs `css-select` to match selectors,
`css-select` needs `css-what` to parse selector syntax, and `css-what` needs
`boolbase`. npm walked the graph and installed all of it. `package.json` holds
your intent, one line. `package-lock.json` holds the resolved result, all
fourteen.

`boolbase` contains two functions that return `true` and `false`. It ships as a
separate package. That is why `.gitignore` starts with `node_modules/` and why
you commit the lock file.

`"private": true` in `package.json` blocks `npm publish`. The spike cannot reach
the public registry by accident.

### What is a Fixture Capture Snippet?

Task 2 of the Milestone 0 plan. The name has three words, and each word records
a decision.

**Fixture** is a frozen input for a test. Here it is one Substack page saved as
HTML on disk, in `spike/fixtures/`. The test suite parses that file with
`linkedom`, then asserts that the selectors find the title, the author, and the
paywall state. The file does not change. A test failure then has one meaning:
the extraction code broke.

**Capture** is the act to get that HTML from a live page. Three methods give
three different results:

| Method | Result |
|---|---|
| `Ctrl+U` (view source) | The server shell. Substack adds the article with JavaScript after load, so the shell holds no article text. |
| Save Page As | The article, and also the images, the stylesheets, and the tracking scripts. |
| DevTools console | The finished DOM. The content script reads this same DOM at Milestone 1. |

The plan uses the console.

**Snippet** is a block of JavaScript that you paste into the console by hand. No
module imports `spike/capture-fixture.js`. `npm test` does not run it. It is a
file so that git can hold it and so that you can paste it again for the next
fixture.

The snippet edits `document.documentElement.cloneNode(true)`. It does not edit
the live page. You are signed in, and you read that tab. A change to the real
DOM breaks the page and needs a reload.

The strip list serves two goals. Scripts, `iframe`, and `svg` come out for
safety, because the fixture must stay inert when a tool opens it. Images come
out for size, because a Substack article holds megabytes of images and git keeps
each version.

`script:not([type="application/ld+json"])` is the exception in that list.
JSON-LD is a `<script>` tag that holds metadata. The browser does not execute
it. It is a possible source for the title and the publish date, so `extract.js`
can read it in Task 4.

The `redact(text)` step exists because the fixtures go into git. A signed-in
Substack page shows your display name in the nav bar, your handle in the comment
threads, and your email in the account menu. `redact(text)` walks each text node
and each attribute value, and replaces those strings with `READER`. That
function is the `TODO(human)` in Task 2, Step 2.

The snippet ends with a write to `navigator.clipboard`. A console script cannot
select a save location. The clipboard lets you paste the HTML into
`spike/fixtures/article-free.html` with a name that you choose.

### So what does this have to do with my project?

`implementation-plan.md` lists Substack UI drift as the first risk. It names
four controls: the spike, the isolated parser module, the fixtures, and the
visible failure states. The capture snippet builds the third control.

The extension has no API. Substack gives no contract. Milestone 2, step 1 is a
content script that reads the article metadata. Milestone 3, step 1 is a
saved-list parser. Both read HTML that Substack can restructure at any time. The
card metadata, the reading-time filter, and the Sync Saved import all sit on
selectors that you do not control.

Fixtures make that code testable. A test against a live page needs the network,
your login session, and a paid subscription for the paywall cases. A red result
has two possible causes: Substack changed, or your code changed. A saved
fixture removes each variable except your own code.

The snippet is also a rehearsal for the content script. It runs in the page
context and reads the DOM after JavaScript runs. This is the same environment
that the Milestone 2 content script gets. A selector that works in the console
works in the extension.

The fixtures outlive the spike. You paste `capture-fixture.js` a few times in
Task 3 and Task 5, then never again. The four HTML files stay as the test corpus
for the Milestone 3 parser.

Task 3 asks for three article fixtures. One is not enough. The `Card` model
must know whether an article is readable. Free, paid-subscribed, and
paid-preview are three different DOM shapes. You cannot make the third shape
later without a publication that you do not pay for.

The redaction step follows from the local-first design. A cloud tool keeps its
test pages on a server. This project puts them in a git history, which is
permanent, so your name comes out before the first commit.

### So basically, because there is no Substack API to pull articles from, this is experimenting whether or not I can do that by scraping the web page itself?

The first half is correct. Substack gives no API, so the extension reads the
rendered page. Three points need more precision.

**Scraping is the wrong shape.** A scraper fetches pages from outside. It
carries cookies, it handles CORS, it meets rate limits, and it meets bot
detection. This extension does none of that. `implementation-plan.md` describes
the capture path as a content script that "reads metadata and selections from
the live DOM, no CORS". The code runs inside the tab that you already opened, in
your signed-in session, after Substack renders the page. There is no fetch to
block, no auth to replay, and no request that looks like a robot. This is also
why the fixture comes from the DevTools console and not from `curl`. The console
is the only place that sees the same DOM that the content script sees.

**The extension does not copy article bodies.** The `Card` interface holds
`title`, `author`, `publication`, `url`, `estimatedReadingMinutes`, your
`notes`, and your `quotes`. It has no `body` field. The extension reads the
article text one time to count the words for the reading estimate, then discards
it. The article stays on Substack. You keep a pointer and your own writing.

**The spike asks a narrower question than "can I".** The data is in the DOM. You
can see it in the Elements panel now. Two things are unknown: which selectors
are stable, and how many page shapes exist. `h1.post-title` can hold for years,
or it can be a build-hash class that changes next month. A paid preview can use
a different container than a free post. The spike answers both questions and
freezes the evidence, so a future change shows as a named test failure.

The in-page design has a licensing effect. A scraper that pulls paywalled
articles from outside is a different act from an extension that reads a page
which a paying subscriber already loaded. The missing `body` field keeps this
project in the second category.

`estimatedReadingMinutes?` is optional. Its comment reads "blank when the body
is unreadable". That `?` is the reason Task 3 needs the paid-preview fixture. It
is the only page shape that exercises the blank branch.

### I still kind of don't get why `capture-fixture.js` exists and its purpose. What problem are we trying to solve right now? And why this method instead of other methods?

The spike has two halves. `capture-fixture.js` is a camera. `extract.js` is a
reader. Task 2 builds the camera, because Task 4 cannot test the reader without
a photograph.

**The problem.** You want code that looks at a Substack page and reports the
title and the author. To know that the code works, you must show it a page and
check the answer. There are two sources for that page.

| Source | Result |
|---|---|
| The live substack.com | The test goes red one morning. The author fixed a typo, or the network dropped, or the session expired, or Substack shipped a redesign, or your code broke. The signal names no cause. |
| A page saved to disk | The file changes only when you replace it. A red test has one cause: your code broke. |

The saved page is a **fixture**. Task 2 makes the tool that captures it. Task 3
runs that tool four times. Task 4 writes the reader and tests it against the
four files. The fixtures then stay as the test corpus for the Milestone 2 and
Milestone 3 parsers.

**Why the DevTools console.** Four ways exist to get HTML off a page. Three fail
here.

| Method | What you get | Why it fails |
|---|---|---|
| `Ctrl+U`, `curl`, `fetch` | The file the server sent | Substack sends a near-empty shell and builds the article with JavaScript. The shell holds no title. `curl` also carries no login, so paid pages come back locked. |
| `Ctrl+S`, Save Page As | The article, the images, the stylesheets, the tracking scripts, and your name | Megabytes per file in git, and live scripts inside a test fixture. |
| DevTools console | The finished DOM, after JavaScript ran, in your signed-in session | Nothing. The plan uses this method. |

The console wins for a second reason. Milestone 2 runs a content script inside
the page. A content script sees the finished DOM in your signed-in session. The
console gives that same view. A selector that works in the console also works in
the extension, so the capture doubles as a rehearsal for the content script.

**Why the snippet strips the page.** It clones the document first, then removes
things for three separate reasons.

| Step | Reason |
|---|---|
| Remove `script`, `iframe`, `svg`, `noscript` | Safety. The fixture must stay inert when a tool opens it. |
| Remove `img`, `picture`, `source` | Size. Git keeps every version of every file. |
| Remove `on*` and `data-track*` attributes | Safety. `onclick` holds code inside an attribute. |
| `redact(text)` | Privacy. A signed-in page shows your display name in the nav, your handle in the comment threads, and your email in the account menu. |

`script:not([type="application/ld+json"])` is the exception in that list. JSON-LD
is a `<script>` tag that holds metadata, and the browser never executes it. It is
a possible source for the title and the publish date, so Task 4 can read it.

Line 11 reads `document.documentElement.cloneNode(true)`. The snippet strips a
copy. You are signed in and you read that tab, and an edit to the real DOM
breaks the page under you.

See also "What is a Fixture Capture Snippet?" above for the three words in the
task name.

### What does `redact()` do in `spike/capture-fixture.js` and why is it needed?

`redact(text)` takes a string, finds every private string inside it, and swaps
each one for the word `READER`.

```js
function redact(text) {
  if (!text || PRIVATE_STRINGS.length === 0) return text;
  const escaped = PRIVATE_STRINGS.map((s) => s.replace(/[.*+?^${}()|[\]\]/g, '\$&'));
  const pattern = new RegExp(escaped.join('|'), 'gi');
  return text.replace(pattern, 'READER');
}
```

| Line | What it does |
|---|---|
| The guard | Hands back empty string, `null`, and `undefined` untouched. The plan asked for no throw on empty input. |
| `escaped` | Turns each private string into a literal. An email holds `.` and `@`. In a regex `.` means "any character", so an unescaped `you@gmail.com` also matches `you@gmailXcom`. `$&` means "the character you just matched", so `.` becomes `\.`. |
| `pattern` | Joins the escaped strings with `\|` into one pattern: name OR handle OR email. `g` replaces every occurrence instead of the first. `i` catches `PHILLIP LAGOC` in a heading. |
| `text.replace` | Returns a new string. `String.replace` never edits in place. |

Three reasons the snippet needs it.

| Reason | Detail |
|---|---|
| Privacy | You capture the fixture while signed in. The nav bar holds your display name, comment threads hold your `@handle`, and the account menu and the embedded JSON blobs hold your email. |
| Permanence | You commit the fixtures. Git keeps every version of every file, so deleting an email later leaves it in the history. The snippet has to redact before the HTML reaches the clipboard. |
| A stable corpus | Every fixture says `READER`. Tasks 3 and 4 assert against those files, and the fixed token keeps the assertions independent of who captured the page. |

The snippet runs `redact()` over text nodes and over attribute values. That
second loop catches what the tree walker cannot reach. Your name also sits in
`alt="Phillip Lagoc"`, `title=`, `href="/@philliplagoc"`, and `data-*` payloads,
and a text-node walker visits none of those.

Building a regex out of data is the classic injection shape. The data here is
yours, so a bad escape costs you a wrong match rather than an attack, but the
escaping habit is the one that also stops SQL injection.

The regex engine matches alternatives leftmost-first. Three separate `replace()`
calls scan the string three times, and each pass can match text the previous
pass wrote. One `a|b|c` pattern makes a single sweep, so it never re-matches
`READER`. If you add both `Phillip` and `Phillip Lagoc` later, put the longer
one first, or `Phillip` wins and ` Lagoc` survives into the fixture.

### Do you mean paste the whole script into the Console tab of Substack? And then this would "take a picture" of the article so I can process later?

Yes to both. Three corrections.

**Paste the whole file.** `F12`, then the **Console** tab, then paste every line
of `spike/capture-fixture.js`, then Enter. The wrapper defines the function and
calls it in one expression:

```js
(async function captureFixture() {
  // ...
})();   // <- these parens run it
```

The file ended `})` at first. That defines an anonymous function and calls
nothing, so the console prints the function back at you and the clipboard stays
empty. The `();` at the end is the call.

**Not Substack yet.** Step 3 is a rehearsal on any article page, with
`PRIVATE_STRINGS` set to `['the']`. You prove the plumbing works: the clipboard
write succeeds, `the` is gone from the output, `READER` is everywhere. Substack
comes in Task 3, after you swap in your real name, handle, and email.

**The output is HTML text.**

| Approach | What you get | Can a test parse it? |
|---|---|---|
| Screenshot | Pixels | No |
| `Ctrl+S` save page | Files, images, scripts, megabytes | Awkwardly |
| `Ctrl+U` view source | Substack's empty shell | Nothing to parse |
| This snippet | The rendered DOM as HTML, stripped and redacted | Yes |

Substack ships an empty HTML shell and builds the article with JavaScript, so
view-source shows you almost nothing. The console sees the finished DOM. So does
a content script, which is what Milestone 2 writes, so the fixture matches what
the real extension will read.

The HTML lands on your clipboard, not on disk. You paste it into
`spike/fixtures/article-free.html` yourself in Task 3, Step 5. Task 4 parses that
frozen file with `linkedom`. The article stops changing, so the tests stop
depending on Substack's servers or on your login.

One more guarantee. The snippet copies the page before it touches anything:

```js
const clone = document.documentElement.cloneNode(true);
```

Every `remove()` and `setAttribute()` after that line runs on the copy. The live
page never changes, so you can run the snippet twice without reloading.

### Why did the snippet fail with `Document is not focused`?

Picture the clipboard as one notepad on a shared desk. Chrome enforces a rule
about it: you may write on the notepad only while you sit at that desk.

Click **Run** on a DevTools snippet and you sit in DevTools. The article page
waits next door. So the last line of the snippet failed:

```js
await navigator.clipboard.writeText(html);
```

`Document is not focused` means the page is not the window you are looking at.
The rule exists to stop a background tab from overwriting the password you
copied a second ago. Chrome breaks your snippet rather than allow that.

Every line above it worked. The clone, the stripped scripts, the deleted images,
the redaction. One step failed, and because it failed inside an `async` function
with no `.catch()` around it, Chrome printed:

```
Uncaught (in promise) NotAllowedError
```

That prefix always means the same thing: a promise rejected and nobody was
listening.

Three ways out:

| Fix | How it works | Cost |
|---|---|---|
| Click the page, then re-run | Focus returns to the article | Fails again the moment you touch DevTools |
| `copy(html)` | A DevTools helper that skips the focus rule | Lives only in DevTools, chokes on large strings |
| Blob download | Build a file in memory, click a hidden link | None worth mentioning |

The snippet takes the third route:

```js
const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
const link = document.createElement('a');
link.href = blobUrl;
link.download = slug + '.html';
link.click();
```

A `Blob` is a pile of bytes plus a label saying "this is HTML".
`URL.createObjectURL()` hands that pile a temporary address, `blob:https://...`,
which points at memory inside this tab. The `download` attribute tells Chrome to
save the address instead of opening it. No focus check, no size limit.

```js
setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
```

Revoking the address frees the memory. Skip that call and the tab holds a second
copy of the page until you close it.

The file lands in Downloads named after the article slug. Move it into
`spike/fixtures/` and Task 4 parses it.

| | Before | After |
|---|---|---|
| Where the HTML goes | Clipboard | Downloads folder |
| Needs the page focused | Yes | No |
| Size limit | Clipboard struggles past a few hundred KB | None |
| Your next step | Paste into a new file | Drag the file into `spike/fixtures/` |

You meet `blob:` again in Milestone 5. Exporting notes as Markdown uses this
same shape: build a string, wrap it in a `Blob`, click a link you made in code.

### I do not pay for any Substack publications. Can paid subscriptions be a future feature?

Yes. I dropped the fixture you cannot make, kept the one you can, and wrote the
subscription work into the plan for later.

The plan named three article page kinds. You can open two of them.

| Fixture | What it is | Can you capture it? |
|---|---|---|
| `article-free.html` | A free article | Yes |
| `article-paid-subscribed.html` | A paid article you paid to read | No |
| `article-paywalled.html` | A paid article you did not pay for | Yes. Opening the page costs nothing. |

Keep the paywalled page, because reading time is `words / 250` and a paywalled
page shows a teaser of about 90 words. Skip the paywall check and the card reads
"1 min read" for an article you cannot open. `isPreview` in `extract.js` catches
that case.

Drop the subscribed page. Milestone 0 ends when every fixture exists and every
table cell holds a value. You cannot check off a step that needs money you do
not want to spend, so the milestone would sit open.

Read "Deferred to a later version" in the plan. If you subscribe one day,
capture the page, add a manifest entry, and run `npm test`. If the read paths
match the free article, you write no new code.

## 2026-08-21 - Milestone 0, Task 3

### I only care about reading free articles. Would I only need `article-free`?

No. Keep `article-paywalled.html`. The plan cut one job: reading the body of a
paid article you subscribe to. It kept a second job: spotting a paywall when you
land on one.

Think of a bouncer at a door. You never enter the paid club. The bouncer must
know what the closed door looks like, so they can tell you "this one is closed
to you" before you walk into a hallway with one poster in it.

| Job | In v1? | Fixture |
|---|---|---|
| Read a free article body | Yes | `article-free.html` |
| Spot a paywall and mark the card | Yes | `article-paywalled.html` |
| Read a paid article body as a subscriber | No | None. Deferred. |

One day you save a link from Notes and the article turns out to be paywalled.
Without the paywall check, `extract.js` counts the ~90-word teaser and the board
shows a "1 min read" card for an article you cannot open. The `isPreview: true`
test in Task 4 runs against `article-paywalled.html`. Drop the fixture and that
test has nothing to parse.

The capture costs a few minutes and no money. Open a paid article you did not
buy and run the snippet.

## 2026-08-24 - Milestone 0, Task 3

### How can I get the State attribute of the Unsave/Save button?

A state attribute is any attribute whose **value flips** when the button
toggles. Watch the button while you click it. Reading the Elements tab alone
will not show you which attribute moved.

Picture a room of light switches behind a curtain. Someone flips one. You learn
which switch moved by watching the room go dark.

A `MutationObserver` watches the room for you. It reports every attribute that
changed, with the old value beside the new one.

```js
const btn = document.querySelector('YOUR SAVE SELECTOR');

// Print every attribute it has right now.
const dump = (el) => Object.fromEntries([...el.attributes].map(a => [a.name, a.value]));
console.log('BEFORE', dump(btn), '| text:', btn.innerText.trim());

// Watch the parent, not the button. React may replace the button itself.
const obs = new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'attributes') {
      console.log('ATTR', r.attributeName,
        ':', JSON.stringify(r.oldValue),
        '->', JSON.stringify(r.target.getAttribute(r.attributeName)));
    } else if (r.type === 'characterData') {
      console.log('TEXT', JSON.stringify(r.oldValue), '->', JSON.stringify(r.target.data));
    } else {
      console.log('NODES replaced under', r.target);
    }
  }
});
obs.observe(btn.parentElement, {
  attributes: true, attributeOldValue: true,
  characterData: true, characterDataOldValue: true,
  childList: true, subtree: true,
});

// Click Save with the mouse. Then click again to undo.
// When you finish: obs.disconnect();
```

Click with the mouse. `btn.click()` fires a synthetic click and Substack may
ignore it.

Read the log, then fill the table cell:

| What the log showed | State attribute |
|---|---|
| `ATTR aria-pressed : "false" -> "true"` | `aria-pressed` |
| `ATTR aria-label : "Save" -> "Unsave"` | `aria-label`, value flips |
| `TEXT "Save" -> "Saved"` | none, read `innerText` |
| Only `class` changed, to a hashed name | none, record it as a risk |
| Nothing logged | The button was replaced. Watch `document.body` instead. |

Two catches worth knowing.

React swaps nodes instead of editing them. An observer attached to the button
goes deaf the moment React replaces that button. Attach it to the parent with
`subtree: true` and it survives the swap.

If the state lives in a hashed class such as `pencraft_x3f9k`, the extension
cannot read it. Substack regenerates that name on the next deploy. Write that
in "Risks found" and the finding is worth more than a filled cell.

### Why will the selector DevTools gave me break?

DevTools **Copy → Copy selector** answers one question: what path finds this
element on this page, right now. You need a different answer: what path finds
this element on every article, next month.

Every part of a selector sits in one of three tiers.

| Tier | Example | What happens to it |
|---|---|---|
| Semantic | `post-ufi`, `data-testid`, `aria-label` | Survives a redesign. A human named it, and the name describes the thing. |
| Stylistic | `pc-gap-16`, `flex-grow-rzmknG` | Dies. `rzmknG` is a build hash. `pc-gap-16` dies when a designer changes the gap to 12px. |
| Positional | `nth-child(1)`, `div > div` | The worst kind. |

Positional parts earn last place because of how they fail. A broken semantic
selector returns `null`, and your code sees the miss. A broken positional
selector returns **the wrong button**, and your code reports it as the right
one. The plan bans silent failure, and `nth-child` is the purest form of it.

Two live examples from the free article:

```
#radix-P0-46 > div > div > button:nth-child(1)
```

Radix UI builds `radix-P0-46` at runtime from a counter. Reload the page and
the number changes. Radix IDs also belong to popovers, so a Save button behind
one does not exist in the DOM until the reader opens the menu.

```
... div.pencraft.pc-gap-16.flex-grow-rzmknG.post-ufi > div:nth-child(1) > div > button
```

One part of that chain is worth keeping. `post-ufi` is Substack's own name for
the like, comment, and share bar. UFI stands for user-facing interactions.
Throw away the rest and test `.post-ufi button[aria-pressed]`.

Shrink a selector by testing candidates against the element you already have:

```js
const el = document.querySelector('THE LONG SELECTOR');
const tryIt = (sel) => {
  const found = document.querySelectorAll(sel);
  console.log(sel, '| count:', found.length, '| same:', found[0] === el);
};
tryIt('.post-ufi button[aria-pressed]');
```

Keep the shortest candidate that reports **count 1** and **same true**.

### Why are we doing Step 4 at all? Why do the Save and Like buttons matter?

Because the extension does not only read those buttons. It clicks them.

Three lines of `implementation-plan.md` put the buttons on the critical path:

| Line | What it says | What it needs from Step 4 |
|---|---|---|
| 88 | Desktop capture "invokes Substack's native Save" | A selector that finds the button so the code can click it |
| 166 | "Native Save/Unsave fails: leave the card unchanged and show the actual completion state" | A way to ask the page whether the click worked |
| 68-70 | `liked`, `commented`, `unsavedFromSubstack` are fields on every card | A way to read each button's current state |

The middle row is the hard one. Your extension clicks Save. Then what? The
network call may have failed. The reader may have signed out. Substack may have
changed the button. The code needs one question it can ask the page: **did the
state flip?**

The state attribute is that question. `aria-pressed` reads `"false"` before the
click and `"true"` after. No flip means no save, and the card stays unchanged
with an honest message.

Take the state attribute away and the code has two bad options. It can claim
success and lie to you. It can refuse to say anything and leave you guessing.
The spec bans both under "silent failure is banned throughout."

So Step 4 is not paperwork. It answers whether one of the spec's rules can be
built at all. A "none, the state lives in a hashed class" answer in the Risks
section is a real result, and Milestone 4 would have to change to match it.

### Why does the Like button sit next to Save in the same table?

Like is the control sample.

You already found `aria-pressed` on Like. Now Save gets the same test, and the
comparison tells you something neither button tells you alone.

| Result | What it means for Milestone 2 |
|---|---|
| Save also uses `aria-pressed` | Substack builds its toggles one way. Write one helper, `readToggleState(el)`, and point it at both buttons. |
| Save uses something else | Substack's buttons are not uniform. Each button needs its own read strategy, and the next button you meet needs its own survey. |

One sample tells you what a button does. Two samples start telling you what
Substack does.

### Why was finding the Save and Like buttons so hard? Was it how Substack labels them?

Labelling caused one of the four problems. Here they are in the order we hit
them.

| # | What we saw | Cause |
|---|---|---|
| 1 | `#radix-P0-46 > div > div > button:nth-child(1)` returned `null` on the next load | Radix UI numbers popovers from a counter that restarts every page load |
| 2 | `button[aria-label^="Like"]` matched 5 buttons | Two belong to this post. Three belong to recommended articles at the page foot |
| 3 | The Save button was absent from a fresh page | It lives inside a menu that mounts when you open it |
| 4 | The Save label reads `Save` on an unsaved article | The label names the action you can take, not the state you are in |

Only #4 comes from a label. Problems 1 to 3 come from where Substack puts the
buttons and what it names their classes, which is why a copied selector read
fine and worked exactly once.

#### The one technique that solved three of them

Take a census of every button, then take it again after something changes, and
compare.

```js
console.table([...document.querySelectorAll('button, [role="button"]')].map((el, i) => ({
  i,
  label: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 40),
  pressed: el.getAttribute('aria-pressed'),
  cls: el.className.split(' ').filter(c => !c.startsWith('pc-')).join(' ').slice(0, 50),
  visible: el.offsetParent !== null,
})));
```

We ran it twice on the article page. Closed menu: 55 rows. Open menu: 58 rows.
The three new rows were `Save`, `Cross post`, and `Open as PDF`.

We found the Save button in that difference, without reading Substack's source
or guessing at a class name. The census works on a page you have never seen,
because it compares the page against itself.

#### Reading the census told us which Like button was ours

| i | label | pressed | class variant | Whose |
|---|---|---|---|---|
| 0 | Like (4,160) | true | `style-button` | This post, top bar |
| 1 | Like (4,160) | true | `style-button` | This post, bottom bar |
| 2 | Like (5,171) | false | `style-compressed` | A recommendation |
| 3 | Like (4,462) | false | `style-compressed` | A recommendation |
| 4 | Like (1,407) | false | `style-compressed` | A recommendation |

Two clues separated them. Rows 0 and 1 share the count 4,160, so they are one
article drawn twice. Rows 2 to 4 carry `style-compressed`, the variant Substack
uses for a post it is advertising.

Scoping to `article` cut the 5 down to 2, and both of those carry the same
state, so either one answers the question.

#### The inverted label

The Like button announces itself with `aria-pressed="true"`. The Save menu item
has no such attribute. Its state is its text.

| Text on the item | The article is |
|---|---|
| `Save` | not saved |
| `Unsave` | saved |

A door sign reading PUSH tells you what to do. It does not tell you whether the
door is open. Substack's menu item works the same way, and the trap is that
reading it backwards produces no error.

```js
// Wrong. Reads "the label says Save, so it is saved."
card.savedOnSubstack = item.innerText.trim() === 'Save';
```

That line runs, returns `true` on an unsaved article, and the board shows a
confident lie. Name the inversion so the next reader sees it:

```js
// The menu offers the action available next, so the saved state is the opposite.
const LABEL_WHEN_SAVED = 'Unsave';
card.savedOnSubstack = item.innerText.trim() === LABEL_WHEN_SAVED;
```

#### What survived

Everything durable turned out to be a role, an ARIA attribute, a framework data
attribute, or an HTML5 element. Every class we started with died.

| Control | Final handle | State |
|---|---|---|
| Like | `article .post-ufi-button[aria-label^="Like"]` | `aria-pressed` |
| Save trigger | `article .post-ufi-button.style-button:not([aria-label])` | n/a |
| Save item | `[data-radix-menu-content] button[role="menuitem"]`, matched on `innerText` | `innerText`, inverted |

Nothing in that table depends on position, on an `id`, or on a hashed class
such as `flex-grow-rzmknG` or `item-Npdq6R`. Those all appeared in the selectors
we started with.

#### The method, for the next button

1. Use **Copy selector** to get any handle on the element. It proves you found the right thing today.
2. Print that element's own markup. Read its `role`, its `aria-*`, its `data-*`, and its unhashed classes.
3. Census every candidate on a freshly loaded page.
4. Census again after the state changes, then diff the two.
5. Shrink the selector until the count is the smallest set that all belongs to you, and confirm with `found[0] === el`.

Step 4 of the plan asked three questions. The answers: Like sits at the top and
the bottom of the post. Save sits in a menu behind an unlabelled `...` in both
of those bars. Like reports state through `aria-pressed`, and Save reports it
through a word.

### If we drop it, what happens?

Two of the four `data-attrs` attributes in the fixture held a signed token
carrying your Substack user id. The choice: delete the attributes, or parse the
JSON inside them and clean the URL.

Simulate the delete first. Compare the numbers:

```
with attrs     words=1599  bodyFound=true  links=13  buttonWrappers=4
dropped        words=1599  bodyFound=true  links=13  buttonWrappers=4

word count delta : 0
bytes saved      : 1862
```

Nothing moved.

| Worry | Why it does not happen |
|---|---|
| The word count changes | `textContent` reads text nodes. An attribute is not a text node. |
| The button labels vanish | "Share" and "Leave a comment" are real text in the DOM. |
| The button targets are lost | Both URLs also sit in a real `href`. The attribute held a second copy. |

Check that last row instead of assuming it:

```bash
grep -o 'href="[^"]*stan\.store[^"]*"' fixture.html | wc -l   # 1, a real link
grep -o 'stan\.store' fixture.html | wc -l                    # 2, link plus attribute
```

You give up page fidelity. The fixture stops being a byte-faithful copy of what
Substack served, which matters when a later task asks how Substack marks up an
in-body button.

#### The rule

Delete beats scrub when nothing downstream reads the thing. A scrub must handle
every value the site puts there next month. A delete handles the attribute once
and stays correct.

Simplicity picked before measuring is a guess. Measure, then pick it.

### What is the `+` coercion?

`+` in JavaScript does two different jobs. It picks one by looking at what sits
on each side.

| Both sides are | `+` does | Example |
| --- | --- | --- |
| numbers | addition | `2 + 3` gives `5` |
| anything else | glues text together | `'a' + 1` gives `'a1'` |

An array counts as "anything else". So `+` turns each array into text first. An
array turns into text by joining its items with commas and dropping the
brackets.

```js
['Phillip Lagoc', '@philliplagoc'] + ['Phillip']
// left side becomes  'Phillip Lagoc,@philliplagoc'
// right side becomes 'Phillip'
// glued:             'Phillip Lagoc,@philliplagocPhillip'
```

The result is one string, with no comma at the seam. JavaScript raises no error,
because a string is a fine thing to have.

#### What that did to the anonymizer

`expandPrivateStrings()` returns the list `redact()` searches for. `redact()`
starts by spreading it:

```js
const ordered = [...REDACT_TERMS].sort((a, b) => b.length - a.length);
```

Spread on an array hands you its items. Spread on a string hands you its
letters.

```js
[...['ab', 'cd']]   // ['ab', 'cd']            2 items
[...'abcd']         // ['a', 'b', 'c', 'd']    4 items
```

The 81-character string became 81 single letters, and the search pattern became
`P|h|i|l|...`. That matches most of the page:

```
'The Writing Chronicles by Kevin Szabo'  ->  'READERREADERREADER...'
```

#### How to join two arrays

| You want | Write |
| --- | --- |
| a new array from two | `[...a, ...b]` |
| the same, older style | `a.concat(b)` |
| one more item on the end | `[...a, 'Phillip']` |
| an item added in place | `a.push('Phillip')` |

JavaScript has no `+` for arrays, so reach for the spread.

#### The shape of this bug

Four bugs in this spike so far, and none of them threw:

| Written | Expected | Got |
| --- | --- | --- |
| `arr1 + arr2` | an array of terms | one string |
| `new URL('some title')` | an error | a valid relative URL |
| `ld.author.name` | the author name | `undefined` |
| `grep -c` on the fixture | element count | line count |

A crash stops you before you commit. A silent wrong answer ships a real name into
git history, which is why the check runs against the output of the anonymizer and
not against its code:

```bash
grep -Eic "phillip|lagoc" spike/fixtures/article-paywalled.html   # want 0
```

## 2026-08-26 - Milestone 0, Task 8

### Can you describe what prototype/app.js does? Like what does each function do?

| Piece | What it does |
|---|---|
| `STORAGE_KEY` | A label for the drawer in `localStorage` where the board's cards live. |
| `state = load()` | Loads the cards when the page starts. |
| `selectedId` | Remembers which card was last clicked, so it can stay highlighted. |
| `load()` | Reads the saved cards from `localStorage`. Empty drawer, falls back to `structuredClone(window.PROTO_CARDS)`, the built-in sample set. |
| `save()` | Writes `state` back into `localStorage`. |
| `statusLabel(card)` | Builds a short summary string for a card, `"notes . 3 quotes . exported v1"`, from whichever parts are true. |
| `visibleCards()` | Filters `state` by the search box text and the max-minutes box, returns only matching cards. |
| `render()` | Redraws the board. For each `.column`, filters cards into that column, clones the `<template id="card-template">` per card, fills in title, publication, minutes, saved date, and status, appends to the list. |
| event listeners (bottom) | Search and max-minutes inputs re-run `render()` on every keystroke. The reset button clears `localStorage`, restores the sample cards, and re-renders. |

`load()` copies the sample data with `structuredClone()` instead of assigning it.
JS objects pass by reference. Skip the clone and editing `state` also edits
`window.PROTO_CARDS`, with no error to catch it. "Reset data" would then reset
to already-mutated data, not the real starting point.

### Why did prototype/app.js have three bugs that would crash it?

The file's own first line reads "Prototype only. Throwaway." A throwaway file
gets wired up and eyeballed, not click-tested end to end, so a typo can sit in
dead code and never run.

Three lines threw before the fix:

| Line | Written | Should be | Why it broke |
|---|---|---|---|
| `save()` | `localStoratge.setItem(...)` | `localStorage.setItem(...)` | Two letters swapped. `localStoratge` is not a global, so calling `save()` throws `ReferenceError`. |
| `render()` | `column.CDATA_SECTION_NODE.status` | `column.dataset.status` | `CDATA_SECTION_NODE` is a numeric constant on every DOM node (used for a different, unrelated DOM feature), not a way to read a custom `data-status` attribute. |
| `render()` | `template.contentEditable.firstElementChild.cloneNote(true)` | `template.content.firstElementChild.cloneNode(true)` | `contentEditable` is a boolean flag for editable text, not the special `.content` property that holds a `<template>`'s inert markup. `cloneNote` does not exist on any DOM object; the real method is `cloneNode`. |

`render()` runs once at the bottom of the file, so the second and third bugs
would throw the moment the page loaded. The first bug only shows up once
something calls `save()`. Nothing in this file does that yet; Task 9 wires up
the notes panel that calls it.

Verified the fix against `prototype/index.html`: each `.column` carries a real
`data-status="to_read"` attribute, and `#card-template`'s first child is a real
`<article class="card">`, so `column.dataset.status` and
`template.content.firstElementChild.cloneNode(true)` are the correct calls, not
guesses.

## 2026-08-26 - Milestone 1, planning

### What does the extension directory have? Is it normal to create Google Chrome Extensions using that kind of directory?

`extension/` is its own npm project, a sibling of `spike/` and `prototype/`.
Four config files sit at its root. Everything else lives under `src/`.

```
extension/
  package.json      # deps and scripts
  tsconfig.json     # one line: extends ./.wxt/tsconfig.json
  wxt.config.ts     # srcDir, React module, manifest keys
  vitest.config.ts  # test runner
  src/
    entrypoints/    # the only folder Chrome knows about
      background.ts       -> service worker
      board/index.html    -> /board.html
      board/main.tsx      -> React root
    domain/         # pure functions. No Dexie, no React, no browser APIs.
    db/             # Dexie schema, and the one module that touches the table
    ui/             # React components
    test-support/   # fake-indexeddb setup, test factories
```

Chrome never loads `extension/`. It loads `extension/.output/chrome-mv3/`, a
folder the build writes. `extension/` is the source. `.output/chrome-mv3/` is
the extension.

No `manifest.json` exists in `src/`. WXT writes one at build time. It reads the
file names under `src/entrypoints/` and merges the `manifest:` block from
`wxt.config.ts`.

The question splits in two.

**Is a build-tool project normal for a Chrome extension?** Yes, for anything
past a toy. The bare way is a folder holding a hand-written `manifest.json` and
loose `.js` and `.html` files, loaded straight into `chrome://extensions`. That
works. It stops working the moment you want TypeScript, JSX, or an npm package,
because the browser runs none of those. Something has to compile them first.
A compile step needs an output folder, and the source/output split follows from
that.

| Approach | Manifest | Source loaded by Chrome? |
|---|---|---|
| Vanilla | Hand-written | Yes, directly |
| WXT / Plasmo / CRXJS | Generated at build | No, the build output is |

`src/entrypoints/` with file-based routing is a WXT convention. Plasmo puts
`background.ts` and `contents/` at the root instead.

**Is `domain/ db/ ui/` normal?** That part is not a Chrome-extension convention.
It is plain application layering, the same split a backend service uses. The
plan states the rule: `domain/` imports nothing, `db/cards.ts` imports
`domain/`, `ui/` imports `db/cards.ts`, `entrypoints/` import `ui/`. The arrows
point one way. This project chose it. WXT does not ask for it.

Layout note: `extension/` sits inside the repo rather than at the root because
the repo holds three things, each with its own `package.json`. A repo holding
the extension alone would put these files at the root.

### Why do we need TypeScript 7 and Vite 8? What are they?

You do not need them. The plan pins one major version below each, on purpose.

```json
"typescript": "~5.9.3",
"vite": "^7.3.6",
```

Plan line 176 explains the refusal: TypeScript 7 and Vite 8 are both published,
and WXT's peer ranges allow both. A range that allows a version says nothing
about whether anyone has run that combination.

#### What TypeScript is

JavaScript plus labels on your data.

```ts
const card: Card = { id: 'a1', title: 'Hello', status: 'to_read' };
card.titel;   // tsc: Property 'titel' does not exist on type 'Card'
```

The compiler catches that typo before Chrome loads the file. Compare the three
bugs in `prototype/app.js`. `localStoratge` and `cloneNote` are the same mistake,
and plain JavaScript let both sit in the file until the line ran.

Chrome cannot run a `.ts` file. The labels come out, plain JavaScript goes in.
`npm run compile` runs `tsc --noEmit`, which checks the labels and writes
nothing.

#### What Vite is

The machine that strips the labels, and four other jobs beside.

| Job | Without it |
|---|---|
| Turn `.ts` and `.tsx` into `.js` | Chrome throws on the first type annotation |
| Turn JSX into function calls | Chrome throws on `<Board />` |
| Resolve `import { nanoid } from 'nanoid'` | Chrome looks for a file named `nanoid` and gets a 404 |
| Bundle many files into few | Every `import` becomes a network round trip |
| Reload the page when you save | You click Reload in `chrome://extensions` all day |

Nothing in `extension/` imports Vite. WXT runs on it. `npm run dev` calls `wxt`,
`wxt` calls Vite, Vite writes `.output/chrome-mv3/`, and Chrome loads that
folder.

#### What the two range operators do

| Written | Accepts | Refuses |
|---|---|---|
| `~5.9.3` | `5.9.4`, `5.9.7` | `5.10.0`, `7.0.0` |
| `^7.3.6` | `7.4.0`, `7.9.2` | `8.0.0` |

`~` takes patches. `^` takes minors too. Both stop at the next major.
TypeScript gets the tighter one because its minor releases carry breaking
changes, so `5.10` behaves like a major for the code that has to compile.

#### Why the old majors

TypeScript 7 is the compiler rewritten in Go. Every file in `src/` passes
through it, and it is a from-scratch reimplementation of the thing that has been
checking your types.

Milestone 1 has to answer one question: does the board store a card, move it
between columns, and show it again after a reload? A red build should mean your
code broke. On an untested toolchain, a red build has a second suspect, and you
have to rule it out before you can read the first one.

Schedule the upgrade as its own task. Take it once the Vitest suite exists,
one dependency at a time, and let the tests say whether it held.

### What are alternatives to these? Just so I know different routes I can potentially take

The stack has three slots. Each slot has real alternatives, and swapping one
does not force a swap of the others.

```
slot 3   WXT            picks your framework conventions and entrypoint model
slot 2   Vite           turns source files into files Chrome can load
slot 1   TypeScript     checks your types before Chrome sees anything
```

#### Slot 1: the type checker

| Route | What you write | Cost |
|---|---|---|
| TypeScript (current) | `const c: Card = ...` in a `.ts` file | A compile step, and `tsc` in the loop |
| Plain JavaScript | What `prototype/app.js` is | `card.titel` fails at runtime with no warning |
| JSDoc plus `checkJs` | `/** @type {Card} */` above a plain `const` | The same errors, longer syntax |

The third route runs the same compiler over comments, so the file stays runnable
`.js` with no build step. Node core and Svelte both took it. It buys this
project nothing, because Vite already compiles `.tsx` for React.

#### Slot 2: the bundler

| Route | What it is | Fit here |
|---|---|---|
| Vite 7 (current) | Dev server, Rollup for builds, esbuild for deps | WXT's default |
| Vite 8 | The same API over Rolldown | Its bundler sits at `1.0.0-rc.11` |
| esbuild alone | One Go binary | No dev server, no reload, you wire it up |
| webpack | The previous standard | Config-heavy and slow. Many MV3 templates still ship it |
| Parcel | Zero config, has a web-extension mode | Smaller ecosystem |
| No bundler | Plain `.js` ES modules, load the folder | Drops React, JSX, and every npm import |

Check the dependency lists to see what changed between Vite 7 and Vite 8:

```
npm view vite@7.3.6 dependencies   # rollup ^4.43.0, esbuild ^0.27.0
npm view vite@8 dependencies       # rolldown 1.0.0-rc.11
```

Vite 8 dropped Rollup and esbuild for Rolldown, a Rust rewrite. Read the version
string. `rc` means release candidate, so Vite 8's bundler has not shipped a 1.0.
That single line carries more weight than any changelog summary.

#### Slot 3: the extension framework

This slot decides the other two for you.

| Route | Where the manifest comes from | Trade |
|---|---|---|
| WXT (current) | Generated from `src/entrypoints/` file names | Conventions and auto-imports to learn |
| Plasmo | Generated from `package.json` | Was the popular pick. Maintenance has slowed |
| CRXJS | You write it. A Vite plugin wires up reloading | The thinnest layer. You own more |
| Vanilla | You write it | No build, no React, no npm |

CRXJS is the honest fallback if WXT's conventions start to fight you. You keep
Vite, React, Dexie, and Vitest, and you take back `manifest.json` as a file you
can open.

Vanilla is a longer fall than it looks. The board would go back to
`document.createElement` calls, which is what `prototype/app.js` does and why it
carried three bugs that no tool caught.

#### Read the ranges yourself

```
npm view wxt@0.21.4 peerDependencies
```

```json
{ "vite": "^6.3.4 || ^7.0.0 || ^8.0.0-0", "typescript": ">=5.4" }
```

That range confirms the plan's claim: WXT accepts Vite 8. The `-0` suffix on
`^8.0.0-0` accepts Vite 8 **prereleases** as well. An author who writes that is
saying "this should work", which is a smaller claim than "we run this in CI".
Read a peer range as a forecast.

One more line in that output is worth a look. WXT depends on `linkedom`, the
package from the spike, for the same reason you installed it: parsing HTML where
no browser exists.

## 2026-08-27 - Milestone 1, Task 1

### Why did `npm install` fail with "No entrypoints found"?

The install worked. A separate command ran after it and failed.

`package.json` holds this line:

```json
"postinstall": "wxt prepare"
```

npm treats a few script names as **lifecycle hooks**. It runs them on its own,
with no one typing their name.

| Script name | npm runs it |
|---|---|
| `preinstall` | Before it downloads anything |
| `install`, `postinstall` | After the download finishes |
| `prepare` | After install, and before `npm publish` |
| `test`, `build`, `dev` | Only when you type `npm run <name>` |

So one `npm install` did two jobs. Job one downloaded 400-odd packages. Job two
ran `wxt prepare`, which reads your entrypoints and writes TypeScript types for
them. Job one passed. Job two had nothing to read, because Steps 4 through 8
create those files.

npm reports the exit code of the last thing it ran, so a green install plus a red
hook prints as one red command.

#### The clue hiding in the error path

```
ERROR  No entrypoints found in ...\extension\entrypoints
```

Read that path twice. The plan puts entrypoints in `extension\src\entrypoints`.
The error names `extension\entrypoints`, one folder shallower.

`srcDir: 'src'` lives in `wxt.config.ts`, which Step 4 creates. With no config
file on disk, `srcDir` holds its default of `.`, so WXT looked next to
`package.json`. The missing `src` in that path is the config file announcing its
own absence.

An error message that names a path you never chose points at a default, and a
default points at missing config.

#### How to tell a failed install from a failed hook

```powershell
npm ls vite typescript wxt --depth=0
```

```
+-- typescript@5.9.3
+-- vite@7.3.6
`-- wxt@0.21.4
```

Real versions mean the packages are on disk and the tree resolves. A broken
install prints `UNMET DEPENDENCY` or `empty` instead. Ask the tree, rather than
reading the exit code and guessing.

#### Why not `npm install --ignore-scripts`

That flag skips every lifecycle hook, and other packages need theirs:

```powershell
node -p "require('./node_modules/esbuild/package.json').scripts"
```

```
{ postinstall: 'node install.js' }
```

esbuild ships a per-platform binary and links it in that hook. Skip it and Vite
loses its compiler, which is a worse failure than the one you started with, and a
stranger one to read.

The fix is order. Let the hook fail at Step 3, create the entrypoints in Steps 4
through 8, then run `npx wxt prepare` yourself. The plan now says so at both
ends.

### What's the difference between TypeScript and JavaScript?

TypeScript is JavaScript plus a type checker. Every valid `.js` file is valid
TypeScript. TypeScript adds annotations the compiler reads and then deletes.

The browser cannot run `.ts`. Something strips the types first. Here that is
Vite, inside WXT.

```ts
// TypeScript
function pin(id: string, at: number): void { ... }

// what the browser gets
function pin(id, at) { ... }
```

| | JavaScript | TypeScript |
|---|---|---|
| Runs in a browser directly | Yes | No, compile first |
| When you hear about a bug | When that line runs | While you type |
| `user.nmae` typo | `undefined`, no warning | Red squiggle |
| Extension here | `.js` | `.ts` / `.tsx` |
| Runtime cost | none | none, types are erased |

`extension/src/entrypoints/background.ts` shows the payoff:

```ts
const { boardTabId } = await browser.storage.session.get('boardTabId');
if (typeof boardTabId === 'number') {
```

`browser.storage.session.get()` returns a bag of unknown values. TypeScript
refuses to pass that into `browser.tabs.update()`, which wants a number. Same
with `if (tab.id != null)`: Chrome's types say `tab.id` is `number | undefined`,
because a devtools window has no tab id. The checker named both ways the code
breaks and made you handle them.

Three things follow:

- `npm run compile` is a separate gate from `npm run build`. `tsc --noEmit`
  checks and emits nothing. Vite strips types without checking them, so a build
  can pass on code `compile` rejects. Run both.
- `@types/react` holds types and no code. React ships as JS; the `@types/*`
  packages describe shapes to the compiler and vanish from the bundle.
- `extension/tsconfig.json` extends `.wxt/tsconfig.json`, which `wxt prepare`
  generates. That is why `browser` and `defineBackground` are known globals with
  no import.

### What is a type checker? What is the benefit of TypeScript over JavaScript?

A spellchecker reads your essay without you reading it aloud and underlines
`recieve`. A type checker reads your code without running it and underlines
where the shapes do not fit.

You say what shape each thing is. The checker traces every path and asks one
question at each step: does the shape going in match the shape expected?

```ts
type Status = 'to_read' | 'reading' | 'processed';

card.status = 'in_progress';
//            ~~~~~~~~~~~~~ not one of the three allowed strings
```

Nothing ran. No board opened, no card moved. The checker read the code and saw
the wrong word.

`Status` is not a variable holding three strings. At runtime the line is gone,
and the browser sees `card.status = 'in_progress'`. The type lives during the
check, the way a red squiggle lives in the editor and not on the printed page.

#### What you get

The plan defines `Card` with 20 fields. That is the payoff surface.

1. **It remembers the shape.** Type `card.` and the editor lists all 20 fields
   with their types. You stop reopening `types.ts` to check whether the field is
   `savedAt` or `dateSaved`.

2. **It catches typos at the keystroke.** In JavaScript `card.tittle` is
   `undefined`, the card renders with a blank title, and you find it three days
   later. In TypeScript it is a squiggle before you save.

3. **It forces you to handle "might not be there."** The `?` marks say so:

```ts
estimatedReadingMinutes?: number;   // might be missing
status: Status;                     // always there
```

`?` means `number | undefined`, so this fails to compile:

```ts
if (card.estimatedReadingMinutes > maxMinutes) return null;
//       ~~~~~~~~~~~~~~~~~~~~~~ possibly 'undefined'
```

That is the checker pointing at a rule in the plan: a card with no reading-time
estimate hides when a max-minutes filter is set. In JavaScript
`undefined > 30` is `false`, so the card shows instead of hiding. The type
system refuses to let you write that bug.

4. **Refactoring stops being scary.** Rename `status` to `column` in
   `types.ts`, run `npm run compile`, and you get every file that needs
   updating. In JavaScript you grep for `"status"` and hope.

5. **Writing all 20 fields now costs nothing.** The plan says it: types cost
   nothing at runtime, and the whole shape written now stops Milestone 2 from
   inventing a second, subtly different `Card`. The type file becomes the one
   definition of a card, and the compiler holds every milestone to it.

#### The cost

You spend time convincing the checker of things you know are fine. `tab.id` is
a number in your case, but Chrome's types say `number | undefined`, so you write
the guard. That tax is real. It buys the five items above, and on a project you
return to after two weeks away, that trades well.

#### Three things to carry

- `Status` as a union of three literal strings is the highest-value type here.
  It turns "which strings are valid columns" from memory into a compiler rule,
  and a `switch` over it reports a missing `processed` branch.
- The `?` on `estimatedReadingMinutes` and `readAt` is a design statement. It
  records which fields the extension might not know yet, the same line that
  separates `Card` from `CardInput`.
- Types are erased, so the checker cannot help at the IndexedDB boundary. Data
  read back from Dexie is whatever got written, maybe by an older version of the
  code. Types state intent there. They do not validate it.

### What is the difference between a `.tsx` and a `.ts` file?

Whether the file contains JSX, the `<Board />`-style markup.

`extension/src/entrypoints/background.ts` is plain logic: it listens for a
toolbar click and opens or focuses a tab. No markup, so `.ts`.
`extension/src/entrypoints/board/main.tsx` renders the React board. It writes
`<App />` to the page, so it needs `.tsx`.

| | `.ts` | `.tsx` |
|---|---|---|
| Contains JSX (`<Foo />`) | No | Yes |
| Compiler assumes `<T>` means | a generic type | a JSX tag |

The rule of thumb: a file that ever writes `return <SomeComponent />` must be
`.tsx`. A file of only functions, types, and logic stays `.ts`.

The ambiguity is real. `<Foo>(bar)` reads as a generic-typed call in a `.ts`
file and as a JSX element in a `.tsx` file. TypeScript decides by file
extension alone. WXT keeps `background.ts` separate from `board/main.tsx` for
that reason: background scripts render no UI, so they carry no JSX-parsing
rules.

### What is React and ReactDOM?

Two separate libraries. `board/main.tsx` imports both:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../../ui/App';
```

**React** describes the UI as components and works out what changed. `<App />`
compiles to a tree of plain JavaScript objects, not real DOM markup. React
builds that tree, compares it to the last one, and works out the smallest set
of edits. It never touches an actual DOM element.

**ReactDOM** applies that tree to the real browser DOM. `react-dom/client` is
the entry point for a browser tab. `react-dom/server` renders on a server
instead, and `react-native` renders to a phone UI instead of a browser DOM.
Only ReactDOM touches an actual `<div>`.

| Library | Job | Knows about the browser? |
|---|---|---|
| `react` | Describe the UI, diff the tree | No |
| `react-dom` | Paint the tree into real DOM nodes | Yes |

`package.json` pins both at `^19.2.8`, the same version. React 19 compiles
JSX through the automatic runtime, which `@wxt-dev/module-react` sets up in
`wxt.config.ts`. That runtime does not need `import React from 'react'` to
compile `<App />`. Older React versions did. The import survives here as
convention.

The split holds across every React-based framework: React Native and Next.js
both keep one library that describes the UI and a separate renderer that
mounts it. `board/main.tsx` is the only file in this scaffold that imports
`react-dom`, because it is the one place that calls
`ReactDOM.createRoot(...).render(<App />)`. Every other React file describes
components and leaves the mounting to this entry point.

## 2026-08-27 - Milestone 1, Task 1

### Why did `npx wxt prepare` from the repo root say I need to install `wxt`?

Two separate problems, stacked.

`extension/node_modules/` did not exist. `.gitignore` excludes it, so a fresh
checkout keeps `package.json` and `package-lock.json` and drops everything
`npm install` writes. Step 3's install never left a trace on this machine.
`ls extension/node_modules` confirmed it: gone.

The command also ran in the wrong place. `npx` looks for a locally installed
binary by checking the current directory's `node_modules/.bin/`, then walking
up through parent directories. It never walks down into `extension/`. `wxt`
lives at `extension/node_modules/.bin/wxt`, and the repo has no root
`package.json`, so `npx wxt` from the root can never find it, installed or
not. `npx` falls back to a throwaway copy from the registry, and that copy
sits next to no `wxt.config.ts` and no entrypoints. Hence "install wxt".

| Where you run it | `npx` checks | Finds `wxt`? |
|---|---|---|
| repo root | root `node_modules/.bin` (does not exist) | No |
| `extension/` | `extension/node_modules/.bin` | Yes, once installed |

Fix: `cd extension` first, every time. `npm run dev` and `npm run build`
already do this for you; `npm run` always resolves against the
`package.json` in the current directory. `npx` gives no such guardrail.

### What is vitest?

Vitest is the test runner. A test runner finds your test files, runs them,
and prints which ones passed. You write the tests, it runs them.

A test is a function that says "call this with X, expect Y back."

```ts
// src/board/cards.test.ts
import { describe, it, expect } from 'vitest';
import { sortByAddedDate } from './cards';

describe('sortByAddedDate', () => {
  it('puts the newest card first', () => {
    const cards = [{ addedAt: 1 }, { addedAt: 5 }];
    expect(sortByAddedDate(cards)[0].addedAt).toBe(5);
  });
});
```

`describe`, `it`, and `expect` come from Vitest. `npm test` in `extension/`
runs every `it(...)` it finds and fails the run when an `expect` is wrong.

Jest is the older, more common runner. Vitest wins here because WXT builds
this extension with Vite, and Vitest runs on Vite. Test files pass through
the same transform pipeline as shipped code: same TypeScript handling, same
aliases, same plugins. Jest would mean a second build config kept in sync by
hand.

`extension/vitest.config.ts` makes three decisions:

| Line | Meaning |
|---|---|
| `environment: 'node'` | Tests run in plain Node, no fake browser DOM. Fine for logic; UI component tests would need `'jsdom'`. |
| `setupFiles: [...]` | `src/test-support/setup.ts` runs once before any test. The place to install `fake-indexeddb` so Dexie works with no browser. |
| `include: [...]` | Only `.test.ts` files under `src/` count as tests. |

`npm test` runs `vitest run`, which executes once and exits, the shape CI
wants. `npm run test:watch` runs bare `vitest`, which stays alive and re-runs
the tests affected by the file you just saved.

`setupFiles` runs once per test environment, not per test file. Global
installs like polyfills belong there. Per-test fixtures belong in
`beforeEach`.

### And what is Dexie?

Dexie sits on top of IndexedDB. Keep the two apart in your head.

**IndexedDB** is a database built into Chrome and every other browser. It lives on the user's
machine, holds whole JavaScript objects rather than rows and columns, and
survives closing the browser. It is what makes this project local-first: no
server, no account.

Its API predates Promises. Everything is event callbacks, version-upgrade
transactions, and cursors. Saving one card takes about thirty lines.

**Dexie** wraps that API in something worth writing.

```ts
// Raw IndexedDB, the short version
const req = indexedDB.open('SubstackLibrary', 1);
req.onupgradeneeded = (e) => { /* create stores by hand */ };
req.onsuccess = () => {
  const tx = req.result.transaction('cards', 'readwrite');
  tx.objectStore('cards').add(card);
  tx.oncomplete = () => { /* now continue */ };
};

// Dexie
await db.cards.add(card);
```

Three pieces show up in this project.

**The schema** (`src/db/schema.ts`, Task 3). Subclass Dexie, declare the
table:

```ts
db.version(1).stores({
  cards: 'id, status, [status+sortOrder], url'
});
```

That string lists indexes. IndexedDB stores the whole object either way, so a
field left out is still saved and read back. Listing it buys you fast queries
and sorting on that field. `[status+sortOrder]` is a compound index, which is
how the board pulls one column's cards already in order.

**The repository** (`src/db/cards.ts`). One file imports `dexie` and touches
the table. Everything above it calls named functions like `moveCard(...)` and
`listCardsByStatus(...)`. Swapping the storage layer later changes one file.

**`useLiveQuery`** from `dexie-react-hooks`:

```tsx
const cards = useLiveQuery(() => listCardsByStatus('inbox'));
```

The argument is a query. Dexie notes which tables it read, then re-runs it
whenever a write touches one of them. Drop a card into another column and all
three columns update, with no UI code asking for a refresh.

This ties back to Vitest through `fake-indexeddb`: IndexedDB rewritten in
plain JavaScript, in memory. Node has no `indexedDB`, so `setup.ts` installs
the fake onto `globalThis` before any test runs. Dexie cannot tell the
difference and opens a real-behaving database.

Dexie adds no storage of its own. Data it writes shows up in Chrome DevTools
under Application → IndexedDB like any other. `version(1)` is a migration
marker: change the indexes later and you bump to `version(2)` with an upgrade
function, which Dexie runs once on machines still holding v1 data.

### What does it mean to canonicalize a URL?

One article can be reached by many URLs.

```
https://alpha.substack.com/p/questions?utm_source=post
https://alpha.substack.com/p/questions#comments
https://alpha.substack.com/p/questions/
https://Alpha.SubStack.COM/p/Great-Questions
  https://alpha.substack.com/p/questions
```

Five strings. A computer comparing them with `===` sees five articles. You see
one.

Canonical means the official version. Canonicalizing picks one form as the
real one and converts everything else to it before you compare or store.

This project needs it because the spike found Substack's Saved list attaching
`?utm_source=...` to its links. The same article captured from the Saved list
and from the article page produces two URLs. Skip canonicalization and the
board shows the article twice, with neither card aware of the other's notes.

The URL is the identity of a card. `ingestCard` answers "have I seen this?" by
comparing URLs, and `restoreCards` answers "replace or add?" the same way. An
unreliable comparison breaks everything downstream.

`src/domain/url.test.ts` pins the rules:

| Rule | Before | After |
|---|---|---|
| Drop tracking params | `?utm_source=post` | removed |
| Drop the fragment | `#comments` | removed |
| Drop a trailing slash on a path | `/p/questions/` | `/p/questions` |
| Add the slash on a bare host | `alpha.substack.com` | `alpha.substack.com/` |
| Lowercase the host | `Alpha.SubStack.COM` | `alpha.substack.com` |
| Trim surrounding whitespace | `␣␣https://…␣␣` | trimmed |
| Reject garbage | `not a url`, `''`, `javascript:alert(1)` | `null` |

Two rules deserve a second look.

The host gets lowercased while the path keeps its case. DNS hostnames are
case-insensitive by spec, so `EXAMPLE.com` and `example.com` reach the same
server. Paths are case-sensitive on most servers, so `/Great-Questions` and
`/great-questions` may be different pages. Lowercasing the path would merge
distinct articles in silence.

`javascript:alert(1)` returns `null` rather than a cleaned string, which is a
security decision. A `javascript:` URL stored on a card and rendered as an
`href` would run that code inside the extension's own page when clicked.
Rejecting at the boundary lets the rest of the codebase trust that every
stored URL is `http` or `https`.

The signature is `(raw: string) => string | null` and it never throws.
Returning `null` puts the bad-URL case into normal control flow. A thrown
error is easy to forget to catch; a `null` in a typed return makes TypeScript
refuse to compile until the caller handles it.

`canonicalizeUrl` lives in `src/domain/`, which imports nothing: no Dexie, no
React, no browser APIs. A pure string-in, string-out function is the cheapest
thing here to test, which is why it carries eleven test cases.

Canonicalization throws information away on purpose. `utm_source` is gone for
good. That suits a board that wants identity. A link shortener, which wants
fidelity, would choose the opposite.

### What does `export` in a .ts file do?

Every `.ts` file is a module, which means a private box. Whatever you declare
inside stays inside until you mark it with `export`.

Both halves show up in `url.test.ts` line 2:

```ts
import { canonicalizeUrl } from './url';
```

That line works because `url.ts` says `export function canonicalizeUrl`. Drop
the `export` and the function still exists and still runs, but no other file
can reach it. TypeScript says `Module '"./url"' has no exported member
'canonicalizeUrl'`. `export` offers, `import` takes.

**Named export.** The default choice in this project, used by every file in
`src/domain/`:

```ts
// domain/url.ts
export function canonicalizeUrl(raw: string): string | null { ... }

// anywhere else
import { canonicalizeUrl } from './url';
```

The braces mean "pick these names out of that module." One file can export as
many as it likes:

```ts
// domain/types.ts exports four things
export type Status = ...
export interface Quote { ... }
export interface Card { ... }
export interface CardInput { ... }

// a caller takes what it needs
import type { Card, Status } from '../domain/types';
```

**Default export.** One per file, imported with no braces and under any name
the caller picks:

```ts
// vitest.config.ts
export default defineConfig({ ... });
```

Vitest never learns what you would have called it. It loads the file and takes
the default. Config files and framework entry points use this form because the
tool wants the one thing the file is for.

**`export type`.** A TypeScript-only variant:

```ts
import Dexie, { type EntityTable } from 'dexie';
```

The `type` keyword marks the name as a type and erases it at compile time.
JavaScript has no idea what an `EntityTable` is, so the import has to vanish
before the browser sees the file. Marking it lets the compiler strip it
without analyzing how it gets used.

Private-by-default is the mechanism behind the dependency rule.
`db/cards.ts` exports `ingestCard` and `restoreCards`. It can hold ten
unexported helpers, and no file in `src/ui/` can reach them by accident. The
exported names are the file's contract. Everything else stays free to rename
or delete, because nothing outside could depend on it. The plan's name list at
line 3311 is the set of names that carry an `export`, which makes that list
the architecture.

A file with no `import` and no `export` is not a module. TypeScript treats it
as a global script, and its top-level `const foo` can collide with another
file's `const foo`. One `export` flips the file into module scope, which is
why a lone `export {}` sometimes sits at the top of a file.

`import { canonicalizeUrl } from './url'` carries no `.ts` on the end. Vite,
running under WXT, resolves the extension. Writing `./url.ts` breaks under
most TypeScript setups.

Named exports win here because they are greppable. Search for
`canonicalizeUrl` and you find every consumer. A default export gets renamed
at each import site, so `import x from './url'` hides the connection.

### What does `async` do?

`async` in front of a function does two things:

1. Wraps the return value in a Promise, always.
2. Allows `await` inside the body.

The reason takes longer than the rule.

Some work does not finish right away. Reading from IndexedDB means asking the
browser's storage engine and waiting. JavaScript runs on one thread, so it
cannot sit and block: freezing that thread freezes the page and the UI with
it.

Callbacks were the old answer, which is the raw IndexedDB API:

```js
req.onsuccess = () => {
  const tx = req.result.transaction('cards', 'readwrite');
  tx.objectStore('cards').add(card);
  tx.oncomplete = () => { /* now continue */ };
};
```

Every "wait for this" nests one level deeper. Three steps in, nobody can read
it.

A Promise is an object standing for a value that has not arrived. `await`
pauses the function until the Promise resolves, hands over the value, and
carries on. The rest of the page keeps running during the pause.

`ingestCard` from the plan, line 1245:

```ts
export async function ingestCard(input: CardInput): Promise<IngestOutcome> {
  const url = canonicalizeUrl(input.url);          // instant, no await
  if (url === null) {
    return { kind: 'rejected', reason: `...` };
  }

  return db.transaction('rw', db.cards, async () => {
    const existing = await db.cards.where('url').equals(url).first();  // pause

    if (existing) {
      const merged = mergeCard(existing, { ...input, url });
      await db.cards.put(merged);                                      // pause
      return { kind: 'updated', card: merged };
    }
    ...
  });
}
```

It reads top to bottom like sequential code while three lines pause. That is
the payoff. `canonicalizeUrl` gets no `await` because pure string work
finishes on the spot. Only the database calls need one.

Two rules cause most of the trouble.

`await` works only inside `async`. The callback on line 1251 carries the
keyword for that reason: it contains `await db.cards.put(...)`, so it needs
`async` even as an inline arrow function.

The return type is always a Promise. The signature says
`Promise<IngestOutcome>` while the body returns a plain
`{ kind: 'added', card }`. `async` does the wrapping, so every caller unwraps:

```ts
const outcome = ingestCard(input);          // an unresolved Promise
const outcome = await ingestCard(input);    // the IngestOutcome
```

A missing `await` is the most common bug in async code. `outcome.kind` on the
first line is `undefined`, nothing throws, and the hunt takes twenty minutes.

The tests show the same shape:

```ts
test('canonicalizes the url before it stores it', async () => {
  await ingestCard({ url: 'https://Alpha.substack.com/p/questions?utm_source=post' });
  ...
});
```

The callback is `async` so it can `await`. Vitest sees the returned Promise
and waits before marking the test done. Drop the `await` and the test passes
while the write is still in flight, which is a green test proving nothing.

`async` does not mean parallel or threaded. The function still runs on the one
JavaScript thread. `await` yields control so other work can run during the
wait, then resumes.

The transaction on line 1251 makes the pauses safe. `db.transaction('rw', ...)`
commits every read and write inside together or rolls them all back. Without
it, two fast captures of the same URL could both `await` the lookup, both see
nothing, and both insert, producing the duplicate canonicalization exists to
prevent.

Nothing in `src/domain/` is `async`. `canonicalizeUrl`, `mergeCard`, and
`createCard` stay synchronous and pure. Async lives in `db/`, the only layer
talking to something slow.
