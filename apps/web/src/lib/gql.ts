import { gql } from "@apollo/client";

export const CREATE_PR = gql`
  mutation CreatePR($input: CreatePRInput!) {
    createPR(input: $input) {
      id
    }
  }
`;

export const PR_LIST = gql`
  query PRs {
    prs {
      id
      repo
      number
      title
      author
      headSha
      baseSha
      state
    }
  }
`;

export const PR_DETAIL = gql`
  query PR($id: ID!) {
    pr(id: $id) {
      id
      repo
      number
      title
      author
      headSha
      baseSha
      state
      files { id path patch }
      reviewRuns {
        id
        status
        provider
        suggestions {
          id
          filePath
          startLine
          endLine
          severity
          message
          fixPatch
        }
      }
    }
  }
`;

export const RUN_ANALYSIS = gql`
  mutation RunAnalysis($prId: ID!, $model: String) {
    runAnalysis(prId: $prId, model: $model) {
      id
      status
    }
  }
`;
