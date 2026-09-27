# GUÍA RÁPIDA DE USUARIO — PLANIFICADOR DE CARGA
**Versión RC3.1 — Piloto Interno**
<!-- RELEASE-TAG: RC3.1 · marca de auto-identificación del paquete -->

---

## 1. ¿Qué es el Planificador de Carga y para qué sirve?
El **Planificador de Carga** convierte la previsión de pedidos en un **plan de carga exacto,
seguro y optimizado**: cuántas cajas van a cada plataforma, cómo se montan los palets físicos y
cómo se agrupan en torres (huecos de camión) sin superar la altura máxima de gálibo.

---

## 2. Unidades de trabajo
- **Cajas:** unidad de cómputo y manipulación física.
- **Plataforma:** destino logístico de la mercancía (Centro, Cataluña, Levante, Sur, Santander,
  Málaga). Cada plataforma se planifica como una unidad independiente y homogénea.

---

## 3. Flujo de trabajo

### Paso 1: Introducir la previsión
Copie el texto de la previsión desde el correo y péguelo en el recuadro principal. El sistema
reconoce automáticamente fechas, plataformas, códigos de producto y cantidades.

### Paso 2: Introducir las existencias (stock)
Indique las cajas disponibles por producto y variedad:
- **Stock suficiente:** todas las plataformas reciben el 100% de lo solicitado.
- **Stock insuficiente (déficit):** el sistema prorratea de forma equitativa y muestra las cajas
  pendientes de expedir.

### Paso 3: Tomate Cocktail Romántico (variedades internas)
El Cocktail Romántico es **un único artículo comercial** que puede tener varias **variedades
físicas** en almacén. Actualmente:
- **Sao Paulo** — lote antiguo.
- **Sunstream**
- **Consabor**

Reglas operativas:
- **Prioridad FIFO:** el lote más antiguo (*Sao Paulo*) se expide siempre en primer lugar para
  garantizar la rotación. *Sunstream* y *Consabor* son variedades normales y no tienen prioridad
  FIFO.
- **Separación monovarietal:** **ninguna plataforma recibe dos variedades distintas de Cocktail**.
  Cada destino recibe exclusivamente una variedad.
- **Mismo formato físico:** todas las variedades de Cocktail comparten exactamente el mismo
  formato (10 × 300 g) y, por tanto, la misma paletización, capacidades, capas y alturas. La única
  diferencia entre ellas es su identificación interna.
- El stock se introduce por separado para cada variedad.

### Paso 4: Bloqueos manuales (locks)
- **Bloqueo Total (FULL):** la plataforma seleccionada recibe el 100% de lo pedido para ese
  producto/variedad.
- **Bloqueo Fijo (FIXED):** fija una cantidad exacta en cajas para esa plataforma.

### Paso 5: Paletización oficial (EURO y METROCHEP)
El sistema elige automáticamente el formato de palet más eficiente para cada plataforma:
- **Palet Europeo (EURO):** 1.200 × 800 mm.
- **Palet Metrochep (METROCHEP):** 1.200 × 1.000 mm.

### Paso 6: Palet físico, torre y altura de gálibo
- **Palet físico:** el palet de madera individual con sus capas de cajas.
- **Torre (hueco de camión):** hasta tres palets remontados para ocupar una sola plaza.
- **Control de altura:** la altura combinada nunca supera el límite del semirremolque
  frigorífico (**2.278 mm**); si lo supera, el sistema desdobla la carga en una torre adicional.

### Paso 7: Replanificación dinámica
Si entra más fruta o se detecta una merma, modifique las existencias en pantalla y pulse
**«Recalcular Plan»**. El reparto se actualiza al instante sin perder la previsión ni los bloqueos.

---

## 4. Revisión y salida de información

### Resultado en pantalla
- **Resumen ejecutivo:** cajas solicitadas, asignadas y pendientes, palets y huecos de camión.
- **Tarjetas por plataforma:** cajas por producto y variedad, formato de palet y detalle de cada
  torre con su altura y margen de gálibo.
- **Avisos e incidencias:** faltantes de existencias y palets incompletos.

### Exportación a PDF
Pulse **«Generar PDF»** para descargar la hoja de carga en A4 apaisado (1 página), con encabezado,
tablas de estiba y casillas de firma. La hoja muestra **TOTAL COCKTAIL** sumando las cajas
**servidas** de todas sus variedades; *Consabor*, *Sunstream* y *Sao Paulo* aparecen como
variedades internas, nunca como artículos independientes.

### Resumen para WhatsApp
Pulse **«Copiar WhatsApp»** para copiar un texto estructurado con las cajas asignadas por
plataforma y variedad.

### Modo claro / oscuro
Botón en la esquina superior para alternar visualización; no altera los datos del cálculo.

---

## 5. Lista de verificación antes de cargar el camión
1. Que las cajas asignadas coinciden con el albarán físico preparado en almacén.
2. Que las plataformas con palets remontados respetan las alturas máximas de la hoja.
3. Que ninguna plataforma lleva mezcladas dos variedades de Cocktail.
4. Que si ha habido faltantes, tráfico está informado de las cajas pendientes.

---

## Flujo rápido

```
Pegar previsión
      ↓
Revisar plataformas y cantidades
      ↓
Introducir stock (por variedad)
      ↓
Aplicar bloqueos si procede
      ↓
Calcular
      ↓
Revisar resultado
      ↓
Generar PDF / WhatsApp
```

---

> ⚠️ **ADVERTENCIA OPERATIVA:**
> **La planificación generada debe ser revisada por el responsable antes de ejecutar la carga.**
