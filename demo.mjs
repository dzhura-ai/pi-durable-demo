// pi-durable crash-resume probe. mode: "crash" | "resume"
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Type } from "@earendil-works/pi-ai";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import {
	AssistantEntry,
	createRegistry,
	defineExtension,
	defineTool,
	Harness,
} from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

const mode = process.argv[2] ?? "crash";
const context = BACKGROUND_CONTEXT;
const LOG = "./tool.log";

const slowNote = defineTool({
	name: "slow_note",
	description: "Writes to tool.log, sleeps 20s, writes again (crash bait).",
	parameters: Type.Object({}),
	replay: "safe",
	execute: async () => {
		appendFileSync(LOG, `${mode} tool-start ${new Date().toISOString()}\n`);
		await new Promise((r) => setTimeout(r, 20_000));
		appendFileSync(LOG, `${mode} tool-end ${new Date().toISOString()}\n`);
		return { content: [{ type: "text", text: "note written" }] };
	},
});

const registry = createRegistry();
registry.install(defineExtension({ name: "demo", tools: [slowNote] }));

const faux = fauxProvider({ models: [{ id: "faux-1", contextWindow: 100_000 }] });
const models = createModels();
models.setProvider(faux.provider);

if (mode === "crash") {
	faux.setResponses([fauxAssistantMessage([fauxToolCall("slow_note", {})])]);
} else {
	faux.setResponses([fauxAssistantMessage("resumed and finished: the note survived.")]);
}

const storage = await openNodeSqliteStorage("./demo.sqlite");
const harness = await Harness.open(storage, { models, registry }, context);
const root = await harness.root(context, {
	agent: { model: { provider: faux.provider.id, modelId: "faux-1" }, tools: [slowNote] },
});

if (mode === "crash") {
	await root.submit({ type: "input", content: "call slow_note please", requestId: "demo-1" }, context);
	console.log("submitted; tool sleeping 20s - kill me now");
	// keep process alive; external kill -9 expected
	await new Promise(() => {});
} else {
	harness.resume();
	const submission = await root.submit({ type: "input", content: "call slow_note please", requestId: "demo-1" }, context);
	const settled = await submission.wait(context);
	const entry = await root.commit((tx) => tx.entry(AssistantEntry, settled.answer), context);
	const text = entry?.model?.[0]?.content?.flatMap((c) => (c.type === "text" ? [c.text] : []))?.join("") ?? "(no text)";
	console.log("status:", settled.status, "| answer:", text);
	console.log("tool.log:\n" + (existsSync(LOG) ? readFileSync(LOG, "utf8") : "(empty)"));
	await harness.close(context);
}
