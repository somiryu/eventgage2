import { env } from '$env/dynamic/private';

const DEFAULT_MCP_URL = 'https://bem-mcp.onrender.com/mcp';

export interface McpToolDefinition {
	name: string;
	description?: string;
	inputSchema?: any;
}

export interface McpNoteSummary {
	id: string;
	title: string;
	type?: string;
	score?: number;
}

export interface McpNoteDetail {
	id: string;
	title?: string;
	frontmatter?: Record<string, any>;
	content?: string;
}

/**
 * Parsea respuestas de transportes MCP que entregan datos en formato JSON directo
 * o en streams SSE ('event: message\ndata: {...}').
 */
function parseMcpPayload(rawText: string): any {
	if (!rawText || !rawText.trim()) return null;

	const trimmed = rawText.trim();
	if (!trimmed.includes('data:')) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return null;
		}
	}

	const lines = trimmed.split('\n');
	for (const line of lines) {
		const l = line.trim();
		if (l.startsWith('data:')) {
			const jsonStr = l.slice(5).trim();
			try {
				return JSON.parse(jsonStr);
			} catch {
				continue;
			}
		}
	}

	return null;
}

/**
 * Ejecuta una llamada JSON-RPC al servidor remoto BEM Brain MCP alojado en Render.
 */
export async function callRemoteMcp(method: string, params: Record<string, any> = {}, timeoutMs: number = 3000): Promise<any> {
	const url = env.BEM_MCP_URL || DEFAULT_MCP_URL;
	const token = env.BEM_MCP_TOKEN;

	if (!token) {
		console.warn('[BEM-MCP] BEM_MCP_TOKEN no configurada — se omite el contexto de BEM Brain (best-effort, no bloquea a GIOCCHI).');
		return null;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json, text/event-stream',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: Date.now(),
				method,
				params
			}),
			signal: controller.signal
		});

		if (!res.ok) {
			console.warn(`[BEM-MCP] Error HTTP ${res.status} al invocar ${method}`);
			return null;
		}

		const text = await res.text();
		const payload = parseMcpPayload(text);
		return payload?.result ?? null;
	} catch (err: any) {
		console.warn(`[BEM-MCP] Excepción en llamada a ${method}:`, err?.message || err);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Obtiene la lista de herramientas registradas en BEM Brain MCP.
 */
export async function listBemTools(): Promise<McpToolDefinition[]> {
	const result = await callRemoteMcp('tools/list', {}, 2500);
	return result?.tools || [];
}

/**
 * Ejecuta una herramienta específica en el BEM Brain MCP.
 */
export async function invokeBemTool(toolName: string, args: Record<string, any> = {}, timeoutMs: number = 3000): Promise<any> {
	const result = await callRemoteMcp('tools/call', {
		name: toolName,
		arguments: args
	}, timeoutMs);

	if (!result) return null;

	// Si viene empaquetado en content array:
	if (Array.isArray(result.content)) {
		const textBlock = result.content.find((c: any) => c.type === 'text');
		if (textBlock?.text) {
			try {
				return JSON.parse(textBlock.text);
			} catch {
				return textBlock.text;
			}
		}
	}

	return result.structuredContent?.result || result;
}

/**
 * Busca conceptos teóricos en las notas de Obsidian de BEM Brain.
 */
export async function searchBemTheory(query: string, limit: number = 3): Promise<McpNoteSummary[]> {
	try {
		const raw = await invokeBemTool('search_notes', { query, limit }, 2000);
		if (Array.isArray(raw)) return raw;
		if (typeof raw === 'string') {
			try {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) return parsed;
			} catch {
				return [];
			}
		}
		return [];
	} catch {
		return [];
	}
}

/**
 * Recupera el contenido completo de una nota específica por su ID.
 */
export async function getBemNoteContent(noteId: string): Promise<McpNoteDetail | null> {
	try {
		const raw = await invokeBemTool('get_note', { id: noteId }, 2000);
		if (!raw) return null;
		if (typeof raw === 'string') {
			try {
				return JSON.parse(raw);
			} catch {
				return { id: noteId, content: raw };
			}
		}
		return raw;
	} catch {
		return null;
	}
}
