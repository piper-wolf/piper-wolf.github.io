import { globalStyle, style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  background: "#f5f3ed",
  color: "#1d2826",
  fontFamily: "Georgia, 'Times New Roman', serif",
  lineHeight: 1.6,
  overflowWrap: "anywhere",
});

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px 24px",
  width: "min(100% - 2 * clamp(1rem, 4vw, 1.5rem), 74rem)",
  margin: "0 auto",
  padding: "24px 0",
  borderBottom: "1px solid #cfd2c8",
});

export const brand = style({
  color: "#1d2826",
  fontSize: "1.3rem",
  fontWeight: "700",
  letterSpacing: "-0.03em",
  whiteSpace: "nowrap",
  textDecoration: "none",
});

export const nav = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 16px",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.875rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
});

export const navLink = style({
  color: "#53635d",
  textDecoration: "none",
  transition: "color 160ms ease",
  "@media": { "(prefers-reduced-motion: reduce)": { transition: "none" } },
  selectors: {
    "&:hover": { color: "#a64128" },
    "&[aria-current]": { color: "#1d2826", fontWeight: "700", textDecoration: "underline" },
  },
});

export const main = style({
  width: "min(100% - 2 * clamp(1rem, 4vw, 1.5rem), 74rem)",
  margin: "0 auto",
  padding: "32px 0 56px",
});

export const eyebrow = style({
  margin: "0 0 5px 0",
  color: "#a64128",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  fontWeight: "700",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});

export const intro = style({
  maxWidth: "34rem",
  margin: "16px 0 0",
  color: "#53635d",
  fontSize: "1rem",
  lineHeight: 1.55,
});

export const feature = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(16rem, 0.72fr)",
  alignItems: "start",
  gap: "48px",
  marginTop: "40px",
  "@media": {
    "screen and (max-width: 48rem)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "24px",
    },
  },
});

export const image = style({
  display: "block",
  width: "100%",
  height: "auto",
  transition: "transform 220ms ease",
  "@media": { "(prefers-reduced-motion: reduce)": { transition: "none" } },
});

export const imageFrame = style({
  display: "block",
  position: "relative",
  width: "100%",
  overflow: "hidden",
  background: "#d7d9d0",
  padding: "10px",
});

export const caption = style({
  marginTop: "14px",
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  lineHeight: 1.5,
});

export const featureCopy = style({ maxWidth: "23rem" });

export const subheading = style({
  margin: "0 0 16px",
  fontSize: "1.5rem",
  fontWeight: "400",
  letterSpacing: "-0.05em",
  lineHeight: 1.3,
});

export const link = style({
  display: "inline-block",
  marginTop: "24px",
  color: "#a64128",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.875rem",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "4px" },
  },
});

export const pageHeader = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(14rem, 0.65fr)",
  alignItems: "start",
  gap: "32px",
  marginBottom: "32px",
  "@media": {
    "screen and (max-width: 48rem)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const pageTitle = style({
  margin: "10px 0 0",
  fontSize: "2rem",
  fontWeight: "400",
  letterSpacing: "-0.035em",
  lineHeight: 1.15,
});

export const supportLink = style({
  justifySelf: "end",
  color: "#a64128",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "4px" },
  },
  "@media": {
    "screen and (max-width: 48rem)": {
      justifySelf: "start",
    },
  },
});

export const feed = style({
  display: "grid",
  gap: "56px",
  "@media": {
    "screen and (max-width: 48rem)": {
      gap: "40px",
    },
  },
});

export const post = style({
  maxWidth: "none",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(9rem, 0.28fr)",
  alignItems: "start",
  gap: "24px",
  "@media": {
    "screen and (max-width: 48rem)": {
      gridTemplateColumns: "1fr",
      gap: "16px",
    },
  },
});

export const postPhoto = style({ minWidth: 0 });

export const imageButton = style({
  display: "block",
  width: "100%",
  padding: 0,
  color: "inherit",
  textDecoration: "none",
  cursor: "pointer",
});

globalStyle(`${imageButton}:hover ${image}`, {
  "@media": {
    "(hover: hover) and (prefers-reduced-motion: no-preference)": {
      transform: "scale(1.015)",
    },
  },
});

export const postMeta = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: "8px 16px",
  marginTop: 0,
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
});

export const postDetails = style({ minWidth: 0 });

export const postTitle = style({
  margin: 0,
  fontSize: "0.8125rem",
  fontWeight: "400",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
});

export const postTitleLink = style({
  color: "inherit",
  textDecoration: "none",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "3px" },
  },
});

export const detailMeta = style({
  justifyContent: "flex-start",
  gap: "32px",
});

export const postCaption = style({
  maxWidth: "34rem",
  margin: "12px 0 0",
  color: "#53635d",
  fontSize: "1rem",
  lineHeight: 1.6,
});

export const detailPage = style({
  maxWidth: "74rem",
  margin: "0 auto",
});

export const detailHeader = style({
  maxWidth: "42rem",
  marginBottom: "24px",
});

export const detailTitle = style({
  margin: "18px 0 0",
  fontSize: "2rem",
  fontWeight: "400",
  letterSpacing: "-0.035em",
  lineHeight: 1.15,
});

export const backLink = style({
  display: "inline-block",
  marginBottom: "24px",
  color: "#a64128",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "4px" },
  },
});

export const detailImageFrame = style({
  display: "block",
  width: "fit-content",
  maxWidth: "100%",
  margin: "0 auto",
  background: "#d7d9d0",
  padding: "10px",
});

export const detailImage = style({
  display: "block",
  width: "auto",
  height: "auto",
  maxWidth: "100%",
  maxHeight: "80svh",
  objectFit: "contain",
  "@media": {
    "screen and (max-width: 48rem)": {
      maxHeight: "none",
    },
  },
});

export const feedEnd = style({
  minHeight: "3rem",
  marginTop: "56px",
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  letterSpacing: "0.1em",
  textAlign: "center",
  textTransform: "uppercase",
});

export const photoDetails = style({
  marginTop: "32px",
  padding: "24px clamp(16px, 3vw, 32px)",
  background: "#eeeee5",
  borderTop: "1px solid #cfd2c8",
});

export const photoDetailsGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
  gap: "24px 32px",
  margin: "20px 0 0",
});

globalStyle(`${photoDetailsGrid} dt`, {
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

globalStyle(`${photoDetailsGrid} dd`, {
  margin: "4px 0 0",
  fontSize: "1rem",
  fontVariantNumeric: "tabular-nums",
});

export const captureTimezone = style({
  display: "block",
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.75rem",
});

globalStyle("*, *::before, *::after", { boxSizing: "border-box" });
globalStyle("body", { margin: 0 });
globalStyle("::selection", { background: "#e6b39b", color: "#1d2826" });

export const homeHeader = style({
  maxWidth: "42rem",
  marginBottom: "32px",
});

export const skipLink = style({
  position: "absolute",
  top: "1rem",
  left: "1rem",
  zIndex: 1,
  padding: "8px 16px",
  background: "#f5f3ed",
  color: "#1d2826",
  transform: "translateY(calc(-100% - 2rem))",
  selectors: {
    "&:focus": { transform: "none" },
  },
});

export const footer = style({
  width: "min(100% - 2 * clamp(1rem, 4vw, 1.5rem), 74rem)",
  margin: "0 auto",
  padding: "24px 0",
  borderTop: "1px solid #cfd2c8",
});

globalStyle("a", {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  textUnderlineOffset: "4px",
});
globalStyle("a:focus-visible", {
  outline: "3px solid #a64128",
  outlineOffset: "4px",
});
