# Catálogo configurable de artículos — V4.7

Documento técnico del catálogo declarativo introducido en V4.7. Describe la fuente de
verdad, el esquema, las validaciones, la identificación segura y el procedimiento para
incorporar un artículo **sin tocar el motor**.

> Alcance V4.7: separar los datos de los tres artículos actuales de la lógica y
> validarlos. **No** incluye interfaz de alta, Google Sheets, persistencia externa ni
> importación de Hispatec. La producción sigue en V4.5 y no se despliega nada.

---

## 1. Fuente de verdad y artefacto generado

| Elemento | Papel |
|---|---|
| `catalog/catalog.json` | **Fuente de verdad**. Se edita aquí. |
| `src/catalog-data.js` | **Generado**. Módulo UMD que consume `src/catalog.js`. No editar a mano. |
| `src/catalog-schema.js` | Validador puro (sin DOM) del catálogo. |
| `src/catalog.js` | API de catálogo construida desde los datos; conserva la API histórica. |
| `tools/build-catalog.js` | Valida y regenera el artefacto; `--check` verifica sincronización. |

```bash
node tools/build-catalog.js           # valida + regenera src/catalog-data.js
node tools/build-catalog.js --check   # falla si el artefacto no está sincronizado
```

`tests/catalog-schema.test.js` comprueba en cada ejecución que el artefacto y el JSON
son idénticos (incluido el hash SHA-256 del fuente).

### Por qué un artefacto JS y no leer el JSON

El navegador y Google Apps Script no pueden leer `catalog.json` del disco. El catálogo
se sirve como módulo UMD (`LogisticsCatalogData`) cargado antes de `catalog.js`
(`index.html`, y en el futuro `gas/index.html`). El build de GAS (`tools/build-gas.js`)
ya incluye `catalog-data.js` en la lista de módulos, pero **los bundles de `gas/` no se
han regenerado en V4.7**.

---

## 2. Esquema

### 2.1 Nivel raíz

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `schemaVersion` | entero | Sí | Actualmente `1`. |
| `catalogVersion` | string | Sí | Monótona (p. ej. `2026.10.19.1`). |
| `globals.palletWoodHeightMm` | entero | No | 144 mm (madera por palet). |
| `globals.maxTowerHeightMm` | entero | No | 2.278 mm (gálibo). |
| `globals.maxPalletsPerTower` | entero | No | 3. |
| `platforms.canonical` | string[] | Sí | Orden canónico de plataformas. |
| `platforms.aliases` | objeto | Sí | Alias → plataforma canónica. |
| `articles` | array | Sí | Al menos un artículo. |

### 2.2 Artículo

| Campo | Obligatorio | Derivado | Descripción |
|---|---|---|---|
| `id` | Sí | — | Identificador interno estable e inmutable (A-Z, 0-9, `_`). |
| `status` | Sí | — | `ACTIVE` \| `INACTIVE`. Un artículo inactivo no se planifica. |
| `name` | Sí | — | Nombre comercial largo. |
| `shortName` | Sí | — | Etiqueta corta para UI. |
| `description` | No | — | Texto libre. |
| `sortOrder` | No | — | Orden de presentación (pendiente de usar en UI). |
| `identification.gisCodes` | Sí (≥1) | — | Uno o varios GIS por artículo; únicos en todo el catálogo. |
| `identification.patterns[]` | Sí (≥1) | — | `{ value, flags }`; se compilan a `RegExp`. Sin funciones. |
| `identification.varietyDetection` | No | — | `NONE` o `DESCRIPTION_PATTERN` (`pattern`, `flags`, `varietyId`). |
| `stockAliases` | No | — | Alias de clave de stock suelta → variedad del artículo. |
| `varieties[]` | No | — | `{ id, name, isOldLot, fifoPriority }`. |
| `defaultVarietyId` | Condicional | — | Obligatorio con varias variedades y estrategia `HAMILTON`. |
| `box.{lengthMm,widthMm,heightMm}` | Sí | — | Dimensiones de caja. |
| `palletization.formats` | Sí (≥1) | — | `EURO` y/o `METROCHEP`. |
| `palletization.overrideGuard` | No | — | `{ blockMetrochepBelowEuroCapacity }`: salvaguarda opcional solo para overrides manuales. |
| `planning.allocationStrategy` | Sí | — | `HAMILTON` \| `MONOVARIETAL_FIFO`. |
| `planning.fifoPriorityVariety` | No | — | Variedad FIFO (solo `MONOVARIETAL_FIFO`). |
| `planning.varietyPreference` | No | — | Desempate neutro explícito. |
| `audit` | No | — | `version`, `createdAt`, `updatedAt`, `updatedBy`, `reason`. |

### 2.3 Formato de paletización

| Campo | Obligatorio | Derivado |
|---|---|---|
| `palletLengthMm`, `palletWidthMm`, `palletHeightMm` | Sí | — |
| `boxesPerLayer`, `maxLayers` | Sí | — |
| `maxStandardBoxes` | — | **Sí**: `boxesPerLayer × maxLayers` (no se almacena). |
| `layerPattern` | Sí | — |
| `isRigid`, `capacitySource`, `verified`, `name` | No | — |

---

## 3. Valores actuales extraídos del código

Todos los valores proceden de `src/catalog.js` y `src/palletizer.js` del commit
`dd8a0de`. No se ha inventado ningún dato físico.

| Artículo | GIS | Variedades (prioridad FIFO) | Caja mm |
|---|---|---|---|
| `PERA_RAMA` | 14072 | — | 600×400×95 |
| `COCKTAIL_ROMANTICO` | 16228 | CONSABOR (2), SAO_PAULO (1, lote viejo), SUNSTREAM (2) | 600×400×95 |
| `CHERRY_RAMA` | 18746 | SUNSTREAM (1) | 400×300×97 |

| Artículo | EURO (cjs/capa × capas) | METROCHEP | Salvaguarda de override |
|---|---|---|---|
| `PERA_RAMA` | 4 × 19 = 76 | 5 × 19 = 95 | — |
| `COCKTAIL_ROMANTICO` | 4 × 20 = 80 | 5 × 20 = 100 | — |
| `CHERRY_RAMA` | 8 × 22 = 176 | 10 × 22 = 220 | Sí: si se fuerza METROCHEP con ≤ 176 cjs, se mantiene EURO |

**Regla B (decisión del propietario):** no existe un umbral obligatorio de cajas para elegir
formato. El optimizador decide entre EURO y METROCHEP con las capacidades, capas, alturas y
torres. Ejemplo real: Pera con 77–80 cajas produce EURO (2 palets en 1 torre); con 81 produce
METROCHEP (1 palet en 1 torre). No es una regla por umbral, es el resultado de la optimización.
La única regla de override es la salvaguarda explícita de Cherry, que solo actúa cuando el
usuario fuerza METROCHEP por debajo de la capacidad EURO.

Alturas derivadas: Pera 1.949 mm, Cocktail 2.044 mm, Cherry 2.278 mm. Madera 144 mm,
gálibo 2.278 mm, máximo 3 palets/torre.

### Campos que hoy NO están definidos

- **`minOperationalBoxes`**: el motor lo consulta, pero ninguna regla lo declara; por
  tanto los avisos de bajo mínimo (`PALLET_UNDERFILL`) no se emiten hoy. **No se ha
  inventado un valor.** Requiere confirmación operativa.
- **Prioridad empresarial CONSABOR vs SUNSTREAM**: documentada como pendiente en
  `src/cocktail-solver.js`. El catálogo solo declara el orden neutro de desempate.
- **Alias suelto `SUNSTREAM`**: se mantiene apuntando a Cocktail (comportamiento V4.6),
  aunque Cherry también tenga una variedad SUNSTREAM. Cambiarlo requiere decisión.

---

## 4. Validaciones implementadas (`src/catalog-schema.js`)

| Código | Comprueba |
|---|---|
| `INVALID_SCHEMA_VERSION`, `MISSING_CATALOG_VERSION` | Versión del esquema y del catálogo. |
| `DUPLICATE_ARTICLE_ID` | `id` único. |
| `DUPLICATE_GIS` | GIS único en todo el catálogo (incluidos inactivos). |
| `DUPLICATE_PATTERN`, `PATTERN_OVERLAP` | Patrones idénticos o que casan con el nombre de otro artículo. |
| `INVALID_PATTERN_REGEX` | Expresión regular compilable. |
| `MISSING_PALLET_FORMATS`, `MISSING_PALLETIZATION` | Artículo con reglas de paletización completas. |
| `INVALID_LAYER_CAPACITY` | `boxesPerLayer` cabe por área en la base del palet. |
| `PALLET_EXCEEDS_TOWER_HEIGHT` | Altura total ≤ gálibo. |
| `INVALID_BOX_DIMENSION` | Dimensiones enteras positivas. |
| `UNKNOWN_DEFAULT_VARIETY`, `UNKNOWN_FIFO_VARIETY` | Variedades referenciadas existentes. |
| `UNKNOWN_STOCK_ALIAS_VARIETY`, `DUPLICATE_STOCK_ALIAS` | Alias de stock válido y no duplicado entre artículos. |
| `MISSING_DEFAULT_VARIETY` | Varias variedades + `HAMILTON` requiere defecto. |
| `INVALID_PLATFORM_ALIAS` | Alias → plataforma canónica existente. |
| `UNKNOWN_VARIETY_DETECTION` | `varietyDetection.varietyId` existe en el artículo. |
| `MISSING_PLANNING`, `MISSING_STRATEGY`, `INVALID_STRATEGY` | `planning` explícito con estrategia válida. |
| `UNKNOWN_VARIETY_PREFERENCE`, `INVALID_VARIETY_PREFERENCE` | `varietyPreference` es un array de variedades existentes. |
| `INCOMPATIBLE_FORMAT_CAPACITY` | Capacidad METROCHEP ≥ EURO. |
| `INVALID_OVERRIDE_GUARD` | Forma válida de la salvaguarda de override. |

La validación de área es **necesaria pero no suficiente** (los patrones de capa
combinados, como Cherry METROCHEP, no se resuelven geométricamente).

---

## 5. Identificación segura (Fase D)

| Entrada | Resultado |
|---|---|
| GIS conocido y único, artículo activo | Se resuelve el artículo (la descripción no manda). |
| GIS de artículo `INACTIVE` | Línea inválida `INACTIVE_ARTICLE`. |
| GIS presente y desconocido | Línea inválida `UNKNOWN_PRODUCT`. **No** se recurre a la descripción. |
| Sin GIS, una única descripción coincidente | Se resuelve el artículo. |
| Sin GIS, varias descripciones coincidentes | Línea inválida `AMBIGUOUS_PRODUCT`. |
| Sin coincidencias | `UNKNOWN_PRODUCT`. |

Esto corrige el comportamiento anterior, en el que `99999 + "TOMATE PERA RAMA"` se
clasificaba como Pera Rama en silencio. Los tres GIS actuales siguen resolviendo igual.

---

## 6. Cómo añadir un artículo (solo datos)

1. Añadir el objeto del artículo a `catalog/catalog.json` con GIS, patrón, caja y reglas
   completas de paletización.
2. Ejecutar `node tools/build-catalog.js` (valida y regenera `src/catalog-data.js`).
3. Ejecutar la batería de pruebas (ver README §9).
4. Si el catálogo debe llegar a producción: **build y despliegue autorizados aparte**
   (`node tools/build-gas.js`), fuera del alcance de V4.7.

No hace falta tocar `parser.js`, `orchestrator.js` ni `palletizer.js`: el artículo se
identifica, recibe stock y paletiza con sus reglas. La interfaz de alta y la persistencia
en Sheets quedan para fases posteriores.

---

## 7. Límites conocidos de V4.7

- La **UI** sigue mostrando 5 entradas de stock y etiquetas específicas de los tres
  productos (`src/ui.js`). Un artículo nuevo funciona en el motor y en los tests, pero
  no tiene formulario propio ni etiqueta comercial dinámica.
- No hay persistencia: el catálogo vive en el repositorio y requiere build/despliegue.
- `src/logistics-engine.js` conserva un catálogo duplicado y **está huérfano** (no se
  carga ni se construye); no se ha tocado para no ampliar el alcance.
- `gas/` no se ha regenerado; su contenido sigue siendo el de V4.6. No debe publicarse
  hasta ejecutar el build autorizado.
