# Catálogo configurable de artículos — V4.7/V4.8.2

Documento técnico del catálogo declarativo (V4.7), de su gestión desde la interfaz
(V4.8) y del stock dinámico integrado (V4.8.2). Describe la fuente de verdad, el esquema,
las validaciones, la identificación segura, la persistencia local y el procedimiento para
incorporar un artículo y darle existencias.

> Alcance V4.7: datos separados de la lógica y validados.
> Alcance V4.8/V4.8.2: alta/edición/activación de artículos y stock dinámico desde la UI,
> con persistencia **local del navegador**. **No** hay backend, Google Sheets,
> configuración compartida ni importación de Hispatec. La producción no se despliega
> desde esta entrega.

---

## 1. Fuente de verdad y artefacto generado

| Elemento | Papel |
|---|---|
| `catalog/catalog.json` | **Fuente de verdad**. Se edita aquí. |
| `src/catalog-data.js` | **Generado**. Módulo UMD que consume `src/catalog.js`. No editar a mano. |
| `src/catalog-schema.js` | Validador puro (sin DOM) del catálogo. |
| `src/catalog-editor.js` | Altas/edición/estado y persistencia local (V4.8). |
| `src/stock-editor.js` | Claves, validación y persistencia del stock (V4.8.2). |
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

## 6. Cómo añadir un artículo

### 6.1. Desde la interfaz (V4.8, local a este navegador)

1. Abrir **Catálogo de Artículos** (escritorio: botón de cabecera; móvil: **Más → Catálogo**).
2. Pulsar **+ Nuevo artículo**, completar ID, nombre, GIS, caja y formatos, y **Guardar**.
3. El artículo se valida con `catalog-schema.js`; si hay errores se muestran y no se guarda.
4. El cambio queda en `localStorage` de este navegador y sobrevive a una recarga.
5. Para descartar los cambios locales: **Restaurar** (vuelve al catálogo de fábrica).

La UI no permite cambiar el ID de un artículo existente ni edita variedades/FIFO/alias:
esos datos se conservan al editar. El stock del artículo se introduce en la sección
**Stock → Añadir existencia**, eligiendo el artículo activo y su variedad. No hace falta
editar código para dar existencias a un artículo nuevo.

### 6.2. Desde el repositorio (fuente de verdad para producción)

1. Añadir el objeto del artículo a `catalog/catalog.json` con GIS, patrón, caja y reglas
   completas de paletización.
2. Ejecutar `node tools/build-catalog.js` (valida y regenera `src/catalog-data.js`).
3. Ejecutar la batería de pruebas (ver README §9).
4. Si el catálogo debe llegar a producción: **build y despliegue autorizados aparte**
   (`node tools/build-gas.js`), fuera del alcance de V4.8.

No hace falta tocar `parser.js`, `orchestrator.js` ni `palletizer.js`: el artículo se
identifica, recibe stock y paletiza con sus reglas.

---

## 7. Persistencia local (V4.8/V4.8.2) y límites conocidos

- Claves de almacenamiento: `planificador-catalog-v1` y `planificador-stock-v1`
  (`localStorage`).
- El catálogo y el stock locales se validan al cargar; si son inválidos se ignoran, se usan
  los valores de fábrica y se informa en la UI. Un guardado sin almacenamiento disponible
  **no** se simula: falla y se avisa.
- **No es configuración compartida**: cada navegador tiene su propia copia. No se
  sincroniza con otros equipos, con GitHub ni con producción.
- El stock se identifica por **artículo + variedad** (`productId::varietyId`, con
  `STANDARD` cuando no hay variedad). La UI conserva la forma histórica sin `::` para las
  líneas sin variedad.
- Se rechazan claves duplicadas (incluida `PERA_RAMA` frente a `PERA_RAMA::STANDARD`),
  artículos inexistentes, artículos inactivos y cantidades no enteras/negativas.
- Al desactivar un artículo no se borra su stock: queda como línea histórica inactiva, no
  se planifica y no admite líneas nuevas.
- `src/logistics-engine.js` conserva un catálogo duplicado y **está huérfano** (no se
  carga ni se construye).
- `gas/` no se ha regenerado; su contenido sigue siendo el de V4.6. No debe publicarse
  hasta ejecutar el build autorizado.

---

## 8. Modelo de stock dinámico (V4.8.2)

La tabla de **Stock Disponible** se construye desde `AppState.stock` y el catálogo activo:

| Concepto | Regla |
|---|---|
| Clave de UI | `PERA_RAMA` (sin variedad) o `COCKTAIL_ROMANTICO::CONSABOR` |
| Clave canónica | `productId::varietyId`, con `STANDARD` si no hay variedad |
| Alta | Solo artículos con `status: ACTIVE`; la variedad debe pertenecer al artículo |
| Cantidad | Entero `>= 0` al editar; entero `> 0` al añadir una línea |
| Duplicados | Se comparan por clave canónica, no por el texto de la clave |
| Inactivos | Conservan su línea histórica; no admiten altas ni planificación |
| Desconocidos | La línea se muestra deshabilitada como “FUERA DE CATÁLOGO” |

Códigos de error propios: `INVALID_STOCK_EMPTY`, `INVALID_STOCK_DECIMAL`,
`INVALID_STOCK_NEGATIVE`, `INVALID_STOCK_NAN`, `INVALID_STOCK_NON_POSITIVE`,
`INVALID_STOCK_TOO_LARGE`,
`DUPLICATE_STOCK_KEY`, `UNKNOWN_ARTICLE`, `INACTIVE_ARTICLE`, `UNKNOWN_VARIETY`,
`MISSING_VARIETY`.

La UI avisa si el stock se actualiza en memoria pero no puede persistirse; no lo presenta
como guardado. La comprobación de esta entrega es headless (mini-DOM y tests); no se ha
realizado una verificación visual en navegador real.
