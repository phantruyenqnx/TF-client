// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@tf/studio-base/context/PlayerSelectionContext";
import TFWebSocketPlayer from "@tf/studio-base/players/TFWebSocketPlayer";
import { Player } from "@tf/studio-base/players/types";

export default class TFWebSocketDataSourceFactory implements IDataSourceFactory {
  public id = "foxglove-websocket";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "TF WebSocket";
  public iconName: IDataSourceFactory["iconName"] = "Flow";
  public description =
    "Connect to a ROS 1, ROS 2, or custom system using the Foxglove WebSocket protocol. For ROS systems, be sure to first install the foxglove_bridge ROS package.";
  public docsLinks = [
    {
      label: "ROS 1",
      url: "#",
    },
    {
      label: "ROS 2",
      url: "#",
    },
    {
      label: "custom data",
      url: "#",
    },
  ];

  public formConfig = {
    fields: [
      {
        id: "url",
        label: "WebSocket URL",
        defaultValue: "ws://localhost:8765",
        validate: (newValue: string): Error | undefined => {
          try {
            const url = new URL(newValue);
            if (url.protocol !== "ws:" && url.protocol !== "wss:") {
              return new Error(`Invalid protocol: ${url.protocol}`);
            }
            return undefined;
          } catch (err) {
            return new Error("Enter a valid url");
          }
        },
      },
    ],
  };

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.params?.url;
    if (!url) {
      return;
    }

    return new TFWebSocketPlayer({
      url,
      metricsCollector: args.metricsCollector,
      sourceId: this.id,
    });
  }
}
