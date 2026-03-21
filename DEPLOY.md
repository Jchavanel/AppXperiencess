# Xperiences v5.0 — Guía de despliegue

## Arquitectura: 3 apps independientes

```
index.html   → App pública (buscador, reservas, usuarios)
admin.html   → Panel administrador master
portal.html  → Portal empresa
```

Cada app carga solo su código. Los datos se comparten a través de **Firebase Firestore** como única fuente de verdad.

```
assets/js/
├── core.js        ← Motor compartido (Firebase, auth, estado, buscador)
├── app-public.js  ← Solo index.html
├── app-admin.js   ← Solo admin.html
└── app-portal.js  ← Solo portal.html
```

---

## 1. Configurar Firebase

Edita `assets/js/firebase-config.js`:

```js
window.XP_FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "tu-proyecto.firebaseapp.com",
  projectId:         "tu-proyecto",
  storageBucket:     "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc..."
};
```

En la consola de Firebase activa:
- Firestore Database (modo producción)
- Authentication → Email/Password

---

## 2. Publicar reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

O copia el contenido de `firestore.rules` manualmente en la consola.

---

## 3. Desplegar los archivos

Sube **todos los archivos** de esta carpeta al mismo servidor/dominio.

### Netlify
```bash
# Arrastra la carpeta a netlify.com/drop
# O: netlify deploy --prod --dir .
```

### Firebase Hosting
```bash
firebase deploy --only hosting
```

### Vercel
```bash
vercel --prod
```

### Servidor propio (nginx/apache)
Sube todos los archivos. El `.htaccess` ya configura las cabeceras correctas.

---

## 4. Crear el primer administrador

1. Abre `https://tudominio.com/admin.html`
2. El formulario de alta aparece solo la primera vez (bootstrap)
3. Introduce nombre, email y contraseña del admin
4. Desde ese momento el acceso queda protegido

---

## 5. Crear acceso para empresas

1. En `admin.html` → Empresas → Editar empresa
2. Introduce email y contraseña temporal para la empresa
3. Envía el enlace `https://tudominio.com/portal.html` a la empresa
4. La empresa inicia sesión y gestiona su contenido de forma autónoma

---

## 6. Instalar como app (PWA)

Cada página se puede instalar como app independiente:

| App | Icono | Nombre instalado |
|-----|-------|-----------------|
| `index.html` | Xperiences (marca) | Xperiences |
| `admin.html` | Fondo azul oscuro "A" | Xperiences Admin |
| `portal.html` | Fondo verde "E" | XP Empresa |

En Chrome/Edge: icono ⊕ en la barra de URL → Instalar  
En Android: menú ⋮ → Añadir a pantalla de inicio  
En iPhone: Safari → Compartir → Añadir a pantalla de inicio  

---

## Actualizar sin perder datos

Los datos están en Firestore, completamente separados del código.  
Para actualizar la app basta con subir los nuevos ficheros JS/HTML.  
**Los datos de Firestore no se tocan en ningún momento.**

---

## Cloudflare Pages (despliegue actual)

### Subir el proyecto

```bash
# Opción 1: drag-and-drop en dash.cloudflare.com/pages → Create a project → Direct upload
# Opción 2: conectar repositorio Git (GitHub/GitLab) → build command vacío, output directory "."
```

### Archivos de configuración incluidos

| Fichero | Función |
|---------|---------|
| `_headers` | Cabeceras HTTP (seguridad, caché, SW) |
| `_redirects` | Enrutado SPA para las 3 apps |
| `netlify.toml` | Solo para referencia, Cloudflare lo ignora |
| `.htaccess` | Solo para Apache/cPanel, Cloudflare lo ignora |

### SPA routing en Cloudflare

Cloudflare Pages detecta automáticamente apps de una sola página si **no hay un fichero `404.html`** en la raíz.
Como Xperiences tiene 3 entry points (`index.html`, `admin.html`, `portal.html`), el fichero `_redirects` define explícitamente las rutas:

```
/admin/*   → admin.html   (sin cambiar URL)
/portal/*  → portal.html
/*         → index.html
```


### wrangler.toml — configuración del Worker

Xperiences despliega como **Workers Assets** (el nuevo sistema unificado de Cloudflare).
El fichero `wrangler.toml` le dice a Wrangler que es un sitio estático:

```toml
[assets]
directory = "."
not_found_handling = "single-page-application"
```

El modo `single-page-application` gestiona automáticamente el routing SPA:
- Archivos que existen → se sirven directamente (`index.html`, `admin.html`, `assets/...`)
- Rutas sin archivo → devuelve `index.html` (comportamiento SPA)

El fichero `_redirects` solo necesita las reglas específicas de admin y portal.
**NO** incluir `/* → /index.html` — eso lo maneja `not_found_handling` sin bucle infinito.

### Firebase Auth y Cloudflare

Firebase Auth usa `authDomain` para el flujo OAuth. Si usas dominio propio (ej. `xperiences.es`),
añade ese dominio en la consola Firebase → Authentication → Settings → Authorized domains.

### Purgar caché tras despliegue

Cloudflare cachea los assets automáticamente. Si tras subir una versión nueva siguen
sirviéndose archivos viejos: **Caching → Configuration → Purge Everything**.

### Variables de entorno

Cloudflare Pages no tiene variables de entorno para ficheros estáticos.
Las credenciales van directamente en `assets/js/firebase-config.js` (que está en `.gitignore`
si usas Git) o se inyectan en el paso de build si usas un bundler.
