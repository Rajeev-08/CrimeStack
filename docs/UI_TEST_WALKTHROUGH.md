# UI acceptance walkthrough

Use a fresh test database or existing synthetic data. Keep backend/frontend running and open http://127.0.0.1:5173.

1. Sign in/bootstrap. Expect navy navigation and a light content area.
2. Data Registry: choose `synthetic-karnataka.csv`. Leave publisher empty and click Confirm import. Expect a specific error and focus on Publisher/source label. Enter “Fictional test generator”, choose synthetic provenance, and confirm. Accepted records must match the unfiltered dashboard count.
3. Command Centre: switch district/category/date filters, saved views and all three map modes. With external tiles blocked, valid points must remain on the dark map canvas. No coordinates must show the coordinate-help notice.
4. Pattern Discovery: inspect day/hour totals. Import/select `synthetic-long-duration.csv` to exercise Isolation Forest outliers. Scores must be historical aggregate scores, not person predictions.
5. Copilot: ask “Show theft in Bengaluru in January 2026”, then “What about Mysuru?”. Category/date scope must remain. Test patterns, repeat cases and socio-economic context before and after auxiliary imports; inspect citations. Try Kannada and optional voice in a supported browser.
6. Network: import `synthetic-network.json`, filter multiple-case links and select Entity 1. Inspect dated case history. With a viewer account, source IDs/case references must be masked.
7. Context: import `synthetic-context.json` and inspect rates/correlation. With fewer than five matching districts, correlation must be unavailable with a clear explanation.
8. Risk Models: train with the long-duration dataset, inspect split dates/Brier comparison and rejection status. Only a validated model can be activated by supervisor/admin. Activation is not guaranteed by training.
9. Copilot: export a conversation using browser Save as PDF. Check that only the conversation/citations appear, with legible Kannada, and no sidebar/input controls.
10. Review a warning, create/claim a task, subscribe to notifications before triggering events, create/submit/approve an investigation, generate/verify/download a brief, and inspect the audit trail.
11. Resize to 390px wide and check that tables scroll within their own containers and all navigation is reachable from the menu.

These are the real-browser checks to perform in your environment; they were not claimed as executed in the restricted build browser.
