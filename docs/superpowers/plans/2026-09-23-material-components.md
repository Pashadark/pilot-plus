# Material components implementation plan

Goal: reversible Material-inspired UI using existing components and unchanged rental actions.

Architecture: opt-in material interface mode; CSS scoped to data-interface. Existing classic and obsidian remain defaults and fallbacks. No database changes.

- [ ] ThemeProvider: accept material in DOM and storage; preserve theme independence. Add regression test selecting material then classic and handling storage events.
- [ ] Root bootstrap: restore material before hydration. AppearanceControls: add Material preview radio option.
- [ ] Shared components: add stable styling hooks for controls and buttons; scoped material stylesheet with light/dark tokens, focus/error/disabled states. Existing UI-kit consumes these same primitives.
- [ ] RentalWizard: scoped step indicator and form sections, no action or calculation changes.
- [ ] Run ThemeProvider, appearance, UI and rental wizard tests; lint and typecheck; inspect responsive rendering before deployment.

Rollback: select obsidian/classic; source archive backups/pre-materialize-ui-20260923.tar.gz. Do not delete previous server release. Do not deploy unverified preview.
