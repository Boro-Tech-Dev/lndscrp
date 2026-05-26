import type { Worker } from "bullmq";
import { closeSharedBrowser } from "./renderedPage";

const workers: Worker[] = [];

export function registerWorker(worker: Worker): Worker {
  workers.push(worker);
  return worker;
}

export async function closeAllWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
  await closeSharedBrowser();
}
