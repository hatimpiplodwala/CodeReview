import "dotenv/config";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema";
import { db } from "@repo/db";
import { Queue } from "bullmq";

type Ctx = { db: typeof db };

const connection = { url: process.env.REDIS_URL || "redis://127.0.0.1:6379" };
const reviewQueue = new Queue("review", { connection });

const resolvers = {
  Query: {
    hello: () => "ok",

    prs: (_: unknown, __: unknown, { db }: Ctx) =>
      db.pullRequest.findMany({
        include: {
          files: true,
          reviewRuns: {
            include: { suggestions: true },
            orderBy: { id: "desc" },
          },
        },
        orderBy: { id: "desc" },
      }),

    pr: (_: unknown, { id }: { id: string }, { db }: Ctx) =>
      db.pullRequest.findUnique({
        where: { id },
        include: {
          files: true,
          reviewRuns: {
            include: { suggestions: true },
            orderBy: { id: "desc" },
          },
        },
      }),
  },

  Mutation: {
    createPR: async (_: unknown, { input }: any, { db }: Ctx) => {
      const { repo, number, title, author, headSha, baseSha, files } = input;
      return db.pullRequest.create({
        data: {
          repo: String(repo),
          number: Number(number),
          title: String(title),
          author: String(author),
          headSha: String(headSha),
          baseSha: String(baseSha),
          state: "open",
          files: {
            create: (files as Array<{ path: string; patch: string }>).map((f) => ({
              path: String(f.path),
              patch: String(f.patch ?? ""),
            })),
          },
        },
        include: { files: true, reviewRuns: { include: { suggestions: true } } },
      });
    },

    // Use the module-scoped reviewQueue instead of queues from context
    runAnalysis: async (
      _: unknown,
      { prId, model }: { prId: string; model?: string },
      { db }: Ctx
    ) => {
      const run = await db.reviewRun.create({
        data: { prId, status: "queued", provider: "ollama" },
      });

      await reviewQueue.add(
        "review",
        { prId, runId: run.id, model },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 3600 },
        }
      );

      return run;
    },
  },
};

const server = new ApolloServer<Ctx>({ typeDefs, resolvers });

startStandaloneServer(server, {
  listen: { port: Number(process.env.PORT || 4000) },
  context: async (): Promise<Ctx> => ({ db }),
}).then(({ url }) => console.log(`API at ${url}`));
