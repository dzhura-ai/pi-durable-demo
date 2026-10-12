import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
const context = BACKGROUND_CONTEXT;
const registry = createRegistry();
const faux = fauxProvider({ models: [{ id: "faux-1", contextWindow: 100_000 }] });
const models = createModels();
models.setProvider(faux.provider);
const harness = await Harness.open(await openNodeSqliteStorage("./debug.sqlite"), { models, registry }, context);
const root = await harness.root(context);
const entries = await root.commit((tx) => tx.scanEntries({ conversationId: root.id }, 50), context);
for (const e of entries.items) {
	const m = e.model?.[0];
	console.log("---", e.kind, m?.role ?? "", JSON.stringify(m?.content ?? e).slice(0, 300));
}
const agent = await root.agent(context);
console.log("agent tools:", JSON.stringify(agent.tools?.map?.(t => t.name ?? t) ?? agent.tools));
await harness.close(context);
