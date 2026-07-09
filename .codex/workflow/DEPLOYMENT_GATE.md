# Deployment Gate — Codex Automation V2

## Authorization Boundary

Deployment is part of the autonomous loop only when the current user request
already authorizes the specific external mutation and no paid-service approval,
missing credential, destructive action, or manual production verification is
pending.

Stop and checkpoint when:

- required credentials or secrets are unavailable;
- paid deployment or paid-service mutation lacks explicit approval;
- rollback or migration could destroy data;
- a human must verify real production behavior.

Do not expose secret values in evidence.

## Pre-Deploy Gate

1. Confirm deployment is required by the active goal.
2. Follow `DEPLOYMENT_CHECKLIST.md`.
3. Run required build, targeted tests, full regression tests, and the current
   review gate.
4. Confirm the exact commit and changed-file scope.
5. Confirm environment-variable names are present without printing values.
6. Define health checks, log checks, rollout order, rollback trigger, and known
   good version.
7. Request approval only if the authorization boundary above requires it.

## Deploy and Verify

1. Deploy the exact reviewed commit using the authorized mechanism.
2. Record deployment ID, commit SHA, service/environment, command, and result.
3. Verify startup, health endpoints, critical logs, and relevant smoke tests.
4. Observe the required stability window.
5. Run automated production checks that are safe and authorized.
6. If manual verification is required, checkpoint exact steps and stop.
7. On failure, execute only a pre-authorized, non-destructive rollback.
   Otherwise stop for approval with the rollback command prepared.
8. After successful verification, update the deployment checklist, progress,
   risks, next action, and acceptance evidence; then continue the loop.

## Deployment Evidence

```text
Authorization:
Reviewed commit:
Pre-deploy commands/results:
Deployment command/result:
Deployment ID:
Startup/health evidence:
Log window and findings:
Smoke checks:
Manual verification: complete | required
Rollback readiness/result:
Production state: VERIFIED | PARTIAL | NOT VERIFIED
Next action:
```

A successful deploy is not proof of feature correctness. Mark production
criteria complete only when their required automated or manual verification is
recorded.
