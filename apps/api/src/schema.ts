import { gql } from "graphql-tag";
import type { PrismaClient } from "@prisma/client";

export const typeDefs = gql/* GraphQL */ `
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
  }
`;

type Ctx = { db: PrismaClient };

export const resolvers = {
  Query: {
    hello: () => "ok",
    prs: async (_: unknown, __: unknown, { db }: Ctx) =>
      db.pullRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: { files: true, reviewRuns: { include: { suggestions: true } } },
      }),
    pr: async (_: unknown, { id }: { id: string }, { db }: Ctx) =>
      db.pullRequest.findUnique({
        where: { id },
        include: { files: true, reviewRuns: { include: { suggestions: true } } },
      }),
  },
  Mutation: {
    createPR: async (_: unknown, { input }: any, { db }: Ctx) => {
      const { repo, number, title, author, headSha, baseSha, files } = input;
  
      return db.pullRequest.upsert({
        // 👇 uses the composite unique constraint @@unique([repo, number]) from your Prisma schema
        where: { repo_number: { repo, number } },
        update: {
          title,
          author,
          headSha,
          baseSha,
          state: "open",
          // simplest: replace files set entirely
          files: {
            deleteMany: {}, // remove any existing files for this PR
            create: files.map((f: any) => ({ path: f.path, patch: f.patch })),
          },
        },
        create: {
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
  },
};
