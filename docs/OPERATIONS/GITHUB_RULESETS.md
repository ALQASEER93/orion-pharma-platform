# GitHub Rulesets - Required Checks on `main`

## Objective
Enforce required status checks on `main` using repository rulesets via API (no manual UI actions).

## Stable Context Discovery
Sample window: last 5 merged PRs on `main` (`#24`, `#23`, `#22`, `#21`, `#20`).

Selection policy:
- Include contexts with `SUCCESS` in at least 3 of 5 PRs.
- Exclude contexts with `SKIPPED` outcomes from required list.

Observed counts:
- `changes`: 5/5
- `quickgate`: 5/5
- `api`: 5/5
- `web`: 1/5
- `shared-tooling`: 1/5

Final required contexts:
- `changes`
- `quickgate`
- `api`

## Ruleset
- Name: `orion-main-required-checks`
- ID: `13265771`
- Target: `branch`
- Branch condition include: `refs/heads/main`
- Enforcement: `active`

Note:
- Attempted `enforcement: evaluate` first.
- API returned: `Enforcement evaluate option is not supported on this plan.`
- Fallback to `active` was applied.

## Applied Payload (Exact)
```json
{
  "name": "orion-main-required-checks",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": [
        "refs/heads/main"
      ],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          {
            "context": "changes"
          },
          {
            "context": "quickgate"
          },
          {
            "context": "api"
          }
        ]
      }
    }
  ]
}
```

## Re-Apply Commands
```powershell
$owner='ALQASEER93'
$repo='orion-pharma-platform'
$rulesetId='13265771'

gh api -X PATCH repos/$owner/$repo/rulesets/$rulesetId --input .tmp_ruleset_payload_active.json
gh ruleset list
gh ruleset check --default
```

## Verification Snapshot
- `gh ruleset list`:
  - `13265771  orion-main-required-checks  ...  active  1`
- `gh ruleset check --default`:
  - `1 rules apply to branch main ...`
  - `required_status_checks ... context:changes, context:quickgate, context:api`
