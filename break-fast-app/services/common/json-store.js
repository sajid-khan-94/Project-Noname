import fs from "node:fs/promises";
import path from "node:path";

const writeQueues = new Map();

function resolveDataDir() {
  return path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
}

function resolveFile(name) {
  return path.join(resolveDataDir(), `${name}.json`);
}

async function ensureFile(name, createInitialState) {
  const file = resolveFile(name);
  await fs.mkdir(path.dirname(file), { recursive: true });

  try {
    await fs.access(file);
  } catch {
    const initialState = createInitialState();
    await fs.writeFile(file, JSON.stringify(initialState, null, 2));
  }

  return file;
}

export async function readDomainState(name, createInitialState) {
  const file = await ensureFile(name, createInitialState);
  const content = await fs.readFile(file, "utf8");
  return JSON.parse(content);
}

export function updateDomainState(name, createInitialState, updater) {
  const previous = writeQueues.get(name) ?? Promise.resolve();
  const next = previous.then(async () => {
    const file = await ensureFile(name, createInitialState);
    const state = JSON.parse(await fs.readFile(file, "utf8"));
    const result = await updater(state);
    await fs.writeFile(file, JSON.stringify(state, null, 2));
    return result;
  });

  writeQueues.set(
    name,
    next.catch(() => {}),
  );

  return next;
}
