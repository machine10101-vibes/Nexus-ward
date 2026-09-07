import { createHashHistory, createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // Static GitHub hosts (Pages or a raw CDN) are not always at `/`.
  // Hash history keeps the only route (`/`) working from any folder.
  const pages = import.meta.env.BASE_URL === "./" && typeof window !== "undefined";
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    history: pages ? createHashHistory() : undefined,
  });
}
