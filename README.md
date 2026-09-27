# Planificador de Carga Hortofrutícola

**Versión 1.0.0 (Release Oficial MVP)**  
*Hub de Expediciones y Logística de Muelle*

---

## 1. Objetivo de la Aplicación

El **Planificador de Carga** es una Single Page Application (SPA) ligera, robusta y determinista diseñada para automatizar y optimizar la preparación de cargas diarias en el muelle de expediciones. 

Resuelve de manera automática:
1. **Interpretación directa** del correo electrónico o texto bruto de la previsión de pedidos (sin limpieza manual previa).
2. **Reparto proporcional equilibrado** del stock físico disponible cuando no alcanza para cubrir el 100% de la demanda (mediante el algoritmo de Hamilton de restos mayores).
3. **Resolución monovarietal estricta de Cocktail Romántico**: prioriza el lote antiguo (Sao Paulo - FIFO 1) sobre el lote fresco (Sunstream - FIFO 2), garantizando que **ninguna plataforma reciba jamás ambas variedades mezcladas**.
4. **Paletización física rígida y cubicaje**: cálculo de palets completos, palets de remanente, porcentaje de ocupación, número de capas y altura estimada en milímetros según el tipo de palet (`EURO` o `METROCHEP`).
5. **Generación inmediata de salidas operativas**:
   - Mensaje estructurado y limpio listo para copiar y enviar por **WhatsApp**.
   - **Informe formal en PDF A4** con cabecera de muelle, balance de stock y firmas.
   - Vista optimizada de **impresión directa en A4**.

---

## 2. Flujo Operativo Diario en Muelle

El flujo de trabajo en el muelle está simplificado en 4 pasos secuenciales sin fricción:

```text
1. COPIAR Y PEGAR PREVISIÓN
   (Pegar el texto tal cual llega en el correo en el Paso 1)
                ↓
2. INTRODUCIR EXISTENCIAS REALES
   (Cajas físicas contadas en almacén en el Paso 2)
                ↓
3. GENERAR PLAN DE CARGA
   (Pulsar el botón azul de generación)
                ↓
4. REVISIÓN Y EXPEDICIÓN
   (Copiar a WhatsApp o descargar el PDF formal A4 con firmas)
```

---

## 3. Guía de Uso Rápido para el Usuario de Muelle

### 3.1. Cómo abrir la aplicación
- **No requiere instalación, servidor ni Node.js** para el uso diario.
- Basta con hacer doble clic sobre el archivo [`index.html`](./index.html) o abrirlo con cualquier navegador web moderno (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).

### 3.2. Cómo introducir una previsión
1. Dirígete a la sección **PASO 1: Previsión de Demanda**.
2. Abre el correo de previsión recibido de la central de compras o pedidos.
3. Selecciona todo el texto de la tabla o mensaje, cópialo (`Ctrl+C`) y pégalo directamente (`Ctrl+V`) en el cuadro de texto.
   - *Nota*: No es necesario borrar cabeceras, ni separar columnas, ni convertir a Excel o TSV. El parser identifica automáticamente las plataformas reconocidas, fechas de entrega, códigos GIS y cantidades de cajas.
4. Puedes pulsar **Analizar Previsión** para previsualizar la demanda total agregada por producto y plataforma antes de calcular la carga.

### 3.3. Cómo introducir existencias físicas
1. Dirígete a la sección **PASO 2: Stock Físico Disponible**.
2. Introduce las cajas reales que hay en almacén para cada línea:
   - **Tomate Pera Rama** (estándar).
   - **Tomate Cocktail Romántico — Sao Paulo** (lote antiguo, prioridad FIFO 1).
   - **Tomate Cocktail Romántico — Sunstream** (lote fresco, prioridad FIFO 2).
   - **Tomate Cherry Rama — Sunstream** (variedad estándar).

### 3.4. Bloqueos Prioritarios y Exclusiones (Opcional)
- Si una plataforma tiene prioridad absoluta (por ejemplo, `CENTRO` debe recibir el 100% de su Pera Rama antes que nadie), despliega **Opciones Avanzadas** y añade un bloqueo prioritario (`FULL`).
- Si un producto, plataforma o línea concreta no debe servirse hoy, puedes excluirlo con un solo clic.

### 3.5. Generar el Plan
- Pulsa el botón principal azul **GENERAR PLAN DE CARGA**.
- En milisegundos se calculará el reparto completo, la paletización y el balance de existencias.

---

## 4. Interpretación del Resultado y de las Incidencias

### 4.1. Badge de Estado Cualitativo (Cabecera)
- **PLANIFICACIÓN CORRECTA** (Verde): 100% de servicio sin déficit de existencias y todos los palets con ocupación óptima.
- **PLANIFICACIÓN CON INCIDENCIAS** (Amarillo): El plan es físicamente viable, pero existen avisos operativos que el muelle debe conocer (por ejemplo: falta de stock que genera cajas pendientes, o palets con remanente inferior al mínimo de estabilidad).
- **PLANIFICACIÓN NO VIABLE** (Rojo): Entrada sin pedidos válidos o stock erróneo que impide el despacho.

### 4.2. Tipos de Incidencias y Advertencias Operativas
- **`PALLET_UNDERFILL` (Bajo Mínimo)**: El último palet de remanente contiene menos cajas de las recomendadas operativamente (ej. < 80 cajas en Euro). La aplicación alerta al carretillero para que refuerce el flejado o considere remontar si es posible.
- **`PALLET_NOT_FULL` (Incompleto)**: El palet no alcanza la altura máxima estándar (ej. 96 cjs en Pera Euro o 176 cjs en Cherry Euro), pero es superior al mínimo operativo.
- **`STOCK_DEFICIT` (Cajas Pendientes)**: El almacén tenía menos cajas que las solicitadas. Las cajas asignadas más las pendientes suman exactamente el pedido original.

---

## 5. Reglas de Negocio Críticas

### 5.1. Regla de Cocktail Romántico (Monovarietal + FIFO)
El Tomate Cocktail Romántico puede servirse físicamente de dos variedades:
- **SAO PAULO**: Lote antiguo en almacén (prioridad FIFO 1).
- **SUNSTREAM**: Lote fresco (prioridad FIFO 2).

> **REGLA DE ORO DE MUELLE**:  
> Una plataforma **NUNCA** puede recibir simultáneamente Sao Paulo y Sunstream.  
> Cada plataforma recibe o bien 100% Sao Paulo, o bien 100% Sunstream, o una asignación parcial de una sola de ellas, o 0. **Jamás se mezclan ambas variedades en el mismo pedido de plataforma**.

### 5.2. Reglas de Paletización Física y Geometría Real (Fase 14.4)

El motor de paletización calcula la estructura física real: **CAJAS → CAPAS → PALETS FÍSICOS → TORRES → HUECOS DE PALET**.

#### Geometría y Capacidades Oficiales por Formato
- **Madera de base**: 144 mm acumulativos por palet físico en la torre (EURO y METROCHEP).
- **Gálibo Máximo de Torre**: **2.278 mm** (`DEFAULT_REFERENCE_TOWER_HEIGHT_MM`).
- **Límite de Remonte**: Máximo **3 palets por torre / hueco**.
- **Segregación Estricta**: Los palets EURO y METROCHEP **nunca se mezclan en la misma torre**.

| Producto | Formato | Dimensiones Caja | Base (cjs/capa) | Capas Máx | Capacidad Máx | Altura Mercancía | Altura Total Palet |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Pera Rama** | EURO | 600×400×95 mm | 4 | 19 | **76 cjs** | 1.805 mm | 1.949 mm |
| **Pera Rama** | METROCHEP | 600×400×95 mm | 5 | 19 | **95 cjs** | 1.805 mm | 1.949 mm |
| **Cocktail Romántico** | EURO | 600×400×95 mm | 4 | 20 | **80 cjs** | 1.900 mm | 2.044 mm |
| **Cocktail Romántico** | METROCHEP | 600×400×95 mm | 5 | 20 | **100 cjs** | 1.900 mm | 2.044 mm |
| **Cherry Rama** | EURO | 400×300×97 mm | 8 | 22 | **176 cjs** | 2.134 mm | 2.278 mm |
| **Cherry Rama** | METROCHEP | 400×300×97 mm | 10 | 22 | **220 cjs** | 2.134 mm | 2.278 mm |

#### Transición Automática de Formato por Umbral
- **Pera Rama**: $\le 76$ cjs $\to$ `EURO`; $> 76$ cjs $\to$ `METROCHEP`.
- **Cocktail Romántico**: $\le 80$ cjs $\to$ `EURO`; $> 80$ cjs $\to$ `METROCHEP`.
- **Cherry Rama**: $\le 176$ cjs $\to$ `EURO`; $> 176$ cjs $\to$ `METROCHEP`.
*(Si la plataforma tiene configuración explícita, se respeta salvo Cherry $\le 176$ que siempre resuelve a EURO).*

#### Remonte y Torres (Huecos de Palet)
Las torres se empaquetan de forma óptima determinista (Bin Packing determinista) respetando:
$$\text{Altura Torre} = (N \times 144\text{ mm}) + \sum \text{Altura Mercancía}_i \le 2.278\text{ mm} \quad (N \le 3)$$
- En el dataset canónico **18/09 (522 cajas)**, se generan exactamente **17 palets físicos** que se agrupan en **10 torres / huecos de palet**:
  - **Santander**: 1 hueco (3 palets remontados: 58 Pera + 4 Cocktail + 24 Cherry = 2.243 mm $\le$ 2.278 mm).
  - **Centro**: 2 huecos (3 palets: 2.908 mm > 2.278 mm $\to$ divide en 2 torres).
  - **Cataluña**: 2 huecos (3 palets: 2.811 mm > 2.278 mm $\to$ divide en 2 torres).
  - **Levante**: 2 huecos (3 palets: 2.813 mm > 2.278 mm $\to$ divide en 2 torres).
  - **Sur**: 2 huecos (3 palets: 2.336 mm > 2.278 mm $\to$ divide en 2 torres).
  - **Málaga**: 1 hueco (2 palets: 858 mm $\le$ 2.278 mm).

---

## 6. Salidas Operativas (Un Plan $\rightarrow$ Tres Salidas)

Una vez generado el plan, en la barra superior de acciones dispones de 3 botones:

1. **Copiar WhatsApp** (`btn-export-whatsapp`):  
   Copia al portapapeles un mensaje limpio, ordenado por plataforma y producto con emojis descriptivos y sección de incidencias, listo para pegar en el grupo de transportistas o encargados.
2. **Generar PDF** (`btn-export-pdf`):  
   Descarga inmediatamente un informe formal en PDF tamaño A4 titulado `Plan_Carga_DD-MM-YYYY.pdf` con cabecera de muelle, KPIs, balance de stock, detalle por plataforma, cubicaje y recuadros para firmas.
3. **Imprimir A4** (`btn-print-plan`):  
   Abre el cuadro de diálogo de impresión nativa del sistema. La hoja de estilos oculta automáticamente los menús, cajas de texto y botones de pantalla, dejando un documento impreso limpio y formal.

---

## 7. Datasets de Demostración Integrados

Para verificar el funcionamiento instantáneamente sin escribir nada:
- Botón **18/09**: Carga la previsión real del 18 de septiembre (522 cajas solicitadas, 17 palets físicos resultantes).
- Botón **26/08**: Carga el dataset de prueba del 26 de agosto con pedidos distribuidos en las 6 plataformas canónicas.

---

## 8. Estructura del Proyecto

```text
logistica-muelle/
├── index.html                 # Interfaz visual de la SPA (Vanilla JS + Tailwind)
├── README.md                  # Manual operativo y técnico oficial
├── spec.md                    # Especificación formal de requisitos
├── test_data.tsv              # Datos brutos de muestra
├── src/                       # Código fuente modular (UMD desacoplado)
│   ├── catalog.js             # Catálogo de productos, códigos GIS y plataformas
│   ├── parser.js              # Parser tolerante a fallos y agregador de demanda
│   ├── hamilton.js            # Algoritmo de prorrateo proporcional (Hare-Niemeyer)
│   ├── cocktail-solver.js     # Solucionador FIFO y monovarietal estricto
│   ├── palletizer.js          # Motor de cubicaje, capacidades y alturas
│   ├── orchestrator.js        # Orquestador central puro (planLoad)
│   ├── ui.js                  # Controlador y estado de la UI (AppState/UIController)
│   └── logistics-engine.js    # Motor clásico conservado por compatibilidad
├── tests/                     # Suite de pruebas automatizadas
│   ├── acceptance.test.js     # Escenarios de aceptación final del MVP (Fase 8)
│   ├── hamilton.test.js       # Tests unitarios de Hamilton y restos
│   ├── monovarietal.test.js   # Tests de FIFO y no mezcla de Cocktail
│   ├── hardening.test.js      # Casos extremos, nulos y stock cero
│   ├── palletizer.test.js     # Tests de cubicaje, Euro y Metrochep
│   ├── parser.test.js         # Tests de extracción de líneas, fechas y GIS
│   ├── integration.test.js    # Tests de integración del orquestador
│   ├── test_logistics_engine.js # Tests de regresión del motor clásico
│   └── ui.test.js             # Tests de la capa UI, reactividad y WhatsApp
├── scripts/                   # Scripts de verificación y reporte
│   ├── run_all_tests.js       # Ejecutor global de las 9 suites de pruebas
│   ├── verify_dom_ids.js      # Verificador de sincronización entre UI y DOM
│   └── verify_phase_7.js      # Verificador de salidas (WhatsApp, PDF e Impresión)
└── reports/                   # Documentos generados físicamente
    └── Plan_Carga_18_09_A4.pdf # Informe PDF A4 de prueba verificado (526 KB)
```

---

## 9. Ejecución de Tests Automatizados

Para ejecutar la batería completa de pruebas:

```bash
# Ejecutar todas las suites de prueba (184 tests):
node scripts/run_all_tests.js

# Ejecutar únicamente la suite de aceptación final:
node tests/acceptance.test.js
```

---

## 10. Requisitos y Dependencias Externas

- **Motor Logístico**: Cero dependencias externas. 100% JavaScript Vanilla estándar (ES6+), ejecutable tanto en Node.js como en navegador.
- **Capa Visual**:
  - Tailwind CSS (vía CDN oficial).
  - Fuentes Inter y JetBrains Mono (vía Google Fonts CDN).
  - html2pdf.js (vía Cloudflare CDN, con fallback automático a `window.print()` si no hay conexión a Internet).
