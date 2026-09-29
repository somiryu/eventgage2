# Genera supabase/seed_ruta_dragon.sql (evento "La Ruta del Dragón", demo SOFA).
# Todo el contenido de la demo vive aquí: aliados, guaridas, trivias, clanes,
# copy narrativo (config.copy), tema, hitos y premios de ejemplo.
# Uso: python3 scripts/generate_ruta_dragon_seed.py
import json, os, random
IMG='/images/ruta-dragon/placeholder'
def q(s):  # SQL literal
    if s is None: return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"
def j(o):
    return q(json.dumps(o, ensure_ascii=False)) + '::jsonb'

ALIADOS = [
 'VelaMar', 'Los Juegos Sobre la Mesa', 'Las Reglas de la Casa', 'Son Geniales', 'Carlos Reyes',
 'Gemu AD (AD164)', 'Comunidad Torrikku', 'BBG', 'Azahar', 'Tablero Infinito',
 'Lafonda Games', 'Friz Froz Fruz', 'Woodmood', 'Ronda', 'Devir'
]
# posiciones del mapa (en %), mismas que static/images/ruta-dragon/mapa-ruta.svg
POS=[(18,12),(50,12),(82,12),(82,30),(50,30),(18,30),(18,48),(50,48),(82,48),(82,66),(50,66),(18,66),(18,84),(50,84),(82,84)]

random.seed(20261)  # códigos estables entre corridas
ALPH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
CODES=['DRG-' + ''.join(random.choice(ALPH) for _ in range(4)) for _ in ALIADOS]

SKILLS={
 'EST': {'name':'Estrategia','description':'Leer el tablero varios turnos adelante y elegir la jugada que más rinde.'},
 'SUE': {'name':'Suerte','description':'La gracia de los dados: cuando la tirada decide, tú sueles salir bien parado.'},
 'ING': {'name':'Ingenio','description':'Resolver acertijos, encontrar combos y ver la regla que nadie más leyó.'},
 'CAR': {'name':'Carisma','description':'Negociar, faroles y reunir gente a la mesa: el arte de jugar con otros.'},
}

TRIVIA={
 1: ('¿En qué arte decorativo se inspiran las losetas de Azul (2017)?',
     [('Los azulejos portugueses',True),('Los vitrales góticos',False),('Los mosaicos romanos',False)],
     '¡Exacto! Azul rinde homenaje a los azulejos que decoraron Portugal.'),
 3: ('En ¡Aventureros al Tren! (Ticket to Ride), ¿qué construyen los jugadores?',
     [('Rutas de ferrocarril entre ciudades',True),('Murallas alrededor de castillos',False),('Puertos para barcos mercantes',False)],
     '¡Correcto! Y ganó el Spiel des Jahres en 2004.'),
 5: ('¿Quién diseñó Catan, publicado por primera vez en 1995?',
     [('Klaus Teuber',True),('Reiner Knizia',False),('Uwe Rosenberg',False)],
     '¡Así es! Klaus Teuber, el padre de Catan.'),
 7: ('¿Cómo se llaman las figuritas de madera con forma de persona que popularizó Carcassonne?',
     [('Meeples',True),('Peones',False),('Tótems',False)],
     '¡Correcto! "Meeple" viene de "my people".'),
 9: ('¿Qué premio alemán, entregado desde 1979, se conoce como el "Juego del Año"?',
     [('Spiel des Jahres',True),('Golden Geek',False),("As d'Or",False)],
     '¡Exacto! El Spiel des Jahres es el premio más famoso del mundo del juego de mesa.'),
 11: ('En Pandemic (2008), ¿cómo se gana la partida?',
     [('Todos juntos: es un juego cooperativo contra el tablero',True),('Gana quien cure más enfermedades',False),('Gana el último jugador en pie',False)],
     '¡Correcto! En Pandemic se gana o se pierde en equipo.'),
 13: ('¿Cuántas caras tiene el dado de rol conocido como d20?',
     [('20',True),('12',False),('10',False)],
     '¡Correcto! El icosaedro, rey de las tiradas críticas.'),
 15: ('¿En qué ciudad alemana se celebra SPIEL, una de las ferias de juegos de mesa más grandes del mundo?',
     [('Essen',True),('Berlín',False),('Múnich',False)],
     '¡Exacto! Cada octubre, Essen se llena de mesas.'),
}
DICE_ATTR={2:'EST',4:'SUE',6:'ING',8:'CAR',10:'EST',12:'SUE',14:'ING'}

CLANES=[
 ('clan_llama','Clan de la Llama','Audacia y riesgo: juegan rápido, se la juegan en cada tirada y celebran cada victoria como un rugido.','clan_llama.jpg','#f97316'),
 ('clan_escarcha','Clan de la Escarcha','Paciencia y estrategia: leen el tablero tres turnos adelante y nunca desperdician una acción.','clan_escarcha.jpg','#38bdf8'),
 ('clan_tormenta','Clan de la Tormenta','Caos que une mesas: conversan, negocian y arrastran amigos a cada partida.','clan_tormenta.jpg','#a78bfa'),
]
AVATARES=[
 ('avatar_cazadora','La Cazadora de Dragones','Estratega nata: planea la ruta completa antes de dar el primer paso.','avatar_cazadora.jpg',{'EST':16,'ING':12,'SUE':10,'CAR':9}),
 ('avatar_explorador','El Explorador de Mesas','Se sienta en cualquier mesa y confía en que los dados estarán de su lado.','avatar_explorador.jpg',{'SUE':16,'CAR':12,'ING':10,'EST':9}),
 ('avatar_narradora','La Narradora','Convierte cada partida en una historia y a cada desconocido en compañero de juego.','avatar_narradora.jpg',{'CAR':16,'ING':13,'EST':10,'SUE':8}),
]

GUIDE_NAME='Ignea, Cronista del Dragón'
GUIDE_ROLE='Guardiana de la Crónica de la Ruta'
GUIDE_IMG=f'{IMG}/guia_cronista.jpg'
GUIDE_BIO='Lleva siglos escribiendo la Crónica del Dragón. Registra cada escama recuperada y guía a los viajeros entre guaridas.'

def milestone_narrative(title, badge, pages):
    return {'title':title,'speaker_id':'char_cronista','speaker_name':GUIDE_NAME,'speaker_role':GUIDE_ROLE,
            'portrait_url':GUIDE_IMG,'badge':badge,
            'pages':[{'tag':t,'content_html':h} for t,h in pages],
            'content_html':''.join(h for _,h in pages)}

MILESTONES=[
 {'count':5,'xp':100,'cp':3,'spBonus':1,'rank':2,'rankTitle':'Portador del Huevo','unlockItem':'item_huevo_dragon',
  'lore':'Obtuviste el Huevo del Dragón.',
  'narrative':milestone_narrative('El Huevo del Dragón','HITO · 5 ESCAMAS',[
     ('LA CRÓNICA','<p>Cinco escamas brillan en tu pasaporte y algo se mueve entre ellas: un <strong>huevo tibio</strong>, del tamaño de un puño, late al ritmo de tus pasos.</p>'),
     ('TU NUEVO RANGO','<p>Desde ahora eres <strong>Portador del Huevo</strong>. Protégelo: la Ruta apenas empieza.</p>')])},
 {'count':10,'xp':150,'cp':4,'spBonus':1,'rank':3,'rankTitle':'Jinete de la Ruta',
  'lore':'El Dragón abrió un ojo.',
  'narrative':milestone_narrative('El Dragón abre un ojo','HITO · 10 ESCAMAS',[
     ('LA CRÓNICA','<p>Bajo los pabellones se escucha un rumor grave. Con diez escamas reunidas, el Dragón <strong>abrió un ojo</strong> y buscó a quien lo despierta.</p>'),
     ('TU NUEVO RANGO','<p>Eres <strong>Jinete de la Ruta</strong>. Solo cinco guaridas te separan de la leyenda.</p>')])},
 {'count':15,'xp':200,'cp':5,'spBonus':0,'rank':4,'rankTitle':'Domador del Dragón','unlockItem':'item_corona_dragon',
  'lore':'Completaste la Ruta del Dragón.',
  'narrative':milestone_narrative('Domador del Dragón','RUTA COMPLETA',[
     ('LA CRÓNICA','<p>Las quince escamas vuelven a su lugar y el Dragón despierta… para inclinar la cabeza ante ti.</p>'),
     ('TU NOMBRE EN LA CRÓNICA','<p>Eres <strong>Domador del Dragón</strong>. Tu nombre queda escrito en la Crónica de SOFA y tu clan celebra tu hazaña.</p>')])},
]

GUIDE_DIRECTIVES=[
 {'if_completed_count_gte':15,'text':'¡Las quince escamas! Eres Domador del Dragón: tu nombre ya está en la Crónica. Mira en el HUD qué clan va ganando.'},
 {'if_completed_count_gte':10,'text':'Diez escamas… el Dragón ya abrió un ojo. Revisa tu Pasaporte: te faltan pocas guaridas.'},
 {'if_completed_count_gte':5,'text':'¡Llevas el Huevo del Dragón! Sigue la Ruta: cada guarida nueva suma a tu clan.'},
 {'if_completed_count_gte':1,'text':'¡Primera escama recuperada! Busca otra guarida en el Mapa o en tu Pasaporte y pide su código.'},
]

COPY={
 'player_noun':'Viajero','player_noun_indef':'Un viajero','player_noun_plural':'viajeros','progress_unit_plural':'escamas',
 'currency_name':'Oro','currency_icon':'🪙',
 'vault_name':'Tesoro del Dragón','vault_hint':'Cambia tu oro por premios de las guaridas aliadas.',
 'rank_default':'Viajero de la Ruta','profile_title':'Mi Crónica',
 'system_error':'El Dragón se movió en sueños y cortó la conexión. No es tu código ni tu respuesta — reintenta en unos segundos.',
 'empty_featured_mission':'Ningún reto abierto. Visita una guarida, pide su código a los guardianes y canjéalo aquí.',
 'empty_map':'El mapa de la Ruta aún no está disponible — vuelve a intentarlo más tarde.',
 'organization_name':'La Ruta del Dragón','factions_label':'Clanes',
 'public_dashboard':{'subtitle':'En vivo desde SOFA — ¿qué clan domará al Dragón?','hof_title':'Salón de los Jinetes','hof_empty':'Nadie ha llegado todavía a 10 escamas. ¿Serás el primero?',
   'honor_badges':[{'min_rank':4,'label':'Domador del Dragón'},{'min_rank':0,'label':'Jinete de la Ruta'}],
   'factions_title':'Batalla de Clanes','feed_title':'La Crónica en vivo','treaty_enabled':False,
   'join_title':'Únete a la Ruta del Dragón','join_hint':'Escanea con tu móvil, elige tu clan y empieza a recorrer las guaridas.'},
 'labels':{'unlocked_mission':'RETO DE GUARIDA DESBLOQUEADO','go_to_mission':'Enfrentar el reto ➔','stay':'Más tarde','mission_types':{'trivia_quiz':'PREGUNTA DEL GUARDIÁN','dice_check':'DUELO DE DADOS'}},
 'wizard':{'faction_prompt':'Elige el clan con el que recorrerás la Ruta. Cada escama que consigas suma para tu clan.','faction_title':'Elige tu Clan','next_to_avatar':'Siguiente: elegir personaje ➔','avatar_prompt':'Elige a tu personaje para la Ruta.','back_to_factions':'⬅ Volver a los Clanes'},
 'onboarding':{
   'speaker':{'name':GUIDE_NAME,'role':GUIDE_ROLE,'portrait_url':GUIDE_IMG},
   'skip_label':'Saltar la leyenda','finish_label':'Comenzar la Ruta 🐉',
   'acts':[
     {'label':'El Dragón Dormido','text':'"Bajo los pabellones de SOFA duerme un dragón antiguo. Cada año, cuando las mesas se llenan de jugadores, sus sueños se agitan… Pero este año pasó algo distinto: sus quince escamas se desprendieron y cayeron en quince guaridas, custodiadas por editoriales, tiendas y comunidades del juego de mesa."'},
     {'label':'Las Quince Guaridas','text':'"Tu tarea es recorrer la Ruta. En cada guarida, sus guardianes te darán un código. Canjéalo aquí y supera su reto: una pregunta o una tirada contra el guardián. Aunque pierdas el reto, la escama te acompaña: en esta Ruta, jugar siempre cuenta."'},
     {'label':'Tu Clan','text':'"Te uniste al Clan de la Llama. Ustedes creen que el Dragón despierta con audacia. Cada escama que consigas aviva el fuego de tu clan."',
      'by_faction':{
        'clan_llama':'"Te uniste al Clan de la Llama. Ustedes creen que el Dragón despierta con audacia: juegan rápido y se la juegan en cada tirada. Cada escama que consigas aviva el fuego de tu clan."',
        'clan_escarcha':'"Te uniste al Clan de la Escarcha. Ustedes creen que al Dragón se le vence con paciencia: leen el tablero tres turnos adelante. Cada escama que consigas congela la ventaja de los rivales."',
        'clan_tormenta':'"Te uniste al Clan de la Tormenta. Ustedes son el caos que une mesas: conversan, negocian y arrastran amigos a jugar. Cada escama que consigas es un trueno más para tu clan."'}}]},
 'welcome_modal':{
   'speaker':{'name':GUIDE_NAME,'role':GUIDE_ROLE,'portrait_url':GUIDE_IMG},
   'badge':'PERGAMINO DE LA CRÓNICA',
   'paragraphs_html':[
     'Soy Ignea, cronista del Dragón. Voy a anotar cada escama que recuperes.',
     'Encuentra las guaridas en el <strong>Mapa</strong> o en tu <strong>Pasaporte</strong>. Cada stand tiene su propio código: pídeselo a sus guardianes y canjéalo en el HUD.',
     'Con <strong>5 escamas</strong> recibes el Huevo del Dragón. Con las <strong>15</strong>… ya lo verás.']},
 'guide':{'character_id':'char_cronista','name':GUIDE_NAME,'role':GUIDE_ROLE,'bio':GUIDE_BIO,'portrait_url':GUIDE_IMG,
   'directives':GUIDE_DIRECTIVES,
   'fallback_text':'Visita cualquier guarida y pide su código a los guardianes. El orden de la Ruta lo eliges tú.'},
 'story_speaker':{'name':GUIDE_NAME,'role':GUIDE_ROLE,'portrait_url':GUIDE_IMG},
 'character_bios':{'char_cronista':{'role':GUIDE_ROLE,'bio':GUIDE_BIO}},
 'world_meter':{'on_success':2,'on_fail':1,'description':'Cada reto que cualquier viajero supera en una guarida acerca al Dragón a despertar. Los intentos fallidos también cuentan.'},
 'messages':{
   'duplicate_code':'Ya canjeaste el código de esta guarida — su escama ya está en tu pasaporte.',
   'trivia_correct':'¡Correcto! Tu clan suma el doble.',
   'trivia_wrong':'No era esa… pero la escama es tuya igual.',
   'dice_success':'¡Venciste al guardián! Tu clan suma el doble.',
   'dice_fail':'El guardián ganó esta vez… pero la escama es tuya igual.',
   'dice_retry_success':'¡Revancha ganada! Tu clan suma puntos.'},
}

stops=[]
for i,name in enumerate(ALIADOS, start=1):
    stops.append({'n':i,'vendor':name,'mission_id':f'guarida_{i:02d}','item_id':f'escama_{i:02d}','image_url':f'{IMG}/guarida_{i:02d}.jpg','stand':None})

CONFIG={
 'copy_preset':'neutral',
 'copy':COPY,
 'main_logo':'/images/ruta-dragon/logo-ruta-dragon.svg',
 'skills':SKILLS,
 'milestones':MILESTONES,
 'faction_colors':{c[0]:c[4] for c in CLANES},
 'map_full_height':True,
 'theme':{
   'google_font':'Cinzel:wght@600;800',
   'font_display':"'Cinzel', Georgia, serif",
   'vars':{
     '--bg-app':'#120b08','--bg-glow':'#3b1206',
     '--accent':'#f59e0b','--accent-rgb':'245, 158, 11',
     '--accent-soft':'#fbbf24','--accent-soft-rgb':'251, 191, 36',
     '--accent-pale':'#fde68a',
     '--accent2':'#dc2626','--accent2-rgb':'220, 38, 38',
     '--accent2-soft':'#f87171','--accent2-soft-rgb':'248, 113, 113',
     '--panel-rgb':'41, 25, 18','--panel-deep-rgb':'24, 14, 10','--panel-deep':'#180e0a','--panel':'#2a1a12',
     '--overlay-rgb':'18, 10, 6','--info':'#fbbf24','--info-rgb':'251, 191, 36','--accent2-deep':'#b91c1c'}},
 'passport':{
   'title':'Pasaporte de la Ruta',
   'subtitle':'Quince guaridas, quince escamas. Pide el código en cada stand.',
   'stops':stops},
 'placeholder_assets':True,
}

L=[]
w=L.append
w("""-- Seed Script: Evento "La Ruta del Dragón" (slug: "ruta-dragon") — DEMO SOFA
--
-- GENERADO por scripts/generate_ruta_dragon_seed.py — editar allí, no aquí; el contenido narrativo vive en
-- bem.eventgage_events.config.copy (ver src/lib/eventCopy.ts).
-- Idempotente: borra y vuelve a crear el contenido del evento `ruta-dragon`
-- (NO toca jugadores de otros eventos).
--
-- ESTADO DEL CONTENIDO (demo):
--   - Los 15 aliados son reales (editoriales, tiendas y comunidades de SOFA),
--     pero su tagline/descripción/logo son PROVISIONALES hasta que cada uno
--     envíe su material. Ninguna frase se atribuye a ellos.
--   - Las imágenes son fotos de juegos de mesa y arte de dominio público de
--     Wikimedia Commons (ver static/images/ruta-dragon/placeholder/CREDITS.md),
--     NO portadas oficiales de los aliados.
--   - Las trivias son de cultura general del juego de mesa; la idea es que
--     cada aliado proponga la pregunta de su propio juego.
--   - Los premios del Tesoro son EJEMPLOS: el catálogo real está en revisión.
--   - Los códigos por guarida (DRG-XXXX) son de demo.

DO $$
DECLARE
    v_event_id UUID;
BEGIN
""")
w(f"""    INSERT INTO bem.eventgage_events (slug, title, description, current_chapter, config)
    VALUES ('ruta-dragon', 'La Ruta del Dragón — SOFA', {q('Recorre las 15 guaridas de editoriales, tiendas y comunidades del juego de mesa en SOFA, recupera las escamas del Dragón y lleva a tu clan a la victoria.')}, 1, {j(CONFIG)})
    ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, config = EXCLUDED.config
    RETURNING id INTO v_event_id;

    -- Contenido idempotente: se recrea completo en cada corrida.
    DELETE FROM bem.eventgage_event_codes WHERE event_id = v_event_id;
    DELETE FROM bem.eventgage_event_missions WHERE event_id = v_event_id;
    DELETE FROM bem.eventgage_event_items WHERE event_id = v_event_id;
    DELETE FROM bem.eventgage_event_rewards WHERE event_id = v_event_id;
    DELETE FROM bem.eventgage_event_levels WHERE event_id = v_event_id;
    DELETE FROM bem.eventgage_event_maps WHERE event_id = v_event_id;
    DELETE FROM bem.eventgage_event_points WHERE event_id = v_event_id;
    DELETE FROM bem.eventgage_event_characters WHERE event_id = v_event_id;
    DELETE FROM bem.eventgage_event_avatars WHERE event_id = v_event_id;
    -- Facciones y aliados se conservan si ya existen (los jugadores y los
    -- enlaces firmados de los paneles de aliado los referencian por id);
    -- solo se actualiza su contenido.
""")
w("    -- Clanes (facciones)\n    INSERT INTO bem.eventgage_event_factions (id, event_id, name, description, faction_points, icon_url) VALUES")
w(",\n".join(f"    ({q(c[0])}, v_event_id, {q(c[1])}, {q(c[2])}, 0, {q(IMG+'/'+c[3])})" for c in CLANES))
w("    ON CONFLICT (id, event_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon_url = EXCLUDED.icon_url;\n")
w("    -- Avatares\n    INSERT INTO bem.eventgage_event_avatars (id, event_id, name, description, gender, image_url, image_url_m, image_url_f, default_sp, default_cp, default_dp) VALUES")
w(",\n".join(f"    ({q(a[0])}, v_event_id, {q(a[1])}, {q(a[2])}, NULL, {q(IMG+'/'+a[3])}, {q(IMG+'/'+a[3])}, {q(IMG+'/'+a[3])}, {j(a[4])}, {j({'points':0,'icon':'🪙'})}, {j({'escamas':0})})" for a in AVATARES)+";\n")
w(f"    -- Guía\n    INSERT INTO bem.eventgage_event_characters (id, event_id, name, portrait_url, role) VALUES ('char_cronista', v_event_id, {q(GUIDE_NAME)}, {q(GUIDE_IMG)}, {q(GUIDE_ROLE)});\n")
w(f"    -- Medidor mundial\n    INSERT INTO bem.eventgage_event_points (id, event_id, point_key, display_name, current_points, max_points, rules) VALUES ('pt_despertar', v_event_id, 'despertar_dragon', 'Despertar del Dragón', 0, 500, '[]'::jsonb);\n")
LEVELS=[(1,0,'Viajero'),(2,150,'Buscador de Escamas'),(3,400,'Rastreador'),(4,800,'Jinete'),(5,1300,'Domador')]
w("    -- Niveles\n    INSERT INTO bem.eventgage_event_levels (id, event_id, level, xp_required, title) VALUES")
w(",\n".join(f"    ('lvl_{n}', v_event_id, {n}, {x}, {q(t)})" for n,x,t in LEVELS)+";\n")
# aliados
w("    -- Aliados (guaridas). Tagline/descripción PROVISIONALES.\n    INSERT INTO bem.eventgage_event_vendors (event_id, name, tagline, description, logo_url, tier, order_index) VALUES")
rows=[]
for i,name in enumerate(ALIADOS, start=1):
    tier='organizer' if name=='Azahar' else 'partner'
    rows.append(f"    (v_event_id, {q(name)}, {q(f'Guarida {i} de la Ruta del Dragón')}, {q('Información del aliado pendiente — se completa con el material que envíe.')}, NULL, {q(tier)}, {i})")
w(",\n".join(rows)+"\n    ON CONFLICT (event_id, name) DO UPDATE SET tagline = EXCLUDED.tagline, description = EXCLUDED.description, tier = EXCLUDED.tier, order_index = EXCLUDED.order_index, is_active = true;\n")
# items
w("    -- Escamas + objetos de hito\n    INSERT INTO bem.eventgage_event_items (id, event_id, name, description, image_url, media_type, media_url, is_public) VALUES")
rows=[f"    ({q(f'escama_{i:02d}')}, v_event_id, {q(f'Escama de {name}')}, {q(f'Escama {i} de 15, custodiada en la guarida de {name}.')}, {q(f'{IMG}/guarida_{i:02d}.jpg')}, 'image', NULL, false)" for i,name in enumerate(ALIADOS, start=1)]
rows.append(f"    ('item_huevo_dragon', v_event_id, 'Huevo del Dragón', 'Late al ritmo de tus pasos. Se obtiene al reunir 5 escamas.', {q(IMG+'/dragon_hero.jpg')}, 'image', NULL, false)")
rows.append(f"    ('item_corona_dragon', v_event_id, 'Corona del Domador', 'Solo la portan quienes completaron las 15 guaridas.', {q(IMG+'/dragon_hero.jpg')}, 'image', NULL, false)")
w(",\n".join(rows)+";\n")
# missions
w("    -- Retos de cada guarida (se desbloquean con el código del stand)\n    INSERT INTO bem.eventgage_event_missions (id, event_id, title, preview, description, image, background, mission_type, unlocks_mission, public, chapter, time_limit_seconds, cp_cost, cp_bet, mechanic) VALUES")
rows=[]
for i,name in enumerate(ALIADOS, start=1):
    base={'vendor':name,'passport_stop':i,'rewards':{'xp':60,'cp':2,'items':[f'escama_{i:02d}']},'faction_impact':{'success':2,'fail':1}}
    if i in TRIVIA:
        qq,opts,ok=TRIVIA[i]
        mech={**base,'draft_content':True,'note':'Pregunta de cultura general para la demo — reemplazar por la del juego del aliado.',
              'question':qq,'options':[{'id':chr(97+k),'text':t,'correct':c} for k,(t,c) in enumerate(opts)],'correct_message':ok}
        title=f'Guarida {i}: {name}'; prev='Responde la pregunta del guardián'; desc=f'Los guardianes de {name} custodian la escama {i}. Responde su pregunta: si aciertas, tu clan suma el doble. Si fallas, la escama es tuya igual.'
        rows.append(f"    ({q(f'guarida_{i:02d}')}, v_event_id, {q(title)}, {q(prev)}, {q(desc)}, {q(f'{IMG}/guarida_{i:02d}.jpg')}, NULL, 'trivia_quiz', NULL, false, 1, NULL, 0, 0, {j(mech)})")
    else:
        attr=DICE_ATTR[i]
        mech={**base,'attribute':attr}
        title=f'Guarida {i}: {name}'; prev=f'Tirada contra el guardián ({SKILLS[attr]["name"]})'; desc=f'Los guardianes de {name} te retan a un duelo. Tira el dado: tu {SKILLS[attr]["name"]} es tu aliada. Si vences, tu clan suma el doble; si pierdes, la escama es tuya igual.'
        rows.append(f"    ({q(f'guarida_{i:02d}')}, v_event_id, {q(title)}, {q(prev)}, {q(desc)}, {q(f'{IMG}/guarida_{i:02d}.jpg')}, NULL, 'dice_check', NULL, false, 1, NULL, 0, 0, {j(mech)})")
w(",\n".join(rows)+";\n")
# codes
w("    -- Un código propio por guarida (lo entrega cada stand)\n    INSERT INTO bem.eventgage_event_codes (id, event_id, code, unlocks_item, unlocks_mission, rewards, category, display_id, description) VALUES")
w(",\n".join(f"    ({q(f'code_guarida_{i:02d}')}, v_event_id, {q(CODES[i-1])}, NULL, {q(f'guarida_{i:02d}')}, {j({'xp':20,'cp':1})}, 'guarida', {q(f'G{i:02d}')}, {q(f'Código del stand de {name}')})" for i,name in enumerate(ALIADOS, start=1))+";\n")
# rewards
REW=[
 ('rew_item_reintento','Pluma de la Cronista','game_aid',4,'Repite una tirada contra un guardián que te haya ganado (un solo uso).',1),
 ('rew_cupon_guarida','Cupón de descuento en una guarida aliada (ejemplo)','coupon',6,'Premio de ejemplo para la demo: el catálogo real está en revisión con los aliados.',2),
 ('rew_mesa_prioritaria','Turno prioritario en una mesa de demostración (ejemplo)','coupon',3,'Premio de ejemplo para la demo: el catálogo real está en revisión con los aliados.',1),
 ('rew_boleta_sorteo','Boleta extra para el sorteo de cierre (ejemplo)','raffle',8,'Premio de ejemplo para la demo: el catálogo real está en revisión con los aliados.',3),
]
w("    -- Tesoro del Dragón (premios de EJEMPLO)\n    INSERT INTO bem.eventgage_event_rewards (id, event_id, name, category, cost, description, min_level) VALUES")
w(",\n".join(f"    ({q(r[0])}, v_event_id, {q(r[1])}, {q(r[2])}, {r[3]}, {q(r[4])}, {r[5]})" for r in REW)+";\n")
# map
hs=[{'id':f'hs_{i:02d}','x':POS[i-1][0],'y':POS[i-1][1],'label':str(i),'title':f'Guarida {i}: {name}','description':f'Aquí custodia su escama {name}. Pide el código a sus guardianes.','is_active':True} for i,name in enumerate(ALIADOS, start=1)]
w(f"    -- Mapa ilustrado de la Ruta\n    INSERT INTO bem.eventgage_event_maps (id, event_id, name, image_url, hotspots) VALUES ('map_ruta', v_event_id, 'Mapa de la Ruta', '/images/ruta-dragon/mapa-ruta.svg', {j(hs)});\n")
w("END $$;\n")
w("-- Códigos de demo por guarida:\n" + "\n".join(f"--   G{i:02d}  {CODES[i-1]}  {name}" for i,name in enumerate(ALIADOS, start=1)) + "\n")
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','supabase','seed_ruta_dragon.sql'),'w').write("\n".join(L))
print("\n".join(f"G{i:02d} {CODES[i-1]} {n}" for i,n in enumerate(ALIADOS,1)))
