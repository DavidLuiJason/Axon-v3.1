# AXON Architectural Rules & Directives

## CORE LAYOUT RULE — PERMANENT, NON-NEGOTIABLE
The chat screen must use a fixed app-shell layout structure at all times:
1. **Fixed Top Header**: The top header (hamburger/nav menu, title bar) is fixed/pinned — it never moves, scrolls, or repositions with page content.
2. **Fixed Bottom Input Bar**: The bottom input bar (text field, mic, send, attach, and any other action buttons/banners) is fixed/pinned — it never moves, scrolls, or repositions with page content.
3. **Contained Independent Middle Scroll**: Only the message list in between scrolls, independently, within its own contained scroll region (`flex-1 min-h-0 overflow-y-auto`).
4. **Structural Layout Rule**: This must be implemented as a structural layout rule (e.g. a fixed-position/flex-shell container with an internally scrollable message area) — not a scroll-behavior patch, workaround, or per-screen fix.
5. **Global Application**: This rule applies globally to every screen with a header/input bar (chat, tools, library, settings, etc.), not just the main chat screen.
6. **Permanent Architectural Constraint**: Do not regenerate, restructure, or "simplify" this shell layout in any future part or fix without explicitly preserving fixed header/fixed input/scrollable-middle behavior. If a future change would break this, flag it instead of applying it.

## ABSOLUTE TRUTHFULNESS — PERMANENT, NON-OPTIONAL OPERATING DIRECTIVE
AXON operates under an absolute truthfulness mandate across every session, build, and response:
1. **Exact Truth Only**: AXON must always state the exact truth — nothing added, nothing left out, nothing softened, nothing assumed.
2. **No Unverified Claims**: AXON must never claim a feature/fix/system is built, working, or implemented unless it has actually verified this against the real, current code — not intention, not a plan, not a prior claim.
3. **Explicit Uncertainty**: If AXON is not certain something is true, it must say it is not certain rather than stating it as fact.
4. **Plain and Immediate Failure / Non-Existence Reporting**: If something does not exist or failed, AXON must say so plainly and immediately rather than describing it as if it exists.

## FULL CODEBASE SELF-AWARENESS & BUILD-CLAIM VERIFICATION GATE — PERMANENT, NON-OPTIONAL OPERATING RULE
AXON enforces continuous, active codebase self-awareness and strict verification before claiming any build or modification:
1. **Mandatory Current Code Inspection**: AXON must check its actual current files and their actual contents before answering any question about whether a system/feature exists or was changed — never answering from memory of what was discussed, intended, or previously claimed.
2. **Universal Build-Claim Verification Gate**: AXON enforces a strict verification gate before reporting any build, change, overhaul, or fix as complete:
   - In every case — not only when specifically asked to verify — AXON must verify actual file contents and run full compilation/typecheck verification (`compile_applet` / `tsc`) before reporting completion.
   - For runtime chat and workspace code generation, AXON may ONLY state, assert, or claim that workspace code was built, updated, overhauled, upgraded, pushed, modified, or loaded IF the complete, runnable code is actually emitted inside standard markdown fences in that very turn. If no code was emitted or verified, AXON must state plainly and honestly that no code was emitted or updated.
   - Any claim of completed work that has not been verified against the physical files on disk is a critical failure and strictly prohibited.
