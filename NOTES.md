# pi-durable demo probe — results (2026-10-06, free heartbeat)

VERIFIED on this box (v1.0.4): crash-resume works exactly as advertised.
- demo2.mjs: durable Ticker task (7 ticks, 400ms sleep, memo-guarded prints).
- Run 1: `node demo2.mjs crash` -> ticks 1-4 printed, then `kill -9` mid-sleep.
- Run 2: `node demo2.mjs resume` -> reopen same demo.sqlite, harness.resume(), waitForTask -> ticks 5-7, NO duplicate prints, outcome "counted to 7".
- Tick log proves single-print semantics (memos) and checkpoint continuation.

GOTCHAS learned (for the Tue session script):
1. `conversation.commit(cb)` returns cb's value; tx.createTask resolves to a NUMERIC TaskId in this version -> String() it before fs writes; waitForTask accepts the number.
2. Agent tool offering via root(context,{agent:{tools:[...]}}) did NOT offer tools in my faux-model probe (assistant tool call went unanswered, run settled "done"); extensions:["demo"] at creation threw chord non-JSON undefined. UNRESOLVED: correct wiring for model+tools path — check test examples 17-coding-tools.ts / 30-tool-override.ts next time. Task-based path (no model) works cleanly and is enough for the crash demo.
3. fauxProvider (pi-ai) = perfect keyless model stub for mechanics demos.
4. protobufjs postinstall unapproved (npm install-scripts) — harmless so far.
5. .mjs must stay plain JS (no TS generics) — node runs it directly, no strip-types needed.

TODO before Tue 20.10: model-based variant (real qwen via custom provider or OPENAI-compatible route) + pretty Telegram presentation (tick log as the punchline).

## Act 2 UPDATE (2026-10-07 08:00 free heartbeat) — tool wiring SOLVED, crash-through-tool VERIFIED
- CORRECT tool offering: `registry.install(CodingTools)` (from `@earendil-works/pi-durable/tools`) + `Harness.open(storage, { models, registry, env: (target) => new NodeExecutionEnv({ cwd: target.cwd ?? process.cwd() }) })` (from `@earendil-works/pi-durable/env/node`). NOT root({agent:{tools}}). demo3.mjs: faux model drives bash+edit, transcript commits, answer "done".
- demo4.mjs: crash THROUGH a real tool call. faux model asks `bash: echo step1 >> work.log; sleep 5; echo step1-done`. kill -9 at ~3s mid-sleep. Resume: `harness.submission(Number(id), context)` reacquires the handle (Harness method, not Conversation!), `sub.wait()` -> "done".
- Interrupted-tool semantics (transcript proof, inspect4.mjs): the killed pi.tool settles as isError result `<harness>[error] Tool bash was interrupted and may have partially run</harness>` — NOT re-executed; the model is told and decides. Safer default than replay.
- Real-world nuance observed: kill -9 kills node, but the spawned bash CHILD SURVIVED and wrote step1-done after the crash — "may have partially run" is literal truth. Great demo talking point.
- Submission/Task ids are numeric (sub.id = 8).
- Act 3 (real model): example 16 uses `models.setProvider(openaiProvider())` — but pi-ai's openaiProvider() hardcodes baseUrl api.openai.com and type openai-responses; DashScope compatible-mode won't fit directly. Plan: tiny custom Provider (~40 lines, fetch to https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions with qwen key) OR skip act 3 and present faux honestly ("the model is a script; durability is the star"). Decide by 19.10.
- Tuesday demo script: Act 1 = ticker kill/resume (demo2, verified), Act 2 = crash through tool call + interrupted-semantics transcript (demo4, verified), Act 3 = real model (optional).
