import { supabaseServer } from './supabaseClient';
import { dev } from '$app/environment';
// @ts-ignore
import fs from 'node:fs';
// @ts-ignore
import path from 'node:path';
// @ts-ignore
import { Buffer } from 'node:buffer';
// @ts-ignore
import process from 'node:process';

const BUCKET_NAME = 'eventgage-assets';

export interface UploadResult {
	success: boolean;
	url?: string;
	error?: string;
}

/**
 * Sube un archivo binario o buffer a Supabase Storage (bucket `eventgage-assets`)
 * o guarda en el directorio estático local como fallback en entorno de desarrollo.
 */
export async function uploadAsset(
	fileBuffer: Buffer | Uint8Array,
	fileName: string,
	contentType: string,
	folder: 'maps' | 'rewards' | 'characters' | 'items' = 'rewards'
): Promise<UploadResult> {
	try {
		const ext = path.extname(fileName) || (contentType.includes('pdf') ? '.pdf' : '.jpg');
		const safeBaseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
		const uniquePath = `${folder}/${Date.now()}_${safeBaseName}${ext}`;

		// 1. Intentar subir al bucket de Supabase Storage
		try {
			const { data, error } = await supabaseServer.storage
				.from(BUCKET_NAME)
				.upload(uniquePath, fileBuffer, {
					contentType,
					upsert: true
				});

			if (!error && data) {
				const { data: publicUrlData } = supabaseServer.storage
					.from(BUCKET_NAME)
					.getPublicUrl(uniquePath);

				if (publicUrlData?.publicUrl) {
					return { success: true, url: publicUrlData.publicUrl };
				}
			}
		} catch (storageErr) {
			console.warn('[storageService] Supabase Storage remoto no disponible, usando fallback:', storageErr);
		}

		// 2. Fallback de desarrollo local: guardar en static/uploads/. Solo en
		// dev — en producción (Netlify serverless) escribir en static/ en
		// tiempo de request no persiste, así que ahí un fallo de Supabase
		// Storage debe reportarse como error real en vez de fingir éxito.
		if (!dev) {
			return { success: false, error: 'No se pudo subir el archivo a Supabase Storage.' };
		}

		const localUploadsDir = path.resolve(process.cwd(), 'static', 'uploads', folder);
		if (!fs.existsSync(localUploadsDir)) {
			fs.mkdirSync(localUploadsDir, { recursive: true });
		}

		const localFileName = `${Date.now()}_${safeBaseName}${ext}`;
		const localFilePath = path.join(localUploadsDir, localFileName);
		fs.writeFileSync(localFilePath, Buffer.from(fileBuffer));

		const publicUrl = `/uploads/${folder}/${localFileName}`;
		return { success: true, url: publicUrl };
	} catch (e: any) {
		console.error('[storageService] Error crítico procesando subida de archivo:', e);
		return { success: false, error: e.message || 'Error al procesar el archivo.' };
	}
}
