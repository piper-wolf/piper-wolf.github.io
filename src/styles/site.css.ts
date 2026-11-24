import { globalStyle, keyframes, style } from "@vanilla-extract/css";

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
const notFoundBreathing = keyframes({
  "0%, 100%": { transform: "none" },
  "50%": { transform: "scaleY(1.025)" },
});
const notFoundBlink = keyframes({
  "0%, 95%, 98%, 100%": { transform: "scaleY(1)" },
  "97%": { transform: "scaleY(0.12)" },
});
const notFoundLook = keyframes({
  "0%, 22%, 76%, 100%": { transform: "none" },
  "30%, 48%": { transform: "rotate(10deg)" },
  "56%, 70%": { transform: "rotate(-7deg)" },
});
const notFoundPeckBody = keyframes({
  "0%, 8%, 31%, 58%, 100%": { transform: "none" },
  "14%, 24%": { transform: "rotate(18deg)" },
  "39%, 50%": { transform: "rotate(18deg)" },
  "66%, 80%": { transform: "rotate(18deg)" },
});
const notFoundPeckHead = keyframes({
  "0%, 8%, 31%, 58%, 100%": { transform: "none" },
  "14%, 24%": { transform: "translate(-2px, 7px) rotate(32deg)" },
  "39%, 50%": { transform: "translate(-2px, 7px) rotate(32deg)" },
  "66%, 80%": { transform: "translate(-2px, 7px) rotate(32deg)" },
});
const notFoundPeckNeck = keyframes({
  "0%, 8%, 31%, 58%, 100%": { transform: "none" },
  "14%, 24%": { transform: "rotate(25deg) scaleY(0.7)" },
  "39%, 50%": { transform: "rotate(25deg) scaleY(0.7)" },
  "66%, 80%": { transform: "rotate(25deg) scaleY(0.7)" },
});
const notFoundPeckEye = keyframes({
  "0%, 12%, 25%, 37%, 51%, 64%, 82%, 100%": { transform: "scaleY(1)" },
  "17%, 23%, 42%, 49%, 69%, 79%": { transform: "scaleY(0.35)" },
});
const notFoundStretchWing = keyframes({
  "0%, 12%, 82%, 100%": { transform: "none" },
  "25%, 70%": { transform: "rotate(22deg) scaleX(1.12)" },
});
const notFoundStretchFoot = keyframes({
  "0%, 12%, 82%, 100%": { transform: "none" },
  "25%, 70%": { transform: "translate(-12px, -2px) rotate(32deg) scaleY(1.15)" },
});
const notFoundStretchTail = keyframes({
  "0%, 12%, 82%, 100%": { transform: "none" },
  "25%, 70%": { transform: "rotate(-9deg)" },
});
const notFoundPreenHead = keyframes({
  "0%, 12%, 31%, 52%, 72%, 100%": { transform: "none" },
  "18%, 26%": { transform: "translate(-3px, -1px) rotate(110deg)" },
  "38%, 46%": { transform: "translate(-3px, -1px) rotate(110deg)" },
  "60%, 67%": { transform: "translate(-3px, -1px) rotate(110deg)" },
});
const notFoundPreenNeck = keyframes({
  "0%, 12%, 31%, 52%, 72%, 100%": { transform: "none" },
  "18%, 26%": { transform: "rotate(25deg) scaleY(0.7)" },
  "38%, 46%": { transform: "rotate(25deg) scaleY(0.7)" },
  "60%, 67%": { transform: "rotate(25deg) scaleY(0.7)" },
});
const notFoundPreenWing = keyframes({
  "0%, 12%, 31%, 52%, 72%, 100%": { transform: "none" },
  "18%, 26%": { transform: "rotate(8deg)" },
  "38%, 46%": { transform: "rotate(8deg)" },
  "60%, 67%": { transform: "rotate(8deg)" },
});
const notFoundRuffleBody = keyframes({
  "0%, 18%, 100%": { transform: "none" },
  "30%": { transform: "scale(1.07, 1.05)" },
  "46%": { transform: "scale(1.02, 1.01)" },
  "62%": { transform: "scale(1.06, 1.04)" },
});
const notFoundRuffleWing = keyframes({
  "0%, 18%, 100%": { transform: "none" },
  "30%": { transform: "rotate(6deg)" },
  "46%": { transform: "rotate(-3deg)" },
  "62%": { transform: "rotate(4deg)" },
});
const notFoundRuffleTail = keyframes({
  "0%, 18%, 100%": { transform: "none" },
  "30%": { transform: "rotate(-8deg)" },
  "46%": { transform: "rotate(6deg)" },
  "62%": { transform: "rotate(-4deg)" },
});

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

export const notFound = style({
  maxWidth: "74rem",
  margin: "0 auto",
});

export const notFoundArt = style({
  position: "relative",
  display: "grid",
  placeItems: "center",
  minHeight: "clamp(17rem, 43svh, 29rem)",
  marginBottom: "clamp(1.5rem, 4vw, 3rem)",
  overflow: "hidden",
  background: "#eeeee5",
  borderBlock: "1px solid #cfd2c8",
});

export const notFoundCode = style({
  margin: 0,
  color: "#1d2826",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "clamp(8rem, 37vw, 35rem)",
  fontWeight: "900",
  letterSpacing: "-0.09em",
  lineHeight: 0.8,
  whiteSpace: "nowrap",
});

export const notFoundPigeon = style({
  position: "absolute",
  top: "36%",
  left: "42%",
  zIndex: 1,
  overflow: "visible",
  transform: "translateX(-50%) rotate(-5deg)",
  "@media": {
    [`screen and (max-width: ${layout.breakpoint})`]: { top: "8%", left: "61%" },
  },
});

globalStyle(`${notFoundPigeon} .pigeon-body`, { transformBox: "view-box", transformOrigin: "88px 108px" });
globalStyle(`${notFoundPigeon} .pigeon-tail`, { transformBox: "view-box", transformOrigin: "32px 101px" });
globalStyle(`${notFoundPigeon} .pigeon-wing`, { transformBox: "view-box", transformOrigin: "76px 91px" });
globalStyle(`${notFoundPigeon} .pigeon-neck`, { transformBox: "view-box", transformOrigin: "111px 76px" });
globalStyle(`${notFoundPigeon} .pigeon-head`, { transformBox: "view-box", transformOrigin: "132px 49px" });
globalStyle(`${notFoundPigeon} .pigeon-eye`, { transformBox: "view-box", transformOrigin: "139px 43px" });
globalStyle(`${notFoundPigeon} .pigeon-foot-front`, { transformBox: "view-box", transformOrigin: "104px 113px" });
globalStyle(`${notFoundPigeon} .pigeon-foot-back`, { transformBox: "view-box", transformOrigin: "76px 115px" });
globalStyle(`${notFoundPigeon} .pigeon-breath`, {
  transformBox: "view-box",
  transformOrigin: "88px 108px",
  animation: `${notFoundBreathing} 4s ease-in-out infinite`,
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } },
});
globalStyle(`${notFoundPigeon} .pigeon-blink`, {
  transformBox: "view-box",
  transformOrigin: "139px 43px",
  animation: `${notFoundBlink} 7s linear infinite`,
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } },
});
globalStyle(`${notFoundPigeon}[data-idle="look"] .pigeon-head`, { animation: `${notFoundLook} 1.6s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="peck"] .pigeon-body`, { animation: `${notFoundPeckBody} 1.9s linear both` });
globalStyle(`${notFoundPigeon}[data-idle="peck"] .pigeon-head`, { animation: `${notFoundPeckHead} 1.9s linear both` });
globalStyle(`${notFoundPigeon}[data-idle="peck"] .pigeon-neck`, { animation: `${notFoundPeckNeck} 1.9s linear both` });
globalStyle(`${notFoundPigeon}[data-idle="peck"] .pigeon-eye`, { animation: `${notFoundPeckEye} 1.9s linear both` });
globalStyle(`${notFoundPigeon}[data-idle="stretch"] .pigeon-wing`, { animation: `${notFoundStretchWing} 2s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="stretch"] .pigeon-foot-front`, { animation: `${notFoundStretchFoot} 2s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="stretch"] .pigeon-tail`, { animation: `${notFoundStretchTail} 2s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="preen"] .pigeon-head`, { animation: `${notFoundPreenHead} 2.5s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="preen"] .pigeon-neck`, { animation: `${notFoundPreenNeck} 2.5s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="preen"] .pigeon-wing`, { animation: `${notFoundPreenWing} 2.5s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="ruffle"] .pigeon-body`, { animation: `${notFoundRuffleBody} 1.3s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="ruffle"] .pigeon-wing`, { animation: `${notFoundRuffleWing} 1.3s ease-in-out both` });
globalStyle(`${notFoundPigeon}[data-idle="ruffle"] .pigeon-tail`, { animation: `${notFoundRuffleTail} 1.3s ease-in-out both` });

export const notFoundHeader = style({
  textAlign: "center",
});

export const notFoundTitle = style({
  margin: "0.25rem 0 0",
  fontSize: headingSize,
  fontWeight: "400",
  letterSpacing: "-0.035em",
  lineHeight: 1.15,
});

export const notFoundIntro = style({
  maxWidth: "34rem",
  margin: "0.75rem auto 0",
  color: "#53635d",
  fontSize: "1rem",
  lineHeight: 1.55,
});

export const notFoundActions = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "0.5rem 1.5rem",
  marginTop: "1rem",
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
