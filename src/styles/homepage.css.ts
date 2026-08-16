import { style } from "@vanilla-extract/css";

export const boxSizing = style({
  boxSizing: "border-box",
});

export const body = style([
  boxSizing,
  {
    margin: 0,
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "system-ui, sans-serif",
  },
]);

export const image = style([
  boxSizing,
  {
    width: "100%",
  },
]);
