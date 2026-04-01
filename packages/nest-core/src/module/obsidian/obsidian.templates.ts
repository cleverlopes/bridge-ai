export function RULES_AND_CONVENTIONS_CONTENT(today: string): string {
  return `---
type: resource
title: "Vault Rules and Conventions"
scope: global
updated: ${today}
---

# Vault Rules and Conventions

## Structure (PARA)
- **projects/** — active and recently completed project intelligence
- **areas/** — project-agnostic knowledge domains (long-lived)
- **resources/** — frequently referenced materials (provider catalogs, glossary, etc.)
- **archive/** — deprecated or completed items
- **inbox/** — unclassified intake

## Frontmatter Rules
- Every note MUST have YAML frontmatter
- Required fields: \`type\`, \`title\`, \`created\`, \`updated\`, \`tags\`
- \`type\`: one of \`project | area | resource | archive | inbox | index | template\`
- \`tags\` MUST include a \`status/*\` tag for project notes

## Naming Conventions
- Folders: \`kebab-case\`
- Files: \`UPPER-CASE.md\` for main artifacts (MOC, ROADMAP, STATE, etc.)
- Phase folders: \`<NN>-<phase-name>\` (zero-padded number)

## Linking Rules
- Every project note links to \`[[projects/<slug>/MOC]]\`
- Every area note includes \`source_projects\` frontmatter linking back to projects
- Use \`[[wikilinks]]\` for cross-references

## Sync Behaviour
- \`ROADMAP.md\`, \`STATE.md\`, \`MOC.md\` are overwritten on sync
- \`CONTEXT.md\` is NEVER overwritten — edit freely
- \`EXECUTION-LOG.md\` is written in real-time during execution — do not edit
`;
}

export const VAULT_TEMPLATES: Record<string, string> = {
  'project-moc.md': `---
type: project
scope: project
project: {{project}}
status: draft
phase: "0"
phase_name: ""
cost_usd: 0
created: {{date}}
updated: {{date}}
tags:
  - status/draft
  - project/{{project}}
links: []
---

# {{name}}

{{description}}
`,

  'phase-context.md': `---
type: resource
title: "Phase {{phase}}: {{phase_name}}"
project: {{project}}
phase: {{phase}}
phase_name: "{{phase_name}}"
status: pending
created: {{date}}
updated: {{date}}
tags:
  - project/{{project}}
  - phase/{{phase}}
---

# Phase {{phase}}: {{phase_name}}

## Objective

## Context

## Notes
`,

  'phase-plan.md': `---
type: resource
title: "Phase {{phase}} Plan"
project: {{project}}
phase: {{phase}}
created: {{date}}
updated: {{date}}
tags:
  - project/{{project}}
  - phase/{{phase}}
---

# Phase {{phase}} Plan

## Objective

## Tasks

## Success Criteria
`,

  'phase-summary.md': `---
type: resource
title: "Phase {{phase}} Summary"
project: {{project}}
phase: {{phase}}
status: completed
created: {{date}}
updated: {{date}}
tags:
  - project/{{project}}
  - phase/{{phase}}
---

# Phase {{phase}} Summary

## One-liner

## Completed Tasks

## Deviations

## Decisions
`,

  'phase-verification.md': `---
type: resource
title: "Phase {{phase}} Verification"
project: {{project}}
phase: {{phase}}
created: {{date}}
updated: {{date}}
tags:
  - project/{{project}}
  - phase/{{phase}}
---

# Phase {{phase}} Verification

## Status

## Checks

## Issues
`,

  'execution-log.md': `---
type: resource
title: "Execution Log — Phase {{phase}}"
project: {{project}}
phase: {{phase}}
created: {{date}}
updated: {{date}}
tags:
  - project/{{project}}
  - phase/{{phase}}
---

# Execution Log — Phase {{phase}}

> Written in real-time during execution. Do not edit manually.
`,

  'retrospective.md': `---
type: resource
title: "Retrospective — {{phase_name}}"
project: {{project}}
created: {{date}}
updated: {{date}}
tags:
  - project/{{project}}
---

# Retrospective

## What went well

## What could be improved

## Action items
`,

  'area-note.md': `---
type: area
title: "{{title}}"
source_projects: []
created: {{date}}
updated: {{date}}
tags:
  - area/{{slug}}
---

# {{title}}

## Overview

## Key Concepts

## References
`,

  'resource-note.md': `---
type: resource
title: "{{title}}"
created: {{date}}
updated: {{date}}
tags:
  - resource/{{slug}}
---

# {{title}}

## Summary

## Content
`,

  'inbox-note.md': `---
type: inbox
title: "{{title}}"
created: {{date}}
updated: {{date}}
tags:
  - inbox
---

# {{title}}

## Content
`,
};
