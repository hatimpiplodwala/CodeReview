# CodeReview

**CodeReview** is an AI-powered code review platform that analyzes pull request diffs and generates actionable feedback with fix suggestions.

## Features
- Analyze **PR diffs** and highlight issues directly in code context  
- **AI-powered review runs** with support for multiple LLMs via [Ollama](https://ollama.ai/)  
- Inline **severity-based suggestions** (`info`, `warn`, `error`, `security`)  
- **Fix patches** with preview, copy-to-clipboard, and `.patch` download options  
- Background job processing with **BullMQ + Redis** for scalable AI inference  
- Modern UI with **Next.js + TailwindCSS** for clean diff visualization  

## Tech Stack
- **Frontend:** Next.js, React, TailwindCSS, Apollo Client  
- **Backend API:** Apollo GraphQL, Node.js, BullMQ workers  
- **Database:** PostgreSQL with Prisma ORM  
- **Infrastructure:** Redis for job queues, Docker for local dev  
- **AI Models:** Ollama (configurable — Qwen, Mistral, CodeLlama, etc.)  

## What This Project Demonstrates
- Full-stack development in a **monorepo** using `pnpm`  
- Designing and consuming **GraphQL APIs** with Apollo  
- Database modeling and migrations using **Prisma + PostgreSQL**  
- Scalable background job handling with **BullMQ/Redis**  
- Integrating **LLM inference into production-style workflows**  
- Building a responsive **diff-based code review UI** in Next.js  
