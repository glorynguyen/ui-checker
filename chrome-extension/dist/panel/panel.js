"use strict";
(() => {
  // chrome-extension/lib/style-extractor.ts
  var PROPERTY_GROUPS = {
    Spacing: [
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "gap",
      "row-gap",
      "column-gap"
    ],
    Typography: [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "letter-spacing",
      "text-align",
      "text-transform",
      "text-decoration",
      "color"
    ],
    Sizing: [
      "width",
      "height",
      "min-width",
      "max-width",
      "min-height",
      "max-height"
    ],
    Layout: [
      "display",
      "flex-direction",
      "align-items",
      "justify-content",
      "flex-wrap",
      "position",
      "top",
      "right",
      "bottom",
      "left",
      "z-index"
    ],
    Visual: [
      "background-color",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "border-top-style",
      "border-right-style",
      "border-bottom-style",
      "border-left-style",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius",
      "box-shadow",
      "opacity",
      "overflow"
    ]
  };
  var ALL_PROPERTIES = Object.values(PROPERTY_GROUPS).flat();
  function getPropertyGroup(property) {
    for (const [group, props] of Object.entries(PROPERTY_GROUPS)) {
      if (props.includes(property))
        return group;
    }
    return "Other";
  }
  var StyleExtractor = { PROPERTY_GROUPS, ALL_PROPERTIES, getPropertyGroup };

  // chrome-extension/lib/figma-parser.ts
  var FigmaParser = {
    parse(input) {
      if (!input)
        return { styles: {}, varMap: {}, rawStyles: {}, sourceDeclarations: {} };
      if (typeof input === "object" && input !== null) {
        return this._parseNodeObject(input);
      }
      if (typeof input === "string" && input.trim().startsWith("{")) {
        try {
          const obj = JSON.parse(input);
          return this._parseNodeObject(obj);
        } catch (e) {
        }
      }
      return this._parseCSSText(input);
    },
    _parseNodeObject(node) {
      const doc = node.document || node;
      const styles = {};
      const varMap = {};
      const rawStyles = {};
      const sourceDeclarations = {};
      const setStyle = (prop, value) => {
        styles[prop] = value;
        rawStyles[prop] = value;
        sourceDeclarations[prop] = `${prop}: ${value};`;
      };
      const box = doc.absoluteBoundingBox || doc.boundingBox;
      if (box) {
        setStyle("width", `${Math.round(box.width)}px`);
        setStyle("height", `${Math.round(box.height)}px`);
      }
      const fill = this._getPrimarySolidFill(doc.fills);
      if (fill) {
        const combinedOpacity = this._combineOpacity(fill.opacity, doc.opacity);
        const color = this._figmaColorToRgb(fill.color, combinedOpacity);
        if (this._isTextNode(doc)) {
          setStyle("color", color);
        } else {
          setStyle("background-color", color);
        }
      }
      if (doc.style) {
        const s = doc.style;
        if (s.fontFamily)
          setStyle("font-family", s.fontFamily);
        if (s.fontSize)
          setStyle("font-size", `${s.fontSize}px`);
        if (s.fontWeight)
          setStyle("font-weight", s.fontWeight.toString());
        if (s.lineHeightPx)
          setStyle("line-height", `${Math.round(s.lineHeightPx)}px`);
        if (s.letterSpacing)
          setStyle("letter-spacing", `${s.letterSpacing}px`);
        if (s.textAlignHorizontal)
          setStyle("text-align", s.textAlignHorizontal.toLowerCase());
      }
      if (doc.cornerRadius !== void 0) {
        const r = `${doc.cornerRadius}px`;
        setStyle("border-top-left-radius", r);
        setStyle("border-top-right-radius", r);
        setStyle("border-bottom-right-radius", r);
        setStyle("border-bottom-left-radius", r);
      }
      if (doc.paddingTop !== void 0)
        setStyle("padding-top", `${doc.paddingTop}px`);
      if (doc.paddingRight !== void 0)
        setStyle("padding-right", `${doc.paddingRight}px`);
      if (doc.paddingBottom !== void 0)
        setStyle("padding-bottom", `${doc.paddingBottom}px`);
      if (doc.paddingLeft !== void 0)
        setStyle("padding-left", `${doc.paddingLeft}px`);
      if (doc.itemSpacing !== void 0)
        setStyle("gap", `${doc.itemSpacing}px`);
      return { styles, varMap, rawStyles, sourceDeclarations };
    },
    _getPrimarySolidFill(fills) {
      if (!Array.isArray(fills))
        return null;
      for (const fill of fills) {
        if (!fill || fill.visible === false)
          continue;
        if (fill.type === "SOLID") {
          return fill;
        }
      }
      return null;
    },
    _isTextNode(doc) {
      return doc?.type === "TEXT";
    },
    _combineOpacity(fillOpacity, nodeOpacity) {
      const fillAlpha = typeof fillOpacity === "number" ? fillOpacity : 1;
      const nodeAlpha = typeof nodeOpacity === "number" ? nodeOpacity : 1;
      return fillAlpha * nodeAlpha;
    },
    _figmaColorToRgb(c, opacity = 1) {
      const r = Math.round(c.r * 255);
      const g = Math.round(c.g * 255);
      const b = Math.round(c.b * 255);
      const a = opacity !== void 0 ? opacity : 1;
      return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
    },
    _parseCSSText(cssText) {
      if (!cssText || !cssText.trim())
        return { styles: {}, varMap: {}, rawStyles: {}, sourceDeclarations: {} };
      let cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
      const declarations = cleaned.split(";").map((d) => d.trim()).filter((d) => d.includes(":"));
      const styles = {};
      const varMap = {};
      const rawStyles = {};
      const sourceDeclarations = {};
      for (const decl of declarations) {
        const colonIdx = decl.indexOf(":");
        const prop = decl.slice(0, colonIdx).trim().toLowerCase();
        const rawValue = decl.slice(colonIdx + 1).trim();
        if (!prop || !rawValue)
          continue;
        const varInfo = this._extractVarInfo(rawValue);
        const value = varInfo ? varInfo.resolved : rawValue;
        const expanded = this._expandShorthand(prop, value);
        const expandedRaw = varInfo ? null : this._expandShorthand(prop, rawValue);
        for (const expandedProp of Object.keys(expanded)) {
          if (varInfo) {
            varMap[expandedProp] = {
              varName: varInfo.varName,
              fallback: varInfo.fallback,
              original: rawValue
            };
          }
          rawStyles[expandedProp] = varInfo ? rawValue : expandedRaw?.[expandedProp] ?? rawValue;
          sourceDeclarations[expandedProp] = `${expandedProp}: ${rawStyles[expandedProp]};`;
        }
        Object.assign(styles, expanded);
      }
      return { styles, varMap, rawStyles, sourceDeclarations };
    },
    // Extract var(--name, fallback) info and resolve to fallback
    _extractVarInfo(value) {
      const match = value.match(/var\(\s*(--[\w-]+)\s*(?:,\s*(.+?))?\s*\)$/);
      if (!match)
        return null;
      const varName = match[1];
      const fallback = match[2] ? match[2].trim() : null;
      return {
        varName,
        fallback,
        resolved: fallback || value,
        // keep raw if no fallback
        original: value
      };
    },
    _expandShorthand(prop, value) {
      switch (prop) {
        case "padding":
          return this._expandBoxShorthand("padding", value);
        case "margin":
          return this._expandBoxShorthand("margin", value);
        case "gap": {
          const parts = value.split(/\s+/);
          if (parts.length === 1) {
            return { "row-gap": parts[0], "column-gap": parts[0] };
          }
          return { "row-gap": parts[0], "column-gap": parts[1] };
        }
        case "border-radius":
          return this._expandBorderRadius(value);
        case "border":
          return this._expandBorder(value);
        case "background":
          if (this._isColorValue(value)) {
            return { "background-color": value };
          }
          return { "background": value };
        default:
          return { [prop]: value };
      }
    },
    _expandBoxShorthand(prefix, value) {
      const parts = value.split(/\s+/);
      let top, right, bottom, left;
      switch (parts.length) {
        case 1:
          top = right = bottom = left = parts[0];
          break;
        case 2:
          top = bottom = parts[0];
          right = left = parts[1];
          break;
        case 3:
          top = parts[0];
          right = left = parts[1];
          bottom = parts[2];
          break;
        case 4:
          top = parts[0];
          right = parts[1];
          bottom = parts[2];
          left = parts[3];
          break;
        default:
          return { [prefix]: value };
      }
      return {
        [`${prefix}-top`]: top,
        [`${prefix}-right`]: right,
        [`${prefix}-bottom`]: bottom,
        [`${prefix}-left`]: left
      };
    },
    _expandBorderRadius(value) {
      const parts = value.split(/\s+/);
      let tl, tr, br, bl;
      switch (parts.length) {
        case 1:
          tl = tr = br = bl = parts[0];
          break;
        case 2:
          tl = br = parts[0];
          tr = bl = parts[1];
          break;
        case 3:
          tl = parts[0];
          tr = bl = parts[1];
          br = parts[2];
          break;
        case 4:
          tl = parts[0];
          tr = parts[1];
          br = parts[2];
          bl = parts[3];
          break;
        default:
          return { "border-radius": value };
      }
      return {
        "border-top-left-radius": tl,
        "border-top-right-radius": tr,
        "border-bottom-right-radius": br,
        "border-bottom-left-radius": bl
      };
    },
    _expandBorder(value) {
      const match = value.match(/^(\S+)\s+(\S+)\s+(.+)$/);
      if (!match)
        return { "border": value };
      const [, width, style, color] = match;
      const result = {};
      for (const side of ["top", "right", "bottom", "left"]) {
        result[`border-${side}-width`] = width;
        result[`border-${side}-style`] = style;
        result[`border-${side}-color`] = color;
      }
      return result;
    },
    _isColorValue(value) {
      return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^rgba?\(/.test(value) || /^hsla?\(/.test(value) || /^(transparent|currentColor|inherit)$/i.test(value);
    },
    /**
     * Parse multi-block CSS text into an array of { label, styles, varMap }.
     * Blocks are delimited by CSS comments or double-newlines.
     */
    parseMulti(cssText) {
      if (!cssText || !cssText.trim())
        return [];
      const commentPattern = /\/\*\s*(.+?)\s*\*\//g;
      const comments = [...cssText.matchAll(commentPattern)];
      if (comments.length > 0) {
        const blocks = [];
        for (let i = 0; i < comments.length; i++) {
          const label = comments[i][1].trim();
          const start = (comments[i].index || 0) + comments[i][0].length;
          const end = i + 1 < comments.length ? comments[i + 1].index || 0 : cssText.length;
          const blockText = cssText.slice(start, end).trim();
          if (blockText) {
            const parsed = this.parse(blockText);
            blocks.push({ label, ...parsed });
          }
        }
        return blocks;
      }
      const rawBlocks = cssText.split(/\n\s*\n/).filter((b) => b.trim());
      return rawBlocks.map((block, i) => {
        const parsed = this.parse(block);
        return { label: `Element ${i + 1}`, ...parsed };
      });
    }
  };

  // chrome-extension/lib/normalizer.ts
  var Normalizer = {
    normalize(styles, rootFontSize = 16) {
      const result = {};
      for (const [prop, value] of Object.entries(styles)) {
        const normalized = this.normalizeValue(prop, value, rootFontSize, styles);
        if (normalized !== null) {
          result[prop] = normalized;
        }
      }
      return result;
    },
    normalizeValue(prop, value, rootFontSize = 16, allStyles = {}) {
      if (value === void 0 || value === null)
        return null;
      let v = String(value).trim();
      v = v.replace(/var\(\s*--[\w-]+\s*,\s*(.+?)\s*\)/g, "$1");
      v = v.toLowerCase();
      if (this._isColorProperty(prop)) {
        v = this._normalizeColor(v);
      }
      if (prop === "font-weight") {
        v = this._normalizeFontWeight(v);
      }
      if (prop === "font-family") {
        v = this._normalizeFontFamily(v);
      }
      v = this._remToPx(v, rootFontSize);
      if (prop === "line-height" && v === "normal") {
        const fontSize = parseFloat(allStyles["font-size"]) || 16;
        v = Math.round(fontSize * 1.2) + "px";
      }
      if (prop.includes("border") && (v === "none" || v === "0px none rgb(0, 0, 0)")) {
        if (prop.includes("width")) {
          v = "0";
        } else if (prop.includes("style")) {
          v = "none";
        } else {
          v = "none";
        }
      }
      if (/^0(px|rem|em|%|pt)?$/.test(v)) {
        v = "0";
      }
      if (/^\d+(\.\d+)?$/.test(v) && v !== "0" && this._isPxProperty(prop)) {
        v = v + "px";
      }
      if (v === "auto")
        v = "auto";
      return v;
    },
    _isColorProperty(prop) {
      return prop === "color" || prop === "background-color" || prop.includes("border") && prop.includes("color");
    },
    _normalizeColor(value) {
      const hexMatch = value.match(/^#([0-9a-f]{3,8})$/);
      if (hexMatch) {
        return this._hexToRgb(hexMatch[1]);
      }
      const rgbMatch = value.match(/^(rgba?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
      if (rgbMatch) {
        const [, fn, r, g, b, a] = rgbMatch;
        if (a !== void 0 && parseFloat(a) !== 1) {
          return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        return `rgb(${r}, ${g}, ${b})`;
      }
      return value;
    },
    _hexToRgb(hex) {
      let r, g, b, a;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else if (hex.length === 8) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
        a = parseInt(hex.slice(6, 8), 16) / 255;
        if (a !== 1) {
          return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(2))})`;
        }
      } else {
        return `#${hex}`;
      }
      return `rgb(${r}, ${g}, ${b})`;
    },
    _normalizeFontWeight(value) {
      const map = {
        "thin": "100",
        "hairline": "100",
        "extra-light": "200",
        "ultralight": "200",
        "light": "300",
        "normal": "400",
        "regular": "400",
        "medium": "500",
        "semi-bold": "600",
        "semibold": "600",
        "demi-bold": "600",
        "bold": "700",
        "extra-bold": "800",
        "ultrabold": "800",
        "black": "900",
        "heavy": "900"
      };
      return map[value] || value;
    },
    _normalizeFontFamily(value) {
      const primary = value.split(",")[0].trim().replace(/['"]/g, "");
      return primary.toLowerCase();
    },
    _remToPx(value, rootFontSize) {
      return value.replace(/([\d.]+)rem/g, (_, num) => {
        return parseFloat(num) * rootFontSize + "px";
      });
    },
    _isPxProperty(prop) {
      const pxProps = [
        "font-size",
        "line-height",
        "letter-spacing",
        "width",
        "height",
        "min-width",
        "max-width",
        "min-height",
        "max-height",
        "margin-top",
        "margin-right",
        "margin-bottom",
        "margin-left",
        "padding-top",
        "padding-right",
        "padding-bottom",
        "padding-left",
        "gap",
        "row-gap",
        "column-gap",
        "top",
        "right",
        "bottom",
        "left",
        "border-top-width",
        "border-right-width",
        "border-bottom-width",
        "border-left-width",
        "border-top-left-radius",
        "border-top-right-radius",
        "border-bottom-right-radius",
        "border-bottom-left-radius"
      ];
      return pxProps.includes(prop);
    }
  };

  // chrome-extension/lib/diff-engine.ts
  var DiffEngine = {
    defaultTolerance: {
      spacing: 2,
      // ±px
      color: 5,
      // ±per channel
      borderRadius: 2
      // ±px
    },
    compare(expected, actual, tolerance = {}) {
      const tol = { ...this.defaultTolerance, ...tolerance };
      const results = [];
      for (const prop of Object.keys(expected)) {
        const exp = expected[prop];
        const act = actual[prop] !== void 0 ? actual[prop] : null;
        if (act === null || act === void 0) {
          results.push({
            property: prop,
            status: "missing",
            expected: exp,
            actual: null,
            severity: "major"
          });
          continue;
        }
        if (exp === act) {
          results.push({
            property: prop,
            status: "match",
            expected: exp,
            actual: act
          });
          continue;
        }
        const comparison = this._compareWithTolerance(prop, exp, act, tol);
        results.push({
          property: prop,
          ...comparison
        });
      }
      const matched = results.filter((r) => r.status === "match").length;
      const mismatched = results.filter((r) => r.status === "mismatch").length;
      const missing = results.filter((r) => r.status === "missing").length;
      return {
        summary: {
          total: results.length,
          matched,
          mismatched,
          missing
        },
        results
      };
    },
    _compareWithTolerance(prop, expected, actual, tolerance) {
      if (this._isColorProperty(prop)) {
        return this._compareColors(expected, actual, tolerance.color);
      }
      const expNum = parseFloat(expected);
      const actNum = parseFloat(actual);
      if (!isNaN(expNum) && !isNaN(actNum)) {
        const diff = Math.abs(expNum - actNum);
        if (diff < 1) {
          return {
            status: "match",
            expected,
            actual,
            note: "subpixel rounding"
          };
        }
        const spacingTol = this._isSpacingProperty(prop) ? tolerance.spacing : 0;
        const radiusTol = this._isRadiusProperty(prop) ? tolerance.borderRadius : 0;
        const tol = Math.max(spacingTol, radiusTol);
        if (tol > 0 && diff <= tol) {
          return {
            status: "match",
            expected,
            actual,
            note: `within \xB1${tol}px tolerance`
          };
        }
        const severity = this._classifyNumericSeverity(prop, diff);
        return { status: "mismatch", expected, actual, severity };
      }
      return {
        status: "mismatch",
        expected,
        actual,
        severity: "major"
      };
    },
    _compareColors(expected, actual, channelTolerance) {
      const expRgb = this._parseRgb(expected);
      const actRgb = this._parseRgb(actual);
      if (!expRgb || !actRgb) {
        return {
          status: expected === actual ? "match" : "mismatch",
          expected,
          actual,
          severity: "major"
        };
      }
      const dr = Math.abs(expRgb.r - actRgb.r);
      const dg = Math.abs(expRgb.g - actRgb.g);
      const db = Math.abs(expRgb.b - actRgb.b);
      const maxDiff = Math.max(dr, dg, db);
      if (maxDiff === 0) {
        return { status: "match", expected, actual };
      }
      if (maxDiff <= channelTolerance) {
        return {
          status: "match",
          expected,
          actual,
          note: `within \xB1${channelTolerance} color tolerance`
        };
      }
      return {
        status: "mismatch",
        expected,
        actual,
        severity: maxDiff > 10 ? "major" : "minor"
      };
    },
    _parseRgb(value) {
      const m = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (!m)
        return null;
      return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
    },
    _isColorProperty(prop) {
      return prop === "color" || prop === "background-color" || prop.includes("border") && prop.includes("color");
    },
    _isSpacingProperty(prop) {
      return prop.startsWith("margin") || prop.startsWith("padding") || prop === "gap" || prop === "row-gap" || prop === "column-gap" || prop === "top" || prop === "right" || prop === "bottom" || prop === "left";
    },
    _isRadiusProperty(prop) {
      return prop.includes("radius");
    },
    _classifyNumericSeverity(prop, diff) {
      if (prop === "font-size" && diff > 2)
        return "major";
      if (prop === "font-weight")
        return "major";
      if (this._isSpacingProperty(prop) && diff <= 4)
        return "minor";
      if (this._isRadiusProperty(prop) && diff <= 2)
        return "minor";
      return "major";
    }
  };

  // chrome-extension/lib/pixel-diff.ts
  var PixelDiff = {
    /**
     * Compare two ImageData objects pixel-by-pixel.
     * Images must be the same dimensions (caller should resize first).
     *
     * @param {ImageData} imgA - First image (e.g. browser screenshot)
     * @param {ImageData} imgB - Second image (e.g. Figma design)
     * @param {PixelDiffOptions} opts
     * @returns {PixelDiffResult}
     */
    compare(imgA, imgB, opts = {}) {
      const threshold = opts.threshold ?? 10;
      const width = imgA.width;
      const height = imgA.height;
      const totalPixels = width * height;
      const diffCanvas = new OffscreenCanvas(width, height);
      const diffCtx = diffCanvas.getContext("2d");
      const diffImageData = diffCtx.createImageData(width, height);
      const diff = diffImageData.data;
      const a = imgA.data;
      const b = imgB.data;
      let diffCount = 0;
      for (let i = 0; i < a.length; i += 4) {
        const dr = Math.abs(a[i] - b[i]);
        const dg = Math.abs(a[i + 1] - b[i + 1]);
        const db = Math.abs(a[i + 2] - b[i + 2]);
        if (dr > threshold || dg > threshold || db > threshold) {
          const maxDiff = Math.max(dr, dg, db);
          const intensity = Math.min(255, maxDiff * 2);
          diff[i] = 255;
          diff[i + 1] = 0;
          diff[i + 2] = 0;
          diff[i + 3] = 80 + intensity * 0.7;
          diffCount++;
        } else {
          diff[i] = a[i];
          diff[i + 1] = a[i + 1];
          diff[i + 2] = a[i + 2];
          diff[i + 3] = 40;
        }
      }
      const matchPercent = totalPixels > 0 ? Math.round((totalPixels - diffCount) / totalPixels * 1e4) / 100 : 100;
      return { diffImageData, matchPercent, diffCount, totalPixels };
    },
    /**
     * Load an image (URL or data URL) into ImageData at the given dimensions.
     * @param {string} src - Image source
     * @param {number} width - Target width
     * @param {number} height - Target height
     * @returns {Promise<ImageData>}
     */
    async loadImageData(src, width, height) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      return new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(ctx.getImageData(0, 0, width, height));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
      });
    },
    /**
     * Render ImageData to a data URL via OffscreenCanvas.
     * @param {ImageData} imageData
     * @returns {Promise<string>}
     */
    async imageDataToURL(imageData) {
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext("2d");
      ctx.putImageData(imageData, 0, 0);
      const blob = await canvas.convertToBlob({ type: "image/png" });
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
  };

  // chrome-extension/panel/panel.ts
  (function() {
    const pickBtn = document.getElementById("pick-btn");
    const pickStatus = document.getElementById("pick-status");
    const settingsBtn = document.getElementById("settings-btn");
    const settingsPanel = document.getElementById("settings-panel");
    const selectionEmptyState = document.getElementById("selection-empty-state");
    const comparisonWorkspace = document.getElementById("comparison-workspace");
    const elementInfo = document.getElementById("element-info");
    const elementName = document.getElementById("element-name");
    const elementDims = document.getElementById("element-dims");
    const figmaSpecSection = document.getElementById("figma-spec-section");
    const figmaInput = document.getElementById("figma-input");
    const extractedStyles = document.getElementById("extracted-styles");
    const compareBtn = document.getElementById("compare-btn");
    const resultsSection = document.getElementById("results-section");
    const resultsSummary = document.getElementById("results-summary");
    const resultsList = document.getElementById("results-list");
    const copyBtn = document.getElementById("copy-btn");
    const copyAiBtn = document.getElementById("copy-ai-btn");
    const clearBtn = document.getElementById("clear-btn");
    const selectorInput = document.getElementById("selector-input");
    const selectorBtn = document.getElementById("selector-btn");
    const mappingSelect = document.getElementById("mapping-select");
    const mappingLoadBtn = document.getElementById("mapping-load-btn");
    const mappingDeleteBtn = document.getElementById("mapping-delete-btn");
    const mappingSaveBtn = document.getElementById("mapping-save-btn");
    const mappingExportBtn = document.getElementById("mapping-export-btn");
    const mappingImportInput = document.getElementById("mapping-import-input");
    const resultsFilter = document.getElementById("results-filter");
    const figmaCacheStatus = document.getElementById("figma-cache-status");
    let extractedData = null;
    let lastDiffReport = null;
    let currentVarMap = {};
    let varOverrides = {};
    let figmaFetchStatus = { node: null, image: null };
    let currentFigmaRequestId = 0;
    let figmaFetchPending = 0;
    let figmaSpecHighlightTimer = null;
    const headerLocateBtn = document.getElementById("header-locate-btn");
    headerLocateBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!extractedData || headerLocateBtn.classList.contains("loading"))
        return;
      headerLocateBtn.classList.add("loading");
      headerLocateBtn.textContent = "Searching";
      sendMessage({
        action: "BRIDGE_COMMAND",
        payload: {
          action: "FIND_SELECTOR",
          selector: extractedData.element
        }
      });
      setTimeout(() => {
        if (headerLocateBtn.classList.contains("loading")) {
          headerLocateBtn.classList.remove("loading");
          headerLocateBtn.textContent = "Locate in Editor";
        }
      }, 3e3);
    });
    function setSelectionStatus(message = "", tone = "") {
      pickStatus.textContent = message;
      pickStatus.classList.remove("active", "error", "success");
      if (tone)
        pickStatus.classList.add(tone);
    }
    function clearFigmaSpecHighlight() {
      if (figmaSpecHighlightTimer) {
        clearTimeout(figmaSpecHighlightTimer);
        figmaSpecHighlightTimer = null;
      }
      figmaSpecSection?.classList.remove("panel-section--highlight");
    }
    function guideToFigmaSpec(message = "Next step: paste or fetch the Figma Spec.") {
      if (!figmaSpecSection || figmaInput.value.trim())
        return;
      clearFigmaSpecHighlight();
      figmaSpecSection.scrollIntoView({ behavior: "smooth", block: "center" });
      figmaInput.focus({ preventScroll: true });
      setSelectionStatus(message, "active");
      void figmaSpecSection.offsetWidth;
      figmaSpecSection.classList.add("panel-section--highlight");
      figmaSpecHighlightTimer = window.setTimeout(() => {
        figmaSpecSection.classList.remove("panel-section--highlight");
        figmaSpecHighlightTimer = null;
      }, 2200);
    }
    function updateSelectionLayout() {
      const hasSelection = Boolean(extractedData);
      selectionEmptyState?.classList.toggle("hidden", hasSelection);
      comparisonWorkspace?.classList.toggle("hidden", !hasSelection);
    }
    const tabId = chrome.devtools.inspectedWindow.tabId;
    let port = null;
    function connectPort() {
      try {
        port = chrome.runtime.connect({ name: "panel" });
        port.postMessage({ action: "INIT", tabId });
      } catch (e) {
        if (checkContext(e))
          return;
        console.error("[Panel] connectPort failed:", e);
      }
      if (port) {
        port.onMessage.addListener((msg) => {
          console.log("[Panel] Port message received:", msg.action);
          if (msg.action === "BRIDGE_CONNECTED") {
            const bridgeBadge = document.getElementById("bridge-status");
            if (bridgeBadge) {
              bridgeBadge.textContent = "Bridge: Active";
              bridgeBadge.className = "status-badge connected";
            }
          } else if (msg.action === "BRIDGE_DISCONNECTED") {
            const bridgeBadge = document.getElementById("bridge-status");
            if (bridgeBadge) {
              bridgeBadge.textContent = "Bridge: Offline";
              bridgeBadge.className = "status-badge";
            }
          } else if (msg.action === "BRIDGE_ERROR") {
            const searchingButtons = document.querySelectorAll(".bridge-btn.loading, #header-locate-btn.loading");
            searchingButtons.forEach((btn) => {
              btn.classList.remove("loading");
              if (btn.id === "header-locate-btn") {
                btn.textContent = "Locate in Editor";
              } else {
                btn.textContent = "Locate";
              }
            });
            setSelectionStatus("VS Code Bridge not found. Is the extension installed?", "error");
          } else if (msg.action === "SELECTOR_RESULTS") {
            console.log("[Panel] Bridge found matches:", msg.matches);
            const searchingButtons = document.querySelectorAll(".bridge-btn.loading");
            searchingButtons.forEach((btn) => {
              btn.classList.remove("loading");
              if (msg.matches.length > 0) {
                btn.classList.add("success");
                btn.textContent = "Found";
                setTimeout(() => {
                  btn.classList.remove("success");
                  btn.textContent = "Locate";
                }, 2e3);
              } else {
                btn.classList.add("error");
                btn.textContent = "Not Found";
                setTimeout(() => {
                  btn.classList.remove("error");
                  btn.textContent = "Locate";
                }, 2e3);
              }
            });
            const heroBtn = document.getElementById("header-locate-btn");
            if (heroBtn && heroBtn.classList.contains("loading")) {
              heroBtn.classList.remove("loading");
              heroBtn.textContent = msg.matches.length > 0 ? "Found!" : "Not Found";
              setTimeout(() => {
                heroBtn.textContent = "Locate in Editor";
              }, 2e3);
            }
            if (msg.matches.length === 0) {
              setSelectionStatus("Selector not found in local workspace.", "error");
            } else {
              setSelectionStatus(`Opened ${msg.matches[0].file.split("/").pop()}`, "success");
            }
          }
          const statusEl = document.getElementById("mcp-status");
          if (msg.action === "MCP_CONNECTED") {
            statusEl.textContent = "Connected";
            statusEl.className = "status-badge connected";
          } else if (msg.action === "MCP_CONNECTION_FAILED") {
            if (!isActiveFigmaResponse(msg))
              return;
            statusEl.textContent = msg.error || "Connection failed";
            statusEl.className = "status-badge error";
            markFigmaFetchComplete();
          } else if (msg.action === "MCP_NODE_FETCH_FAILED") {
            if (!isActiveFigmaResponse(msg))
              return;
            alert("Figma Fetch Error: " + msg.error);
            figmaFetchStatus.node = null;
            renderFigmaCacheStatus();
            markFigmaFetchComplete();
            guideToFigmaSpec("Figma fetch failed. Paste the spec here or try fetching again.");
          } else if (msg.action === "MCP_NODE_DATA") {
            if (!isActiveFigmaResponse(msg))
              return;
            console.log("[Panel] Received MCP Node Data:", msg.data);
            figmaInput.value = JSON.stringify(msg.data, null, 2);
            clearFigmaSpecHighlight();
            figmaFetchStatus.node = msg.meta || null;
            renderFigmaCacheStatus();
            markFigmaFetchComplete();
            updateCompareBtn();
          } else if (msg.action === "MCP_IMAGE_DATA") {
            if (!isActiveFigmaResponse(msg))
              return;
            console.log("[Panel] Received MCP Image URL:", msg.imageUrl);
            figmaFetchStatus.image = msg.meta || null;
            renderFigmaCacheStatus();
            loadFigmaImageUrl(msg.imageUrl);
            markFigmaFetchComplete();
          } else if (msg.action === "MCP_IMAGE_FETCH_FAILED") {
            if (!isActiveFigmaResponse(msg))
              return;
            console.warn("[Panel] Figma visual fetch failed:", msg.error);
            figmaFetchStatus.image = null;
            renderFigmaCacheStatus();
            markFigmaFetchComplete();
          } else if (msg.action === "FIGMA_TAB_SYNCED") {
            if (msg.url) {
              const parsed = parseFigmaUrl(msg.url);
              if (parsed) {
                if (parsed.fileKey) {
                  mcpFileKeyInput.value = parsed.fileKey;
                  chrome.storage.local.get(["figmaConfig"], (res) => {
                    const newConfig = { ...res.figmaConfig || {}, fileKey: parsed.fileKey };
                    chrome.storage.local.set({ figmaConfig: newConfig });
                  });
                }
                if (parsed.nodeId) {
                  mcpNodeIdInput.value = parsed.nodeId;
                }
                console.log("[Panel] Synced from Figma tab:", parsed);
              }
            }
          } else if (msg.action === "FIGMA_TAB_SYNC_FAILED") {
            alert("Figma Tab Sync Error: " + msg.error);
          } else if (msg.action === "ELEMENT_CAPTURED") {
            onElementCaptured(msg);
          } else if (msg.action === "ELEMENT_CAPTURE_FAILED") {
            onElementCaptureFailed(msg);
          }
          if (msg.action === "ELEMENT_SELECTED") {
            onElementSelected(msg.data);
          } else if (msg.action === "PICKER_CANCELLED") {
            setPickerState(false);
            setSelectionStatus("Picker cancelled.", "");
          } else if (msg.action === "SELECTOR_NOT_FOUND") {
            setPickerState(false);
            setSelectionStatus(`No match found for "${msg.selector}".`, "error");
          }
        });
        port.onDisconnect.addListener(() => {
          console.log("[Panel] Port disconnected");
          port = null;
        });
      }
    }
    function connectToFigma(token) {
      sendMessage({ action: "FIGMA_CONNECT", token });
    }
    function parseFigmaUrl(url) {
      try {
        const u = new URL(url);
        const pathParts = u.pathname.split("/");
        const keyIdx = pathParts.findIndex((p) => p === "design" || p === "file") + 1;
        const fileKey = pathParts[keyIdx];
        const nodeId = u.searchParams.get("node-id");
        return { fileKey, nodeId };
      } catch (e) {
        return null;
      }
    }
    function fetchFigmaNode(inputId) {
      return fetchFigmaNodeWithOptions(inputId, { forceRefresh: false });
    }
    function fetchFigmaNodeWithOptions(inputId, options = {}) {
      let nodeId = inputId;
      let fileKey = mcpFileKeyInput.value.trim();
      const forceRefresh = Boolean(options.forceRefresh);
      const requestId = ++currentFigmaRequestId;
      if (nodeId.includes("figma.com")) {
        const parsed = parseFigmaUrl(nodeId);
        if (parsed) {
          if (parsed.fileKey) {
            fileKey = parsed.fileKey;
            mcpFileKeyInput.value = fileKey;
            if (chrome.storage) {
              chrome.storage.local.get(["figmaConfig"], (res) => {
                const newConfig = { ...res.figmaConfig || {}, fileKey };
                chrome.storage.local.set({ figmaConfig: newConfig });
              });
            }
          }
          if (parsed.nodeId) {
            nodeId = parsed.nodeId;
            mcpNodeIdInput.value = nodeId;
          }
        }
      }
      if (!fileKey) {
        alert("Please enter a Figma File Key in settings or paste a full Figma URL.");
        return;
      }
      beginFigmaFetch(forceRefresh);
      figmaFetchStatus = { node: null, image: null };
      renderFigmaCacheStatus();
      sendMessage({ action: "MCP_GET_NODE", nodeId, fileKey, forceRefresh, requestId });
      sendMessage({ action: "MCP_GET_IMAGE", nodeId, fileKey, forceRefresh, requestId });
    }
    function loadFigmaImageUrl(url) {
      figmaImage = url;
      figmaDropZone.classList.add("has-image");
      figmaDropZone.textContent = "";
      const img = document.createElement("img");
      img.src = figmaImage;
      img.className = "preview-thumb";
      img.alt = "Figma design";
      figmaDropZone.appendChild(img);
      const os = document.getElementById("overlay-section");
      if (os)
        os.classList.remove("hidden");
      renderOverlay();
    }
    connectPort();
    function sendMessage(msg) {
      if (!port) {
        console.log("[Panel] Port is null, reconnecting before send");
        connectPort();
      }
      try {
        port?.postMessage(msg);
        console.log("[Panel] postMessage sent:", msg.action);
      } catch (e) {
        if (checkContext(e))
          return;
        console.warn("[Panel] postMessage failed, reconnecting:", e.message);
        try {
          connectPort();
          port?.postMessage(msg);
        } catch (e2) {
          console.error("[Panel] Critical port failure:", e2);
        }
      }
    }
    function checkContext(e) {
      if (e.message && e.message.includes("context invalidated")) {
        console.error("[Panel] Extension context invalidated. Please reload the extension and DevTools.");
        alert("Extension context invalidated. This usually happens after an extension update. Please reload the extension and the DevTools panel.");
        return true;
      }
      return false;
    }
    const mcpConnectBtn = document.getElementById("mcp-connect-btn");
    const mcpFetchBtn = document.getElementById("mcp-fetch-btn");
    const mcpRefreshBtn = document.getElementById("mcp-refresh-btn");
    const mcpSyncBtn = document.getElementById("mcp-sync-btn");
    const mcpTokenInput = document.getElementById("mcp-token");
    const mcpFileKeyInput = document.getElementById("figma-file-key");
    const mcpNodeIdInput = document.getElementById("mcp-node-id");
    function beginFigmaFetch(forceRefresh) {
      figmaFetchPending = 2;
      mcpFetchBtn.disabled = true;
      mcpRefreshBtn.disabled = true;
      mcpFetchBtn.textContent = forceRefresh ? "Refreshing..." : "Fetching...";
      mcpRefreshBtn.textContent = "Working...";
    }
    function endFigmaFetch() {
      figmaFetchPending = 0;
      mcpFetchBtn.disabled = false;
      mcpRefreshBtn.disabled = false;
      mcpFetchBtn.textContent = "Fetch Spec";
      mcpRefreshBtn.textContent = "Refresh Live";
    }
    function markFigmaFetchComplete() {
      figmaFetchPending = Math.max(0, figmaFetchPending - 1);
      if (figmaFetchPending === 0) {
        endFigmaFetch();
      }
    }
    function isActiveFigmaResponse(msg) {
      return !msg.requestId || msg.requestId === currentFigmaRequestId;
    }
    function formatRelativeTime(timestamp) {
      if (!timestamp)
        return "just now";
      const diffMs = Math.max(0, Date.now() - timestamp);
      const diffSec = Math.round(diffMs / 1e3);
      if (diffSec < 5)
        return "just now";
      if (diffSec < 60)
        return `${diffSec}s ago`;
      const diffMin = Math.round(diffSec / 60);
      if (diffMin < 60)
        return `${diffMin}m ago`;
      const diffHour = Math.round(diffMin / 60);
      return `${diffHour}h ago`;
    }
    function describeMeta(label, meta) {
      if (!meta)
        return `${label}: unavailable`;
      const sourceText = meta.source === "cache" ? "cached" : "fresh";
      return `${label}: ${sourceText} ${formatRelativeTime(meta.cachedAt)}`;
    }
    function renderFigmaCacheStatus() {
      const parts = [];
      if (figmaFetchStatus.node)
        parts.push(describeMeta("Spec", figmaFetchStatus.node));
      if (figmaFetchStatus.image)
        parts.push(describeMeta("Image", figmaFetchStatus.image));
      if (parts.length === 0) {
        figmaCacheStatus.textContent = "";
        figmaCacheStatus.classList.add("hidden");
        return;
      }
      figmaCacheStatus.innerHTML = `<strong>Cache:</strong> ${parts.join(" | ")}`;
      figmaCacheStatus.classList.remove("hidden");
    }
    mcpConnectBtn.addEventListener("click", () => {
      const token = mcpTokenInput.value.trim();
      const fileKey = mcpFileKeyInput.value.trim();
      if (token) {
        connectToFigma(token);
        if (chrome.storage) {
          chrome.storage.local.set({ figmaConfig: { token, fileKey } });
        }
      }
    });
    mcpSyncBtn.addEventListener("click", () => {
      sendMessage({ action: "SYNC_FIGMA_TAB" });
    });
    mcpFetchBtn.addEventListener("click", () => {
      const nodeId = mcpNodeIdInput.value.trim();
      if (nodeId) {
        fetchFigmaNode(nodeId);
      }
    });
    mcpRefreshBtn.addEventListener("click", () => {
      const nodeId = mcpNodeIdInput.value.trim();
      if (nodeId) {
        fetchFigmaNodeWithOptions(nodeId, { forceRefresh: true });
      }
    });
    if (chrome.storage) {
      chrome.storage.local.get(["figmaConfig"], (result) => {
        const config = result.figmaConfig || {};
        if (mcpTokenInput)
          mcpTokenInput.value = config.token || "";
        if (mcpFileKeyInput)
          mcpFileKeyInput.value = config.fileKey || "";
        if (config.token) {
          connectToFigma(config.token);
        }
      });
    }
    pickBtn.addEventListener("click", () => {
      sendMessage({ action: "START_PICKER" });
      setPickerState(true);
    });
    function queryBySelector() {
      const selector = selectorInput.value.trim();
      if (!selector)
        return;
      setSelectionStatus("Looking up selector...", "active");
      sendMessage({ action: "QUERY_SELECTOR", selector });
    }
    selectorBtn.addEventListener("click", () => queryBySelector());
    selectorInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        queryBySelector();
    });
    function setPickerState(active) {
      if (active) {
        pickBtn.disabled = true;
        setSelectionStatus("Click an element in the page, or press Esc to cancel.", "active");
      } else {
        pickBtn.disabled = false;
        pickStatus.classList.remove("active");
      }
    }
    function onElementSelected(data) {
      setPickerState(false);
      setSelectionStatus("Selection ready.", "success");
      extractedData = data;
      updateSelectionLayout();
      elementInfo.classList.remove("hidden");
      elementName.textContent = data.element;
      elementDims.textContent = `${data.dimensions.width} x ${data.dimensions.height}`;
      if (data.figmaId) {
        mcpNodeIdInput.value = data.figmaId;
        fetchFigmaNode(data.figmaId);
      } else {
        guideToFigmaSpec();
      }
      const lines = Object.entries(data.styles).map(([k, v]) => `${k}: ${v};`).join("\n");
      extractedStyles.textContent = lines;
      updateCompareBtn();
      const os = document.getElementById("overlay-section");
      if (os) {
        os.classList.remove("hidden");
        console.log("[Panel] Auto-capturing element for visual overlay");
        sendMessage({ action: "CAPTURE_ELEMENT", selector: data.element });
      }
    }
    figmaInput.addEventListener("input", () => {
      if (figmaInput.value.trim()) {
        clearFigmaSpecHighlight();
      }
      updateCompareBtn();
    });
    function updateCompareBtn() {
      compareBtn.disabled = !(extractedData && figmaInput.value.trim());
    }
    function openVarEditor(_anchorEl, property, varInfo) {
      const currentValue = varOverrides[property] ?? varInfo.fallback ?? "";
      const message = [
        `Override ${varInfo.varName} for ${property}.`,
        "Leave blank to clear the override and fall back to the Figma value."
      ].join("\n");
      const nextValue = window.prompt(message, currentValue);
      if (nextValue === null)
        return;
      const trimmed = nextValue.trim();
      if (trimmed) {
        varOverrides[property] = trimmed;
      } else {
        delete varOverrides[property];
      }
      if (extractedData && figmaInput.value.trim()) {
        runComparison();
      }
    }
    settingsBtn.addEventListener("click", () => {
      settingsPanel.classList.toggle("hidden");
    });
    function getTolerance() {
      const s = parseInt(document.getElementById("tol-spacing").value);
      const c = parseInt(document.getElementById("tol-color").value);
      const r = parseInt(document.getElementById("tol-radius").value);
      return {
        spacing: isNaN(s) ? 2 : s,
        color: isNaN(c) ? 5 : c,
        borderRadius: isNaN(r) ? 2 : r
      };
    }
    if (chrome.storage) {
      chrome.storage.local.get(["tolerance", "bridgePort"], (result) => {
        if (result.tolerance) {
          if (result.tolerance.spacing !== void 0)
            document.getElementById("tol-spacing").value = result.tolerance.spacing;
          if (result.tolerance.color !== void 0)
            document.getElementById("tol-color").value = result.tolerance.color;
          if (result.tolerance.borderRadius !== void 0)
            document.getElementById("tol-radius").value = result.tolerance.borderRadius;
        }
        if (result.bridgePort) {
          document.getElementById("bridge-port").value = result.bridgePort;
        }
      });
    }
    settingsPanel.addEventListener("change", () => {
      const tol = getTolerance();
      const bridgePort = parseInt(document.getElementById("bridge-port").value) || 3e3;
      if (chrome.storage) {
        try {
          chrome.storage.local.set({ tolerance: tol, bridgePort });
        } catch (e) {
          checkContext(e);
        }
      }
    });
    function runComparison() {
      if (!extractedData || !figmaInput.value.trim())
        return;
      const parsed = FigmaParser.parse(figmaInput.value);
      currentVarMap = parsed.varMap;
      const rootFontSize = extractedData.rootFontSize || 16;
      const figmaStyles = { ...parsed.styles };
      const rawFigmaStyles = { ...parsed.rawStyles };
      const sourceDeclarations = { ...parsed.sourceDeclarations };
      for (const [prop, val] of Object.entries(varOverrides)) {
        if (prop in figmaStyles) {
          figmaStyles[prop] = val;
          rawFigmaStyles[prop] = val;
          sourceDeclarations[prop] = `${prop}: ${val};`;
        }
      }
      const normalizedFigma = Normalizer.normalize(figmaStyles, rootFontSize);
      const normalizedBrowser = Normalizer.normalize(extractedData.styles, rootFontSize);
      const tolerance = getTolerance();
      const baseReport = DiffEngine.compare(normalizedFigma, normalizedBrowser, tolerance);
      const report = {
        ...baseReport,
        results: baseReport.results.map((result) => {
          const sourceExpected = rawFigmaStyles[result.property] ?? result.expected;
          return {
            ...result,
            sourceExpected,
            sourceDeclaration: sourceDeclarations[result.property] || `${result.property}: ${sourceExpected};`
          };
        })
      };
      lastDiffReport = {
        ...report,
        element: extractedData.element,
        dimensions: extractedData.dimensions
      };
      renderResults(report);
    }
    compareBtn.addEventListener("click", () => runComparison());
    function buildAiPrompt() {
      if (!lastDiffReport)
        return null;
      const mismatches = lastDiffReport.results.filter((r) => r.status === "mismatch" || r.status === "missing");
      const lines = [];
      lines.push("## UI Checker \u2014 AI Fix Request");
      lines.push("");
      lines.push("### Element");
      lines.push(`Selector: ${lastDiffReport.element}`);
      if (extractedData?.classList)
        lines.push(`Classes:  ${extractedData.classList}`);
      lines.push(`Dimensions: ${lastDiffReport.dimensions?.width ?? "?"}px \xD7 ${lastDiffReport.dimensions?.height ?? "?"}px`);
      lines.push("");
      const s = lastDiffReport.summary;
      lines.push("### Comparison Summary");
      lines.push(`${s.mismatched} mismatches \xB7 ${s.missing ?? 0} missing \xB7 ${s.matched} matched (${s.total} total)`);
      lines.push("");
      if (mismatches.length > 0) {
        lines.push("### Mismatches");
        lines.push("| Property | Expected (Figma) | Actual (DOM) | Severity |");
        lines.push("|---|---|---|---|");
        for (const r of mismatches) {
          lines.push(`| ${r.property} | ${r.sourceExpected ?? r.expected ?? "\u2014"} | ${r.actual ?? "\u2014"} | ${r.severity || r.status} |`);
        }
        lines.push("");
      }
      const figmaRaw = figmaInput.value.trim();
      if (figmaRaw) {
        lines.push("### Figma Spec (expected styles)");
        lines.push("```css");
        lines.push(figmaRaw);
        lines.push("```");
        lines.push("");
      }
      if (extractedData?.styles) {
        lines.push("### Live DOM Styles (actual styles)");
        lines.push("```css");
        lines.push(Object.entries(extractedData.styles).map(([k, v]) => `${k}: ${v};`).join("\n"));
        lines.push("```");
        lines.push("");
      }
      lines.push("---");
      lines.push("Paste your component code below and ask the AI to fix the mismatches.");
      return lines.join("\n");
    }
    if (copyAiBtn) {
      copyAiBtn.addEventListener("click", async () => {
        const prompt2 = buildAiPrompt();
        if (!prompt2)
          return;
        await navigator.clipboard.writeText(prompt2);
        const orig = copyAiBtn.textContent;
        copyAiBtn.textContent = "Copied!";
        setTimeout(() => {
          copyAiBtn.textContent = orig || "";
        }, 1500);
      });
    }
    resultsFilter.addEventListener("input", () => {
      if (lastDiffReport)
        renderResults(lastDiffReport);
    });
    function appendStat(parent, label, value, valueClass) {
      const stat = document.createElement("div");
      stat.className = "stat";
      const labelEl = document.createElement("span");
      labelEl.className = "stat-label";
      labelEl.textContent = label;
      const valueEl = document.createElement("span");
      valueEl.className = `stat-value ${valueClass}`;
      valueEl.textContent = value.toString();
      stat.appendChild(labelEl);
      stat.appendChild(valueEl);
      parent.appendChild(stat);
    }
    function renderResults(report) {
      resultsSection.classList.remove("hidden");
      const s = report.summary;
      resultsSummary.textContent = "";
      appendStat(resultsSummary, "Matched", s.matched, "stat-matched");
      appendStat(resultsSummary, "Mismatched", s.mismatched, "stat-mismatched");
      appendStat(resultsSummary, "Missing", s.missing, "stat-missing");
      resultsList.textContent = "";
      const severityOrder = { major: 0, minor: 1, negligible: 2 };
      const statusOrder = { mismatch: 0, missing: 1, match: 2 };
      const sorted = [...report.results].sort((a, b) => {
        const sa = statusOrder[a.status] ?? 3;
        const sb = statusOrder[b.status] ?? 3;
        if (sa !== sb)
          return sa - sb;
        const sevA = severityOrder[a.severity || ""] ?? 3;
        const sevB = severityOrder[b.severity || ""] ?? 3;
        return sevA - sevB;
      });
      const filterText = resultsFilter.value.trim().toLowerCase();
      const filtered = filterText ? sorted.filter((r) => r.property.toLowerCase().includes(filterText)) : sorted;
      const mismatches = filtered.filter((r) => r.status === "mismatch" || r.status === "missing");
      const matches = filtered.filter((r) => r.status === "match");
      if (mismatches.length > 0) {
        const grouped = groupByPropertyGroup(mismatches);
        for (const [group, items] of Object.entries(grouped)) {
          const groupEl = document.createElement("div");
          groupEl.className = "result-group";
          const header = document.createElement("div");
          header.className = "result-group-header";
          header.textContent = group;
          groupEl.appendChild(header);
          items.forEach((r) => groupEl.appendChild(createResultRow(r)));
          resultsList.appendChild(groupEl);
        }
      }
      if (matches.length > 0) {
        const toggle = document.createElement("button");
        toggle.className = "matched-toggle";
        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = "\u25B6";
        toggle.appendChild(arrow);
        toggle.appendChild(document.createTextNode(` ${matches.length} matched properties`));
        const content = document.createElement("div");
        content.className = "matched-content";
        const grouped = groupByPropertyGroup(matches);
        for (const [group, items] of Object.entries(grouped)) {
          const groupEl = document.createElement("div");
          groupEl.className = "result-group";
          const header = document.createElement("div");
          header.className = "result-group-header";
          header.textContent = group;
          groupEl.appendChild(header);
          items.forEach((r) => groupEl.appendChild(createResultRow(r)));
          content.appendChild(groupEl);
        }
        toggle.addEventListener("click", () => {
          toggle.classList.toggle("open");
          content.classList.toggle("open");
        });
        resultsList.appendChild(toggle);
        resultsList.appendChild(content);
      }
    }
    function groupByPropertyGroup(items) {
      const groups = {};
      for (const item of items) {
        const group = StyleExtractor.getPropertyGroup(item.property);
        if (!groups[group])
          groups[group] = [];
        groups[group].push(item);
      }
      return groups;
    }
    function createResultRow(r) {
      const row = document.createElement("div");
      row.className = `result-row result-row--${r.status}`;
      const icon = document.createElement("span");
      icon.className = "result-icon";
      icon.style.color = r.status === "match" ? "var(--green)" : r.status === "missing" ? "var(--orange)" : "var(--red)";
      icon.textContent = r.status === "match" ? "\u2713" : r.status === "missing" ? "\u26A0" : "\u2717";
      row.appendChild(icon);
      const prop = document.createElement("span");
      prop.className = "result-prop";
      prop.textContent = r.property;
      if (r.severity && r.status !== "match") {
        const sev = document.createElement("span");
        sev.className = `severity-badge severity-${r.severity}`;
        sev.textContent = r.severity;
        prop.appendChild(sev);
      }
      row.appendChild(prop);
      const expectedCol = document.createElement("span");
      expectedCol.className = "result-expected";
      const varInfo = currentVarMap[r.property];
      if (varInfo) {
        const overridden = varOverrides[r.property];
        const displayValue = overridden || r.expected;
        const label = document.createElement("span");
        label.className = "result-label";
        label.textContent = "exp";
        expectedCol.appendChild(label);
        const chip = document.createElement("span");
        chip.className = "var-chip";
        chip.title = varInfo.original;
        chip.textContent = varInfo.varName;
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          openVarEditor(chip, r.property, varInfo);
        });
        expectedCol.appendChild(chip);
        const val = document.createElement("span");
        val.className = "result-value var-resolved";
        val.textContent = displayValue;
        expectedCol.appendChild(val);
        expectedCol.appendChild(createColorSwatch(r.property, displayValue));
      } else {
        const label = document.createElement("span");
        label.className = "result-label";
        label.textContent = "exp";
        expectedCol.appendChild(label);
        expectedCol.appendChild(createValueElement(r.sourceExpected ?? r.expected, ""));
      }
      row.appendChild(expectedCol);
      const actualCol = document.createElement("span");
      actualCol.className = "result-actual";
      const actLabel = document.createElement("span");
      actLabel.className = "result-label";
      actLabel.textContent = "act";
      actualCol.appendChild(actLabel);
      if (r.actual !== null) {
        const val = document.createElement("span");
        val.className = `result-value ${r.status === "match" ? "match" : "mismatch"}`;
        val.textContent = r.actual;
        actualCol.appendChild(val);
        actualCol.appendChild(createColorSwatch(r.property, r.actual));
        if (r.note) {
          const note = document.createElement("span");
          note.className = "result-note";
          note.textContent = `(${r.note})`;
          actualCol.appendChild(note);
        }
        if (r.status === "mismatch") {
          const actions = document.createElement("div");
          actions.className = "result-actions";
          actions.style.display = "inline-flex";
          actions.style.gap = "4px";
          actions.style.marginLeft = "8px";
          const fixBtn = document.createElement("button");
          fixBtn.className = "btn btn-xs copy-fix-btn";
          fixBtn.textContent = "Fix";
          fixBtn.title = "Copy to clipboard";
          fixBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(r.sourceDeclaration || `${r.property}: ${r.sourceExpected ?? r.expected};`).then(() => {
              fixBtn.textContent = "Copied!";
              fixBtn.classList.add("btn-success");
              setTimeout(() => {
                fixBtn.textContent = "Fix";
                fixBtn.classList.remove("btn-success");
              }, 1e3);
            });
          });
          actions.appendChild(fixBtn);
          const bridgeBtn = document.createElement("button");
          bridgeBtn.className = "btn btn-xs bridge-btn";
          bridgeBtn.innerHTML = "Locate";
          bridgeBtn.title = "Find in VS Code";
          bridgeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (bridgeBtn.classList.contains("loading"))
              return;
            bridgeBtn.classList.add("loading");
            bridgeBtn.textContent = "Searching";
            const payload = {
              action: "FIND_SELECTOR",
              selector: lastDiffReport.element,
              property: r.property,
              value: r.sourceExpected ?? r.expected
            };
            bridgeBtn.dataset.activeSearch = "true";
            sendMessage({ action: "BRIDGE_COMMAND", payload });
            setTimeout(() => {
              if (bridgeBtn.classList.contains("loading")) {
                bridgeBtn.classList.remove("loading");
                bridgeBtn.textContent = "Timeout";
              }
            }, 3e3);
          });
          actions.appendChild(bridgeBtn);
          actualCol.appendChild(actions);
        }
      } else {
        const nA = document.createElement("span");
        nA.className = "result-value missing";
        nA.textContent = "n/a";
        actualCol.appendChild(nA);
      }
      row.appendChild(actualCol);
      return row;
    }
    function createValueElement(value, className) {
      const el = document.createElement("span");
      el.className = "result-value " + className;
      el.textContent = value;
      return el;
    }
    function createColorSwatch(property, value) {
      const el = document.createElement("span");
      if (!value)
        return el;
      const isColor = property === "color" || property === "background-color" || property.includes("border") && property.includes("color");
      if (isColor) {
        el.className = "color-swatch";
        el.style.backgroundColor = value;
      }
      return el;
    }
    copyBtn.addEventListener("click", () => {
      if (!lastDiffReport)
        return;
      const r = lastDiffReport;
      const mismatches = r.results.filter((x) => x.status === "mismatch" || x.status === "missing");
      const matched = r.results.filter((x) => x.status === "match");
      let md = `## Style Diff Report
`;
      md += `**Element:** \`${r.element}\` (${r.dimensions.width} x ${r.dimensions.height})
`;
      md += `**Date:** ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}

`;
      if (mismatches.length > 0) {
        md += `### Mismatches (${mismatches.length})
`;
        md += `| Property | Expected (Figma) | Actual (Browser) | Severity |
`;
        md += `|----------|-----------------|------------------|----------|
`;
        for (const m of mismatches) {
          md += `| ${m.property} | ${m.sourceExpected ?? m.expected} | ${m.actual ?? "n/a"} | ${m.severity} |
`;
        }
        md += "\n";
      }
      md += `### Matched: ${matched.length}/${r.summary.total} properties
`;
      navigator.clipboard.writeText(md).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy Report";
        }, 1500);
      });
    });
    clearBtn.addEventListener("click", () => {
      extractedData = null;
      lastDiffReport = null;
      currentVarMap = {};
      varOverrides = {};
      clearFigmaSpecHighlight();
      figmaInput.value = "";
      extractedStyles.textContent = "Pick an element to extract styles.";
      elementInfo.classList.add("hidden");
      resultsSection.classList.add("hidden");
      resultsSummary.textContent = "";
      resultsList.textContent = "";
      resultsFilter.value = "";
      compareBtn.disabled = true;
      updateSelectionLayout();
    });
    function getSavedMappings(cb) {
      chrome.storage.local.get(["savedMappings"], (result) => {
        cb(result.savedMappings || []);
      });
    }
    function setSavedMappings(mappings, cb) {
      chrome.storage.local.set({ savedMappings: mappings }, cb);
    }
    function refreshMappingsList() {
      getSavedMappings((mappings) => {
        mappingSelect.textContent = "";
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = mappings.length === 0 ? "-- No saved mappings --" : "-- Select mapping --";
        mappingSelect.appendChild(defaultOpt);
        for (const m of mappings) {
          const opt = document.createElement("option");
          opt.value = m.name;
          opt.textContent = m.name;
          mappingSelect.appendChild(opt);
        }
        updateMappingButtons();
      });
    }
    function updateMappingButtons() {
      const hasSelection = mappingSelect.value !== "";
      mappingLoadBtn.disabled = !hasSelection;
      mappingDeleteBtn.disabled = !hasSelection;
      mappingExportBtn.disabled = !hasSelection;
    }
    mappingSelect.addEventListener("change", updateMappingButtons);
    mappingSaveBtn.addEventListener("click", () => {
      if (Object.keys(varOverrides).length === 0) {
        alert("No variable overrides to save. Edit a CSS variable first.");
        return;
      }
      const name = prompt("Mapping name:");
      if (!name || !name.trim())
        return;
      const trimmed = name.trim();
      getSavedMappings((mappings) => {
        const existing = mappings.findIndex((m) => m.name === trimmed);
        const entry = {
          name: trimmed,
          created: (/* @__PURE__ */ new Date()).toISOString(),
          overrides: { ...varOverrides }
        };
        if (existing >= 0) {
          mappings[existing] = entry;
        } else {
          mappings.push(entry);
        }
        setSavedMappings(mappings, () => {
          refreshMappingsList();
          mappingSelect.value = trimmed;
          updateMappingButtons();
        });
      });
    });
    mappingLoadBtn.addEventListener("click", () => {
      const name = mappingSelect.value;
      if (!name)
        return;
      getSavedMappings((mappings) => {
        const entry = mappings.find((m) => m.name === name);
        if (!entry)
          return;
        varOverrides = { ...entry.overrides };
        if (extractedData && figmaInput.value.trim()) {
          runComparison();
        }
      });
    });
    mappingDeleteBtn.addEventListener("click", () => {
      const name = mappingSelect.value;
      if (!name)
        return;
      if (!confirm(`Delete mapping "${name}"?`))
        return;
      getSavedMappings((mappings) => {
        const filtered = mappings.filter((m) => m.name !== name);
        setSavedMappings(filtered, refreshMappingsList);
      });
    });
    mappingExportBtn.addEventListener("click", () => {
      const name = mappingSelect.value;
      if (!name)
        return;
      getSavedMappings((mappings) => {
        const entry = mappings.find((m) => m.name === name);
        if (!entry)
          return;
        const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name.replace(/[^a-z0-9_-]/gi, "_")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });
    mappingImportInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file)
        return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data.name || !data.overrides || typeof data.overrides !== "object") {
            alert("Invalid mapping file. Expected { name, overrides }.");
            return;
          }
          getSavedMappings((mappings) => {
            const existing = mappings.findIndex((m) => m.name === data.name);
            const entry = {
              name: data.name,
              created: data.created || (/* @__PURE__ */ new Date()).toISOString(),
              overrides: data.overrides
            };
            if (existing >= 0) {
              mappings[existing] = entry;
            } else {
              mappings.push(entry);
            }
            setSavedMappings(mappings, () => {
              refreshMappingsList();
              mappingSelect.value = data.name;
              updateMappingButtons();
            });
          });
        } catch {
          alert("Failed to parse JSON file.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
    refreshMappingsList();
    const overlayCaptureBtn = document.getElementById("overlay-capture-btn");
    const figmaDropZone = document.getElementById("figma-drop-zone");
    const figmaImageInput = document.getElementById("figma-image-input");
    const overlaySliderRow = document.getElementById("overlay-slider-row");
    const overlayOpacity = document.getElementById("overlay-opacity");
    const overlayOpacityVal = document.getElementById("overlay-opacity-val");
    const diffThresholdRow = document.getElementById("diff-threshold-row");
    const diffThreshold = document.getElementById("diff-threshold");
    const diffThresholdVal = document.getElementById("diff-threshold-val");
    const overlayCanvasArea = document.getElementById("overlay-canvas-area");
    const overlayCanvas = document.getElementById("overlay-canvas");
    const overlayMatchInfo = document.getElementById("overlay-match-info");
    const modeBtns = document.querySelectorAll(".overlay-mode-btn");
    let overlayMode = "onion";
    let browserScreenshot = null;
    let figmaImage = null;
    let capturedDPR = 1;
    overlayCaptureBtn.addEventListener("click", () => {
      if (!extractedData) {
        overlayCaptureBtn.textContent = "Pick element first";
        setTimeout(() => {
          overlayCaptureBtn.textContent = "Capture";
        }, 1500);
        return;
      }
      overlayCaptureBtn.disabled = true;
      overlayCaptureBtn.textContent = "Capturing...";
      const selector = extractedData?.element || "";
      sendMessage({ action: "CAPTURE_ELEMENT", selector });
    });
    function onElementCaptured(msg) {
      overlayCaptureBtn.disabled = false;
      overlayCaptureBtn.textContent = "Capture";
      if (!msg.screenshot || !msg.rect) {
        return;
      }
      capturedDPR = msg.devicePixelRatio || 1;
      const img = new Image();
      img.onload = () => {
        const cropX = msg.rect.viewportX * capturedDPR;
        const cropY = msg.rect.viewportY * capturedDPR;
        const cropW = msg.rect.width * capturedDPR;
        const cropH = msg.rect.height * capturedDPR;
        const canvas = document.createElement("canvas");
        canvas.width = msg.rect.width;
        canvas.height = msg.rect.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, msg.rect.width, msg.rect.height);
        browserScreenshot = canvas.toDataURL("image/png");
        renderOverlay();
      };
      img.src = msg.screenshot;
    }
    function onElementCaptureFailed(msg) {
      console.error("[Panel] onElementCaptureFailed", msg);
      overlayCaptureBtn.disabled = false;
      overlayCaptureBtn.textContent = "Failed \u2014 retry";
      setTimeout(() => {
        overlayCaptureBtn.textContent = "Capture";
      }, 2e3);
    }
    figmaDropZone.addEventListener("click", () => figmaImageInput.click());
    figmaImageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file)
        loadFigmaImage(file);
      e.target.value = "";
    });
    figmaDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      figmaDropZone.classList.add("drag-over");
    });
    figmaDropZone.addEventListener("dragleave", () => {
      figmaDropZone.classList.remove("drag-over");
    });
    figmaDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      figmaDropZone.classList.remove("drag-over");
      const file = e.dataTransfer?.files[0];
      if (file && file.type.startsWith("image/"))
        loadFigmaImage(file);
    });
    document.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items)
        return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file)
            loadFigmaImage(file);
          return;
        }
      }
    });
    function loadFigmaImage(file) {
      const reader = new FileReader();
      reader.onload = () => {
        figmaImage = reader.result;
        figmaDropZone.classList.add("has-image");
        figmaDropZone.textContent = "";
        const img = document.createElement("img");
        img.src = figmaImage;
        img.className = "preview-thumb";
        img.alt = "Figma design";
        figmaDropZone.appendChild(img);
        renderOverlay();
      };
      reader.readAsDataURL(file);
    }
    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        modeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        overlayMode = btn.dataset.mode;
        updateSliderVisibility();
        renderOverlay();
      });
    });
    function updateSliderVisibility() {
      overlaySliderRow.classList.toggle("hidden", overlayMode !== "onion");
      diffThresholdRow.classList.toggle("hidden", overlayMode !== "diff");
    }
    overlayOpacity.addEventListener("input", () => {
      overlayOpacityVal.textContent = overlayOpacity.value + "%";
      renderOverlay();
    });
    diffThreshold.addEventListener("input", () => {
      diffThresholdVal.textContent = diffThreshold.value;
      renderOverlay();
    });
    async function renderOverlay() {
      if (!browserScreenshot && !figmaImage) {
        overlayCanvasArea.classList.add("hidden");
        return;
      }
      overlayCanvasArea.classList.remove("hidden");
      overlayMatchInfo.classList.add("hidden");
      const ctx = overlayCanvas.getContext("2d");
      const browserImg = browserScreenshot ? await loadImg(browserScreenshot) : null;
      const figmaImg = figmaImage ? await loadImg(figmaImage) : null;
      const w = browserImg ? browserImg.width : figmaImg ? figmaImg.width : 0;
      const h = browserImg ? browserImg.height : figmaImg ? figmaImg.height : 0;
      if (overlayMode === "side-by-side") {
        const totalW = (browserImg ? w : 0) + (figmaImg ? figmaImg.width : 0) + (browserImg && figmaImg ? 8 : 0);
        const maxH = Math.max(h, figmaImg ? figmaImg.height : 0);
        overlayCanvas.width = totalW;
        overlayCanvas.height = maxH;
        ctx.clearRect(0, 0, totalW, maxH);
        let x = 0;
        if (browserImg) {
          ctx.drawImage(browserImg, 0, 0);
          x = browserImg.width + 8;
        }
        if (figmaImg) {
          ctx.drawImage(figmaImg, x, 0, figmaImg.width, figmaImg.height);
        }
      } else if (overlayMode === "onion") {
        overlayCanvas.width = w;
        overlayCanvas.height = h;
        ctx.clearRect(0, 0, w, h);
        if (browserImg)
          ctx.drawImage(browserImg, 0, 0);
        if (figmaImg) {
          const opacity = parseInt(overlayOpacity.value) / 100;
          ctx.globalAlpha = opacity;
          ctx.drawImage(figmaImg, 0, 0, w, h);
          ctx.globalAlpha = 1;
        }
      } else if (overlayMode === "diff") {
        overlayCanvas.width = w;
        overlayCanvas.height = h;
        ctx.clearRect(0, 0, w, h);
        if (browserImg && figmaImg) {
          const threshold = parseInt(diffThreshold.value) || 10;
          const imgDataA = getImageData(browserImg, w, h);
          const imgDataB = getImageData(figmaImg, w, h);
          const result = PixelDiff.compare(imgDataA, imgDataB, { threshold });
          ctx.putImageData(result.diffImageData, 0, 0);
          overlayMatchInfo.classList.remove("hidden");
          overlayMatchInfo.textContent = `${result.matchPercent}% match (${result.diffCount.toLocaleString()} / ${result.totalPixels.toLocaleString()} pixels differ)`;
          if (result.matchPercent >= 98) {
            overlayMatchInfo.className = "overlay-match-info good";
          } else if (result.matchPercent >= 90) {
            overlayMatchInfo.className = "overlay-match-info warn";
          } else {
            overlayMatchInfo.className = "overlay-match-info bad";
          }
        } else if (browserImg) {
          ctx.drawImage(browserImg, 0, 0);
        } else if (figmaImg) {
          ctx.drawImage(figmaImg, 0, 0, w, h);
        }
      }
    }
    function loadImg(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }
    function getImageData(img, w, h) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    }
    clearBtn.addEventListener("click", () => {
      browserScreenshot = null;
      figmaImage = null;
      overlayCanvasArea.classList.add("hidden");
      overlayMatchInfo.classList.add("hidden");
      figmaDropZone.classList.remove("has-image");
      figmaDropZone.textContent = "";
      const p1 = document.createElement("p");
      p1.textContent = "Drop or paste Figma screenshot here";
      const p2 = document.createElement("p");
      p2.className = "text-muted";
      p2.textContent = "Or click to upload";
      figmaDropZone.appendChild(p1);
      figmaDropZone.appendChild(p2);
    });
    updateSelectionLayout();
  })();
})();
