# TypeScript Errors Inventory

Date captured: 2026-07-26
Command run: `npm run build` (in `client/`)

## Summary

- Total errors: 26
- Files affected: 5
- Error codes observed: TS18048, TS2345, TS2339, TS2305

### Errors by file

- `src/pages/ApprovalGroups.tsx`: 5
- `src/pages/Dashboard.tsx`: 2
- `src/pages/WorkflowDetail.tsx`: 11
- `src/pages/WorkflowEdit.tsx`: 3
- `src/pages/Workflows.tsx`: 5

## Full Error List

### src/pages/ApprovalGroups.tsx

1. `src/pages/ApprovalGroups.tsx:38:26` - TS18048 - `'group.members' is possibly 'undefined'.`
2. `src/pages/ApprovalGroups.tsx:208:20` - TS18048 - `'group.members' is possibly 'undefined'.`
3. `src/pages/ApprovalGroups.tsx:217:20` - TS18048 - `'group.members' is possibly 'undefined'.`
4. `src/pages/ApprovalGroups.tsx:222:20` - TS18048 - `'group.members' is possibly 'undefined'.`
5. `src/pages/ApprovalGroups.tsx:222:49` - TS18048 - `'group.members' is possibly 'undefined'.`

### src/pages/Dashboard.tsx

1. `src/pages/Dashboard.tsx:166:16` - TS18048 - `'req.steps' is possibly 'undefined'.`
2. `src/pages/Dashboard.tsx:235:48` - TS2345 - `Argument of type 'ApprovalStep[] | undefined' is not assignable to parameter of type 'ApprovalStep[]'. Type 'undefined' is not assignable to type 'ApprovalStep[]'.`

### src/pages/WorkflowDetail.tsx

1. `src/pages/WorkflowDetail.tsx:214:37` - TS18048 - `'workflow.slots' is possibly 'undefined'.`
2. `src/pages/WorkflowDetail.tsx:214:65` - TS18048 - `'workflow.slots' is possibly 'undefined'.`
3. `src/pages/WorkflowDetail.tsx:215:50` - TS18048 - `'workflow.steps' is possibly 'undefined'.`
4. `src/pages/WorkflowDetail.tsx:215:78` - TS18048 - `'workflow.steps' is possibly 'undefined'.`
5. `src/pages/WorkflowDetail.tsx:216:39` - TS18048 - `'workflow.columns' is possibly 'undefined'.`
6. `src/pages/WorkflowDetail.tsx:216:70` - TS18048 - `'workflow.columns' is possibly 'undefined'.`
7. `src/pages/WorkflowDetail.tsx:225:14` - TS18048 - `'workflow.columns' is possibly 'undefined'.`
8. `src/pages/WorkflowDetail.tsx:248:14` - TS18048 - `'workflow.slots' is possibly 'undefined'.`
9. `src/pages/WorkflowDetail.tsx:273:14` - TS18048 - `'workflow.steps' is possibly 'undefined'.`
10. `src/pages/WorkflowDetail.tsx:281:76` - TS2339 - `Property 'approverName' does not exist on type '{ id: string; order: number; approverId: string; }'.`
11. `src/pages/WorkflowDetail.tsx:301:14` - TS18048 - `'workflow.columns' is possibly 'undefined'.`

### src/pages/WorkflowEdit.tsx

1. `src/pages/WorkflowEdit.tsx:10:3` - TS2305 - `Module '"../types"' has no exported member 'ApprovalSlotConfig'.`
2. `src/pages/WorkflowEdit.tsx:360:38` - TS18048 - `'g.members' is possibly 'undefined'.`
3. `src/pages/WorkflowEdit.tsx:361:28` - TS18048 - `'g.members' is possibly 'undefined'.`

### src/pages/Workflows.tsx

1. `src/pages/Workflows.tsx:7:40` - TS2305 - `Module '"../types"' has no exported member 'ApprovalSlotConfig'.`
2. `src/pages/Workflows.tsx:250:40` - TS18048 - `'g.members' is possibly 'undefined'.`
3. `src/pages/Workflows.tsx:250:65` - TS18048 - `'g.members' is possibly 'undefined'.`
4. `src/pages/Workflows.tsx:509:24` - TS18048 - `'wf.steps' is possibly 'undefined'.`
5. `src/pages/Workflows.tsx:509:46` - TS18048 - `'wf.steps' is possibly 'undefined'.`

## Notes

- This list is a direct snapshot of compiler output at capture time.
- Most errors are strict-nullability (`possibly 'undefined'`) and type export mismatches.
