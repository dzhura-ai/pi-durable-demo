// demo3: faux model + REAL durable tools (CodingTools) on sqlite — fixes the tool-offering wiring.
// Key: tools come from registry.install(CodingTools) + harness env factory, NOT root({agent:{tools}}).
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { createRegistry, defineExtension, Harness, AssistantEntry, ToolResultEntry } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";

const context = BACKGROUND_CONTEXT;
const directory = await mkdtemp(join(tmpdir(), "pi-durable-demo3-"));
await writeFile(join(directory, "notes.txt"), "hello world\n");

const faux = fauxProvider();
const models = createModels();
models.setProvider(faux.provider);
const toolCall = (name, args, id) => fauxAssistantMessage([fauxToolCall(name, args, { id })], { stopReason: "toolUse" });
faux.setResponses([
	toolCall("bash", { command: "cat notes.txt" }, "b1"),
	toolCall("edit", { path: "notes.txt", edits: [{ oldText: "world", newText: "durable" }] }, "e1"),
	toolCall("bash", { command: "cat notes.txt" }, "b2"),
	fauxAssistantMessage([fauxText("The file now greets durable.")]),
]);

const registry = createRegistry();
registry.install(CodingTools);
registry.install(defineExtension({ name: "demo3", sections: [] }));

const storage = await openNodeSqliteStorage("./demo3.sqlite");
const harness = await Harness.open(
	storage,
	{ models, registry, env: (target) => new NodeExecutionEnv({ cwd: target.cwd ?? process.cwd() }) },
	context,
);
const root = await harness.root(context, { agent: { model: { provider: "faux", modelId: "faux-1" }, cwd: directory } });

const settled = await (await root.submit({ type: "input", content: "Greet durable instead." }, context)).wait(context);
console.log("status:", settled.status);
const transcript = await root.entries({}, 20, undefined, context);
for (const entry of [...transcript.items].reverse()) {
	if (!ToolResultEntry.is(entry)) { console.log("-", entry.kind); continue; }
	const result = entry.model[0];
	const text = result.content.map((i) => (i.type === "text" ? i.text : "")).join("");
	console.log(`- ${entry.kind} ${result.toolName}:`, JSON.stringify(text.slice(0, 120)));
}
if (settled.status === "done" && settled.type === "input") {
	const answer = await root.commit((tx) => tx.entry(AssistantEntry, settled.answer), context);
	const message = answer?.model?.[0];
	console.log("answer:", message?.role === "assistant" ? JSON.stringify(message.content) : message);
}
console.log("file now:", JSON.stringify(await readFile(join(directory, "notes.txt"), "utf8")));
await harness.close(context);
