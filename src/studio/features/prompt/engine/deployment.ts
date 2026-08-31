// Vendored from Prompt Studio (features/prompt/engine/deployment.ts). Do not edit here — run `pnpm sync`.
import { AWS_CDK_INSTRUCTION, deployMcpMap } from "../../deploy/data/targets"
import type { ProjectDoc } from "../../../types/project"

/**
 * The deployment block.
 *
 * Empty when nothing was chosen, which matters: the block list drops empty
 * bodies, so a project that has not answered the question gets no deployment
 * section at all rather than a paragraph telling the agent to deploy nowhere.
 */
export function deploymentBlock(doc: ProjectDoc): string {
  const deployment = doc.deployment
  const mcps = deployment.mcps
    .map((id) => deployMcpMap[id])
    .filter((mcp) => mcp !== undefined)
  const wantsCdk = deployment.iac === "aws-cdk"
  const notes = deployment.notes.trim()

  if (!mcps.length && !wantsCdk && !notes) return ""

  const parts: string[] = []

  if (mcps.length) {
    parts.push(
      "Deploy this project yourself using the MCP servers listed below. They are connected and available to you — do not print shell commands for the developer to run, and do not stop at \"ready to deploy\"."
    )
    parts.push(mcps.flatMap((mcp) => mcp.promptLines).join("\n\n"))
    parts.push(
      [
        "When the deploy is done, end your report with a **Deployment** section containing:",
        "- every live URL, labelled by what it is (web app, API, dashboard)",
        "- the sign-in credentials for any account you created, including a seeded admin if the app needs one to be usable",
        "- every environment variable you set, with secret values masked",
        "- anything still needed from the developer before this is production-ready — a custom domain, a paid plan, an SMTP provider, a rotated secret",
        "Treat the credentials you hand back as throwaway: say so, and tell the developer to rotate them before real use.",
      ].join("\n")
    )
  }

  if (wantsCdk) {
    parts.push(AWS_CDK_INSTRUCTION)
  }

  if (mcps.length && wantsCdk) {
    // Both is a coherent choice, and left unexplained it reads as a
    // contradiction the agent resolves by picking one.
    parts.push(
      "These two are not in conflict: deploy the running preview on the managed platforms above, and still commit the CDK app as the path to the developer's own AWS account. Say in your report which one is currently serving traffic."
    )
  }

  if (notes) parts.push(notes)

  return parts.join("\n\n")
}
