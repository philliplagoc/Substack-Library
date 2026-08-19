# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Substack-Library is a local-first Chrome/Edge extension for a deliberate Substack reading workflow: capture articles from any device, triage them on a three-column board, take notes beside the article on its original page, and export those notes as Markdown, either as a download or written into an Obsidian vault.



## Session log

`changes.log` is the handoff record for this repository.

- Read it first, before you read the code or the plans. Its "Current state"
  section tells you where the work stopped.
- Add an entry at the top of its "Entries" section when you finish a unit of
  work, and update "Current state" to match. Use the template in the file.
- Record the reason and the next step, not the diff. Git holds the diff.

## Learning notes

`docs/learning-notes.md` records the questions the developer asks while they
build this project. The developer learns the stack as the work goes on.

- Add a note when the developer asks about a concept, a tool, a file, or a
  decision. Examples: "What is Node?", "What does `package.json` do?", "Why is
  this file a plain script?"
- Do not add a note for a question about the immediate task. Examples: "Which
  step comes next?", "Did the test pass?", "Show me the diff."
- Write the note after you give the answer. Use the answer you gave. Make it
  shorter. Keep the tables, the code blocks, and the comparisons. Remove the
  conversational lines.
- Put the note in the section for the current date. Add a new
  `## YYYY-MM-DD - <milestone and task>` section at the end of the file when
  that date has no section.
- Make the question the `###` heading. Keep the words the developer used.
- Write the notes in ASD-STE100, like the other documents.
- Run the `stop-slop` skill on the note text after you write it. This step is
  necessary, not optional. Remove the adverbs, the passive voice, the em dashes,
  the throat-clearing openers, and the "not X, it is Y" contrasts. Keep the
  tables and the code blocks.
- ASD-STE100 wins where the two rule sets disagree. Keep the sentences short and
  uniform. Do not vary the rhythm for effect.
- No code reads this file. Do not add an entry to `changes.log` for it.
