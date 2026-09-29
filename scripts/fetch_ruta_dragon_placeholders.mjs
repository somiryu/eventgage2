// Descarga las imágenes PROVISIONALES de "La Ruta del Dragón" (demo SOFA)
// desde Wikimedia Commons y escribe su atribución en CREDITS.md.
//
// Son fotos reales de juegos de mesa y arte de dominio público con licencia
// libre (CC0 / CC BY / CC BY-SA / dominio público) — NO son el arte ni las
// portadas oficiales de los aliados. Se reemplazan por el material que envíe
// cada editorial/tienda antes de la versión pública del evento.
//
// Uso: node scripts/fetch_ruta_dragon_placeholders.mjs
// Idempotente: salta los archivos que ya existen en disco.

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('static/images/ruta-dragon/placeholder');
const WIDTH = 800;
const UA = 'eventgage-ruta-dragon-demo/0.1 (demo interna Azahar Juegos)';

// `file` = nombre local; `title` = archivo exacto en Commons, o `search` =
// primera coincidencia JPEG de una búsqueda (para títulos muy largos).
const MANIFEST = [
	// Guaridas (una foto de juego de mesa por stand)
	{ file: 'guarida_01.jpg', title: 'File:A game of Azul in progress.jpg' },
	{ file: 'guarida_02.jpg', title: 'File:Dixit cards.jpg' },
	{ file: 'guarida_03.jpg', title: 'File:Ticket to Ride (16298587785).jpg' },
	{ file: 'guarida_04.jpg', title: 'File:Pandemic board game.jpg' },
	{ file: 'guarida_05.jpg', title: 'File:Huge Settlers of Catan game in Petah Tikva 01.jpg' },
	{ file: 'guarida_06.jpg', title: 'File:Codenames board game.jpg' },
	{ file: 'guarida_07.jpg', title: 'File:Terraforming Mars.jpg' },
	{ file: 'guarida_08.jpg', title: 'File:Carcassonne Miples.jpg' },
	{ file: 'guarida_09.jpg', title: 'File:7 Wonders game.jpg' },
	{ file: 'guarida_10.jpg', title: 'File:Playing Dominion card game.JPG' },
	{ file: 'guarida_11.jpg', title: 'File:Kingdomino - 0fb5d6f8-0cb9-4156-8d20-0cdf5899ca36~1.jpg' },
	{ file: 'guarida_12.jpg', title: 'File:Components in Wingspan board game.jpg' },
	{ file: 'guarida_13.jpg', title: 'File:Twilight Imperium, third edition, late game big battles.jpg' },
	{ file: 'guarida_14.jpg', search: 'Still a favourite board game explore Maria Eklind' },
	{ file: 'guarida_15.jpg', title: 'File:Ticket to Ride Asia.jpg' },
	// Clanes
	{ file: 'clan_llama.jpg', title: 'File:Saint George and the Dragon by Paolo Uccello (London) 01.jpg' },
	{ file: 'clan_escarcha.jpg', title: 'File:Dragon ascending Mount Fuji, Katsushika Hokusai.jpg' },
	{ file: 'clan_tormenta.jpg', title: 'File:Katsushika Hokusai Pines and Waves at the Dragon Cavern.jpeg' },
	// Personajes y avatares
	{ file: 'guia_cronista.jpg', search: 'Dragon God of Kasuga Noh' },
	{ file: 'avatar_cazadora.jpg', title: 'File:Saint George and the Dragon by Paolo Uccello (Paris) 01.jpg' },
	{ file: 'avatar_explorador.jpg', search: 'Susanoo rescues Kushinada Hime from the dragon' },
	{ file: 'avatar_narradora.jpg', search: 'Woman Watching a Dragon Emanate from Her Fan Painting Totoya' },
	// Portada del evento
	{ file: 'dragon_hero.jpg', title: 'File:Hokusai Dragon.jpg' }
];

const API = 'https://commons.wikimedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
	const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
	for (let attempt = 0; attempt < 6; attempt++) {
		const res = await fetch(url, { headers: { 'User-Agent': UA } });
		if (res.status === 429) {
			await sleep(5000 * (attempt + 1));
			continue;
		}
		if (!res.ok) throw new Error(`Commons API ${res.status} para ${url}`);
		return res.json();
	}
	throw new Error(`Commons API: demasiados reintentos para ${url}`);
}

async function resolveInfo(entry) {
	const common = { prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: String(WIDTH) };
	const data = entry.title
		? await api({ action: 'query', titles: entry.title, ...common })
		: await api({ action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: entry.search, gsrlimit: '5', ...common });
	const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
	const page = pages.find((p) => p.imageinfo?.[0]?.mime === 'image/jpeg');
	if (!page) throw new Error(`Sin resultado JPEG para ${entry.title || entry.search}`);
	const info = page.imageinfo[0];
	const meta = info.extmetadata || {};
	const strip = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
	return {
		title: page.title,
		downloadUrl: info.thumburl || info.url,
		pageUrl: info.descriptionurl,
		license: strip(meta.LicenseShortName?.value) || 'ver página',
		artist: strip(meta.Artist?.value) || 'desconocido'
	};
}

async function exists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

await mkdir(OUT_DIR, { recursive: true });
const credits = [];

for (const entry of MANIFEST) {
	const target = path.join(OUT_DIR, entry.file);
	// Pausa entre consultas: la API de Commons limita ráfagas (HTTP 429).
	await sleep(1500);
	const info = await resolveInfo(entry);
	credits.push({ file: entry.file, ...info });
	if (await exists(target)) {
		console.log(`= ${entry.file} (ya existe)`);
		continue;
	}
	const res = await fetch(info.downloadUrl, { headers: { 'User-Agent': UA } });
	if (!res.ok) throw new Error(`Descarga ${res.status}: ${info.downloadUrl}`);
	await writeFile(target, Buffer.from(await res.arrayBuffer()));
	console.log(`+ ${entry.file} ← ${info.title} (${info.license})`);
}

const md = [
	'# Créditos de imágenes provisionales — La Ruta del Dragón',
	'',
	'Imágenes de Wikimedia Commons usadas SOLO para la demo. No son material oficial de los aliados;',
	'se reemplazan por las portadas y logos que envíe cada editorial/tienda.',
	'',
	'| Archivo | Obra en Commons | Autor | Licencia |',
	'|---|---|---|---|',
	...credits.map((c) => `| ${c.file} | [${c.title.replace(/^File:/, '')}](${c.pageUrl}) | ${c.artist.replace(/\|/g, '/')} | ${c.license} |`),
	''
].join('\n');
await writeFile(path.join(OUT_DIR, 'CREDITS.md'), md);
console.log(`\nCréditos escritos en ${path.relative(process.cwd(), path.join(OUT_DIR, 'CREDITS.md'))}`);
