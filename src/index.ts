import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono()
  .use("*", logger())
  .use("*", cors({ origin: "*" }))

  .get("/health", (ctx) => {
    console.log({ url: ctx.req.url });
    return ctx.json({ ok: true }, 200);
  })

  .use("*", secureHeaders())

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
