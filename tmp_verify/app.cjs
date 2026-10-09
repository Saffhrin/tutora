"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// frontend/src/App.tsx
var App_exports = {};
__export(App_exports, {
  default: () => App
});
module.exports = __toCommonJS(App_exports);
var import_react6 = require("react");
var import_react_router_dom7 = require("react-router-dom");
var import_lucide_react7 = require("lucide-react");

// frontend/src/pages/Dashboard.tsx
var import_react = require("react");
var import_react_router_dom = require("react-router-dom");
var import_lucide_react = require("lucide-react");

// frontend/src/api.ts
async function api(path, init) {
  const response = await fetch(`/api${path}`, { ...init, headers: { ...init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }, ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((item) => item.msg).join("; ") : body?.error || `Request failed (${response.status}). Please try again.`);
  }
  return response.json();
}
var post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
var percent = (value) => `${Math.round(value * 100)}%`;
function locationLabel(location = {}) {
  if (location.page != null) return `Page ${location.page}`;
  if (location.slide != null) return `Slide ${location.slide}`;
  if (location.timestamp_seconds != null) return `${Math.floor(location.timestamp_seconds / 60)}:${String(Math.floor(location.timestamp_seconds % 60)).padStart(2, "0")}`;
  return "Source passage";
}
function sourceLink(citation) {
  return `/library?source=${encodeURIComponent(citation.source_id)}&unit=${encodeURIComponent(citation.unit_id)}`;
}

// frontend/src/components/Mastery.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function Mastery({ value, evidence }) {
  const level = evidence === 0 ? "unknown" : value >= 0.7 ? "high" : value >= 0.4 ? "mid" : "low";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "mastery", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `mastery-bar ${level}`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${Math.max(4, Math.round(value * 100))}%` } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: evidence === 0 ? "no evidence yet" : `${percent(value)} \xB7 ${evidence} graded` })
  ] });
}

// frontend/src/pages/Dashboard.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function Dashboard({ onChanged }) {
  const [data, setData] = (0, import_react.useState)(null);
  const [history, setHistory] = (0, import_react.useState)([]);
  const [error, setError] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const navigate = (0, import_react_router_dom.useNavigate)();
  (0, import_react.useEffect)(() => {
    api("/dashboard").then(setData).catch((e) => setError(e.message));
    api("/assessments").then(setHistory).catch(() => void 0);
  }, []);
  const startDiagnostic = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await post("/assessments", { diagnostic: true, count: 6, kind: "mixed", difficulty: "adaptive", topic_ids: [] });
      onChanged();
      navigate(`/practice?assessment=${created.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (error && !data) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "banner warn", children: error });
  if (!data) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "loading", children: "Loading your learner model\u2026" });
  const graded = data.topics.filter((topic) => topic.evidence_count > 0);
  const weakest = [...data.topics].sort((a, b) => a.mastery - b.mastery)[0];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: "page-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "eyebrow", children: "Personalized tutoring \xB7 Track D" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h1", { children: [
          "Welcome back, ",
          data.learner.name
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "lede", children: graded.length === 0 ? "Your learner model has no graded evidence yet. Start with a short diagnostic quiz \u2014 the tutor will keep refusing anything your material does not cover." : `Mastery is estimated from ${data.stats.answered_questions} graded answers across ${data.stats.topics} topics. Weakest right now: ${weakest?.name}.` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { className: "primary", onClick: startDiagnostic, disabled: busy, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Target, { size: 16 }),
        " ",
        busy ? "Building quiz\u2026" : "Start diagnostic quiz"
      ] })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "banner warn", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "stats", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Stat, { icon: import_lucide_react.FileStack, label: "Sources", value: data.stats.sources }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Stat, { icon: import_lucide_react.Layers, label: "Content units", value: data.stats.units }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Stat, { icon: import_lucide_react.BookOpen, label: "Topics", value: data.stats.topics }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Stat, { icon: import_lucide_react.ClipboardCheck, label: "Assessments", value: data.stats.assessments }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Stat, { icon: import_lucide_react.Target, label: "Mean mastery", value: data.stats.answered_questions ? percent(data.stats.mean_mastery) : "\u2014" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "columns", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: "Topic mastery" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "muted", children: "Bayesian knowledge tracing over graded quiz answers only." }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "topic-list", children: data.topics.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "topic-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: topic.name }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "muted small", children: [
              topic.unit_count ?? 0,
              " units"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Mastery, { value: topic.mastery, evidence: topic.evidence_count }),
          topic.prerequisites.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("small", { className: "muted", children: [
            "Prerequisites: ",
            topic.prerequisites.join(" \u2192 ")
          ] })
        ] }, topic.id)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: "What to study next" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "muted", children: "Recommendations are ordered by evidence-weighted weakness." }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ol", { className: "reco", children: data.recommendations.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: item.title }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: item.reason }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "ghost", onClick: () => navigate(`/practice?topic=${item.topic_id}`), children: "Practice this topic" })
        ] }, item.topic_id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "divider" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: "Recent assessments" }),
        history.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "muted", children: "No assessments yet." }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "history", children: history.slice(0, 5).map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            item.diagnostic ? "Diagnostic" : "Practice",
            " \xB7 ",
            item.question_count,
            " questions"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: item.completed && item.score != null ? percent(item.score) : "in progress" })
        ] }, item.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "divider" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "disclaimer", children: data.disclaimer }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "muted small", children: [
          "Tutor engine: ",
          data.provider.enabled ? `Gemini (${data.provider.model}) writing over retrieved excerpts` : "offline extractive mode (verbatim citations, no generated prose)",
          "."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { className: "ghost", onClick: () => navigate("/tutor"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Play, { size: 14 }),
          " Open the grounded tutor"
        ] })
      ] })
    ] })
  ] });
}
function Stat({ icon: Icon, label, value }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "stat", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { size: 16 }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: value })
  ] });
}

// frontend/src/pages/Library.tsx
var import_react2 = require("react");
var import_react_router_dom2 = require("react-router-dom");
var import_lucide_react2 = require("lucide-react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var KIND_ICON = {
  pdf: import_lucide_react2.FileText,
  slides: import_lucide_react2.Presentation,
  video: import_lucide_react2.PlayCircle,
  audio: import_lucide_react2.PlayCircle,
  image: import_lucide_react2.Image,
  text: import_lucide_react2.FileText
};
function Library({ onChanged }) {
  const [sources, setSources] = (0, import_react2.useState)([]);
  const [detail, setDetail] = (0, import_react2.useState)(null);
  const [params, setParams] = (0, import_react_router_dom2.useSearchParams)();
  const [error, setError] = (0, import_react2.useState)("");
  const [notice, setNotice] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [pasteOpen, setPasteOpen] = (0, import_react2.useState)(false);
  const [pasteTitle, setPasteTitle] = (0, import_react2.useState)("");
  const [pasteText, setPasteText] = (0, import_react2.useState)("");
  const fileInput = (0, import_react2.useRef)(null);
  const focusRef = (0, import_react2.useRef)(null);
  const mediaRef = (0, import_react2.useRef)(null);
  const selectedId = params.get("source");
  const focusedUnit = params.get("unit");
  const load = () => api("/sources").then(setSources).catch((e) => setError(e.message));
  (0, import_react2.useEffect)(() => {
    load();
  }, []);
  (0, import_react2.useEffect)(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api(`/sources/${selectedId}`).then(setDetail).catch((e) => setError(e.message));
  }, [selectedId]);
  (0, import_react2.useEffect)(() => {
    if (focusedUnit && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const location = detail?.units.find((unit) => unit.id === focusedUnit)?.location;
    if (mediaRef.current && location?.timestamp_seconds != null) {
      mediaRef.current.currentTime = location.timestamp_seconds;
      mediaRef.current.play().catch(() => void 0);
    }
  }, [detail, focusedUnit]);
  const upload = async (file) => {
    setBusy(true);
    setError("");
    setNotice("");
    const body = new FormData();
    body.append("file", file);
    try {
      const created = await api("/sources/upload", { method: "POST", body });
      if (created.status === "failed") {
        setError(created.error || "Extraction failed.");
      } else {
        setNotice(`Extracted ${created.unit_count} grounded units from ${created.title}.`);
        setParams({ source: created.id });
      }
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const savePaste = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await api("/sources/text", {
        method: "POST",
        body: JSON.stringify({ title: pasteTitle || "Pasted notes", text: pasteText })
      });
      setNotice(`Added \u201C${created.title}\u201D with ${created.unit_count} units.`);
      setPasteOpen(false);
      setPasteText("");
      setPasteTitle("");
      setParams({ source: created.id });
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const focused = (0, import_react2.useMemo)(
    () => detail?.units.find((unit) => unit.id === focusedUnit) ?? null,
    [detail, focusedUnit]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { className: "page-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "eyebrow", children: "Multimodal knowledge base" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h1", { children: "Library" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "lede", children: "Drop in lecture videos, PDFs, slide decks, figures or pasted notes. Every unit keeps its exact origin \u2014 page, slide number or video timestamp." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "head-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "input",
          {
            ref: fileInput,
            type: "file",
            hidden: true,
            onChange: (event) => event.target.files?.[0] && upload(event.target.files[0]),
            accept: ".txt,.md,.pdf,.pptx,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm,.mpeg,.mpg"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { className: "primary", disabled: busy, onClick: () => fileInput.current?.click(), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.Upload, { size: 16 }),
          " ",
          busy ? "Extracting\u2026" : "Upload material"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { className: "ghost", onClick: () => setPasteOpen((open) => !open), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.Wand2, { size: 16 }),
          " Paste notes"
        ] })
      ] })
    ] }),
    notice && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "banner good", children: notice }),
    error && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "banner warn", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_lucide_react2.AlertTriangle, { size: 14 }),
      " ",
      error
    ] }),
    pasteOpen && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { children: "Paste text" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { placeholder: "Title", value: pasteTitle, onChange: (e) => setPasteTitle(e.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "textarea",
        {
          rows: 6,
          placeholder: "Paste lecture notes. Separate paragraphs with a blank line \u2014 each paragraph becomes a citable unit.",
          value: pasteText,
          onChange: (e) => setPasteText(e.target.value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { className: "primary", disabled: busy || pasteText.trim().length < 20, onClick: savePaste, children: "Save to library" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "library", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("h2", { children: [
          "Sources (",
          sources.length,
          ")"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "source-list", children: sources.map((source) => {
          const Icon = KIND_ICON[source.kind] ?? import_lucide_react2.FileText;
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              className: source.id === selectedId ? "source active" : "source",
              onClick: () => setParams({ source: source.id }),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { size: 16 }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: source.title }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("small", { children: [
                    source.kind,
                    " \xB7 ",
                    source.unit_count,
                    " units",
                    source.status === "failed" && " \xB7 failed"
                  ] })
                ] })
              ]
            }
          ) }, source.id);
        }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "card viewer", children: [
        !detail && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "muted", children: "Select a source to inspect its extracted units and original file." }),
        detail && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { children: detail.source.title }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "muted small", children: [
            detail.source.kind,
            " \xB7 ",
            detail.units.length,
            " units \xB7 created ",
            new Date(detail.source.created_at).toLocaleString()
          ] }),
          detail.source.status === "failed" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "banner warn", children: detail.source.error }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(OriginalPane, { source: detail.source, focus: focused, mediaRef }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { children: "Extracted units" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "unit-list", children: detail.units.map((unit) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "li",
            {
              ref: unit.id === focusedUnit ? focusRef : void 0,
              className: unit.id === focusedUnit ? "unit focused" : "unit",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "unit-head", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: unit.location.label ?? locationLabel(unit.location) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "chip", children: unit.topic_name ?? "untagged" }),
                  unit.visual_description && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "chip alt", children: "figure described" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: unit.text.length > 420 ? `${unit.text.slice(0, 420)}\u2026` : unit.text }),
                unit.visual_description && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "muted small", children: [
                  "Visual: ",
                  unit.visual_description
                ] })
              ]
            },
            unit.id
          )) })
        ] })
      ] })
    ] })
  ] });
}
function OriginalPane({
  source,
  focus,
  mediaRef
}) {
  const file = `/api/sources/${source.id}/file`;
  const timestamp = focus?.location?.timestamp_seconds;
  if (source.kind === "pdf") {
    const page = focus?.location?.page ? `#page=${focus.location.page}` : "";
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "original", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "unit-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: "Original PDF" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: `${file}${page}`, target: "_blank", rel: "noreferrer", children: "open in new tab" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("iframe", { title: source.title, src: `${file}${page}` })
    ] });
  }
  if (source.kind === "video" || source.kind === "audio") {
    const src = `${file}${timestamp != null ? `#t=${Math.floor(timestamp)}` : ""}`;
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "original", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "unit-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: source.kind === "video" ? "Lecture recording" : "Audio brief" }),
        timestamp != null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "chip", children: [
          "jump to ",
          locationLabel({ timestamp_seconds: timestamp })
        ] })
      ] }),
      source.kind === "video" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("video", { ref: mediaRef, controls: true, src }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("audio", { ref: mediaRef, controls: true, src })
    ] });
  }
  if (source.kind === "slides" || source.kind === "image") {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "original", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "unit-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: source.kind === "slides" ? "Original slide deck" : "Original figure" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: file, target: "_blank", rel: "noreferrer", children: "open original" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "muted small", children: "Extracted text for the focused unit is highlighted below \u2014 the viewer always shows the exact slide or figure description that a citation points to." })
    ] });
  }
  return null;
}

// frontend/src/pages/Tutor.tsx
var import_react3 = require("react");
var import_react_router_dom4 = require("react-router-dom");
var import_lucide_react4 = require("lucide-react");

// frontend/src/components/Citation.tsx
var import_lucide_react3 = require("lucide-react");
var import_react_router_dom3 = require("react-router-dom");
var import_jsx_runtime4 = require("react/jsx-runtime");
var ICONS = {
  pdf: import_lucide_react3.FileText,
  slides: import_lucide_react3.Presentation,
  video: import_lucide_react3.PlayCircle,
  image: import_lucide_react3.Image,
  audio: import_lucide_react3.PlayCircle
};
function Citation({ citation, kind = "pdf" }) {
  const Icon = ICONS[kind] ?? import_lucide_react3.FileText;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_router_dom3.Link, { className: "citation", to: sourceLink(citation), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "citation-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { size: 14 }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: citation.source_title }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: citation.location_label ?? locationLabel(citation.location) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("blockquote", { children: citation.excerpt.length > 240 ? `${citation.excerpt.slice(0, 240)}\u2026` : citation.excerpt }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "citation-open", children: "Open exact source \u2192" })
  ] });
}

// frontend/src/pages/Tutor.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function Tutor() {
  const [messages, setMessages] = (0, import_react3.useState)([]);
  const [topics, setTopics] = (0, import_react3.useState)([]);
  const [scope, setScope] = (0, import_react3.useState)("");
  const [draft, setDraft] = (0, import_react3.useState)("");
  const [suggestions, setSuggestions] = (0, import_react3.useState)([]);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [error, setError] = (0, import_react3.useState)("");
  const endRef = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
    api("/topics").then(setTopics).catch(() => void 0);
    api("/chat/history").then((history) => {
      setMessages(history.map((item) => ({
        role: item.role,
        content: item.content,
        citations: item.citations,
        grounded: item.role === "tutor" ? item.citations.length > 0 : void 0,
        mode: item.mode ?? void 0
      })));
    }).catch(() => void 0);
    post("/chat", { message: "What does this course cover?" }).then((reply) => setSuggestions(reply.suggested_questions)).catch(() => void 0);
  }, []);
  (0, import_react3.useEffect)(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);
  const ask = async (text) => {
    const question = text.trim();
    if (!question || busy) return;
    setDraft("");
    setError("");
    setMessages((current) => [...current, { role: "student", content: question, citations: [] }]);
    setBusy(true);
    try {
      const reply = await post("/chat", { message: question, topic_id: scope || null });
      setMessages((current) => [...current, {
        role: "tutor",
        content: reply.answer,
        citations: reply.citations,
        grounded: reply.grounded,
        mode: reply.mode
      }]);
      setSuggestions(reply.suggested_questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "page-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "eyebrow", children: "Source grounding" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h1", { children: "Grounded tutor" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "lede", children: "Answers are written only over retrieved excerpts of your material, and each claim links to the exact page, slide or timestamp. Anything outside the material is declined instead of guessed." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "scope", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "Scope" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("select", { value: scope, onChange: (event) => setScope(event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "", children: "All topics" }),
          topics.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: topic.id, children: topic.name }, topic.id))
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "chat", children: [
      messages.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "chat-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.Sparkles, { size: 20 }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { children: "Ask about your own material" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "muted", children: "Try \u201CHow do I compute mean squared error?\u201D or \u201CWhat is the learning rate for?\u201D" })
      ] }),
      messages.map((message, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: `bubble ${message.role} ${message.role === "tutor" ? message.grounded ? "grounded" : "declined" : ""}`, children: [
        message.role === "tutor" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `badge ${message.grounded ? "good" : "warn"}`, children: message.grounded ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.ShieldCheck, { size: 13 }),
          " Source-backed"
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.ShieldOff, { size: 13 }),
          " Declined \u2014 not in your material"
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: message.content }),
        message.citations.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "citations", children: message.citations.map((citation) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Citation, { citation }, citation.unit_id)) }),
        message.mode && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("small", { className: "muted tiny", children: [
          "engine: ",
          message.mode
        ] })
      ] }, index)),
      busy && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "bubble tutor", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "muted", children: "Retrieving from your library\u2026" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { ref: endRef })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "banner warn", children: error }),
    suggestions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "suggestions", children: suggestions.map((question) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { className: "chip-button", onClick: () => ask(question), children: question }, question)) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "form",
      {
        className: "composer",
        onSubmit: (event) => {
          event.preventDefault();
          ask(draft);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "input",
            {
              value: draft,
              placeholder: "Ask something from your lectures, textbook or slides\u2026",
              onChange: (event) => setDraft(event.target.value)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { className: "primary", type: "submit", disabled: busy || !draft.trim(), children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.CornerDownLeft, { size: 16 }),
            " Ask"
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: "muted small", children: [
      "The tutor cannot see the internet, only your library. Ask ",
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react_router_dom4.Link, { to: "/library", children: "Library" }),
      " for what is indexed."
    ] })
  ] });
}

// frontend/src/pages/Practice.tsx
var import_react4 = require("react");
var import_react_router_dom5 = require("react-router-dom");
var import_lucide_react5 = require("lucide-react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function Practice({ onChanged }) {
  const [params, setParams] = (0, import_react_router_dom5.useSearchParams)();
  const [topics, setTopics] = (0, import_react4.useState)([]);
  const [selected, setSelected] = (0, import_react4.useState)([]);
  const [count, setCount] = (0, import_react4.useState)(5);
  const [kind, setKind] = (0, import_react4.useState)("mixed");
  const [difficulty, setDifficulty] = (0, import_react4.useState)("adaptive");
  const [assessment, setAssessment] = (0, import_react4.useState)(null);
  const [answers, setAnswers] = (0, import_react4.useState)({});
  const [report, setReport] = (0, import_react4.useState)(null);
  const [error, setError] = (0, import_react4.useState)("");
  const [busy, setBusy] = (0, import_react4.useState)(false);
  (0, import_react4.useEffect)(() => {
    api("/topics").then((data) => {
      setTopics(data);
      const preselect = params.get("topic");
      setSelected(preselect ? [preselect] : []);
    }).catch((e) => setError(e.message));
  }, []);
  (0, import_react4.useEffect)(() => {
    const existing = params.get("assessment");
    if (existing) {
      api(`/assessments/${existing}/questions`).then((data) => setAssessment({ id: existing, ...data })).catch(() => void 0);
    }
  }, []);
  const generate = async (diagnostic = false) => {
    setBusy(true);
    setError("");
    setReport(null);
    setAnswers({});
    try {
      const created = await post("/assessments", {
        topic_ids: diagnostic ? [] : selected,
        count,
        kind,
        difficulty,
        diagnostic
      });
      setAssessment(created);
      setParams({ assessment: created.id });
      onChanged();
    } catch (e) {
      setError(e.message);
      setAssessment(null);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!assessment) return;
    setBusy(true);
    setError("");
    try {
      const result = await post(`/assessments/${assessment.id}/submit`, { answers });
      setReport(result);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const answeredCount = (0, import_react4.useMemo)(
    () => assessment ? assessment.questions.filter((question) => (answers[question.id] ?? "").trim()).length : 0,
    [assessment, answers]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("header", { className: "page-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "eyebrow", children: "Adaptive assessment" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { children: "Practice & mock exams" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "lede", children: "Pick a scope; questions are tagged to a topic, a source location and a difficulty. Items are never reused across assessments, and each answer comes back with cited feedback." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "ghost", onClick: () => generate(true), disabled: busy, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Target, { size: 16 }),
        " Diagnostic quiz (all topics)"
      ] })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "banner warn", children: error }),
    !assessment && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: "Choose your scope" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "topic-picker", children: topics.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: selected.includes(topic.id) ? "pick active" : "pick", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            type: "checkbox",
            checked: selected.includes(topic.id),
            onChange: (event) => setSelected((current) => event.target.checked ? [...current, topic.id] : current.filter((id) => id !== topic.id))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: topic.name }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { children: topic.evidence_count === 0 ? "no evidence" : `${percent(topic.mastery)} mastery` })
      ] }, topic.id)) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "controls", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { children: [
          "Questions",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "number", min: 1, max: 10, value: count, onChange: (e) => setCount(Number(e.target.value)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { children: [
          "Type",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { value: kind, onChange: (e) => setKind(e.target.value), children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "mixed", children: "Mixed" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "mcq", children: "Multiple choice" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "short", children: "Short answer" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "numerical", children: "Numerical" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { children: [
          "Difficulty",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { value: difficulty, onChange: (e) => setDifficulty(e.target.value), children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "adaptive", children: "Adaptive (weakest topics first)" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "easy", children: "Easy" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "medium", children: "Medium" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "hard", children: "Hard" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "primary", onClick: () => generate(false), disabled: busy, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.ClipboardList, { size: 16 }),
          " ",
          busy ? "Generating\u2026" : "Generate assessment"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "muted small", children: selected.length === 0 ? "No topic selected = every topic in your library." : `${selected.length} topic(s) selected.` })
    ] }),
    assessment && !report && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "card", children: [
      assessment.notice && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "banner quiet", children: assessment.notice }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("h2", { children: [
        assessment.questions.length,
        " questions"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ol", { className: "questions", children: assessment.questions.map((question, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "question-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("b", { children: [
            "Q",
            index + 1
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "chip", children: question.topic_name }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "chip alt", children: question.difficulty }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "chip alt", children: question.kind }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "chip alt", children: question.origin === "gemini" ? "AI-generated, verified" : "reviewed bank" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: question.prompt }),
        question.kind === "mcq" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "options", children: (question.options ?? []).map((option) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: answers[question.id] === option ? "option active" : "option", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "radio",
              name: question.id,
              checked: answers[question.id] === option,
              onChange: () => setAnswers((current) => ({ ...current, [question.id]: option }))
            }
          ),
          option
        ] }, option)) }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            className: "answer",
            placeholder: question.kind === "numerical" ? "Numeric answer" : "Your answer",
            value: answers[question.id] ?? "",
            onChange: (event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
          }
        ),
        question.source && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("details", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("summary", { children: "Source location (hidden until you answer)" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Citation, { citation: question.source })
        ] })
      ] }, question.id)) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "controls", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "primary", onClick: submit, disabled: busy || answeredCount === 0, children: [
          "Submit ",
          answeredCount,
          " answer",
          answeredCount === 1 ? "" : "s"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "ghost", onClick: () => {
          setAssessment(null);
          setAnswers({});
          setParams({});
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.RefreshCw, { size: 14 }),
          " New scope"
        ] })
      ] })
    ] }),
    report && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("h2", { children: [
        "Report \xB7 ",
        percent(report.score),
        " (",
        report.correct,
        "/",
        report.total,
        ")"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "columns", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: "Mastery updates" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ul", { className: "history", children: report.mastery_changes.map((change) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: change.name }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("b", { className: change.after >= change.before ? "up" : "down", children: [
              percent(change.before),
              " \u2192 ",
              percent(change.after)
            ] })
          ] }, change.topic_id)) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: "Weak topics" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ul", { className: "history", children: report.weak_topics.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: topic.name }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("b", { children: percent(topic.mastery) })
          ] }, topic.id)) }),
          report.misconceptions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: "Likely misconceptions" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ul", { className: "misconceptions", children: report.misconceptions.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("li", { children: item }, item)) })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: "Cited feedback" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ul", { className: "feedback", children: report.feedback.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { className: item.correct ? "ok" : "no", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "question-head", children: [
              item.correct ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.CheckCircle2, { size: 15 }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.XCircle, { size: 15 }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("b", { children: [
                "Q",
                index + 1
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "chip", children: item.topic_name })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: item.prompt }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "muted small", children: [
              "You answered \u201C",
              item.student_answer || "\u2014",
              "\u201D. Expected: ",
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("b", { children: item.expected_answer })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "small", children: item.explanation }),
            item.citation && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Citation, { citation: item.citation })
          ] }, item.question_id)) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "controls", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "primary", onClick: () => generate(false), disabled: busy, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.RefreshCw, { size: 14 }),
          " Another set (new questions)"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "ghost", onClick: () => {
          setAssessment(null);
          setReport(null);
          setAnswers({});
          setParams({});
        }, children: "Change scope" })
      ] })
    ] })
  ] });
}

// frontend/src/pages/CourseMap.tsx
var import_react5 = require("react");
var import_react_router_dom6 = require("react-router-dom");
var import_lucide_react6 = require("lucide-react");
var import_jsx_runtime7 = require("react/jsx-runtime");
function CourseMap() {
  const [topics, setTopics] = (0, import_react5.useState)([]);
  const [error, setError] = (0, import_react5.useState)("");
  (0, import_react5.useEffect)(() => {
    api("/topics").then(setTopics).catch((e) => setError(e.message));
  }, []);
  const roots = topics.filter((topic) => topic.prerequisites.length === 0);
  const byName = (name) => topics.find((topic) => topic.name === name);
  const maxDepth = (topic, seen = []) => {
    if (seen.includes(topic.id)) return 0;
    const parents = topic.prerequisites.map(byName).filter(Boolean);
    return parents.length === 0 ? 0 : 1 + Math.max(...parents.map((parent) => maxDepth(parent, [...seen, topic.id])));
  };
  const depth = (topic) => maxDepth(topic);
  if (error) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "banner warn", children: error });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("header", { className: "page-head", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "eyebrow", children: "Visual course flow" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { children: "Topic & prerequisite map" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "lede", children: "Prerequisites come from the topic metadata; mastery colours come from your graded evidence. Auto-grouped topics from your own uploads are marked." })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("h2", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.Network, { size: 16 }),
        " Learning path"
      ] }),
      topics.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "muted", children: "No topics yet \u2014 upload material first." }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "map", children: [...topics].sort((a, b) => depth(a) - depth(b)).map((topic) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "map-node", style: { marginLeft: `${depth(topic) * 48}px` }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "map-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "topic-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { children: topic.name }),
          topic.auto && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "chip alt", children: "auto" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Mastery, { value: topic.mastery, evidence: topic.evidence_count }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "muted small", children: topic.description }),
        topic.prerequisites.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { className: "small prerequisites", children: [
          topic.prerequisites.map((name) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
            name,
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react6.ArrowRight, { size: 11 })
          ] }, name)),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { children: topic.name })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_router_dom6.Link, { className: "ghost", to: `/practice?topic=${topic.id}`, children: "Practice \u2192" })
      ] }) }, topic.id)) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "divider" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h3", { children: "Foundation topics" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ul", { className: "history", children: roots.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: topic.name }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { children: topic.evidence_count === 0 ? "no evidence" : percent(topic.mastery) })
      ] }, topic.id)) })
    ] })
  ] });
}

// frontend/src/App.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var NAV = [
  { to: "/", label: "Dashboard", icon: import_lucide_react7.LayoutDashboard, end: true },
  { to: "/library", label: "Library", icon: import_lucide_react7.Library, end: false },
  { to: "/tutor", label: "Tutor", icon: import_lucide_react7.GraduationCap, end: false },
  { to: "/practice", label: "Practice", icon: import_lucide_react7.BookOpen, end: false },
  { to: "/map", label: "Course map", icon: import_lucide_react7.Network, end: false }
];
function App() {
  const [status, setStatus] = (0, import_react6.useState)({ online: true, provider: null });
  const navigate = (0, import_react_router_dom7.useNavigate)();
  const refresh = (0, import_react6.useCallback)(() => {
    api("/dashboard").then((data) => setStatus({ online: true, provider: data.provider })).catch(() => setStatus((current) => ({ ...current, online: false })));
  }, []);
  (0, import_react6.useEffect)(() => {
    refresh();
    const timer = setInterval(refresh, 2e4);
    return () => clearInterval(timer);
  }, [refresh]);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "shell", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("aside", { className: "sidebar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "brand", onClick: () => navigate("/"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "brand-mark", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_lucide_react7.Sparkles, { size: 18 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: "Tutora" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { children: "A little more understanding, every day." })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("nav", { children: NAV.map(({ to, label, icon: Icon, end }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_router_dom7.NavLink, { to, end, className: ({ isActive }) => isActive ? "active" : "", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { size: 17 }),
        " ",
        label
      ] }, to)) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "sidebar-foot", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: `pill ${status.provider?.enabled ? "pill-good" : "pill-quiet"}`, children: status.provider?.enabled ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          "Gemini: ",
          status.provider.model
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_lucide_react7.WifiOff, { size: 13 }),
          " Offline mode: local extraction + extractive tutor"
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { children: "Every answer is cited to a page, slide or timestamp \u2014 or refused." })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("main", { children: [
      !status.online && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "banner warn", children: [
        "The Tutora API is not reachable on port ",
        "8123",
        ". Start it with ",
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("code", { children: "python -m backend.main" }),
        " (it skips to a free port automatically) or",
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("code", { children: "./scripts/dev.sh" }),
        " for API and UI together."
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_router_dom7.Routes, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_router_dom7.Route, { path: "/", element: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Dashboard, { onChanged: refresh }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_router_dom7.Route, { path: "/library", element: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Library, { onChanged: refresh }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_router_dom7.Route, { path: "/tutor", element: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tutor, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_router_dom7.Route, { path: "/practice", element: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Practice, { onChanged: refresh }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_router_dom7.Route, { path: "/map", element: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(CourseMap, {}) })
      ] })
    ] })
  ] });
}
