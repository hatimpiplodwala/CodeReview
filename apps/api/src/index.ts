import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { Queue } from "bullmq";
import { db } from "@repo/db";
import type { PrismaClient } from "@prisma/client";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";

// ----------------- Schema (INLINE) -----------------
const typeDefs = /* GraphQL */ `
  scalar DateTime

  type Suggestion {
    id: ID!
    filePath: String!
    startLine: Int!
    endLine: Int!
    message: String!
    fixPatch: String
    severity: String!
  }

  type PRFile {
    id: ID!
    path: String!
    patch: String!
  }

  type ReviewRun {
    id: ID!
    status: String!
    provider: String
    startedAt: DateTime
    completedAt: DateTime
    suggestions: [Suggestion!]!
  }

  type PullRequest {
    id: ID!
    repo: String!
    number: Int!
    title: String!
    author: String!
    headSha: String!
    baseSha: String!
    state: String!
    createdAt: DateTime!
    files: [PRFile!]!
    reviewRuns: [ReviewRun!]!
  }

  input PRFileInput {
    path: String!
    patch: String!
  }

  input CreatePRInput {
    repo: String!
    number: Int!
    title: String!
    author: String!
    headSha: String!
    baseSha: String!
    files: [PRFileInput!]!
  }

  type Query {
    hello: String!
    prs: [PullRequest!]!
    pr(id: ID!): PullRequest
  }

  type Mutation {
    createPR(input: CreatePRInput!): PullRequest!
    runAnalysis(prId: ID!): ReviewRun!
  }
`;

type Ctx = { db: PrismaClient };

const resolvers = {
  Query: {
    hello: () => "ok",
    prs: (_: unknown, __: unknown, { db }: Ctx) =>
      db.pullRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          files: true,
          reviewRuns: {
            orderBy: { id: "desc" },      
            include: { suggestions: true },
          },
        },
      }),
    
    // inside resolvers.Query.pr
    pr: (_: unknown, { id }: { id: string }, { db }: Ctx) =>
      db.pullRequest.findUnique({
        where: { id },
        include: {
          files: true,
          reviewRuns: {
            orderBy: { id: "desc" },         
            include: { suggestions: true },
          },
        },
      }),
  },

  Mutation: {
    createPR: async (_: unknown, { input }: any, { db }: Ctx) => {
      const { repo, number, title, author, headSha, baseSha, files } = input;
      return db.pullRequest.create({
        data: {
          repo,
          number,
          title,
          author,
          headSha,
          baseSha,
          state: "open",
          files: { create: files.map((f: any) => ({ path: f.path, patch: f.patch })) },
        },
        include: { files: true, reviewRuns: { include: { suggestions: true } } },
      });
    },

    runAnalysis: async (_: unknown, { prId }: { prId: string }, { db }: Ctx) => {
      const run = await db.reviewRun.create({
        data: { prId, status: "queued", provider: "openai" },
        include: { suggestions: true },
      });
      
      const job = await reviewQueue.add(
        "analyze-pr",
        { prId, runId: run.id },
        {
          jobId: run.id,                       // ← de-dupe by run id
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 3600 },
        }
      );
      console.log("[review] enqueued", job.id, "prId=", prId, "runId=", run.id);
      
      return run;
    },
  },
};


// ----------------- Server bootstrap -----------------
const reviewQueue = new Queue("review", {
  connection: { url: process.env.REDIS_URL || "redis://127.0.0.1:6379" },
});


const app = express();
app.use(cors());

const server = new ApolloServer<Ctx>({
  typeDefs,
  resolvers,
  // Enable local landing page with embedded GraphQL Sandbox
  plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
});

await server.start();
app.use(
  "/graphql",
  bodyParser.json(),
  expressMiddleware<Ctx>(server, { context: async () => ({ db }) })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}/graphql`));
