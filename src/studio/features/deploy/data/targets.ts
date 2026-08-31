// Vendored from Prompt Studio (features/deploy/data/targets.ts). Do not edit here — run `pnpm sync`.
/**
 * Where the generated app is meant to end up, and how the agent gets it there.
 *
 * Two different answers, so two different questions. The MCP list is "you have
 * these tools, use them and hand me back a URL" — the agent provisions and
 * deploys during the build. AWS CDK is "you do not have my account, so write
 * the infrastructure down and I will run it" — nothing is provisioned, a stack
 * file is produced. Picking both is coherent: deploy the preview on the managed
 * platforms and still commit the CDK app.
 */

export type DeployMcp = {
  id: string
  label: string
  /** shown under the checkbox */
  hint: string
  /** what the agent is told to do with this MCP server */
  promptLines: string[]
}

export const deployMcps: DeployMcp[] = [
  {
    id: "vercel",
    label: "Vercel MCP",
    hint: "Deploys the web build and returns the live URL",
    promptLines: [
      "**Vercel** — use the Vercel MCP server to create the project and deploy the web build. Set every `NEXT_PUBLIC_*` variable the app reads before the first deploy, not after: a build that ships without its API URL looks deployed and is not.",
      "Report the production URL and the preview URL separately, and say which git branch each one tracks.",
    ],
  },
  {
    id: "neon",
    label: "Neon MCP",
    hint: "Provisions Postgres and runs the migrations",
    promptLines: [
      "**Neon** — use the Neon MCP server to create the Postgres project, then run the migrations for the data model above against it. Confirm the tables exist by querying them; do not assume a migration that exited zero actually applied.",
      "Report the connection string with the password masked, and say plainly that the unmasked one is in the environment variables you set — never paste a live password into your summary.",
    ],
  },
  {
    id: "render",
    label: "Render MCP",
    hint: "Deploys the backend service",
    promptLines: [
      "**Render** — use the Render MCP server to create and deploy the backend service. Point it at the database above, set the deploy branch explicitly, and wait for the deploy to reach `live` rather than reporting success when it is still building.",
      "Report the service URL and confirm its health endpoint answers 200.",
    ],
  },
]

export const deployMcpMap = Object.fromEntries(
  deployMcps.map((mcp) => [mcp.id, mcp])
) as Record<string, DeployMcp>

export type IacTarget = {
  id: string
  label: string
  hint: string
}

export const iacTargets: IacTarget[] = [
  {
    id: "none",
    label: "None",
    hint: "No infrastructure code — deploy by hand or with the MCP servers above",
  },
  {
    id: "aws-cdk",
    label: "AWS CDK",
    hint: "Write a CDK app sized to what this project actually needs",
  },
]

/**
 * The CDK instruction.
 *
 * "Minimal configuration as per the app need" is the whole point: an agent
 * asked for a CDK stack with no constraint reaches for a VPC, three subnets, a
 * NAT gateway and a Fargate service for an app that is one container and one
 * database. So the rule is stated as a floor to justify against, and the
 * inventory is derived from the document rather than guessed.
 */
export const AWS_CDK_INSTRUCTION = [
  "Write an AWS CDK app (TypeScript, `aws-cdk-lib` v2) under `infra/`, sized to this project and nothing more.",
  "**Minimal means minimal.** Provision only what the screens, endpoints and tables above actually require. Before you add any construct, be able to name the feature in this brief that needs it — if you cannot, leave it out. In particular: no VPC unless something in it must be private, no NAT gateway unless a private subnet genuinely needs egress, no load balancer for a single container that a function URL or an App Runner service can serve, no Route 53 zone unless a domain was specified, and no multi-AZ or read replica unless this brief asked for availability guarantees.",
  "Structure it as one stack per deployable piece, with the environment (`dev` / `prod`) as a stack prop rather than a copied file. Put every tunable — instance sizes, retention, memory, the domain — in one `config.ts` with the dev defaults set to the cheapest thing that works.",
  "Do not hardcode secrets. Database credentials go in Secrets Manager, everything else in SSM parameters, and the app reads them at runtime.",
  "Include, in `infra/README.md`: the bootstrap and deploy commands, what each stack creates, a rough monthly cost estimate at idle, and the teardown command. State explicitly anything you left out on purpose so the developer can decide whether they wanted it.",
  "Run `cdk synth` and confirm it succeeds before you report back. Do not run `cdk deploy` unless you were given credentials and asked to.",
].join("\n\n")
