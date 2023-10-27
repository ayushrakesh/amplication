import { DSGResourceData, ModuleMap } from "@amplication/code-gen-types";
import normalize from "normalize-path";
import DsgContext from "./dsg-context";
import { EnumResourceType } from "./models";
import { prepareContext } from "./prepare-context";
import { ILogger } from "@amplication/util/logging";
import { createDTOModules, createDTOs } from "./server/resource/create-dtos";
import { formatCode } from "@amplication/code-gen-utils";
import { Worker } from "worker_threads";
import { stringify } from "flatted";
import path from "path";

export async function createDataService(
  dSGResourceData: DSGResourceData,
  internalLogger: ILogger,
  pluginInstallationPath?: string
): Promise<ModuleMap> {
  const context = DsgContext.getInstance;
  try {
    if (dSGResourceData.resourceType === EnumResourceType.MessageBroker) {
      internalLogger.info("No code to generate for a message broker");
      return null;
    }

    const startTime = Date.now();
    await prepareContext(
      dSGResourceData,
      internalLogger,
      pluginInstallationPath
    );

    const { GIT_REF_NAME: gitRefName, GIT_SHA: gitSha } = process.env;
    await context.logger.info(
      `Running DSG version: ${gitRefName} <${gitSha?.substring(0, 6)}>`
    );

    await context.logger.info("Creating application...", {
      resourceId: dSGResourceData.resourceInfo.id,
      buildId: dSGResourceData.buildId,
    });

    const { appInfo } = context;
    const { settings } = appInfo;

    await context.logger.info("Creating DTOs...");
    const dtos = await createDTOs(context.entities);
    context.DTOs = dtos;
    const dtoModules = await createDTOModules(dtos);

    await context.logger.info("Formatting DTOs code...");
    await dtoModules.replaceModulesCode((path, code) => formatCode(path, code));

    const { adminUISettings } = settings;
    const { generateAdminUI } = adminUISettings;

    const serializedContext = context.serializeForWorker();

    await context.logger.info("CREATE SERVER WORKER...");
    const serverWorker = new Worker(
      path.resolve(__dirname, "./create-server-worker.js")
    );
    const serverPromise = new Promise<ModuleMap>((resolve, reject) => {
      serverWorker.on("message", (data) => resolve(data));
      serverWorker.on("error", reject);
      serverWorker.postMessage(stringify(serializedContext));
    });

    let adminPromise: Promise<ModuleMap> | null = null;
    if (generateAdminUI) {
      await context.logger.info("CREATE ADMIN WORKER...");
      const adminUiWorker = new Worker(
        path.resolve(__dirname, "./create-admin-worker.js")
      );
      adminPromise = new Promise<ModuleMap>((resolve, reject) => {
        adminUiWorker.on("message", resolve);
        adminUiWorker.on("error", reject);
        adminUiWorker.postMessage(stringify(serializedContext));
      });
    }

    const [serverModules, adminUIModules] = await Promise.all([
      serverPromise,
      adminPromise || Promise.resolve(new ModuleMap(context.logger)),
    ]);

    const modules = await serverModules.merge(dtoModules);
    if (adminUIModules) {
      await modules.merge(adminUIModules);
    }

    // This code normalizes the path of each module to always use Unix path separator.
    await context.logger.info(
      "Normalizing modules path to use Unix path separator"
    );
    await modules.replaceModulesPath((path) => normalize(path));

    const endTime = Date.now();
    internalLogger.info("Application creation time", {
      durationInMs: endTime - startTime,
    });

    await context.logger.info(
      "Creating application process finished successfully"
    );

    return modules;
  } catch (error) {
    await internalLogger.error("Failed to run createDataService", {
      ...error,
    });
    throw error;
  }
}
