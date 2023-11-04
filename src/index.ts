import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono()
  .use("*", logger())
  .use("*", cors({ origin: "*" }))

  .get("/health", (ctx) => {
    return ctx.json({ ok: true }, 200);
  })

  .use("*", secureHeaders({ crossOriginResourcePolicy: false }))

  .get("/github", async (ctx) => {
    return ctx.body(
      `<svg xmlns="http://www.w3.org/2000/svg" height="1" width="100%"><line x1="0" y1="0" x2="100%" y2="0" stroke="#74b816" stroke-width="1" /></svg>`,
      200,
      {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
      }
    );
  })

  .get("/", (ctx) => ctx.json({ name: "view" }))
  .notFound((ctx) => ctx.json({ message: "Not found" }, 404))
  .onError((error: unknown, ctx) => {
    let status = 500;
    let message = "Internal server error";

    if (error instanceof Error) {
      message = error.message;
    }

    return ctx.json({ message }, status);
  });

export default app;
