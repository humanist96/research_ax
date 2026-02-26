import { execSync } from 'child_process'
import { getProject, setProjectStatus } from '../src/lib/project/store'

function getProjectId(): string {
  const idx = process.argv.indexOf('--project-id')
  if (idx === -1 || idx + 1 >= process.argv.length) {
    console.error('[Pipeline] Usage: tsx scripts/pipeline.ts --project-id <id>')
    process.exit(1)
  }
  return process.argv[idx + 1]
}

function runStep(step: string, projectId: string): void {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`[Pipeline] Running: ${step}`)
  console.log('='.repeat(60))

  execSync(`tsx scripts/${step}.ts --project-id ${projectId}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
}

async function main() {
  const projectId = getProjectId()

  const project = getProject(projectId)
  if (!project) {
    console.error(`[Pipeline] Project ${projectId} not found`)
    process.exit(1)
  }
  if (!project.config) {
    console.error(`[Pipeline] Project ${projectId} has no config`)
    process.exit(1)
  }

  console.log(`[Pipeline] Starting pipeline for: ${project.name}`)

  try {
    setProjectStatus(projectId, 'collecting')
    runStep('collect', projectId)

    setProjectStatus(projectId, 'analyzing')
    runStep('analyze', projectId)

    setProjectStatus(projectId, 'reporting')
    runStep('generate-report', projectId)

    setProjectStatus(projectId, 'complete')
    console.log('\n[Pipeline] All steps completed successfully!')
  } catch (error) {
    setProjectStatus(projectId, 'error')
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Pipeline] Failed: ${msg}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[Pipeline] Fatal error:', error)
  process.exit(1)
})
