# [1.1.0](https://github.com/glorynguyen/ui-checker/compare/vscode-bridge-v1.0.0...vscode-bridge-v1.1.0) (2026-05-15)


### Features

* **bridge:** add runtime setup button to Chrome extension panel ([6298a97](https://github.com/glorynguyen/ui-checker/commit/6298a97f63d15706e2ad9a47150c05e1db695ff3))

# 1.0.0 (2026-05-14)


### Bug Fixes

* add ws ([807b14d](https://github.com/glorynguyen/ui-checker/commit/807b14d3f8df98914ec941bcf9c5a4ba70bfe345))
* **ci:** prevent release workflow race conditions ([a40b8df](https://github.com/glorynguyen/ui-checker/commit/a40b8df4aa156971e11313f7f5677b4ade50889a))
* package-lock ([55dc9f1](https://github.com/glorynguyen/ui-checker/commit/55dc9f134f0c243ddcbac4b01b83c2534f68a334))
* **panel:** [HWWW-XXX] handle port disconnections ([7c28036](https://github.com/glorynguyen/ui-checker/commit/7c28036d696ee22e347bcfac457b3305b36c7190))


### Features

* add batch mode for multi-element comparison ([28353de](https://github.com/glorynguyen/ui-checker/commit/28353de43616a23203e567d97993cbad67f72466))
* add results filtering functionality to the comparison results ([adbc5a2](https://github.com/glorynguyen/ui-checker/commit/adbc5a2cf2c3f0ad2d25fb8e04c40f061b5ae35d))
* **bridge:** add VS Code extension for locate-in-code functionality ([05c6919](https://github.com/glorynguyen/ui-checker/commit/05c69196065246f7e9195ed782a0a957fe64ec15))
* **bridge:** change default WebSocket port to 9876 ([6b08a11](https://github.com/glorynguyen/ui-checker/commit/6b08a117855ed547627f4db7a8ea6c1ccff57da1))
* **chrome-extension:** add visual overlay ([821d300](https://github.com/glorynguyen/ui-checker/commit/821d300bb49f78e91aadb63d226ad7417daf4dee))
* enhance CI/CD integration and add runtime setup command ([b44b35b](https://github.com/glorynguyen/ui-checker/commit/b44b35b492d65ebf025ec54b859b7bb38a26b012))
* **figma:** add direct Figma REST API integration ([317443c](https://github.com/glorynguyen/ui-checker/commit/317443cef635b31ca7512d4b857931f6f557b314))
* **figma:** add local caching for Figma API responses ([40f3eb5](https://github.com/glorynguyen/ui-checker/commit/40f3eb5ef8e07081123ab34aaa9757e7d6b3b603))
* initialize package.json for figma-css-diff project with semantic-release setup ([31a088a](https://github.com/glorynguyen/ui-checker/commit/31a088a4c495e37bbb68f75ad4950dcfbe2a0b54))
* migrate codebase to TypeScript ([6e8ab9d](https://github.com/glorynguyen/ui-checker/commit/6e8ab9dc04e1c5418718e4370a53280fc8ffca74))
* **panel:** [HWWW-XXX] add CSS variable support ([3711106](https://github.com/glorynguyen/ui-checker/commit/3711106650f6d73cc18f27bf97b8cb48ce233f6a))
* **panel:** [HWWW-XXX] add selector and mappings ([31bee5c](https://github.com/glorynguyen/ui-checker/commit/31bee5cc08dc58802a07fee5b105f48a8aa39e64))
* **panel:** add selection empty state with guided workflow ([fcf2123](https://github.com/glorynguyen/ui-checker/commit/fcf2123ecc1bb0bfad04d29250fe3983a708a0d2))
* **panel:** redesign selection UI and add AI copy feature ([ee3e544](https://github.com/glorynguyen/ui-checker/commit/ee3e544cee3ba175ff1b66042aa2ec1d9ae0769f))
* **panel:** streamline onboarding UI ([e51e29d](https://github.com/glorynguyen/ui-checker/commit/e51e29de18dde3e74c8570bcc2ac2d71f7bf86bf))
* **source-location:** add runtime instrumentation and enhanced selector matching ([ed7cbab](https://github.com/glorynguyen/ui-checker/commit/ed7cbab61ebcbebf96ea8ba9a8824e449e73d881))
* update release configuration for semantic-release with Google credentials ([32133a7](https://github.com/glorynguyen/ui-checker/commit/32133a7243b012be785fb4b45fd35fd47130c79d))
* update semantic-release dependencies in package.json and package-lock.json ([f27f791](https://github.com/glorynguyen/ui-checker/commit/f27f79190ba3880bb6a9b2ec3a6631393df99ce7))
* **vscode-bridge:** add marketplace links and setup guidance ([91b8ccc](https://github.com/glorynguyen/ui-checker/commit/91b8ccc0b3e821e144f2b0d3b80cb1db39037dda))
* **vscode-bridge:** add retake port command for multi-window use ([c50c78c](https://github.com/glorynguyen/ui-checker/commit/c50c78c51446ecabe092b9475bb989a1f7c6af85))


### BREAKING CHANGES

* **bridge:** Default bridge port changed from 3000 to 9876. Users
with existing configurations must update both VS Code and Chrome
extension settings to use the same port.
* **chrome-extension:** Remove batch mode comparison feature. The batch UI and
multi-element comparison workflow has been replaced by the visual overlay
system.

# [2.2.0](https://github.com/glorynguyen/ui-checker/compare/v2.1.0...v2.2.0) (2026-04-30)


### Features

* **source-location:** add runtime instrumentation and enhanced selector matching ([ed7cbab](https://github.com/glorynguyen/ui-checker/commit/ed7cbab61ebcbebf96ea8ba9a8824e449e73d881))

## [2.0.1](https://github.com/glorynguyen/ui-checker/compare/v2.0.0...v2.0.1) (2026-04-28)


### Bug Fixes

* package-lock ([55dc9f1](https://github.com/glorynguyen/ui-checker/commit/55dc9f134f0c243ddcbac4b01b83c2534f68a334))
