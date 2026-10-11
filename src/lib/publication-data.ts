import Ajv from "ajv/dist/2020.js";
import schema from "../data/publication.schema.json" with { type: "json" };

export interface PublishedPhotoRecord {
  image: string;
  number: string;
  title: string;
  queueId?: string;
  alt: string;
  date: string;
  dateTime: string;
  caption: string;
}

export interface PublicationData {
  schemaVersion: 1;
  photos: PublishedPhotoRecord[];
}

const ajv = new Ajv({ allErrors: true });
ajv.addFormat("date", (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const validate = ajv.compile<PublicationData>(schema);

export function readPublicationData(value: unknown): PublicationData {
  if (!validate(value)) throw new Error(`Invalid publication data: ${ajv.errorsText(validate.errors)}`);
  const numbers = new Set<string>();
  const ids = new Set<string>();
  for (const row of value.photos) {
    const number = Number(row.number);
    if (!Number.isSafeInteger(number) || number < 1 || String(number).padStart(3, "0") !== row.number || numbers.has(row.number)) {
      throw new Error("Invalid or duplicate permanent photo number.");
    }
    numbers.add(row.number);
    if (row.queueId) {
      if (ids.has(row.queueId)) throw new Error("Duplicate publication queue ID.");
      ids.add(row.queueId);
    }
  }
  return value;
}
