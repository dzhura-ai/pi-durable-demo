// pi-durable crash-resume demo (task-based, no model needed).
// mode "crash": start ticker to 7, expect external kill -9 mid-run.
// mode "resume": reopen same sqlite, waitForTask -> continues from checkpoint.
import { appendFileSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, defineExtension, defineTask, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

const mode = process.argv[2] ?? "crash";
const context = BACKGROUND_CONTEXT;
const LOG = "./ticks.log";
const say = (line) => { console.log(line); appendFileSync(LOG, `${mode}: ${line}\n`); };

const Ticker = defineTask({
	name: "demo.ticker",
	version: 1,
	initial: () => ({ phase: "tick", n: 1 }),
	phases: {
		tick: async (task, runtime, tc) => {
			const n = task.state.checkpoint.n;
			if ((await runtime.memo(`printed-${n}`, tc)) === undefined) {
				await runtime.memo(`printed-${n}`, true, tc);
				say(`tick ${n}`);
			} else {
				say(`tick ${n} (rerun, memo says already printed - staying silent)`);
			}
			await runtime.commit(
				() =>
					n === task.input.to
						? { status: "terminal", outcome: { status: "completed", result: `counted to ${n}` } }
						: { status: "running", checkpoint: { phase: "tick", n: n + 1 } },
				tc,
			);
			await runtime.sleep(Date.now() + 400, tc);
		},
	},
	abort: async (_t, runtime, tc) => {
		await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), tc);
	},
});

const registry = createRegistry();
registry.install(defineExtension({ name: "ticker", tasks: [Ticker] }));
const harness = await Harness.open(await openNodeSqliteStorage("./demo.sqlite"), { models: createModels(), registry }, context);

if (mode === "crash") {
	const root = await harness.root(context);
	await root.commit((tx) => tx.createTask(Ticker, { to: 7 }, { ownership: { kind: "conversation" } }), context);
	const page = await root.commit((tx) => tx.scanTasks({}, 1), context);
	writeFileSync("./task.id", String(page.items[0].id));
	harness.resume();
	say("started; sleeping between ticks - kill me now");
	await new Promise(() => {});
} else {
	harness.resume();
	const root = await harness.root(context);
	const id = Number(readFileSync("./task.id", "utf8").trim());
	const settled = await harness.waitForTask(id, context);
	say(`after reopen: ${JSON.stringify(settled.state.outcome)}`);
	say("full tick log:\n" + (existsSync(LOG) ? readFileSync(LOG, "utf8") : "(empty)"));
	await harness.close(context);
}
