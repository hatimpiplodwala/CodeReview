-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PullRequest" (
    "id" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "baseSha" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PRFile" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "patch" TEXT NOT NULL,

    CONSTRAINT "PRFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewRun" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "provider" TEXT,
    "userId" TEXT,

    CONSTRAINT "ReviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Suggestion" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "fixPatch" TEXT,
    "severity" TEXT NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "public"."User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_repo_number_key" ON "public"."PullRequest"("repo", "number");

-- AddForeignKey
ALTER TABLE "public"."PRFile" ADD CONSTRAINT "PRFile_prId_fkey" FOREIGN KEY ("prId") REFERENCES "public"."PullRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewRun" ADD CONSTRAINT "ReviewRun_prId_fkey" FOREIGN KEY ("prId") REFERENCES "public"."PullRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewRun" ADD CONSTRAINT "ReviewRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Suggestion" ADD CONSTRAINT "Suggestion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."ReviewRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
