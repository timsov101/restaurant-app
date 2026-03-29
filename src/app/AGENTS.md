# AGENTS.md

## Workflow
- Always use /plan behavior for UI tasks before making edits.
- Do not edit code until you have inspected relevant files and returned a plan for approval.
- Prefer minimal, targeted changes over broad refactors.

## UI rules
- Reuse existing components and styling patterns whenever possible.
- Prefer canonical primitives for cards, buttons, chips, inputs, typography, icons, and spacing.
- If no reusable primitive exists, propose extracting one before duplicating UI.
- Keep changes mobile-first.

## Figma rules
- When a Figma selection link is provided, use it as the primary design source.
- If design context is incomplete, say exactly what is missing before coding.
- Do not infer final visual details from neighboring screens unless explicitly told to.

## Verification
- Run the smallest relevant lint/test command after edits.
- Report changed files, commands run, and follow-up recommendations.