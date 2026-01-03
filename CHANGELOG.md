# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-03

### Fixed
- **CI/CD:** Fixed release workflow permissions (403 Forbidden).
- **Packaging:** Fixed issue where `google-credentials.json` was missing in the packaged application by adding it to `extraResources` and updating path resolution.

## [0.2.0] - 2026-01-03

### Added
- **Cloud Backup:**
    - Integrated Google Drive cloud backup (Phase 4).
    - Added progress bar for cloud uploads.
    - Implemented pause/resume functionality for cloud uploads.
- **USB & Automation:**
    - Implemented auto-backup triggers on USB connection (Phase 3).
    - Added robust USB detection using PowerShell/WMI polling.
    - Added visual destination selection with radio buttons.
- **Backup Core:**
    - Added guided backup flow with visual source selection (Phase 2).
    - Implemented local backup logic with streams and soft fail.
    - Added exclusion patterns for `node_modules`, `.git`, etc.
    - Added destination selection dialog.

### Fixed
- **CI/CD:**
    - Resolved all linting, formatting, and type-checking warnings in `npm run ci`.
    - Fixed TypeScript version mismatch warning.
- **Cloud:**
    - Fixed `stream.push()` after EOF error in cloud uploads.
    - Fixed cancel behavior to properly stop all source uploads.
- **Logic:**
    - Stabilized auto-backup triggers and exclusions.
    - Corrected bytes tracking during backup.
    - Improved USB detection commands.
- **Configuration:**
    - Fixed PostCSS configuration (converted to CJS).
    - addresed ESM warnings.

### Changed
- **Documentation:**
    - Updated README and SPECIFICATIONS.
- **Build/Chore:**
    - Set up CI/CD pipeline (linting, formatting, logger).
    - Configured release workflow.
    - Removed verbose logs.

## [0.1.0] - 2026-01-02

### Added
- Initial project skeleton with Electron, Vite, React, and TypeScript.
