# Changelog

The list of commits in this changelog is automatically generated in the release process.
The commits follow the Conventional Commit specification.

## [0.2.1] - 2026-04-22

### 🚀 Features

- Added json console exporter (#43)

### 🐛 Bug Fixes

- Changed docker copy path to adhere to tsc rootDir (#42)

### ⚙️ Miscellaneous Tasks

- Bump version to v0.2.1
- Bump version to v0.2.1-rc.0

## [0.2.0] - 2026-04-21

### 🚀 Features

- Added correlationId (#36)
- Use hash tagged actions, fix lint issues (#35)
- Update alpine packages in dockerfile (#33)
- Add workflow lint (#32)
- Create self contained node bundle (#27)
- Add npm version bump workflow (#28)

### 🐛 Bug Fixes

- Adjust workflow permissions (#40)
- Refactor workflow lint action (#37)
- Adjust permissions for nightly workflow (#38)
- Harmonize json output (#34)

### 🚜 Refactor

- Harmonization (#30)

### ⚙️ Miscellaneous Tasks

- Bump version to v0.2.0
- Bump version to v0.2.0-rc.0
- Updated cryptobroker-client dependency (#41)
- Updated tsconfig node to 24, updated packages (#39)
- Update actions to latest versions for Node 24 support (#29)

## [0.1.1-rc1] - 2026-03-26

### 🚀 Features

- Add nightly security scan (#23)
- Updated docker to work with npm (#19)
- Use npm package from registry (#18)
- Added otel tracing for CLI commands (#14)
- Server benchmark (#13)
- Add workflow for generating binary during release (#10)
- Added health status task (#8)
- Implemented status check command (#6)

### 🐛 Bug Fixes

- Add npm ci to install dependencies before other CI tasks (#26)
- Update Dockerfile (#22)
- Harmonize CLI (#25)
- Adjust env file and Taskfile (#21)
- Fixed task command and pretty print benchmark results (#17)
- Renamed healthCheck function (#7)

### 💼 Other

- Otel logging (#15)

### 🚜 Refactor

- Adjust Docker image generation (#11)
- Adjust Task setup (#9)

### ⚙️ Miscellaneous Tasks

- Version updates task rename (#12)

### ◀️ Revert

- Removed configs for using github npm registry (#20)

## [0.1.0] - 2025-12-02

### 🚀 Features

- Add workflow files (#4)

### 🐛 Bug Fixes

- Adjust task test-sign to new path (#5)

### 📚 Documentation

- Updated CLI installation section and taskfile comments

### ⚙️ Miscellaneous Tasks

- Updated the container image name (#3)
- Updated packages for new branch model (#2)
- Addition of GHCR workflow and adjustment of dependencies (#1)
