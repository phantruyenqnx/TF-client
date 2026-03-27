// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "@tf/wasm-zstd" {
  export const isLoaded: Promise<boolean>;
  export function compressBound(size: number): number;
  export function compress(buffer: Uint8Array, compressionLevel?: number): Buffer;
  export function decompress(buffer: Uint8Array, size: number): Buffer;
}
