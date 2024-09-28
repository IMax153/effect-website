import { definePlugin } from "@expressive-code/core"
import { EOL } from "node:os"
import * as fs from "node:fs"
import * as path from "node:path"

export interface CodeImportOptions {
  readonly rootDir?: string
}

export interface PluginCodeImportProps {
  lines?: Array<string>
}

declare module "@expressive-code/core" {
  export interface ExpressiveCodeBlockProps extends PluginCodeImportProps { }
}

const FILE_META_REGEX = /^(?<path>.+?)(?:(?:#(?:L(?<from>\d+)(?<dash>-)?)?)(?:L(?<to>\d+))?)?$/

export default function pluginCodeImport(options: CodeImportOptions = {}) {
  const {
    rootDir = process.cwd()
  } = options

  if (!path.isAbsolute(rootDir)) {
    throw new Error(`The provided 'rootDir' must be an absolute path - received: ${rootDir}`)
  }

  return definePlugin({
    name: "@plugins/code-import",
    hooks: {
      preprocessMetadata(context) {
        const fileMeta = context.codeBlock.metaOptions.getString("file")

        if (fileMeta !== undefined) {
          const parsedFileMeta = FILE_META_REGEX.exec(fileMeta)

          if (!parsedFileMeta || !parsedFileMeta.groups || !parsedFileMeta.groups.path) {
            throw new Error(`Received invalid 'file' path: ${fileMeta}`)
          }

          const parsedPath = parsedFileMeta.groups.path
          const normalizedPath = parsedPath.replace("^<rootDir>", rootDir).replace(/\\ /g, " ")
          const sourceFileDir = path.dirname(context.codeBlock.parentDocument?.sourceFilePath || "")
          const absolutePath = path.resolve(sourceFileDir, normalizedPath)

          const fromLine = parsedFileMeta.groups.from
            ? Number.parseInt(parsedFileMeta.groups.from, 10)
            : undefined

          const toLine = parsedFileMeta.groups.to
            ? Number.parseInt(parsedFileMeta.groups.to, 10)
            : undefined

          const hasDash = parsedFileMeta.groups.dash !== undefined || fromLine === undefined

          const fileContent = fs.readFileSync(absolutePath, "utf8")
          const targetLines = extractLines(fileContent, fromLine, hasDash, toLine)

          context.codeBlock.props.lines = targetLines
        }
      },
      preprocessCode(context) {
        const fileMeta = context.codeBlock.metaOptions.getString("file")
        const lines = context.codeBlock.props.lines

        if (fileMeta && lines) {
          context.codeBlock.insertLines(0, lines)
        }
      }
    }
  })
}

function extractLines(
  content: string,
  fromLine: number | undefined,
  hasDash: boolean,
  toLine: number | undefined,
): Array<string> {
  const lines = content.split(EOL)
  const start = fromLine || 1
  let end: number
  if (!hasDash) {
    end = start
  } else if (toLine) {
    end = toLine
  } else {
    end = lines.length - 1
  }
  return lines.slice(start - 1, end)
}
