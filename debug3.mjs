import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Type } from "@earendil-works/pi-ai";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { createRegistry, defineExtension, defineTool, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

const context = BACKGROUND_CONTEXT;
const tool = defineTool({
	name: "slow_note",
	description: "test",
	parameters: Type.Object({}),
	replay: "safe",
	execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
});
const registry = createRegistry();
registry.install(defineExtension({ name: "demo", extensions: ["demo"] }));
const faux = fauxProvider({ models: [{ id: "faux-1", contextWindow: 100_000 }] });
const models = createModels();
models.setProvider(faux.provider);
faux.setResponses([fauxAssistantMessage([fauxToolCall("slow_note", {})]), fauxAssistantMessage("done-done")]);
const harness = await Harness.open(await openNodeSqliteStorage("./debug3.sqlite"), { models, registry }, context);
const root = await harness.root(context, { agent: { model: { provider: faux.provider.id, modelId: "faux-1" }, extensions: ["demo"] } });
const sub = await root.submit({ type: "input", content: "go", requestId: "dbg-1" }, context);
const settled = await sub.wait(context);
console.log("settled:", settled.status, settled.type);
const entries = await root.commit((tx) => tx.scanEntries({ conversationId: root.id }, 50), context);
for (const e of entries.items) console.log("-", e.kind ?? e.type ?? JSON.stringify(e).slice(0, 120));
await harness.close(context);
