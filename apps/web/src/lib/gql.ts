import { gql } from "@apollo/client";

export const HELLO = gql`query { hello }`;

export const PR_LIST = gql`
  query {
    prs { id repo number title author createdAt }
  }
`;

export const PR_DETAIL = gql`
  query ($id: ID!) {
    pr(id: $id) {
      id repo number title author headSha baseSha state
      files { id path patch }
      reviewRuns {
        id status provider
        suggestions { id filePath startLine endLine severity message fixPatch }
      }
    }
  }
`;


export const CREATE_PR = gql`
  mutation ($input: CreatePRInput!) {
    createPR(input: $input) {
      id
    }
  }
`;

export const RUN_ANALYSIS = gql`
  mutation ($prId: ID!) {
    runAnalysis(prId: $prId) { id status }
  }
`;