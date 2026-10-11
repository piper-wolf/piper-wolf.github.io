import { expect, test } from "@playwright/test";
import published from "../src/data/pigeons.json" with { type: "json" };
import { readPublicationData } from "../src/lib/publication-data";

test("versioned publication data rejects malformed or conflicting records", () => {
  expect(readPublicationData(published).photos).toHaveLength(published.photos.length);
  const badVersion = structuredClone(published);
  badVersion.schemaVersion = 2;
  expect(() => readPublicationData(badVersion)).toThrow(/Invalid publication data/);
  for (const [field, value] of [["image", "../draft.jpg"], ["dateTime", "2026-02-30"], ["number", "000"]]) {
    const data = structuredClone(published);
    Object.assign(data.photos[0], { [field]: value });
    expect(() => readPublicationData(data)).toThrow();
  }
  const duplicate = structuredClone(published);
  duplicate.photos.push(structuredClone(duplicate.photos[0]));
  expect(() => readPublicationData(duplicate)).toThrow(/duplicate permanent photo number/i);
  duplicate.photos.at(-1)!.number = "999";
  expect(() => readPublicationData(duplicate)).toThrow(/Duplicate publication queue ID/);
});
