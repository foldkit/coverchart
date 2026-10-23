# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: true

## Project Notes

Coverchart is a multi-page song chart editor (home library, editor, play view) with Blocks, OutMessage, localStorage persistence, and theme preference.

The root Model owns the canonical song library. Editor and Play receive a song through view inputs and Binding delivery context. Their keyed instances hold interaction state, not synchronized song copies. Children report domain changes through OutMessages; the parent applies them to the current canonical song and returns persistence Commands. Preserve the editor's intentional lyrics undo snapshot and in-flight placement guards.
