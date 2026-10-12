// demo4: crash-resume THROUGH a real tool call (faux model + CodingTools + sqlite).
// crash: model asks bash "echo step1; sleep 5" -> kill -9 mid-tool.
// resume: reopen sqlite -> tool task resumes/retries, model continues, run finishes.
import { mkdtemp } from "node:fs/promises";
import { appendFileSync as afs, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";

const mode = process.argv[2] ?? "crash";
const context = BACKGROUND_CONTEXT;
const directory = join(process.cwd(), "workdir4");
if (mode === "crash") await mkdtemp(directory).catch(() => {});
const WORKLOG = join(directory, "work.log");
const say = (line) => { console.log(`[${mode}] ${line}`); afs("./demo4.log", `[${mode}] ${line}\n`); };

const faux = fauxProvider();
const models = createModels();
models.setProvider(faux.provider);
const toolCall = (name, args, id) => fauxAssistantMessage([fauxToolCall(name, args, { id })], { stopReason: "toolUse" });
if (mode === "crash") {
	faux.setResponses([
		toolCall("bash", { command: `echo step1 >> ${WORKLOG}; sleep 5; echo step1-done >> ${WORKLOG}` }, "b1"),
		toolCall("bash", { command: `echo step2 >> ${WORKLOG}` }, "b2"),
		fauxAssistantMessage([fauxText("All steps survived.")]),
	]);
} else {
	faux.setResponses([
		toolCall("bash", { command: `echo step2 >> ${WORKLOG}` }, "b2"),
		fauxAssistantMessage([fauxText("All steps survived.")]),
	]);
}

const registry = createRegistry();
registry.install(CodingTools);
const harness = await Harness.open(await openNodeSqliteStorage("./demo4.sqlite"), {
	models, registry, env: (target) => new NodeExecutionEnv({ cwd: target.cwd ?? process.cwd() }),
}, context);

if (mode === "crash") {
	const root = await harness.root(context, { agent: { model: { provider: "faux", modelId: "faux-1" }, cwd: directory } });
	const sub = await root.submit({ type: "input", content: "Do the two steps." }, context);
	writeFileSync("./sub.id", String(sub.id ?? sub.submission?.id ?? ""));
	say(`submitted (id file: ${readFileSync("./sub.id", "utf8")}); sleeping inside bash tool - kill me now`);
	harness.resume();
	await new Promise(() => {});
} else {
	harness.resume();
	const root = await harness.root(context);
	const idRaw = readFileSync("./sub.id", "utf8").trim();
	const sub = await harness.submission(Number(idRaw), context);
	if (!sub) { say("submission handle not found by id; scanning"); }
	const settled = sub ? await sub.wait(context) : null;
	say(`settled: ${JSON.stringify(settled?.status)}`);
	say("work.log:\n" + (existsSync(WORKLOG) ? readFileSync(WORKLOG, "utf8") : "(missing)"));
	await harness.close(context);
}
