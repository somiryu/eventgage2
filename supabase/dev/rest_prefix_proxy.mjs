// SOLO DESARROLLO LOCAL.
//
// @supabase/supabase-js siempre antepone `/rest/v1` a la URL base que se le
// pasa a createClient() — así es como Supabase real expone PostgREST detrás
// de su gateway (Kong). El PostgREST nativo levantado aquí (sin Docker) no
// tiene ese gateway delante, así que este proxy hace exactamente lo mismo
// que Kong haría para esta ruta: reescribe `/rest/v1/<algo>` -> `/<algo>`
// y reenvía la petición tal cual a PostgREST. No transforma datos, no
// inventa nada — es solo el mismo rewrite de ruta que la infraestructura
// real de Supabase ya hace.
import http from 'node:http';

const PROXY_PORT = 3112;
const POSTGREST_TARGET = 'http://127.0.0.1:3111';

const server = http.createServer(async (req, res) => {
	const rewrittenPath = req.url.startsWith('/rest/v1')
		? req.url.replace(/^\/rest\/v1/, '') || '/'
		: req.url;

	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	const body = chunks.length ? Buffer.concat(chunks) : undefined;

	try {
		const upstream = await fetch(`${POSTGREST_TARGET}${rewrittenPath}`, {
			method: req.method,
			headers: { ...req.headers, host: undefined },
			body
		});
		res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
		res.end(Buffer.from(await upstream.arrayBuffer()));
	} catch (e) {
		res.writeHead(502, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: 'proxy_error', message: String(e) }));
	}
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
	console.log(`[rest_prefix_proxy] escuchando en http://127.0.0.1:${PROXY_PORT}, reenviando /rest/v1/* -> ${POSTGREST_TARGET}/*`);
});
