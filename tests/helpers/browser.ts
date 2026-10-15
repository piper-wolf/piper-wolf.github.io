import { test as base, expect, type BrowserContext } from '@playwright/test';

export async function blockExternalRequests(context: BrowserContext, baseURL: string) {
  const origin = new URL(baseURL).origin;
  await context.route(url => url.origin !== origin, route => route.abort());
}

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await blockExternalRequests(context, baseURL!);
    await use(context);
  },
});
export { expect };
