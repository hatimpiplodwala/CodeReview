"use client";

import { ReactNode } from "react";
import { ApolloClient, InMemoryCache, HttpLink, ApolloProvider } from "@apollo/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/graphql";

const client = new ApolloClient({
  link: new HttpLink({ uri: API_URL }),
  cache: new InMemoryCache(),
});

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
