const path = require('path')
const fs = require('fs-extra')
const ora = require('ora')
const execa = require('execa')

const args = require('minimist')(process.argv.slice(2))
const formats = args.formats || args.f

build('')

async function build (target) {
  const pkgDir = '../'
  const pkg = require(`${pkgDir}/package.json`)

  // allow packages to skip build
  if (pkg.skipBuild) return

  const spinner = ora(`Building ${pkg.name} \r`).start()

  try {
    if (!formats) {
      await fs.remove(`${pkgDir}/dist`)
    }

    await execa(
      'rollup',
      [
        '-c',
        '--environment',
        [
          `TARGET:${target}`,
          formats ? `FORMATS:${formats}` : ''
        ]
          .filter(Boolean)
          .join(',')
      ],
      { stdio: 'inherit' }
    )

    // build types
    const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor')

    const extractorConfigPath = path.resolve('api-extractor.json')
    const extractorConfig = ExtractorConfig.loadFileAndPrepare(extractorConfigPath)
    Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: true
    })

    await fs.remove('dist/packages')

    spinner.succeed()
  } catch (e) {
    spinner.fail()
    console.error(e.stack)
  }
}
