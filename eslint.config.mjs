import js from "@eslint/js";
import html from "eslint-plugin-html";

const browserGlobals = {
  document: "readonly",
  window: "readonly",
  fetch: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  navigator: "readonly",
  location: "readonly",
  history: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  MouseEvent: "readonly",
  KeyboardEvent: "readonly",
  FocusEvent: "readonly",
  alert: "readonly",
  confirm: "readonly",
  performance: "readonly",
  AudioContext: "readonly",
  webkitAudioContext: "readonly",
  getComputedStyle: "readonly",
  matchMedia: "readonly",
  DOMMatrixReadOnly: "readonly",
  addEventListener: "readonly",
  removeEventListener: "readonly",
  Worker: "readonly",
};

const commonRules = {
  "no-var": "off",
  "no-console": "off",
  "no-undef": "error",
  "no-unreachable": "warn",
  "no-constant-condition": ["warn", { checkLoops: false }],
  "no-empty": ["warn", { allowEmptyCatch: true }],
  "prefer-const": "off",
  "no-prototype-builtins": "off",
};

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: {
      ...commonRules,
      "no-unused-vars": ["warn", {
        args: "none",
        varsIgnorePattern: "^(STYLE_LABEL|roleStyleReality|_|ovrUnificado|srand)$",
      }],
    },
  },
  {
    files: ["**/*.html"],
    plugins: { html },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: {
      ...commonRules,
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-redeclare": "off",
      "no-global-assign": "off",
    },
  },
  {
    files: ["game.js"],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    files: ["calibrador-worker.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        postMessage: "readonly",
        importScripts: "readonly",
        fetch: "readonly",
        performance: "readonly",
        navigator: "readonly",
        console: "readonly",
      },
    },
    rules: commonRules,
  },
  {
    files: ["bancada/**/*.js", "tools/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        exports: "writable",
      },
    },
    rules: commonRules,
  },
  {
    ignores: ["node_modules/**", "sandbox_backup/**"],
  },
];
