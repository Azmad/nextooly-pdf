/*
 * Nextooly – Online PDF Tools
 * Copyright (C) 2025 Nextooly
 *
 * This file is part of the Nextooly PDF Tools project.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

let mupdfInitPromise: Promise<any> | null = null;

export function loadMuPDF(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MuPDF can only be loaded in the browser."));
  }

  if (mupdfInitPromise) return mupdfInitPromise;

  mupdfInitPromise = (async () => {
    const mupdf: any = await import("mupdf");

    const wasmUrl = "/wasm/mupdf.wasm";

    if (typeof mupdf.default === "function") {
      return await mupdf.default({
        locateFile: (path: string) =>
          path.endsWith(".wasm") ? wasmUrl : path,
      });
    }

    return mupdf;
  })();

  return mupdfInitPromise;
}
