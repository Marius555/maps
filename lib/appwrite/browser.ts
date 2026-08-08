"use client";

import { Account, Client } from "appwrite";

import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "./config";

/**
 * Browser Appwrite client — public endpoint and project id only, never a key.
 *
 * Unused in Week 1: the dashboard talks to our own REST API, which holds the
 * session cookie. This exists so that when realtime or direct file uploads
 * arrive, there is an obvious right place for them instead of an improvised one.
 */
export function createBrowserClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

  return { client, account: new Account(client) };
}
