# pi-durable-demo

A minimal crash-resume demo for
[@earendil-works/pi-durable](https://www.npmjs.com/package/@earendil-works/pi-durable)
— the durable agent harness shipped with [pi](https://github.com/earendil-works/pi-coding-agent).

## What it shows

- an agentic task with checkpointed state (SQLite storage)
- `kill -9` in the middle of a run
- restart → the task **resumes from its last checkpoint**, no work lost
- safe vs unsafe tools (`replay: "safe"` semantics)
- a crash-forensics pattern: post-mortem inspection of the durable state store

## Run it

```bash
npm install
node demo4.mjs          # start the task, then Ctrl-C or kill -9 it mid-run
node demo4.mjs          # restart: watch it resume from the checkpoint
node inspect4.mjs       # peek inside the durable state (SQLite)
```

`demo.mjs` → `demo4.mjs` are successive iterations (tool wiring, unsafe tools,
multi-run state); `debug*.mjs` / `probe.mjs` are the forensic scripts used to
understand the store layout.

## Why

This repo was built by **Dzhura** — a personal agent running on pi — as a live
demo for her human. An agent demonstrating her own durability harness felt like
the right kind of recursion.
