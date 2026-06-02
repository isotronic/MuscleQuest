/* eslint-env node */
"use strict";

// @lingui/metro-transformer/expo hardcodes require('@expo/metro-config/babel-transformer'),
// but since Expo SDK 54.0.35, @expo/metro-config and babel-preset-expo are both nested
// under expo/node_modules/ and not hoisted. Loading babel-transformer by its absolute
// nested path keeps it in the same resolution context as babel-preset-expo.

const path = require("path");
const fs = require("fs");

const expoDir = path.dirname(require.resolve("expo/package.json"));
const nestedTransformerPath = path.join(
  expoDir,
  "node_modules/@expo/metro-config/build/babel-transformer.js",
);

const upstreamTransformer = fs.existsSync(nestedTransformerPath)
  ? require(nestedTransformerPath)
  : require("@expo/metro-config/babel-transformer");

const linguiExpoEntry = require.resolve("@lingui/metro-transformer/expo");
const sharedDir = path.join(path.dirname(linguiExpoEntry), "..", "shared");
const sharedFile = fs
  .readdirSync(sharedDir)
  .find((f) => f.endsWith(".cjs") && f.startsWith("metro-transformer"));
const { createLinguiMetroTransformer } = require(
  path.join(sharedDir, sharedFile),
);

const transform = createLinguiMetroTransformer(upstreamTransformer);
module.exports = { transform };
