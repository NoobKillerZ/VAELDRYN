'use strict';

var GAME_VERSION = '0.1.3-alpha';

// Feedback de jugadores vía Google Forms.
// formUrl: enlace base del formulario (viewform). entryTags/entryMsg: IDs
// "entry.NNNNNN" del enlace previo para las casillas y el mensaje.
var FEEDBACK = {
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdJHHwY8QWsoCHZ3FtT39Gs02j9xlsPqXz18lTzm9eTmvodrw/viewform',
  entryTags: '',
  entryMsg: 'entry.279828834'
};

var CONFIG = {
  COLS: 24,
  ROWS: 14,
  CELL: 40,
  WIDTH: 960,
  HEIGHT: 560,
  START_GOLD: 170,
  START_LIVES: 20,
  PATH: [[-1, 3], [6, 3], [6, 8], [12, 8], [12, 3], [18, 3], [18, 11], [24, 11]],
  MAX_LEVEL: 3,
  SELL_RATIO: 0.65,
  WIN_WAVE: 20
};

var DIFFICULTY = {
  0: { name: 'Normal', hpMult: 1, goldMult: 1, livesMod: 0, eliteChance: 0, speedMult: 1 },
  1: { name: 'Fácil', hpMult: 0.7, goldMult: 1.2, livesMod: 5, eliteChance: 0, speedMult: 0.9 },
  2: { name: 'Difícil', hpMult: 1.5, goldMult: 0.8, livesMod: -3, eliteChance: 0.12, speedMult: 1.1 },
  3: { name: 'Pesadilla', hpMult: 2.2, goldMult: 0.72, livesMod: -3, eliteChance: 0.26, speedMult: 1.15 }
};

var TOWER_TYPES = ['archer', 'fire', 'ice', 'venom', 'crossbow', 'dwarf', 'druid', 'tesla', 'knight', 'sniper', 'holy', 'banner', 'warlock', 'barracks'];

var TOWERS = {
  archer: {
    name: 'Arquero', icon: '🏹', cost: 50, element: 'physical',
    range: 140, damage: 12, rate: 0.45,
    color: '#7a5230', projColor: '#e8d48a', visual: 'arrow',
    canHitFlying: true,
    desc: 'Arquero en torre de madera. Rápido, fiable y acierta a los voladores.',
    ability: { name: 'Lluvia de Flechas', icon: '🏹', cd: 20, desc: 'Ráfaga de flechas sobre todos los enemigos en alcance.' }
  },
  fire: {
    name: 'Mago de Fuego', icon: '🔥', cost: 85, element: 'fire',
    range: 120, damage: 22, rate: 1.5, aoe: 46,
    color: '#6a2620', projColor: '#ff7a30', visual: 'fireball',
    canHitFlying: true,
    desc: 'Bolas de fuego con explosión en área y quemaduras.',
    ability: { name: 'Meteorito', icon: '☄️', cd: 26, desc: 'Un meteorito arrasa la zona de mayor presión enemiga.' }
  },
  ice: {
    name: 'Mago de Hielo', icon: '❄️', cost: 70, element: 'ice',
    range: 120, damage: 9, rate: 0.9,
    color: '#3a5a7a', projColor: '#bfe8ff', visual: 'frost',
    canHitFlying: true, unlock: { wave: 2 },
    desc: 'Ralentiza y congela. Combínalo con fuego y torres de daño.',
    ability: { name: 'Nova Glacial', icon: '❄️', cd: 24, desc: 'Onda de escarcha que congela y daña a todos los enemigos en alcance.' }
  },
  dwarf: {
    name: 'Cañón Enano', icon: '💣', cost: 120, element: 'earth',
    range: 130, damage: 55, rate: 2.4, aoe: 48,
    color: '#5a5a62', projColor: '#3a3a3a', visual: 'bomb',
    canHitFlying: false,
    desc: 'Bombas pesadas con empuje. No alcanza a los voladores.',
    ability: { name: 'Bombardeo', icon: '💣', cd: 28, desc: 'Lluvia de bombas sobre los enemigos en alcance.' }
  },
  crossbow: {
    name: 'Ballestero', icon: '🎯', cost: 110, element: 'physical',
    range: 165, damage: 60, rate: 2.0, pierce: 2,
    color: '#6b5230', projColor: '#9a8a5a', visual: 'bolt',
    canHitFlying: true, unlock: { wave: 3 },
    desc: 'Lento pero devastador. Sus virotes atraviesan enemigos.',
    ability: { name: 'Virote Perforante', icon: '🎯', cd: 26, desc: 'Un virote colosal atraviesa a todos los enemigos en línea.' }
  },
  venom: {
    name: 'Alquimista', icon: '🧪', cost: 75, element: 'nature',
    range: 125, damage: 8, rate: 0.7, poison: { dps: 6, t: 3 },
    color: '#2a5a3a', projColor: '#7ad47f', visual: 'venom',
    canHitFlying: true, unlock: { wave: 4 },
    desc: 'Viales de veneno que corroen a sus objetivos lentamente.',
    ability: { name: 'Nube Tóxica', icon: '🧪', cd: 24, desc: 'Envenena en área a todos los enemigos en alcance.' }
  },
  druid: {
    name: 'Druida', icon: '🌿', cost: 90, element: 'nature',
    range: 130, damage: 0, rate: 0, rootDur: 1.0,
    color: '#2a5a2a', projColor: '#7fd47f', visual: 'none',
    canHitFlying: false, unlock: { wave: 6 },
    desc: 'Raíces que inmovilizan y aura que acelera a las torres cercanas.',
    ability: { name: 'Emboscada', icon: '🌿', cd: 22, desc: 'Raíces salvajes inmovilizan y dañan a los enemigos en alcance.' }
  },
  tesla: {
    name: 'Torre de Rayos', icon: '⚡', cost: 120, element: 'lightning',
    range: 110, damage: 18, rate: 1.0, chains: 3,
    color: '#3a4a7a', projColor: '#8ad4ff', visual: 'arc',
    canHitFlying: true, unlock: { wave: 7 },
    desc: 'Descargas que saltan entre enemigos cercanos. Ralentiza al impacto.',
    ability: { name: 'Tormenta', icon: '⚡', cd: 26, desc: 'Cadena de rayos devastadora sobre muchos enemigos.' }
  },
  knight: {
    name: 'Caballero', icon: '⚔️', cost: 100, element: 'physical',
    range: 60, damage: 14, rate: 0.7,
    color: '#4a4a5a', projColor: '#ccccdd', visual: 'none',
    canHitFlying: false, unlock: { wave: 8 },
    desc: 'Bloquea el camino, empuja a los enemigos y frena su avance.',
    ability: { name: 'Golpe de Escudo', icon: '🛡️', cd: 20, desc: 'Empuja, aturde y daña a los enemigos cercanos.' }
  },
  sniper: {
    name: 'Francotirador', icon: '🔭', cost: 150, element: 'physical',
    range: 280, damage: 90, rate: 3.2, pierce: 2,
    color: '#5a5a6a', projColor: '#e8e8f0', visual: 'snipe',
    canHitFlying: true, unlock: { wave: 9 },
    desc: 'Alcance extremo. Sus balas de ballesta perforan la armadura.',
    ability: { name: 'Tiro Letal', icon: '🔭', cd: 28, desc: 'Disparo de precisión masivo al enemigo más avanzado.' }
  },
  holy: {
    name: 'Torre Sagrada', icon: '✨', cost: 130, element: 'nature',
    range: 150, damage: 16, rate: 1.0,
    color: '#e8d48a', projColor: '#fff6c8', visual: 'holy',
    canHitFlying: true, purge: 4, unlock: { wave: 10 },
    desc: 'Purifica la corrupción del suelo y daña doble a los corruptos.',
    ability: { name: 'Purificación', icon: '✨', cd: 26, desc: 'Repara torres aliadas, purifica el suelo y hiere a los corruptos.' }
  },
  banner: {
    name: 'Estandarte', icon: '🚩', cost: 110, element: 'holy',
    range: 120, damage: 0, rate: 0, aura: 1.18, rateAura: 1.12,
    color: '#8a6a2a', projColor: '#ffe08a', visual: 'none',
    canHitFlying: false, unlock: { wave: 11 },
    desc: 'Inspira a las torres cercanas: +daño y +cadencia.',
    ability: { name: 'Grito de Guerra', icon: '🚩', cd: 28, desc: 'Inspira a las torres aliadas cercanas: +50% daño durante 8s.' }
  },
  warlock: {
    name: 'Cultista del Vacío', icon: '🌀', cost: 140, element: 'void',
    range: 130, damage: 15, rate: 1.2, hex: { mult: 1.4, t: 3 },
    color: '#3a2a5a', projColor: '#b08aff', visual: 'hex',
    canHitFlying: true, unlock: { wave: 12 },
    desc: 'Maldice a los enemigos: reciben +40% de daño de todas las fuentes.',
    ability: { name: 'Devastación', icon: '🌀', cd: 26, desc: 'Explosión del vacío que maldice y daña a todos en alcance.' }
  },
  barracks: {
    name: 'Barracas', icon: '⚔️', cost: 100, element: 'physical',
    range: 100, damage: 0, rate: 0,
    color: '#6a5a3a', projColor: '#ccccdd', visual: 'none',
    canHitFlying: false, unlock: { wave: 5 },
    desc: 'Genera soldados aliados que defienden el camino.',
    soldiers: {
      swordsman: { hp: 80, dmg: 8, rate: 0.8, range: 28, speed: 80, armor: 0 }
    },
    ability: { name: 'Refuerzos', icon: '⚔️', cd: 30, desc: 'Refresca y fortalece a los soldados aliados cercanos.' }
  }
};

TOWERS.archer.upgrades = [
  { name: 'Flecha Doble', cost: 50, damage: 20, rate: 0.38, targetCap: 2, desc: 'Dispara a dos enemigos a la vez.' },
  { name: 'Flecha Perforante', cost: 100, damage: 28, rate: 0.34, pierce: 3, targetCap: 2, desc: 'Las flechas atraviesan a varios enemigos.' },
  { name: 'Lluvia de Flechas', cost: 180, damage: 38, rate: 0.30, pierce: 4, targetCap: 3, aoe: 26, desc: 'Ráfaga con pequeña zona de impacto.' }
];
TOWERS.fire.upgrades = [
  { name: 'Bola de Fuego', cost: 70, damage: 34, aoe: 52, desc: 'Más daño y mayor explosión.' },
  { name: 'Explosión', cost: 130, damage: 50, aoe: 60, desc: 'Incendia grandes grupos de enemigos.' },
  { name: 'Meteorito', cost: 220, damage: 85, aoe: 72, desc: 'Un meteorito arrasa la zona.' }
];
TOWERS.ice.upgrades = [
  { name: 'Rayo Helado', cost: 60, damage: 10, rate: 0.8, desc: 'Ralentiza más a sus objetivos.' },
  { name: 'Escarcha', cost: 110, damage: 14, rate: 0.75, desc: 'Escarcha frecuente que frena grupos.' },
  { name: 'Congelación', cost: 180, damage: 20, rate: 0.7, desc: 'Congela por completo a sus objetivos.' }
];
TOWERS.venom.upgrades = [
  { name: 'Veneno Concentrado', cost: 65, damage: 12, poison: { dps: 12, t: 3.5 }, desc: 'El veneno corroe mucho más rápido.' },
  { name: 'Gas Corrosivo', cost: 120, damage: 16, poison: { dps: 18, t: 4 }, aoe: 40, desc: 'El vial estalla y envenena en área.' },
  { name: 'Peste Negra', cost: 200, damage: 24, poison: { dps: 28, t: 5 }, aoe: 52, desc: 'Una nube tóxica arrasa grupos enteros.' }
];
TOWERS.tesla.upgrades = [
  { name: 'Arco Doble', cost: 85, damage: 28, chains: 4, desc: 'El rayo salta a más enemigos.' },
  { name: 'Tormenta Interna', cost: 150, damage: 42, chains: 5, rate: 0.9, desc: 'Más daño y cadenas devastadoras.' },
  { name: 'Corona de Rayos', cost: 240, damage: 60, chains: 6, rate: 0.8, desc: 'Una tormenta en miniatura. Ralentiza todo lo que toca.' }
];
TOWERS.dwarf.upgrades = [
  { name: 'Pólvora', cost: 90, damage: 80, rate: 2.3, aoe: 52, desc: 'Más pólvora, más dolor.' },
  { name: 'Bombas Pesadas', cost: 160, damage: 120, rate: 2.5, aoe: 62, desc: 'Explosiones que hacen retroceder.' },
  { name: 'Catapulta', cost: 260, damage: 170, rate: 2.8, aoe: 75, desc: 'Arrasa tanques y jefes.' }
];
TOWERS.crossbow.upgrades = [
  { name: 'Virote Reforzado', cost: 80, damage: 95, rate: 2.1, desc: 'Más daño por disparo.' },
  { name: 'Perforación', cost: 150, damage: 140, rate: 2.2, pierce: 5, desc: 'Atraviesa hasta 5 enemigos.' },
  { name: 'Ballesta de Asedio', cost: 240, damage: 200, rate: 2.6, pierce: 6, desc: 'Apunta a los jefes y no falla.' }
];
TOWERS.druid.upgrades = [
  { name: 'Raíces', cost: 70, rootDur: 1.4, aura: 1.15, desc: 'Inmoviliza más tiempo.' },
  { name: 'Curación', cost: 120, rootDur: 1.8, aura: 1.22, desc: 'Purga el fuego de las torres aliadas.' },
  { name: 'Aura Natural', cost: 200, rootDur: 2.2, aura: 1.3, desc: 'Gran aceleración de ataque para sus vecinas.' }
];
TOWERS.knight.upgrades = [
  { name: 'Espadachín', cost: 80, damage: 24, rate: 0.6, desc: 'Golpes más fuertes.' },
  { name: 'Caballero', cost: 140, damage: 36, rate: 0.55, desc: 'Ralentiza a quien golpea.' },
  { name: 'Paladín', cost: 230, damage: 55, rate: 0.5, desc: 'Aturde brevemente a los enemigos.' }
];
TOWERS.holy.upgrades = [
  { name: 'Luz Bendita', cost: 100, damage: 20, rate: 1.0, purge: 6, desc: 'Purifica más suelo y dispara más rápido.' },
  { name: 'Catedral', cost: 180, damage: 32, rate: 0.9, purge: 9, desc: 'Gran purificación y daño sagrado.' },
  { name: 'Santo Sepulcro', cost: 300, damage: 55, rate: 0.8, purge: 14, desc: 'Limpia el mapa y destruye a los corruptos.' }
];
TOWERS.sniper.upgrades = [
  { name: 'Balista', cost: 110, damage: 140, rate: 3.4, desc: 'Virote reforzado de gran alcance.' },
  { name: 'Perforación Blindada', cost: 190, damage: 200, rate: 3.6, pierce: 3, ignoreArmor: true, desc: 'Ignora la armadura de los enemigos.' },
  { name: 'Juez Final', cost: 300, damage: 320, rate: 4.0, pierce: 4, ignoreArmor: true, desc: 'Un solo disparo puede acabar con un jefe herido.' }
];
TOWERS.banner.upgrades = [
  { name: 'Estandarte de Guerra', cost: 80, aura: 1.25, rateAura: 1.18, desc: 'Mayor inspiración para las torres aliadas.' },
  { name: 'Bandera Real', cost: 150, aura: 1.33, rateAura: 1.24, range: 140, desc: 'Alcance y poder ampliados.' },
  { name: 'Honor de Valdryn', cost: 240, aura: 1.45, rateAura: 1.32, range: 160, desc: 'Las torres cercanas se vuelven leyendas.' }
];
TOWERS.warlock.upgrades = [
  { name: 'Maldición Menor', cost: 100, damage: 24, hex: { mult: 1.5, t: 3.5 }, desc: 'La maldición dura más y se intensifica.' },
  { name: 'Pacto Oscuro', cost: 180, damage: 36, hex: { mult: 1.65, t: 4 }, aoe: 44, desc: 'La maldición estalla en área.' },
  { name: 'Vacío Devorador', cost: 280, damage: 55, hex: { mult: 1.85, t: 5 }, aoe: 55, desc: 'Drena el vacío: daña y corrompe el suelo.' }
];
TOWERS.barracks.upgrades = [
  { name: 'Espadachín Veterano', cost: 70, soldiers: { swordsman: { hp: 130, dmg: 14, rate: 0.7, armor: 1 } }, desc: 'El espadachín se vuelve más fuerte.' },
  { name: 'Arquero', cost: 120, addArcher: true, soldiers: { swordsman: { hp: 130, dmg: 14, rate: 0.7, armor: 1 }, archer: { hp: 60, dmg: 10, rate: 0.6, range: 90, ranged: true } }, desc: 'Un arquero se une a la defensa.' },
  {
    name: 'Escuadra de Élite', cost: 200, addShieldbearer: true, addMage: true,
    soldiers: {
      swordsman: { hp: 200, dmg: 22, rate: 0.6, armor: 2 },
      archer: { hp: 90, dmg: 16, rate: 0.5, range: 100, ranged: true },
      shieldbearer: { hp: 300, dmg: 6, rate: 1.0, range: 24, armor: 4 },
      mage: { hp: 70, dmg: 20, rate: 1.2, range: 80, ranged: true, element: 'fire' }
    },
    desc: 'Escudero y mago se unen al escuadrón.'
  }
];

var ENEMIES = {
  goblin: { name: 'Goblin Explorador', hp: 45, speed: 110, reward: 6, r: 9, color: '#3f9e4f', desc: 'Rápido y débil.' },
  orc: { name: 'Orco Guerrero', hp: 150, speed: 55, reward: 11, r: 13, color: '#4a7c3a', armor: 1, desc: 'Robusto y armado.' },
  berserker: { name: 'Orco Berserker', hp: 190, speed: 52, reward: 16, r: 13, color: '#8a5a2a', armor: 1, enrage: true, desc: 'Se enfurece por debajo del 50% de vida.' },
  skeleton: { name: 'Esqueleto', hp: 85, speed: 75, reward: 9, r: 10, color: '#d8d8d0', revive: 0.3, resist: { physical: 0.6 }, weak: { fire: 1.5 }, desc: 'Puede resucitar (30%).' },
  undead: { name: 'Caballero No-Muerto', hp: 420, speed: 38, reward: 34, r: 14, color: '#5a6470', armor: 3, resist: { physical: 0.45 }, weak: { fire: 1.4 }, desc: 'Tanque. Débil a la magia.' },
  bat: { name: 'Murciélago Demoníaco', hp: 55, speed: 140, reward: 8, r: 8, color: '#6a3a8a', flying: true, weak: { ice: 1.5 }, desc: 'Vuela: los golpes y bombas no lo alcanzan.' },
  troll: { name: 'Troll', hp: 800, speed: 26, reward: 45, r: 18, color: '#5c8a6a', armor: 2, regen: 3, weak: { fire: 1.4 }, desc: 'Regenera vida lentamente.' },
  sorcerer: { name: 'Hechicero Goblin', hp: 95, speed: 62, reward: 24, r: 11, color: '#3f9e4f', buff: true, desc: 'Acelera a los goblins cercanos.' },
  necromancer: { name: 'Nigromante', hp: 240, speed: 45, reward: 48, r: 13, color: '#4a2a5a', necro: true, resist: { physical: 0.7 }, weak: { fire: 1.3 }, desc: 'Levanta esqueletos mientras vive.' },
  dragon: { name: 'Dragón Rojo', hp: 2800, speed: 42, reward: 500, r: 24, color: '#b3302a', boss: true, resist: { physical: 0.6 }, weak: { ice: 1.3 }, flyPhase: 0.5, ragePhase: 0.25, fireStun: 4, desc: 'Gran jefe: vuela y prende fuego a tus torres.' },
  orcKing: { name: 'Rey Orco', hp: 1800, speed: 30, reward: 350, r: 20, color: '#3a6a2a', boss: true, armor: 1, resist: { physical: 0.65 }, summonType: 'goblin', summonCd: 8, desc: 'Invoca goblins y acelera a los orcos.' },
  lord: { name: 'Señor de los Muertos', hp: 2200, speed: 26, reward: 420, r: 20, color: '#3a3a4a', boss: true, resist: { physical: 0.7 }, weak: { fire: 1.3 }, necro: true, summonCd: 6, desc: 'Revive a los caídos en esqueletos.' },
  fireGolem: { name: 'Gólem de Fuego', hp: 600, speed: 34, reward: 38, r: 16, color: '#b3301a', armor: 2, resist: { fire: 0.35, physical: 0.7 }, weak: { ice: 1.6 }, desc: 'Resiste el fuego y lo físico. El hielo lo funde.' },
  iceWraith: { name: 'Espectro Helado', hp: 140, speed: 120, reward: 20, r: 10, color: '#9fd4ea', flying: true, resist: { ice: 0.4, physical: 0.7 }, weak: { fire: 1.7 }, desc: 'Espectro de hielo: casi inmune al hielo, arde con fuego.' },
  stoneGolem: { name: 'Gólem de Piedra', hp: 750, speed: 24, reward: 46, r: 17, color: '#8a827a', armor: 4, resist: { earth: 0.4, physical: 0.5 }, weak: { nature: 1.6 }, desc: 'Piel de roca: resiste la tierra y lo físico. Las raíces lo rompen.' },
  treant: { name: 'Treant Corrupto', hp: 420, speed: 32, reward: 36, r: 15, color: '#3a5a2a', armor: 1, resist: { nature: 0.4, earth: 0.6 }, weak: { fire: 1.7 }, desc: 'Ente corrupto: resiste la naturaleza. Es muy inflamable.' },
  stormSpirit: { name: 'Espíritu de Tormenta', hp: 110, speed: 135, reward: 22, r: 9, color: '#4a7ab8', flying: true, resist: { ice: 0.6, earth: 0.6 }, weak: { physical: 1.5 }, desc: 'Hecho de aire y hielo: resbala de la magia, débil a lo físico.' },
  voidWalker: { name: 'Caminante del Vacío', hp: 500, speed: 55, reward: 55, r: 14, color: '#2a1a3a', resist: { fire: 0.7, ice: 0.7, earth: 0.7, nature: 0.7 }, weak: { physical: 1.6 }, desc: 'Engullido por el vacío: resiste toda la magia. Solo lo físico lo daña.' },
  saboteur: { name: 'Saboteador', hp: 180, speed: 70, reward: 22, r: 11, color: '#6a5a3a', armor: 1, targetsTowers: true, towerDmg: 8, desc: 'Corre a tus torres y las daña con sus explosivos.' },
  assassin: { name: 'Asesino', hp: 90, speed: 130, reward: 18, r: 9, color: '#4a3a5a', targetsTowers: true, towerDmg: 5, desc: 'Veloz: golpea la torre más cercana y huye.' },
  thief: { name: 'Ladrón', hp: 70, speed: 120, reward: 8, r: 9, color: '#7a7a3a', steal: true, desc: 'Si llega al castillo, roba parte de tu oro.' },
  hulker: { name: 'Hulk Corrupto', hp: 900, speed: 22, reward: 60, r: 17, color: '#5a1a5a', armor: 3, corruption: 25, regen: 2, resist: { nature: 0.6 }, weak: { fire: 1.4 }, desc: 'Bestia corrupta que impregna el suelo de oscuridad.' },
  crawler: { name: 'Araña Cazadora', hp: 60, speed: 150, reward: 8, r: 8, color: '#3a3040', weak: { fire: 1.4 }, resist: { nature: 0.7 }, desc: 'Rápida y numerosa. Escala por cualquier grieta.' },
  gargoyle: { name: 'Gárgola', hp: 260, speed: 60, reward: 26, r: 11, color: '#8a92a4', flying: true, armor: 2, resist: { earth: 0.4, physical: 0.6 }, weak: { nature: 1.4 }, desc: 'Piel de piedra alada. Las bombas apenas la rozan.' },
  wisp: { name: 'Fuego Fatuo', hp: 90, speed: 110, reward: 14, r: 8, color: '#8ad47f', flying: true, explode: { radius: 50, dmg: 6 }, weak: { ice: 1.4 }, desc: 'Explota al morir y daña a las torres cercanas.' },
  shaman: { name: 'Chamán Orco', hp: 130, speed: 50, reward: 30, r: 11, color: '#8a6a2a', resist: { nature: 0.5 }, weak: { fire: 1.4 }, buffShaman: true, desc: 'Enfurece a los orcos cercanos.' },
  orcShield: { name: 'Orco Escudado', hp: 320, speed: 42, reward: 26, r: 13, color: '#7a6a52', armor: 3, shieldHits: 3, resist: { physical: 0.85 }, weak: { fire: 1.3 }, desc: 'Su torre de escudos bloquea 3 impactos directos. Las explosiones y el veneno lo rodean.' },
  mender: { name: 'Chamán Sanador', hp: 170, speed: 55, reward: 32, r: 11, color: '#5aa06a', healAura: { radius: 110, amount: 16, cd: 2.2 }, resist: { physical: 0.7 }, weak: { lightning: 1.5 }, desc: 'Cura a sus aliados cercanos. ¡Elimínalo primero!' },
  phaseStalker: { name: 'Espectro Fásico', hp: 140, speed: 100, reward: 30, r: 11, color: '#7a8fd0', cloak: { visible: 2.2, hidden: 2.4 }, resist: { physical: 0.55 }, weak: { ice: 1.6 }, desc: 'Se desvanece periódicamente: las torres no pueden apuntarlo. El hielo lo revela.' },
  demon: { name: 'Demonio Menor', hp: 220, speed: 80, reward: 22, r: 12, color: '#b3302a', armor: 1, resist: { fire: 0.4 }, weak: { ice: 1.3 }, desc: 'Nacido del fuego. El hielo lo aplaca.' },
  lich: { name: 'Liche', hp: 500, speed: 40, reward: 55, r: 14, color: '#4a2a6a', necro: true, resist: { physical: 0.6, fire: 0.7 }, weak: { nature: 1.3 }, desc: 'Nigromante supremo: levanta esqueletos sin cesar.' },
  iceDragon: { name: 'Dragón de Hielo', hp: 3200, speed: 40, reward: 550, r: 24, color: '#8ad4ff', boss: true, resist: { ice: 0.5 }, weak: { fire: 1.4 }, flyPhase: 0.5, frostStun: 4, desc: 'Gran jefe: congela tus torres y barre el campo con escarcha.' },
  warMachine: { name: 'Máquina de Guerra', hp: 2400, speed: 26, reward: 450, r: 20, color: '#6a6a72', boss: true, armor: 4, targetsTowers: true, towerDmg: 30, resist: { physical: 0.5 }, weak: { fire: 1.3 }, desc: 'Ariete de asedio: demuele las torres a su paso.' },
  voidLord: { name: 'Señor del Vacío', hp: 4000, speed: 30, reward: 700, r: 22, color: '#2a1a3a', boss: true, corruption: 40, summonType: 'voidWalker', resist: { fire: 0.6, ice: 0.6, earth: 0.6, nature: 0.6 }, weak: { physical: 1.5 }, desc: 'El final de todo: engulle la magia y escupe caminantes del vacío.' },
  splitter: { name: 'Escindido', hp: 200, speed: 55, reward: 12, r: 12, color: '#7a4a8a', split: { into: 'splitterSmall', count: 2 }, resist: { physical: 0.8 }, weak: { fire: 1.3 }, desc: 'Se divide en dos al morir.' },
  splitterSmall: { name: 'Escindido Menor', hp: 80, speed: 90, reward: 4, r: 7, color: '#9a6aaa', split: { into: 'splitterTiny', count: 2 }, desc: 'Fragmento del Escindido. Se divide de nuevo.' },
  splitterTiny: { name: 'Fragmento', hp: 30, speed: 120, reward: 2, r: 5, color: '#ba8aca', desc: 'El último fragmento. No se divide más.' }
};
