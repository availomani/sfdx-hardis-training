/**
 * The bridge between a training command and the Command Runner panel of the
 * VS Code extension.
 *
 * The extension runs `node scripts/training.mjs <verb>` in that panel rather
 * than in a terminal (see isTrainingPanelCommand in vscode-sfdx-hardis) and
 * passes the address of its WebSocket server in SFDX_HARDIS_WEBSOCKET. This
 * module speaks the same protocol sfdx-hardis commands speak, so a lesson looks
 * like any other command of the product: log lines, questions with answer
 * chips, and buttons for the files it wrote.
 *
 * Without that variable every function here is a no-op and the script prints to
 * the console as it always did. No dependency: Node ships a WebSocket client.
 */

const ADDRESS = process.env.SFDX_HARDIS_WEBSOCKET || "";
const CONTEXT_ID = process.env.SFDX_HARDIS_COMMAND_CONTEXT_ID || String(process.pid);
const CONNECT_TIMEOUT_MS = 5000;
// A learner reading a question is not in a hurry, and a lesson can wait
const ANSWER_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** What the panel answers when the learner dismisses a question. */
export const CANCELLED = "exitNow";

let socket = null;
let context = null;
let pendingAnswer = null;

/** True once the panel is listening, which is what makes questions possible. */
export function isActive() {
  return socket !== null && socket.readyState === 1;
}

/**
 * Opens the connection and waits for the extension to acknowledge it. Resolves
 * to false when there is no panel, when the WebSocket cannot be opened, or when
 * the acknowledgement does not arrive: in every one of those the caller keeps
 * its console output and its terminal questions.
 */
export async function connect(command) {
  if (!ADDRESS || typeof WebSocket === "undefined") {
    return false;
  }
  context = { id: CONTEXT_ID, command, commandLine: `node scripts/training.mjs ${command}` };
  try {
    socket = new WebSocket(`ws://${ADDRESS}`);
  } catch {
    socket = null;
    return false;
  }
  socket.addEventListener("message", (event) => {
    let data = null;
    try {
      data = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
    } catch {
      return;
    }
    if (data.event === "ping") {
      send({ event: "pong" });
    } else if (data.event === "promptsResponse" && pendingAnswer) {
      pendingAnswer(Array.isArray(data.promptsResponse) ? data.promptsResponse[0] : data.promptsResponse);
    } else if (data.event === "cancelCommand") {
      // The learner closed the panel. The extension does not kill the process:
      // it expects the command to stop by itself, as sfdx-hardis commands do.
      console.log("Cancelled from the panel.");
      close("cancelled");
      process.exit(1);
    }
  });
  const dropped = () => {
    socket = null;
    // A question waiting on a panel that is gone would otherwise wait out the
    // whole answer timeout
    if (pendingAnswer) {
      pendingAnswer(undefined);
    }
  };
  socket.addEventListener("close", dropped);
  socket.addEventListener("error", dropped);

  const opened = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), CONNECT_TIMEOUT_MS);
    const done = (value) => {
      clearTimeout(timer);
      resolve(value);
    };
    if (!socket) {
      done(false);
      return;
    }
    socket.addEventListener("open", () => done(true), { once: true });
    socket.addEventListener("error", () => done(false), { once: true });
  });
  if (!opened || !isActive()) {
    socket = null;
    return false;
  }

  // The extension answers initClient with the kind of user input it wants.
  // Anything other than the panel means questions stay on the console.
  const ready = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), CONNECT_TIMEOUT_MS);
    const listener = (event) => {
      let data = null;
      try {
        data = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
      } catch {
        return;
      }
      if (data.event === "userInput") {
        clearTimeout(timer);
        socket.removeEventListener("message", listener);
        resolve(data.userInput);
      }
    };
    socket.addEventListener("message", listener);
    send({ event: "initClient" });
  });
  if (ready !== "ui-lwc") {
    close("skipped");
    return false;
  }
  return true;
}

function send(message) {
  if (!isActive()) {
    return;
  }
  try {
    socket.send(JSON.stringify({ ...message, context }));
  } catch {
    // The panel disappearing is not a reason for a lesson to fail
  }
}

/**
 * One line in the panel. `type` follows the sfdx-hardis log types: log, action,
 * warning, error, success.
 */
export function log(message, type = "log") {
  send({ event: "commandLogLine", logType: type, message: String(message) });
}

/**
 * The panel draws text, number, select and multiselect questions, and nothing
 * else. A confirm sent as one arrives with no Yes and no No: the learner gets a
 * sentence, a Cancel and a Validate, and Validate answers an empty object, which
 * every caller reads as "no". So a confirm becomes the two-choice select it
 * already is, which is exactly what the CLI sends (reformatQuestions, in
 * sfdx-hardis src/common/utils/prompts.ts).
 */
function forPanel(prompt) {
  if (prompt.type !== "confirm") {
    return prompt;
  }
  const yes = prompt.initial !== false;
  return {
    ...prompt,
    type: "select",
    choices: [
      { title: "Yes", value: true, selected: yes },
      { title: "No", value: false, selected: !yes }
    ]
  };
}

/**
 * Asks the question in the panel and waits for the answer. `prompt` is a
 * prompts-style definition: { type, name, message, choices, initial }.
 * Resolves to undefined when the panel is gone, so the caller can fall back.
 */
export async function ask(prompt) {
  if (!isActive()) {
    return undefined;
  }
  const question = forPanel(prompt);
  const answer = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ANSWER_TIMEOUT_MS);
    pendingAnswer = (value) => {
      clearTimeout(timer);
      pendingAnswer = null;
      resolve(value);
    };
    send({ event: "prompts", prompts: [question] });
  });
  const value =
    answer && typeof answer === "object" && question.name in answer ? answer[question.name] : answer;
  // What the panel sends when the learner dismisses the question. Every caller
  // treats it the way the CLI does: the command stops there.
  if (value === CANCELLED || (Array.isArray(value) && value[0] === CANCELLED)) {
    return CANCELLED;
  }
  return value;
}

/** A button at the bottom of the panel: a file the lesson wrote, or a link. */
export function report(file, title, type = "report") {
  send({ event: "reportFile", file: String(file).replace(/\\/g, "/"), title, type });
}

/** Asks VS Code to refresh its panels, after a command changed the pipeline. */
export function refresh() {
  send({ event: "refreshStatus" });
  send({ event: "refreshCommands" });
  send({ event: "refreshPipeline" });
}

/** Ends the command in the panel: "success", "error" or "skipped". */
export function close(status = "success") {
  if (!isActive()) {
    socket = null;
    return;
  }
  send({ event: "closeClient", status });
  try {
    socket.close();
  } catch {
    // Already gone
  }
  socket = null;
}
