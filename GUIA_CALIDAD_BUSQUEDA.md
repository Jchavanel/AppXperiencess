# Guía de Calidad de Búsqueda — Xperiences

Panel: `admin.html` → **Calidad de búsqueda**

---

## ¿Para qué sirve este panel?

El motor de búsqueda de Xperiences clasifica las experiencias por relevancia usando una puntuación compuesta. Este panel te permite ajustar **cómo se pondera cada factor** para que los resultados reflejen exactamente lo que quieres priorizar.

Todos los cambios son inmediatos y se sincronizan en tiempo real con la base de datos. No es necesario reiniciar nada.

---

## Los 6 pesos principales

### 1. Peso semántico (por defecto: 5)
**¿Qué controla?** La importancia de que las palabras de la búsqueda coincidan con las etiquetas y descripción de la experiencia.

- **Valor alto (7–10):** Las experiencias con etiquetas muy específicas dominan completamente los resultados. Ideal cuando tus empresas tienen etiquetas manuales bien configuradas.
- **Valor bajo (1–3):** El buscador da más importancia a otros factores como proximidad o sostenibilidad. Útil si las etiquetas son escasas o inconsistentes.
- **Recomendación:** Mantén entre **4–6** mientras las empresas completan sus etiquetas. Sube a **7–8** cuando la mayoría tengan etiquetas manuales configuradas.

---

### 2. Peso climatología (por defecto: 1.2)
**¿Qué controla?** La penalización de experiencias con alta sensibilidad climática en días de mal tiempo, y el bonus de actividades indoor.

- **Valor alto (2–4):** Las actividades al aire libre con alta sensibilidad climática bajan mucho en rankings cuando el tiempo es adverso. Las actividades indoor suben.
- **Valor bajo (0–0.5):** El tiempo no afecta al ranking.
- **Recomendación:** Mantén entre **1–2**. Sube a **2.5–3** si tu zona tiene climatología variable y quieres que el buscador sea especialmente sensible al tiempo.

---

### 3. Peso sostenibilidad (por defecto: 0.7)
**¿Qué controla?** El bonus que reciben las experiencias con mayor nivel de sostenibilidad (escala 1–5 configurada en cada empresa).

- **Valor alto (2–3):** Las empresas más sostenibles aparecen sistemáticamente más arriba.
- **Valor bajo (0–0.3):** La sostenibilidad no influye en el orden.
- **Recomendación:** Mantén en **0.5–1** como bonus suave. Sube si quieres posicionar Xperiences como plataforma de turismo responsable.

---

### 4. Peso cercanía (por defecto: 1)
**¿Qué controla?** El bonus por distancia física al usuario (requiere que el usuario haya dado permiso de geolocalización).

- **Valor alto (2–4):** Las experiencias más cercanas dominan los resultados aunque sean menos relevantes semánticamente.
- **Valor bajo (0–0.5):** La distancia no penaliza ni bonifica.
- **Recomendación:** **1–1.5** para búsqueda equilibrada. Sube a **2.5** si la mayoría de usuarios buscan planes locales inmediatos.

---

### 5. Peso prioridad empresa (por defecto: 1.0)
**¿Qué controla?** El multiplicador de la prioridad de búsqueda de cada empresa (escala 1–10 configurada en el panel Finanzas).

- **Valor alto (1.5–2):** Las empresas con prioridad alta aparecen mucho más arriba respecto a las de prioridad baja.
- **Valor bajo (0–0.5):** La prioridad manual tiene poco efecto; el ranking es más "democrático".
- **Recomendación:** **1.0** es un equilibrio razonable. Sube a **1.5** si usas la prioridad como herramienta comercial (empresas premium vs básicas).

---

### 6. Peso aprendizaje (por defecto: 1.4)
**¿Qué controla?** El boost que reciben las experiencias que han acumulado más vistas y reservas en la plataforma.

- **Valor alto (2–3):** Las experiencias populares dominan aún más. El sistema es auto-reforzante.
- **Valor bajo (0–0.5):** Nuevas experiencias tienen las mismas oportunidades que las establecidas.
- **Recomendación:** **1.2–1.5** para equilibrar descubrimiento vs popularidad. Si acabas de lanzar con pocas reservas, baja a **0.5** para que el ranking no esté sesgado por falta de datos.

---

## Los 4 umbrales de intención

Estos umbrales no son pesos — son **filtros de admisión**. Una experiencia que no supere el umbral correspondiente queda completamente excluida de ese tipo de búsqueda.

### Umbral romántico (por defecto: 4)
Puntuación mínima que debe tener una experiencia en términos románticos para aparecer en búsquedas como "cena romántica" o "plan en pareja".

- **Umbral alto (6–8):** Solo experiencias muy explícitamente románticas (restaurantes con menú pareja, veladas especiales).
- **Umbral bajo (2–3):** Cualquier experiencia con mención de pareja o atardecer aparece.
- **Efecto práctico:** Si ves que búsquedas románticas devuelven resultados irrelevantes, sube este umbral.

### Umbral familiar (por defecto: 4)
Igual que el romántico pero para "plan familiar", "actividad con niños", etc.

- **Umbral alto:** Solo parques, actividades infantiles, menús familiares explícitos.
- **Umbral bajo:** Cualquier actividad abierta al público puede aparecer.

### Umbral familiar restauración (por defecto: 3)
Específico para búsquedas tipo "restaurante familiar". Más bajo que el umbral familiar general porque los restaurantes con zonas infantiles merecen aparecer aunque no sean exclusivamente familiares.

### Umbral indoor (por defecto: 3)
Para búsquedas como "plan si llueve" o "actividad interior".

- **Umbral alto:** Solo experiencias explícitamente indoor.
- **Umbral bajo:** Actividades mixtas o con alternativa cubierta también aparecen.

---

## Diagnóstico: "Búsquedas sin resultado"

Esta tabla muestra las búsquedas que devolvieron cero resultados. Es tu mapa para mejorar el catálogo.

### Pasos para resolver búsquedas sin resultado:

1. **Identifica el patrón** — ¿Son búsquedas muy específicas ("paseo a caballo en la montaña"), categorías faltantes ("karting"), o intenciones no mapeadas ("romántico en la playa")?

2. **Si la experiencia existe pero no aparece** → Ve a la empresa correspondiente y añade la búsqueda como **etiqueta manual**. Por ejemplo, para "paseo a caballo": añade `paseo a caballo, ruta ecuestre, caballo, equitación`.

3. **Si la categoría no existe en el catálogo** → Crea o convence a una empresa del sector de unirse.

4. **Si es una búsqueda demasiado específica** → Revisa si los umbrales están muy altos. Una búsqueda "plan para sorprender a mi novia" podría estar bloqueada por el umbral romántico si no hay experiencias con puntuación suficiente.

---

## Diagnóstico: "Empresas no preparadas"

Muestra las empresas cuyo perfil está incompleto y por eso no aparecen en búsquedas.

### Campos críticos para aparecer en el buscador:

| Campo | Impacto |
|-------|---------|
| **Etiquetas manuales** | El más importante. Sin ellas, el buscador usa solo el título y descripción. |
| **Experiencia activa** | Sin al menos una experiencia activa con oferta, la empresa no aparece nunca. |
| **Imagen** | No afecta al ranking pero sí a la conversión (la gente no hace clic sin imagen). |
| **Descripción** | Palabras clave en la descripción alimentan el motor semántico. |
| **Ubicación** | Necesaria para el ranking por cercanía y para mostrar la distancia al usuario. |
| **Tipo de negocio** | Determina si aparece en búsquedas de "restaurante" vs "actividad". |

---

## Configuración recomendada por escenario

### Plataforma nueva (pocas empresas, pocas etiquetas)
```
Semántico:         3.5
Climatología:      1.0
Sostenibilidad:    0.5
Cercanía:          0.8
Prioridad empresa: 1.0
Aprendizaje:       0.3  ← bajo porque no hay datos históricos
Umbral romántico:  3    ← bajo para que aparezca algo
Umbral familiar:   3
Umbral familiar rest: 2
Umbral indoor:     2
```

### Plataforma madura (empresas con etiquetas completas)
```
Semántico:         7.0  ← alto para máxima precisión
Climatología:      1.2
Sostenibilidad:    0.7
Cercanía:          1.2
Prioridad empresa: 1.0
Aprendizaje:       1.6
Umbral romántico:  4
Umbral familiar:   4
Umbral familiar rest: 3
Umbral indoor:     3
```

### Plataforma comercial (con empresas premium y básicas)
```
Semántico:         5.0
Climatología:      1.2
Sostenibilidad:    0.5
Cercanía:          1.0
Prioridad empresa: 1.8  ← alto para que las empresas premium se noten
Aprendizaje:       1.4
```

---

## Flujo de trabajo recomendado (semanal)

1. **Lunes:** Revisa "Búsquedas sin resultado" de la semana anterior
2. **Martes–Miércoles:** Contacta a las empresas afectadas y ayúdalas a añadir etiquetas manuales
3. **Jueves:** Revisa "Empresas no preparadas" y fija una meta de completitud (ej: todas ≥ 60%)
4. **Viernes:** Ajusta un peso si el comportamiento del buscador no es el esperado. **Cambia solo un peso a la vez** y espera a ver el resultado antes de tocar otro.

---

## Regla de oro

> **Las etiquetas manuales son la palanca más potente del sistema.**
>
> Un peso semántico de 7 con etiquetas manuales bien configuradas supera en precisión a cualquier combinación de pesos altos con etiquetas vacías. La calidad del catálogo siempre gana a la configuración del motor.

