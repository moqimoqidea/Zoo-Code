/**
 * Live end-to-end demo for Phase 1.
 *
 * Spins up a mock IPC server (mimicking the extension's API surface) and then
 * forks the bridge process (`src/main.ts`) as a real child Node process
 * pointed at that socket. The bridge issues a `GetModes` API call and prints
 * the response. This proves the forked node process can talk to the API
 * surface over a real Unix socket.
 *
 * Run with:  pnpm --filter @zoo-code/remote-bridge exec tsx scripts/demo.ts
 */
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

import { IpcServer } from "@roo-code/ipc"
import { IpcMessageType, IpcOrigin, RooCodeEventName, TaskCommandName, type TaskEvent } from "@roo-code/types"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function uniqueSocketPath(): string {
	return path.join(os.tmpdir(), `zoo-code-bridge-demo-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`)
}

async function main() {
	const socketPath = uniqueSocketPath()
	try {
		fs.unlinkSync(socketPath)
	} catch {
		// ignore
	}

	const server = new IpcServer(socketPath, (...args) => process.stderr.write(`[mock-server] ${args.join(" ")}\n`))

	server.on(IpcMessageType.TaskCommand, (clientId, command) => {
		process.stderr.write(`[mock-server] received command: ${command.commandName}\n`)

		if (command.commandName === TaskCommandName.GetModes) {
			server.send(clientId, {
				type: IpcMessageType.TaskEvent,
				origin: IpcOrigin.Server,
				data: {
					eventName: RooCodeEventName.ModesResponse,
					payload: [
						[
							{ slug: "code", name: "Code" },
							{ slug: "architect", name: "Architect" },
							{ slug: "ask", name: "Ask" },
							{ slug: "debug", name: "Debug" },
						],
					],
				} as TaskEvent,
			})
		}
	})

	server.listen()
	process.stderr.write(`[demo] mock IPC server listening on ${socketPath}\n`)

	// Fork the bridge entry point as a real child process.
	const mainPath = path.join(__dirname, "..", "src", "main.ts")
	const child = spawn("tsx", [mainPath, "--socket", socketPath, "--command", "get-modes"], {
		stdio: "inherit",
	})

	await new Promise<void>((resolve) => {
		child.on("close", (code) => {
			process.stderr.write(`\n[demo] bridge process exited with code ${code}\n`)
			resolve()
		})
	})

	cleanupSocket(socketPath)
	// node-ipc keeps the event loop alive in the mock server; exit explicitly.
	process.exit(0)
}

function cleanupSocket(socketPath: string) {
	try {
		fs.unlinkSync(socketPath)
	} catch {
		// ignore
	}
}

void main()
