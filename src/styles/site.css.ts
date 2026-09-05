import { globalStyle, style } from "@vanilla-extract/css";

export const page = style({
  minHeight: "100vh",
  background: "#f5f3ed",
  color: "#1d2826",
  fontFamily: "Georgia, 'Times New Roman', serif",
});

export const box = style({ boxSizing: "border-box" });

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "32px",
  width: "min(100% - 48px, 74rem)",
  margin: "0 auto",
  padding: "24px 0",
  borderBottom: "1px solid #cfd2c8",
});

export const brand = style({
  color: "#1d2826",
  fontSize: "1.3rem",
  fontWeight: "700",
  letterSpacing: "-0.03em",
  textDecoration: "none",
});

export const nav = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "20px",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.75rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
});

export const navLink = style({
  color: "#53635d",
  textDecoration: "none",
  transition: "color 160ms ease",
  selectors: {
    "&:hover": { color: "#c25135" },
    "&[aria-current='page']": { color: "#1d2826", fontWeight: "700" },
    "&:focus-visible": { outline: "2px solid #c25135", outlineOffset: "4px" },
  },
});

export const main = style({
  width: "min(100% - 48px, 74rem)",
  margin: "0 auto",
  padding: "32px 0 56px",
});

export const eyebrow = style({
  margin: "0 0 5px 0",
  color: "#c25135",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.72rem",
  fontWeight: "700",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});

export const heading = style({
  maxWidth: "32rem",
  margin: "10px 0 24px",
  fontSize: "2rem",
  fontWeight: "400",
  letterSpacing: "-0.075em",
  lineHeight: "0.88",
});

export const intro = style({
  maxWidth: "34rem",
  margin: 0,
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
    "screen and (max-width: 700px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const image = style({
  display: "block",
  width: "100%",
  height: "auto",
  transition: "transform 220ms ease",
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
  fontSize: "0.76rem",
  lineHeight: 1.5,
});

export const featureCopy = style({ maxWidth: "23rem" });

export const subheading = style({
  margin: "0 0 16px",
  fontSize: "1.5rem",
  fontWeight: "400",
  letterSpacing: "-0.05em",
  lineHeight: 1,
});

export const text = style({
  margin: 0,
  color: "#53635d",
  fontSize: "1.05rem",
  lineHeight: 1.7,
});

export const link = style({
  display: "inline-block",
  marginTop: "24px",
  color: "#c25135",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.8rem",
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
    "screen and (max-width: 700px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const pageTitle = style({
  margin: "10px 0 0",
  fontSize: "2rem",
  fontWeight: "400",
  letterSpacing: "-0.075em",
  lineHeight: 0.88,
});

export const supportLink = style({
  justifySelf: "end",
  color: "#c25135",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.72rem",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "4px" },
    "&:focus-visible": { outline: "2px solid #c25135", outlineOffset: "4px" },
  },
  "@media": {
    "screen and (max-width: 700px)": {
      justifySelf: "start",
    },
  },
});

export const feed = style({
  display: "grid",
  gap: "56px",
  "@media": {
    "screen and (max-width: 700px)": {
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
    "screen and (max-width: 700px)": {
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
  selectors: {
    "&:focus-visible": { outline: "2px solid #c25135", outlineOffset: "5px" },
  },
});

globalStyle(`${imageButton}:hover ${image}`, { transform: "scale(1.015)" });

export const postMeta = style({
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  marginTop: 0,
  color: "#53635d",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
});

export const postDetails = style({ minWidth: 0 });

export const postTitle = style({
  margin: 0,
  fontSize: "0.72rem",
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
  letterSpacing: "-0.075em",
  lineHeight: 0.95,
});

export const backLink = style({
  display: "inline-block",
  marginBottom: "24px",
  color: "#c25135",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { textDecoration: "underline", textUnderlineOffset: "4px" },
    "&:focus-visible": { outline: "2px solid #c25135", outlineOffset: "4px" },
  },
});

export const detailImageFrame = style({
  display: "block",
  width: "fit-content",
  maxWidth: "90vw",
  marginLeft: "50%",
  transform: "translateX(-50%)",
  background: "#d7d9d0",
  padding: "12px",
  "@media": {
    "screen and (max-width: 700px)": {
      maxWidth: "100%",
      marginLeft: 0,
      transform: "none",
    },
  },
});

export const detailImage = style({
  display: "block",
  width: "auto",
  height: "auto",
  maxWidth: "calc(90vw - 24px)",
  maxHeight: "calc(80vh - 24px)",
  objectFit: "contain",
  "@media": {
    "screen and (max-width: 700px)": {
      maxWidth: "calc(100vw - 72px)",
    },
  },
});

export const feedEnd = style({
  minHeight: "3rem",
  marginTop: "56px",
  color: "#8b958e",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "0.72rem",
  letterSpacing: "0.1em",
  textAlign: "center",
  textTransform: "uppercase",
});

globalStyle("*", { boxSizing: "border-box" });
globalStyle("body", { margin: 0 });
globalStyle("::selection", { background: "#e6b39b", color: "#1d2826" });
