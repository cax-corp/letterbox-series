import { test as base } from "@playwright/test";
export * from "@playwright/test";
type Row = { key: string; payload: unknown; updated_at: string };
export const test = base.extend<{
  privateState: Map<string, Row>;
  privateWrites: Row[][];
}>({
  privateState: async ({}, use) => {
    await use(new Map());
  },
  privateWrites: async ({}, use) => {
    await use([]);
  },
  page: async ({ page, privateState, privateWrites }, use) => {
    await page.route("**/rest/v1/vela_private_state?**", (route) =>
      route.fulfill({ json: [...privateState.values()] }),
    );
    await page.route("**/rest/v1/rpc/vela_merge_private_state", (route) => {
      const rows = route.request().postDataJSON().items as Row[];
      privateWrites.push(rows);
      for (const row of rows) {
        const old = privateState.get(row.key);
        if (!old || Date.parse(row.updated_at) > Date.parse(old.updated_at))
          privateState.set(row.key, row);
      }
      return route.fulfill({ json: [...privateState.values()] });
    });
    await use(page);
  },
});
