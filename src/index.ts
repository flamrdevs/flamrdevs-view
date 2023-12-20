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

let REDIS: Redis;
const redisFromContext = <E extends { Bindings: Bindings }>(ctx: Context<E>) => (REDIS ??= Redis.fromEnv(ctx.env));

const secret = async (ctx: Context) => {
  const formData = await ctx.req.formData();
  if (ctx.env.SECRET === `${formData.get("secret")}`) return formData;
  throw new Error("Invalid secret");
};

type HonoEnv = { Bindings: Bindings };

const app = new Hono<HonoEnv>()
  .use("*", logger())
  .use("*", cors({ origin: "*" }))
  .get("/health", (ctx) => ctx.json({ ok: true }, 200))
  .use("*", secureHeaders({ crossOriginResourcePolicy: false }));

const profile = <T extends string>(name: T) => {
  app.route(
    `/${name}`,
    (() => {
      const KEY_TOTAL = `${name}/total`;
      const KEY_TIMES = `${name}/times`;
      return new Hono<HonoEnv>()
        .get("/", async (ctx) => {
          const redis = redisFromContext(ctx);
          let stroke = "#6E6E6E";
          try {
            await Promise.all([redis.incr(KEY_TOTAL), redis.lpush<number>(KEY_TIMES, Date.now())]);
          } catch (error) {
            console.error(error);
            stroke = "#E5484D";
          }
          return ctx.body(
            `<svg xmlns="http://www.w3.org/2000/svg" height="1" width="100%"><line x1="0" y1="0" x2="100%" y2="0" stroke="${stroke}" stroke-width="1" /></svg>`,
            200,
            { "Content-Type": "image/svg+xml", "Cache-Control": "max-age=0, no-cache, no-store, must-revalidate" }
          );
        })
        .get("/total", async (ctx) => ctx.json(Number(await redisFromContext(ctx).get<string>(KEY_TOTAL))))
        .get("/times", async (ctx) => ctx.json(await redisFromContext(ctx).lrange<number>(KEY_TIMES, 0, -1)))
        .put("/slice", async (ctx) => {
          await secret(ctx);
          return ctx.json({ ok: (await redisFromContext(ctx).ltrim(KEY_TIMES, 0, 999)) === "OK" });
        })
        .delete("/clear", async (ctx) => {
          await secret(ctx);
          return ctx.json({ ok: (await redisFromContext(ctx).del(KEY_TOTAL, KEY_TIMES)) > 0 });
        });
    })()
  );
};

profile("github");
profile("gitlab");

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
