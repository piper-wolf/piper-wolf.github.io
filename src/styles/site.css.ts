import { globalStyle, style } from "@vanilla-extract/css";

import { layout } from "./layout";

const contentWidth = `min(100% - 2 * ${layout.gutter}, ${layout.maxWidth})`;
// rem: text and layout rhythm; em: text-relative details; px: crisp borders/focus.
const sectionSpace = "clamp(2rem, 1rem + 4vw, 3.5rem)";
const headingSize = "clamp(2rem, 1.5rem + 2vw, 3rem)";
const touchTarget = "max(44px, 2.75rem)";
const actionLink = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.6em",
  minHeight: touchTarget,
} as const;

export const iconLabel = style({ display: "inline-flex", alignItems: "center", gap: "0.6em" });

export const page = style({
  minHeight: "100svh",
  display: "flex",
  flexDirection: "column",
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
  gap: "0.5rem 1.5rem",
  width: contentWidth,
  margin: "0 auto",
  padding: "1.5rem 0",
  borderBottom: "1px solid #cfd2c8",
  // A 28px mobile visitor needs 25.375px to its feet plus 6px clearance.
  "@media": { "screen and (max-width: 40rem)": { paddingBottom: "2rem" } },
});

export const brand = style({
  ...actionLink,
  color: "#1d2826",
  fontSize: "1.3rem",
  fontWeight: "700",
  letterSpacing: "-0.03em",
  minWidth: 0,
  textDecoration: "none",
});

export const nav = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem 1rem",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.875rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
});

export const navLink = style({
  ...actionLink,
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
  width: contentWidth,
  flex: 1,
  margin: "0 auto",
  paddingBlock: sectionSpace,
});

export const eyebrow = style({
  margin: "0 0 0.3125rem 0",
  color: "#a64128",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  fontWeight: "700",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});

export const intro = style({
  maxWidth: "34rem",
  margin: "1rem 0 0",
  color: "#53635d",
  fontSize: "1rem",
  lineHeight: 1.55,
});

export const feature = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.72fr)",
  alignItems: "start",
  gap: layout.featureGap,
  marginTop: sectionSpace,
  "@media": {
    [`screen and (max-width: ${layout.breakpoint})`]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "1.5rem",
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
  padding: layout.frame,
});

export const caption = style({
  margin: "0.875rem 0 0",
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  lineHeight: 1.5,
});

export const featurePhoto = style({ minWidth: 0, margin: 0 });

export const featureCopy = style({ minWidth: 0, maxWidth: "32rem", alignSelf: "center" });

export const subheading = style({
  margin: "0 0 1rem",
  fontSize: "1.5rem",
  fontWeight: "400",
  letterSpacing: "-0.05em",
  lineHeight: 1.3,
});

export const link = style({
  ...actionLink,
  color: "#a64128",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.875rem",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "0.2em" },
  },
});

export const pageHeader = style({
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  marginBottom: "2rem",
});

export const headerActions = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem 2rem",
});

export const pageTitle = style({
  margin: "0.625rem 0 0",
  fontSize: headingSize,
  fontWeight: "400",
  letterSpacing: "-0.035em",
  lineHeight: 1.15,
});

export const supportLink = style({
  ...actionLink,
  color: "#a64128",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "0.2em" },
  },
});

export const feed = style({
  display: "grid",
  gap: sectionSpace,
});

export const post = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.4fr)",
  alignItems: "start",
  gap: layout.postGap,
  scrollMarginBlockStart: "1.5rem",
  "@media": {
    [`screen and (max-width: ${layout.breakpoint})`]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "1rem",
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
  justifyContent: "flex-start",
  gap: "0.5rem 1rem",
  marginTop: 0,
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
});

export const postDetails = style({ minWidth: 0 });

globalStyle(`${postDetails} ${postMeta}`, {
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.25rem",
  "@media": {
    [`screen and (max-width: ${layout.breakpoint})`]: { flexDirection: "row", alignItems: "center", gap: "0.5rem 1.5rem" },
  },
});

export const postTitle = style({
  margin: 0,
  fontSize: "0.8125rem",
  fontWeight: "400",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
});

export const postTitleLink = style({
  ...actionLink,
  color: "inherit",
  textDecoration: "none",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "0.2em" },
  },
});

export const detailMeta = style({
  justifyContent: "flex-start",
  gap: "2rem",
});

export const postCaption = style({
  maxWidth: "34rem",
  margin: "0.75rem 0 0",
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
  marginBottom: "1.5rem",
  // Frameless photo tops need room above them for the whole visitor.
  "@media": {
    "screen and (max-width: 40rem)": { marginBottom: "2rem" },
    [`screen and (width > 40rem) and (max-width: ${layout.breakpoint}) and (orientation: portrait)`]: {
      marginBottom: "2.75rem",
    },
  },
});

export const detailTitle = style({
  margin: "1.125rem 0 0",
  fontSize: headingSize,
  fontWeight: "400",
  letterSpacing: "-0.035em",
  lineHeight: 1.15,
});

export const backLink = style({
  ...actionLink,
  marginBottom: "1.5rem",
  color: "#a64128",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "0.2em" },
  },
});

export const detailImageFrame = style({
  display: "block",
  width: "fit-content",
  maxWidth: "100%",
  margin: "0 auto",
  background: "#d7d9d0",
  padding: layout.frame,
});

export const mobileEdgeToEdge = style({
  "@media": {
    [`screen and (max-width: ${layout.breakpoint}) and (orientation: portrait)`]: {
      width: `calc(100% + 2 * ${layout.gutter})`,
      maxWidth: "none",
      marginInline: `calc(-1 * ${layout.gutter})`,
      padding: 0,
    },
  },
});

export const detailImage = style({
  display: "block",
  width: "auto",
  height: "auto",
  maxWidth: "100%",
  maxHeight: "80svh",
  objectFit: "contain",
  "@media": {
    [`screen and (max-width: ${layout.breakpoint})`]: {
      maxHeight: "none",
    },
    [`screen and (max-width: ${layout.breakpoint}) and (orientation: portrait)`]: {
      width: "100%",
    },
  },
});

export const feedEnd = style({
  minHeight: "3rem",
  marginTop: sectionSpace,
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
  letterSpacing: "0.1em",
  textAlign: "center",
  textTransform: "uppercase",
});

export const photoDetails = style({
  marginTop: "2rem",
  padding: "clamp(1rem, 0.5rem + 2vw, 2rem)",
  background: "#eeeee5",
  borderTop: "1px solid #cfd2c8",
});

export const postActions = style({
  display: "flex",
  flexWrap: "wrap",
  marginTop: "1.25rem",
});

export const blueskyShareLink = style({
  ...actionLink,
  padding: "0.5rem 1rem",
  border: "1px solid #cfd2c8",
  borderRadius: "0.25rem",
  color: "#1d2826",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.875rem",
  textDecoration: "none",
  selectors: {
    "&:hover": { background: "#eeeee5", borderColor: "#53635d" },
  },
});

export const photoDetailsGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
  gap: "1.5rem 2rem",
  margin: "1.25rem 0 0",
});

globalStyle(`${photoDetailsGrid} dt`, {
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

globalStyle(`${photoDetailsGrid} dd`, {
  margin: "0.25rem 0 0",
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
});

export const skipLink = style({
  ...actionLink,
  position: "absolute",
  top: "1rem",
  left: "1rem",
  zIndex: 1,
  padding: "0.5rem 1rem",
  background: "#f5f3ed",
  color: "#1d2826",
  transform: "translateY(calc(-100% - 2rem))",
  selectors: {
    "&:focus": { transform: "none" },
  },
});

export const footer = style({
  width: contentWidth,
  margin: "0 auto",
  padding: "1.5rem 0",
  borderTop: "1px solid #cfd2c8",
});

export const footerDetails = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "0.5rem 1.5rem",
  marginTop: "0.5rem",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8125rem",
});

globalStyle(`${footerDetails} a`, { color: "#a64128" });

export const copyright = style({
  marginLeft: "auto",
  color: "#697066",
  textAlign: "right",
  "@media": {
    [`screen and (max-width: ${layout.breakpoint})`]: { marginLeft: 0, textAlign: "left", width: "100%" },
  },
});

export const copyrightLink = style({ ...actionLink });

export const footerItem = style({
  ...actionLink,
  minWidth: 0,
});

globalStyle(`${footerItem} svg`, { color: "#a64128" });

export const copyrightContent = style({ maxWidth: "42rem" });
globalStyle(`${copyrightContent} section`, { marginTop: "2rem" });
globalStyle(`${copyrightContent} a`, { color: "#a64128" });

// Inline prose links must stay inline; only navigation/actions get touch boxes.
globalStyle("a", { textUnderlineOffset: "0.2em" });
globalStyle(`${footerDetails} a`, { overflowWrap: "anywhere" });
globalStyle(`${photoDetailsGrid} > div`, { minWidth: 0 });
globalStyle("a:focus-visible", {
  outline: "3px solid #a64128",
  outlineOffset: "4px",
});
