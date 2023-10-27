import { parentPort } from "worker_threads";
import { createServer } from "./server/create-server";
import { AsyncLocalStorage } from "node:async_hooks";
import DsgContext from "./dsg-context";
import { parse } from "flatted";

const asyncLocalStorage = new AsyncLocalStorage();

if (parentPort) {
  parentPort.on("message", (incomingContext) => {
    const reconstructedContext = DsgContext.createFromData(
      parse(incomingContext)
    );
    asyncLocalStorage.run(reconstructedContext, () => {
      const serverModules = createServer();
      parentPort.postMessage(serverModules);
    });
  });
}
