/* @ds-bundle: {"format":3,"namespace":"IngrydPorDentroDesignSystem_019e0c","components":[],"sourceHashes":{"ui_kits/social/components.jsx":"be3644aa1bb4"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.IngrydPorDentroDesignSystem_019e0c = window.IngrydPorDentroDesignSystem_019e0c || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/social/components.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Carousel components — typed at the 1080×1350 design size, scaled to fit. */

const {
  useState,
  useEffect,
  useRef
} = React;

/* ─── shared ────────────────────────────────────────────── */
const FRAME_W = 1080;
const FRAME_H_CAR = 1350;
const FRAME_H_STORY = 1920;

/* A scaled stage: the kit's components draw at native pixel sizes, the
   stage scales them down so a 1080-wide frame fits inside a 360-wide preview. */
function ScaledStage({
  width,
  height,
  scale,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: width * scale,
      height: height * scale,
      position: "relative",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      position: "absolute",
      top: 0,
      left: 0
    }
  }, children));
}

/* ─── carousel frame ─────────────────────────────────────── */
function CarouselFrame({
  photo,
  washOpacity = 0.45,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: FRAME_W,
      height: FRAME_H_CAR,
      position: "relative",
      overflow: "hidden",
      background: photo || "linear-gradient(135deg, #2a1f18 0%, #4a3424 100%)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: `rgba(28,22,20,${washOpacity})`,
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: `radial-gradient(rgba(244,231,206,0.06) 1px, transparent 1px), radial-gradient(rgba(28,22,20,0.05) 1px, transparent 1px)`,
      backgroundSize: "3px 3px, 5px 5px",
      backgroundPosition: "0 0, 1px 2px",
      mixBlendMode: "overlay",
      opacity: 0.7,
      pointerEvents: "none"
    }
  }), children);
}

/* ─── cover slide ────────────────────────────────────────── */
function CoverSlide({
  photo,
  eyebrow = "@INGRYD.PORDENTRO",
  title,
  paren,
  tagline
}) {
  return /*#__PURE__*/React.createElement(CarouselFrame, {
    photo: photo
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 70,
      left: 0,
      right: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-cowrie.png",
    alt: "",
    style: {
      width: 54,
      opacity: 0.95
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 26,
      letterSpacing: "0.18em",
      color: "var(--paper)"
    }
  }, eyebrow)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 60,
      right: 60,
      top: "24%",
      fontFamily: "var(--serif-display)",
      fontWeight: 900,
      fontSize: 132,
      lineHeight: 0.95,
      letterSpacing: "-0.02em",
      textTransform: "uppercase",
      color: "#F0DBA8",
      fontVariationSettings: '"SOFT" 100, "opsz" 144',
      textAlign: "center",
      wordBreak: "normal",
      overflowWrap: "break-word"
    }
  }, paren && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#E5C68F"
    }
  }, paren), title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "57%",
      textAlign: "center",
      color: "var(--burgundy)",
      fontSize: 64,
      lineHeight: 1
    }
  }, "\u2193"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 380,
      background: "linear-gradient(180deg, rgba(28,22,20,0) 0%, rgba(28,22,20,0.55) 60%, rgba(28,22,20,0.85) 100%)",
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      bottom: 90,
      right: 80,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 32,
      lineHeight: 1.2,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "#F0DBA8",
      maxWidth: 700
    }
  }, tagline), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 84,
      height: 84,
      borderRadius: 999,
      border: "2.5px solid #1C1614",
      display: "grid",
      placeItems: "center",
      color: "#1C1614",
      fontSize: 38,
      background: "rgba(244,231,206,0.92)",
      flexShrink: 0
    }
  }, "\u2192")));
}

/* ─── evidence slide (folder + clippings) ────────────────── */
function EvidenceSlide({
  photo,
  title,
  paren,
  tagline,
  clippings = []
}) {
  return /*#__PURE__*/React.createElement(CarouselFrame, {
    photo: photo,
    washOpacity: 0.5
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 70,
      left: 0,
      right: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-cowrie.png",
    alt: "",
    style: {
      width: 48
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: "0.18em",
      color: "var(--paper)"
    }
  }, "@INGRYD.PORDENTRO")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 60,
      right: 60,
      top: 200,
      fontFamily: "var(--serif-display)",
      fontWeight: 900,
      fontSize: 124,
      lineHeight: 0.94,
      letterSpacing: "-0.02em",
      textTransform: "uppercase",
      color: "#F0DBA8",
      fontVariationSettings: '"SOFT" 100, "opsz" 144',
      textAlign: "center"
    }
  }, paren && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#E5C68F"
    }
  }, paren), title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: -40,
      right: -40,
      bottom: -40,
      height: 720
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      top: 0,
      width: 220,
      height: 60,
      background: "#E5C68F",
      clipPath: "polygon(0 0, 86% 0, 100% 100%, 0% 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 56,
      bottom: 0,
      background: "#E5C68F",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)"
    }
  }), clippings.map((c, i) => /*#__PURE__*/React.createElement(Clipping, _extends({
    key: i
  }, c, {
    index: i + 1
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      bottom: 70,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 24,
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 30,
      lineHeight: 1.2,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "#5C1F23",
      maxWidth: 720
    }
  }, tagline), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 80,
      borderRadius: 999,
      border: "2.5px solid #1C1614",
      display: "grid",
      placeItems: "center",
      color: "#1C1614",
      fontSize: 36,
      flexShrink: 0
    }
  }, "\u2192")));
}
function Clipping({
  source,
  head,
  x,
  y,
  w,
  rot,
  fasten = "clip",
  index
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: x,
      top: y,
      width: w,
      background: "#FBF6EB",
      transform: `rotate(${rot}deg)`,
      boxShadow: "0 18px 30px -12px rgba(28,22,20,0.55), 0 2px 0 rgba(28,22,20,0.06)",
      padding: "28px 28px 24px"
    }
  }, fasten === "clip" && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -16,
      left: "30%",
      width: 14,
      height: 70,
      background: "linear-gradient(#aaa, #777)",
      borderRadius: 6,
      transform: "rotate(-10deg)",
      boxShadow: "2px 3px 4px rgba(0,0,0,0.35)"
    }
  }), fasten === "binder" && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -10,
      right: 40,
      width: 88,
      height: 24,
      background: "#1C1614",
      borderRadius: "3px 3px 6px 6px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.4)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 14,
      color: "#C8242A",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, source), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--serif-display)",
      fontWeight: 700,
      fontSize: 26,
      lineHeight: 1.18,
      color: "#1C1614"
    }
  }, head), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 14,
      left: 14,
      fontFamily: "var(--mono)",
      fontSize: 14,
      color: "#3C2E26"
    }
  }, `(0${index})`));
}

/* ─── chapter divider ────────────────────────────────────── */
const TONES = {
  paper: {
    bg: "linear-gradient(180deg, #F4E7CE 0%, #E8D6B3 100%)",
    fg: "#5C1F23",
    kicker: "#3C2E26",
    rule: "#5C1F23"
  },
  merlot: {
    bg: "#501318",
    fg: "#F0DBA8",
    kicker: "#E5C68F",
    rule: "#E5C68F"
  },
  esmeralda: {
    bg: "#063B35",
    fg: "#F0DBA8",
    kicker: "#8AACD2",
    rule: "#8AACD2"
  },
  placidBlue: {
    bg: "#8AACD2",
    fg: "#1C1614",
    kicker: "#501318",
    rule: "#1C1614"
  },
  verdeMoss: {
    bg: "#4A5D3F",
    fg: "#F0DBA8",
    kicker: "#E5C68F",
    rule: "#E5C68F"
  },
  downtownBrown: {
    bg: "#604034",
    fg: "#F0DBA8",
    kicker: "#E5C68F",
    rule: "#E5C68F"
  }
};
function ChapterSlide({
  index,
  title,
  kicker,
  tone = "paper"
}) {
  const t = TONES[tone] || TONES.paper;
  return /*#__PURE__*/React.createElement(CarouselFrame, {
    photo: t.bg,
    washOpacity: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 80,
      left: 80,
      fontFamily: "var(--mono)",
      fontSize: 32,
      color: t.fg,
      fontWeight: 500
    }
  }, `(0${index})`), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 80,
      right: 80,
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: t.kicker
    }
  }, kicker), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 60,
      right: 60,
      top: "30%",
      fontFamily: "var(--serif-display)",
      fontWeight: 900,
      fontSize: 132,
      lineHeight: 0.94,
      letterSpacing: "-0.02em",
      textTransform: "uppercase",
      color: t.fg,
      fontVariationSettings: '"SOFT" 100, "opsz" 144',
      textAlign: "left"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 100,
      left: 80,
      right: 80,
      height: 1,
      background: t.rule
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 60,
      left: 80,
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: t.fg
    }
  }, "continua \u2192"));
}

/* ─── explainer slide (placid blue, didactic) ───────────── */
function ExplainerSlide({
  index,
  kicker,
  title,
  tone = "placidBlue"
}) {
  const t = TONES[tone] || TONES.placidBlue;
  return /*#__PURE__*/React.createElement(CarouselFrame, {
    photo: t.bg,
    washOpacity: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 80,
      left: 80,
      right: 80,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 32,
      color: t.fg,
      fontWeight: 500
    }
  }, `(0${index})`), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 20,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      background: t.kicker,
      color: t.bg,
      padding: "8px 16px",
      borderRadius: 4
    }
  }, kicker)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 60,
      right: 60,
      top: "32%",
      fontFamily: "var(--serif-display)",
      fontWeight: 900,
      fontSize: 132,
      lineHeight: 0.94,
      letterSpacing: "-0.02em",
      textTransform: "uppercase",
      color: t.fg,
      fontVariationSettings: '"SOFT" 100, "opsz" 144'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 90,
      left: 80,
      right: 80,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: t.fg
    }
  }, "passo a passo \u2192"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 80,
      borderRadius: 999,
      border: `2.5px solid ${t.fg}`,
      display: "grid",
      placeItems: "center",
      color: t.fg,
      fontSize: 36
    }
  }, "\u2192")));
}

/* ─── pull-quote slide ──────────────────────────────────── */
function QuoteSlide({
  quote,
  byline,
  tone = "merlot"
}) {
  const t = TONES[tone] || TONES.merlot;
  return /*#__PURE__*/React.createElement(CarouselFrame, {
    photo: t.bg,
    washOpacity: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "50%",
      left: 80,
      right: 80,
      transform: "translateY(-50%)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--serif-display)",
      fontWeight: 800,
      fontStyle: "italic",
      fontSize: 96,
      lineHeight: 1.05,
      color: t.fg,
      fontVariationSettings: '"SOFT" 100, "opsz" 144',
      textWrap: "balance"
    }
  }, "\"", quote, "\""), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 60,
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: t.kicker
    }
  }, "\u2014 ", byline)), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-cowrie.png",
    alt: "",
    style: {
      position: "absolute",
      bottom: 80,
      left: "50%",
      transform: "translateX(-50%)",
      width: 56,
      opacity: 0.9
    }
  }));
}

/* ─── outro / follow slide ──────────────────────────────── */
function OutroSlide({
  photo
}) {
  return /*#__PURE__*/React.createElement(CarouselFrame, {
    photo: photo,
    washOpacity: 0.55
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 90,
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: "var(--mono)",
      fontSize: 26,
      color: "#F4E7CE",
      letterSpacing: "0.16em"
    }
  }, "(fim)"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 60,
      right: 60,
      top: "26%",
      fontFamily: "var(--serif-display)",
      fontWeight: 900,
      fontSize: 124,
      lineHeight: 0.95,
      letterSpacing: "-0.02em",
      textTransform: "uppercase",
      color: "#F0DBA8",
      fontVariationSettings: '"SOFT" 100, "opsz" 144',
      textAlign: "center"
    }
  }, "vai por", /*#__PURE__*/React.createElement("br", null), "mim \u2014 voc\xEA", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#E5C68F"
    }
  }, "fica.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 360,
      background: "linear-gradient(180deg, rgba(28,22,20,0) 0%, rgba(28,22,20,0.85) 100%)",
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 90,
      textAlign: "center",
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 28,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "#F0DBA8"
    }
  }, "Quer ficar por dentro?"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      fontFamily: "var(--sans-body)",
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "#E5C68F"
    }
  }, "siga \xB7 @INGRYD.PORDENTRO")));
}

/* ─── feed tile (3-up grid view) ──────────────────────── */
function FeedTile({
  children,
  square = true
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 360,
      height: square ? 360 : 450,
      overflow: "hidden",
      position: "relative",
      background: "#1C1614"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      transform: "scale(0.333)",
      transformOrigin: "top left"
    }
  }, children));
}

/* ─── story frame ──────────────────────────────────────── */
function StoryFrame({
  photo,
  tone,
  children
}) {
  const t = tone ? TONES[tone] || TONES.merlot : null;
  const bg = t ? t.bg : photo || "linear-gradient(135deg, #2a1f18 0%, #4a3424 100%)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: FRAME_W,
      height: FRAME_H_STORY,
      position: "relative",
      overflow: "hidden",
      background: bg,
      backgroundSize: "cover",
      backgroundPosition: "center"
    }
  }, !t && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(28,22,20,0.4)"
    }
  }), children);
}

/* expose */
Object.assign(window, {
  ScaledStage,
  CarouselFrame,
  CoverSlide,
  EvidenceSlide,
  ChapterSlide,
  ExplainerSlide,
  QuoteSlide,
  OutroSlide,
  FeedTile,
  StoryFrame,
  TONES,
  FRAME_W,
  FRAME_H_CAR,
  FRAME_H_STORY
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/social/components.jsx", error: String((e && e.message) || e) }); }

})();
