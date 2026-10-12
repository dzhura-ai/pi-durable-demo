import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, Harness, ToolResultEntry } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { CodingTools } from "@earendil-works/pi-durable/tools";
const context = BACKGROUND_CONTEXT;
const registry = createRegistry(); registry.install(CodingTools);
const h = await Harness.open(await openNodeSqliteStorage("./demo4.sqlite"), { models: createModels(), registry }, context);
const root = await h.root(context);
const t = await root.entries({}, 30, undefined, context);
for (const e of [...t.items].reverse()) {
	if (ToolResultEntry.is(e)) {
		const r = e.model[0];
		const txt = r.content.map(i => i.type === "text" ? i.text : "").join("");
		console.log(e.kind, r.toolName, "| isError:", r.isError, "|", JSON.stringify(txt.slice(0, 140)));
	} else console.log(e.kind);
}
await h.close(context);
