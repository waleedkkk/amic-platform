import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("ملفات PWA", () => {
  it("يعلن manifest عن الهوية الداكنة والأيقونات المطلوبة", () => {
    const manifest = JSON.parse(readFileSync(resolve(projectRoot, "client/public/manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      short_name: "AMIC",
      display: "standalone",
      orientation: "portrait",
      theme_color: "#050910",
      background_color: "#050910",
    });
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/pwa-icon-192.svg", sizes: "192x192" }),
      expect.objectContaining({ src: "/pwa-icon-512.svg", sizes: "512x512" }),
    ]));
  });

  it("يربط صفحة التطبيق تعريف PWA ويسجل عامل الخدمة", () => {
    const indexHtml = readFileSync(resolve(projectRoot, "client/index.html"), "utf8");
    const serviceWorker = readFileSync(resolve(projectRoot, "client/public/service-worker.js"), "utf8");
    expect(indexHtml).toContain('rel="manifest" href="/manifest.json"');
    expect(indexHtml).toContain('serviceWorker.register("/service-worker.js")');
    expect(serviceWorker).toContain('url.pathname.startsWith("/api/")');
  });
});
