import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, defineExtension, defineTask, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
const context = BACKGROUND_CONTEXT;
const T = defineTask({
	name: "probe.t", version: 1,
	initial: () => ({ phase: "go" }),
	phases: { go: async (_t, rt, tc) => { await rt.commit(() => ({ status: "terminal", outcome: { status: "completed", result: "x" } }), tc); } },
	abort: async (_t, rt, tc) => { await rt.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), tc); },
});
const registry = createRegistry();
registry.install(defineExtension({ name: "p", tasks: [T] }));
const h = await Harness.open(await openNodeSqliteStorage("./probe.sqlite"), { models: createModels(), registry }, context);
const root = await h.root(context);
const ret = await root.commit((tx) => tx.createTask(T, { to: 7 }, { ownership: { kind: "conversation" } }), context);
console.log("commit returned:", typeof ret, JSON.stringify(ret));
await h.close(context);
