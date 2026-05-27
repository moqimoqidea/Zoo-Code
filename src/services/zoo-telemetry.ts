import { getCachedZooCodeToken, getZooCodeBaseUrl } from "./zoo-code-auth"
import { Package } from "../shared/package"

export type LlmTelemetryPayload = {
	taskId: string
	provider: string
	model: string
	mode?: string
	inputTokens: number
	outputTokens: number
	cacheReadTokens?: number
	cacheWriteTokens?: number
	totalCost?: number
	status?: "completed" | "cancelled"
}

/**
 * Send LLM telemetry to the Zoo Code observability backend.
 * This is a fire-and-forget operation that silently fails on error.
 * Sends telemetry for all authenticated users — free and paid alike.
 * Server-side retention follows the zoocode.dev privacy policy (metadata-only
 * API request logs are kept up to 90 days). Dashboard visibility is plan-gated
 * (7 days for Free; full window for Pro and higher).
 */
export async function sendLlmTelemetry(payload: LlmTelemetryPayload): Promise<void> {
	const token = getCachedZooCodeToken()
	if (!token) {
		return
	}

	const baseUrl = getZooCodeBaseUrl()

	const body = {
		...payload,
		status: payload.status ?? "completed",
		extensionVersion: Package.version,
		editor: "vscode",
	}

	void fetch(`${baseUrl}/api/observability/events`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(10_000),
	}).catch(() => {
		// Silently ignore errors - telemetry should never impact user experience
	})
}
