// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";
import { DeepPartial } from "ts-essentials";
import { StoreApi } from "zustand";

import { Immutable, SettingsTreeField, SettingsTreeNode } from "@tf/studio";
import { AppBarMenuItem } from "@tf/studio-base/components/AppBar/types";
import { LayoutData } from "@tf/studio-base/context/CurrentLayoutContext";
import { PanelInfo } from "@tf/studio-base/context/PanelCatalogContext";
import { WorkspaceContextStore } from "@tf/studio-base/context/Workspace/WorkspaceContext";
import type { SceneExtensionConfig } from "@tf/studio-base/panels/ThreeDeeRender/SceneExtensionConfig";
import type { Player } from "@tf/studio-base/players/types";

interface IAppContext {
  appBarLayoutButton?: JSX.Element;
  appBarMenuItems?: readonly AppBarMenuItem[];
  createEvent?: (args: {
    deviceId: string;
    timestamp: string;
    durationNanos: string;
    metadata: Record<string, string>;
  }) => Promise<void>;
  injectedFeatures?: InjectedFeatures;
  importLayoutFile?: (fileName: string, data: LayoutData) => Promise<void>;
  layoutEmptyState?: JSX.Element;
  syncAdapters?: readonly JSX.Element[];
  workspaceExtensions?: readonly JSX.Element[];
  extensionSettings?: JSX.Element;
  renderSettingsStatusButton?: (
    nodeOrField: Immutable<SettingsTreeNode | SettingsTreeField>,
  ) => JSX.Element | undefined;
  workspaceStoreCreator?: (
    initialState?: Partial<WorkspaceContextStore>,
  ) => StoreApi<WorkspaceContextStore>;
  PerformanceSidebarComponent?: React.ComponentType;
  extraPanels?: PanelInfo[];
  wrapPlayer: (child: Player) => Player;
}

export const INJECTED_FEATURE_KEYS = {
  customSceneExtensions: "ThreeDeeRender.customSceneExtensions",
} as const;

export type InjectedFeatureMap = {
  [INJECTED_FEATURE_KEYS.customSceneExtensions]?: {
    customSceneExtensions: DeepPartial<SceneExtensionConfig>;
  };
};

export type InjectedFeatures = {
  availableFeatures: InjectedFeatureMap;
};

const AppContext = createContext<IAppContext>({
  // Default wrapPlayer is a no-op and is a pass-through of the provided child player
  wrapPlayer: (child) => child,
});
AppContext.displayName = "AppContext";

export function useAppContext(): IAppContext {
  return useContext(AppContext);
}

export { AppContext };
export type { IAppContext };
