import { layoutFilteredBusinesses, type LayoutBatch, type LayoutResult } from "../lib/inspection-layout";

self.onmessage = ({ data }: MessageEvent<LayoutBatch[]>) => {
  let result: LayoutResult;
  try {
    result = { positions: layoutFilteredBusinesses(data) };
  } catch (error) {
    result = { error: error instanceof Error ? error.message : "Could not arrange the filtered graph." };
  }
  self.postMessage(result);
};
