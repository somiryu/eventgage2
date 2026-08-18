/**
 * Definición de metadatos y configuración de Habilidades / Skill Points (SP) en Eventgage.
 */

export interface SkillInfo {
	code: string; // Máximo 3 caracteres (ej. 'ANA', 'DIS', 'EST', 'FAC', 'HAC')
	name: string;
	description: string;
}

export const FALLBACK_SKILL_DESCRIPTION = 'Esta habilidad te permite resolver retos dentro del juego';

/**
 * Catálogo canónico de habilidades por defecto para Gamescon y eventos generales.
 */
export const DEFAULT_SKILLS_CATALOG: Record<string, { name: string; description: string }> = {
	ANA: {
		name: 'Análisis & Métricas',
		description: 'Capacidad analítica para descifrar datos conductuales, auditar sesgos y optimizar mecánicas objetivas.'
	},
	DIS: {
		name: 'Diseño & Creatividad',
		description: 'Habilidad para concebir narrativas inmersivas, experiencias sensoriales y prototipos lúdicos memorables.'
	},
	EST: {
		name: 'Estrategia & Negocio',
		description: 'Visión estratégica para alinear mecánicas lúdicas con el ROI, la gobernanza institucional y los objetivos de negocio.'
	},
	FAC: {
		name: 'Facilitación & Conexión Humana',
		description: 'Liderazgo empático para gestionar la dinámica grupal, fomentar seguridad psicológica y activar el cambio cultural.'
	},
	// Mapeos para demo / legacy
	HACKEO: {
		name: 'Hackeo de Sistemas',
		description: 'Destreza técnica para vulnerar terminales de datos y sortear cortafuegos digitales.'
	},
	PERCEPCION: {
		name: 'Percepción Táctica',
		description: 'Agudeza sensorial para detectar anomalías, patrones ocultos y amenazas en el entorno.'
	},
	SIGILO: {
		name: 'Sigilo Operativo',
		description: 'Capacidad para infiltrarse y maniobrar sin ser detectado por los sistemas de vigilancia.'
	}
};

/**
 * Obtiene la información completa de una habilidad asegurando que el código de la etiqueta
 * tenga un máximo estricto de 3 caracteres y aplicando el fallback si no hay descripción.
 */
export function getSkillInfo(
	skillKey: string,
	customSkills?: Record<string, { name?: string; description?: string }>
): SkillInfo {
	if (!skillKey) {
		return {
			code: 'SP',
			name: 'Habilidad',
			description: FALLBACK_SKILL_DESCRIPTION
		};
	}

	const rawKey = skillKey.trim();
	const normalizedKey = rawKey.toUpperCase();
	
	// Etiqueta de máximo 3 caracteres en mayúsculas
	const code = normalizedKey.slice(0, 3);

	// Buscar en catálogo personalizado o predeterminado
	const customEntry = customSkills?.[rawKey] || customSkills?.[normalizedKey] || customSkills?.[code];
	const defaultEntry = DEFAULT_SKILLS_CATALOG[normalizedKey] || DEFAULT_SKILLS_CATALOG[code];

	const name = customEntry?.name || defaultEntry?.name || rawKey;
	const description = customEntry?.description || defaultEntry?.description || FALLBACK_SKILL_DESCRIPTION;

	return {
		code,
		name,
		description
	};
}
