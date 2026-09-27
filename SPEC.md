# Especificación Técnica: Modelo Físico de Paletización y Torres (Fase 14.4)

**Sistema**: Planificador de Carga Logística Hortofrutícola  
**Módulo**: `src/palletizer.js`  
**Consumidores**: `src/orchestrator.js`, `src/ui.js` (WhatsApp, PDF, UI de Muelle)

---

## 1. Principio Fundamental de Dominio

La paletización se rige exclusivamente por geometría física tridimensional real:
$$\text{CAJAS} \longrightarrow \text{CAPAS} \longrightarrow \text{PALETS FÍSICOS} \longrightarrow \text{TORRES} \longrightarrow \text{HUECOS DE PALET}$$

Quedan expresamente prohibidos:
- Modelos heurísticos basados en balances de cajas (ej. mínimos de 80 cajas).
- Alturas heurísticas heredadas (1.800 mm, 2.500 mm, 2.600 mm).
- Fórmulas directas ingenuas para calcular huecos (ej. $\lceil N/3 \rceil$ sin considerar gálibo).

---

## 2. Geometría Física y Parámetros Oficiales

### 2.1. Constantes Globales
- **Gálibo Máximo de Torre de Referencia**: $2.278\text{ mm}$ (`DEFAULT_REFERENCE_TOWER_HEIGHT_MM`).
- **Altura de Madera de Palet**: $144\text{ mm}$ (`PALLET_WOOD_HEIGHT_MM`).
  - Cada palet físico en la torre aporta $144\text{ mm}$ de madera.
  - Para $N$ palets en una torre: $\text{Madera} = N \times 144\text{ mm}$.
- **Límite Máximo de Remonte por Torre**: $3\text{ palets físicos}$.

### 2.2. Dimensiones y Capacidades Oficiales

| Parámetro | Pera Rama (EURO) | Pera Rama (METRO) | Cocktail (EURO) | Cocktail (METRO) | Cherry (EURO) | Cherry (METRO) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dimensiones Palet** | 1200×800 mm | 1200×1000 mm | 1200×800 mm | 1200×1000 mm | 1200×800 mm | 1200×1000 mm |
| **Dimensiones Caja** | 600×400×95 mm | 600×400×95 mm | 600×400×95 mm | 600×400×95 mm | 400×300×97 mm | 400×300×97 mm |
| **Cajas por Capa** | 4 | 5 | 4 | 5 | 8 | 10 |
| **Capas Máximas** | 19 | 19 | 20 | 20 | 22 | 22 |
| **Capacidad Máxima** | **76 cjs** | **95 cjs** | **80 cjs** | **100 cjs** | **176 cjs** | **220 cjs** |
| **Altura Mercancía** | 1.805 mm | 1.805 mm | 1.900 mm | 1.900 mm | 2.134 mm | 2.134 mm |
| **Altura Total Palet** | 1.949 mm | 1.949 mm | 2.044 mm | 2.044 mm | 2.278 mm | 2.278 mm |

---

## 3. Resolución Automática de Formato de Palet

La resolución de formato para cada asignación sigue umbrales de capacidad nominal estricta:
1. **Pera Rama**:
   $$\text{Cantidad} \le 76 \implies \text{EURO} \quad (76\text{ cjs/palet})$$
   $$\text{Cantidad} > 76 \implies \text{METROCHEP} \quad (95\text{ cjs/palet})$$
2. **Cocktail Romántico**:
   $$\text{Cantidad} \le 80 \implies \text{EURO} \quad (80\text{ cjs/palet})$$
   $$\text{Cantidad} > 80 \implies \text{METROCHEP} \quad (100\text{ cjs/palet})$$
3. **Cherry Rama**:
   $$\text{Cantidad} \le 176 \implies \text{EURO} \quad (176\text{ cjs/palet})$$
   $$\text{Cantidad} > 176 \implies \text{METROCHEP} \quad (220\text{ cjs/palet})$$

*Excepción de Rigidez de Cherry*: Si una configuración explícita solicita METROCHEP para Cherry Rama pero la cantidad asignada es $\le 176$ cajas, el sistema asigna automáticamente EURO para evitar ineficiencias de transporte.

---

## 4. Cálculo de Palets Físicos

Para una asignación de $B$ cajas con capacidad $C$ y cajas por capa $L_{capa}$:
- Número de palets completos: $F = \lfloor B / C \rfloor$.
- Cajas de remanente: $R = B \pmod C$.
- Cada palet completo tiene:
  - $\text{Cajas} = C$
  - $\text{Capas} = \text{maxLayers}$
  - $\text{Altura Mercancía} = \text{Capas} \times H_{caja}$
  - $\text{Altura Total} = 144 + \text{Altura Mercancía}$
  - $\text{isFull} = \text{true}$
- Si $R > 0$, se genera un palet de remanente con:
  - $\text{Cajas} = R$
  - $\text{Capas} = \lceil R / L_{capa} \rceil$
  - $\text{Altura Mercancía} = \text{Capas} \times H_{caja}$
  - $\text{Altura Total} = 144 + \text{Altura Mercancía}$
  - $\text{isFull} = \text{false}$
  - Warning operativo emitido: `PALLET_NOT_FULL`

---

## 5. Algoritmo de Empaquetado en Torres (Bin Packing Determinista)

### 5.1. Reglas Físicas de Validación de Torre
Una torre compuesta por los palets $\{P_1, P_2, \dots, P_k\}$ es válida si y solo si:
1. **Límite de Palets**: $k \le 3$.
2. **Homogeneidad de Formato**: $\forall i, j: \text{format}(P_i) = \text{format}(P_j)$ (EURO y METROCHEP nunca comparten torre).
3. **Límite de Gálibo**:
   $$H_{torre} = (k \times 144\text{ mm}) + \sum_{i=1}^k H_{mercancía}(P_i) \le 2.278\text{ mm}$$

### 5.2. Algoritmo de Optimización
1. Separación de palets en dos conjuntos disjuntos por formato: $\mathcal{P}_{EURO}$ y $\mathcal{P}_{METRO}$.
2. Para cada conjunto:
   - Ordenamiento de palets por altura de mercancía decreciente (desempate lexicográfico por `palletId`).
   - Búsqueda determinista de mínima partición (Branch and Bound con poda) que minimiza el número total de torres.
   - En cada torre, se registran:
     - `towerHeightMm`: altura total acumulada ($k \times 144 + \sum \text{merchandiseHeightMm}$).
     - `remainingHeightMm`: espacio libre hasta el gálibo ($2.278 - H_{torre}$).
     - `woodHeightMm`: altura total de madera ($k \times 144$).
     - `merchandiseHeightMm`: altura total de mercancía.
     - `totalBoxes`: suma exacta de cajas.

### 5.3. Relación de Términos
$$\mathbf{TORRE} \equiv \mathbf{HUECO\ DE\ PALET}$$
No existe distinción técnica ni física entre una torre y un hueco de palet.

---

## 6. Salidas Operativas y Dataset Canónico 18/09

En el dataset canónico del 18 de septiembre (522 cajas asignadas):
- **Cajas Paletizadas**: 522 / 522 (100% de conservación de masa).
- **Palets Físicos**: 17 palets.
- **Torres / Huecos de Palet**: 10 torres.

### Desglose por Plataforma:
1. **SANTANDER**:
   - 58 Pera (15L = 1.425 mm) + 4 Cocktail (1L = 95 mm) + 24 Cherry (3L = 291 mm) + 432 mm madera = **2.243 mm** $\le$ 2.278 mm.
   - **1 Hueco de Palet** (3 palets en 1 torre, 35 mm libres).
2. **CENTRO**:
   - 55 Pera (14L = 1.330 mm) + 36 Cocktail (9L = 855 mm) + 24 Cherry (3L = 291 mm) + 432 mm madera = 2.908 mm > 2.278 mm.
   - **2 Huecos de Palet** (reparto óptimo en 2 torres).
3. **CATALUÑA**:
   - 60 Pera (15L = 1.425 mm) + 31 Cocktail (8L = 760 mm) + 16 Cherry (2L = 194 mm) + 432 mm madera = 2.811 mm > 2.278 mm.
   - **2 Huecos de Palet** (reparto óptimo en 2 torres).
4. **LEVANTE**:
   - 74 Pera (19L = 1.805 mm) + 12 Cocktail (3L = 285 mm) + 24 Cherry (3L = 291 mm) + 432 mm madera = 2.813 mm > 2.278 mm.
   - **2 Huecos de Palet** (reparto óptimo en 2 torres).
5. **SUR**:
   - 58 Pera (15L = 1.425 mm) + 12 Cocktail (3L = 285 mm) + 12 Cherry (2L = 194 mm) + 432 mm madera = 2.336 mm > 2.278 mm.
   - **2 Huecos de Palet** (reparto óptimo en 2 torres).
6. **MÁLAGA**:
   - 15 Pera (4L = 380 mm) + 7 Cocktail (2L = 190 mm) + 288 mm madera = **858 mm** $\le$ 2.278 mm.
   - **1 Hueco de Palet** (2 palets en 1 torre, 1.420 mm libres).
