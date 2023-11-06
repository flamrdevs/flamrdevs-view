import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { Redis } from "@upstash/redis/cloudflare";

type Bindings = {
  SECRET: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
};

export interface Env extends Bindings {}

const useRedis = <E extends { Bindings: Bindings }>(ctx: Context<E>) => Redis.fromEnv(ctx.env);

const secret = async (ctx: Context) => {
  const formData = await ctx.req.formData();
  if (ctx.env.SECRET === `${formData.get("secret")}`) return formData;
  throw new Error("Invalid secret");
};

const svg = async (ctx: Context, callback: () => Promise<any>) => {
  let stroke = "#6E6E6E";

  try {
    await callback();
  } catch (error) {
    console.error(error);
    stroke = "#E5484D";
  }

  return ctx.body(
    `<svg xmlns="http://www.w3.org/2000/svg" height="1" width="100%"><line x1="0" y1="0" x2="100%" y2="0" stroke="${stroke}" stroke-width="1" /></svg>`,
    200,
    {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
    }
  );
};
const count = async <E extends { Bindings: Bindings }>(ctx: Context<E>, key: string) => ctx.json(await useRedis(ctx).llen(key));
const list = async <E extends { Bindings: Bindings }>(ctx: Context<E>, key: string) =>
  ctx.json(await useRedis(ctx).lrange<number>(key, 0, -1));
const clear = async <E extends { Bindings: Bindings }>(ctx: Context<E>, key: string) => {
  await secret(ctx);
  return ctx.json({ ok: (await useRedis(ctx).del(key)) > 0 });
};

type HonoEnv = { Bindings: Bindings };

const app = new Hono<HonoEnv>()
  .use("*", logger())
  .use("*", cors({ origin: "*" }))
  .get("/health", (ctx) => ctx.json({ ok: true }, 200))
  .use("*", secureHeaders({ crossOriginResourcePolicy: false }));

app.route(
  "/github",
  (() => {
    const KEY = "github";
    return new Hono<HonoEnv>()
      .get("/", (ctx) => svg(ctx, () => useRedis(ctx).rpush<number>(KEY, Date.now())))
      .get("/count", (ctx) => count(ctx, KEY))
      .get("/list", (ctx) => list(ctx, KEY))
      .delete("/clear", (ctx) => clear(ctx, KEY));
  })()
);

app.route(
  "/gitlab",
  (() => {
    const KEY = "gitlab";
    return new Hono<HonoEnv>()
      .get("/", (ctx) => svg(ctx, () => useRedis(ctx).rpush<number>(KEY, Date.now())))
      .get("/count", (ctx) => count(ctx, KEY))
      .get("/list", (ctx) => list(ctx, KEY))
      .delete("/clear", (ctx) => clear(ctx, KEY));
  })()
);

app
  .get("/", (ctx) => ctx.json({ name: "view" }))
  .notFound((ctx) => ctx.json({ message: "Not found" }, 404))
  .onError((error: unknown, ctx) => {
    let status = 500;
    let message = "Internal server error";
    if (error instanceof Error) message = error.message ?? "Error";
    console.error(message);
    return ctx.json({ message }, status);
  });

export default app;
