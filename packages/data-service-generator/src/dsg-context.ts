import * as types from "@amplication/code-gen-types";
import {
  BuildLogger as IBuildLogger,
  clientDirectories,
  ContextUtil,
  serverDirectories,
} from "@amplication/code-gen-types";
import { EnumResourceType } from "./models";
import { readPluginStaticModules } from "./utils/read-static-modules";
import {
  USER_ENTITY_NAME,
  USER_NAME_FIELD_NAME,
  USER_PASSWORD_FIELD_NAME,
  USER_ROLES_FIELD_NAME,
} from "./server/user-entity/user-entity";
import { BuildLogger } from "./build-logger";
import { cloneDeep } from "lodash";

class DsgContext implements types.DsgContext {
  public appInfo!: types.AppInfo;
  public entities: types.Entity[] = [];
  public buildId: string;
  public roles: types.Role[] = [];
  public modules: types.ModuleMap;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public DTOs: types.DTOs = {};
  public plugins: types.PluginMap = {};
  public logger: IBuildLogger;
  public utils: ContextUtil = {
    skipDefaultBehavior: false,
    abortGeneration: (msg: string) => {
      this.utils.abortMessage = msg;
      this.utils.abort = true;
    },
    abort: false,
    abortMessage: "",
    importStaticModules: readPluginStaticModules,
  };
  public serviceTopics: types.ServiceTopics[] = [];
  public topics: types.Topic[] = [];

  public clientDirectories!: clientDirectories;
  public serverDirectories!: serverDirectories;

  public hasDecimalFields = false;
  public hasBigIntFields = false;

  public userEntityName: string = USER_ENTITY_NAME;
  public userNameFieldName: string = USER_NAME_FIELD_NAME;
  public userPasswordFieldName: string = USER_PASSWORD_FIELD_NAME;
  public userRolesFieldName: string = USER_ROLES_FIELD_NAME;

  private static instance: DsgContext;

  public static get getInstance(): DsgContext {
    return this.instance || (this.instance = new this());
  }

  public serializeForWorker(): types.DsgContext {
    return {
      resourceType: this.resourceType,
      resourceInfo: this.appInfo,
      buildId: this.buildId,
      entities: this.entities,
      roles: this.roles,
      modules: this.modules,
      DTOs: this.DTOs,
      plugins: this.plugins,
      pluginInstallations: this.pluginInstallations,
      logger: this.logger,
      utils: this.utils,
      clientDirectories: this.clientDirectories,
      serverDirectories: this.serverDirectories,
      userEntityName: this.userEntityName,
      userNameFieldName: this.userNameFieldName,
      userPasswordFieldName: this.userPasswordFieldName,
      userRolesFieldName: this.userRolesFieldName,
      serviceTopics: this.serviceTopics,
      topics: this.topics,
    };
  }

  private constructor() {
    //prevent external code from creating instances of the context
    this.logger = new BuildLogger();
    this.modules = new types.ModuleMap(this.logger);
  }

  public static createFromData(data: Partial<DsgContext>): DsgContext {
    const context = new DsgContext();
    const clonedData = cloneDeep(data);
    Object.assign(context, clonedData);
    return context;
  }

  public get resourceInfo(): types.AppInfo {
    return this.appInfo;
  }

  public set resourceInfo(value: types.AppInfo) {
    this.appInfo = value;
  }

  public resourceType!: EnumResourceType;
  public pluginInstallations: types.PluginInstallation[] = [];
  public otherResources?: types.DSGResourceData[] | undefined;
}

export default DsgContext;
