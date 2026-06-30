// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "gzweb" {
  import { Observable } from "rxjs";

  export interface SceneManagerConfig {
    elementId?: string;
    websocketUrl?: string;
    websocketKey?: string;
    audioTopic?: string;
    topicName?: string;
    msgType?: string;
    msgData?: unknown;
    enableLights?: boolean;
  }

  export type TopicCb = (msg: any) => void;

  export class Topic {
    name: string;
    cb: TopicCb;
    unsubscribe?(): any;
    constructor(name: string, cb: TopicCb);
  }

  export class SceneManager {
    constructor(config?: SceneManagerConfig);
    disconnect(): void;
    resize(): void;
    resetView(): void;
    setCameraView(direction: 'top' | 'front' | 'side'): void;
    toggleGrid(): boolean;
    toggleOrtho(): boolean;
    snapshot(): void;
    select(name: string): void;
    follow(name: string | null): void;
    moveTo(name: string): void;
    thirdPersonFollow(name: string): void;
    firstPerson(name: string): void;
    getConnectionStatusAsObservable(): Observable<boolean>;
    getConnectionStatus(): string;
    getModels(): unknown[];
    subscribeToTopic(topic: Topic): void;
    unsubscribeFromTopic(name: string): void;
    subscribeToCameraFeed(topic: string, onFrame: (pngBytes: Uint8Array) => void): void;
    play(): void;
    pause(): void;
    step(steps?: number): void;
    reset(): void;
    stop(): void;
    spawnModel(sdfString: string, pose?: { x: number; y: number; z: number }): void;
    spawnModelByUri(uri: string, name: string): void;
    removeModel(name: string): void;
    publish(): void;
    onModelSelect: ((name: string | null) => void) | null;
  }
}
