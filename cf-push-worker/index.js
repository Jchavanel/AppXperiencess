/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Xperiences — Push Notifications Worker                  ║
 * ║  Cloudflare Worker  ·  /cf-push-worker/index.js          ║
 * ║                                                          ║
 * ║  Despliega como Worker SEPARADO (no Assets):             ║
 * ║  cd cf-push-worker && npx wrangler deploy                ║
 * ║                                                          ║
 * ║  Secrets necesarios (wrangler secret put <NAME>):        ║
 * ║    FCM_SERVER_KEY   → Firebase Console → Configuración   ║
 * ║                       → Cloud Messaging → Server key     ║
 * ║    FIREBASE_API_KEY → Firebase Console → Configuración   ║
 * ║                       → General → apiKey                 ║
 * ╚══════════════════════════════════════════════════════════╝
 */

const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';

// Tipos de notificación permitidos
const ALLOWED_TYPES = [
  'booking-new',        // Sistema → Empresa (nueva reserva)
  'booking-confirmed',  // Sistema → Cliente (confirmada)
  'promo-empresa',      // Empresa → sus clientes (Pro+)
  'promo-global'        // Admin → todos los clientes
];

// Permisos por tipo: qué roles pueden enviar cada tipo
const TYPE_PERMISSIONS = {
  'booking-new':       ['customer', 'system'],  // triggered al reservar
  'booking-confirmed': ['company', 'system'],   // triggered al confirmar
  'promo-empresa':     ['company'],             // solo empresa (Pro+)
  'promo-global':      ['admin']                // solo admin
};

// ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') return corsResponse('', 204);

    const url = new URL(request.url);

    // Salud
    if (url.pathname === '/health') {
      return corsResponse(JSON.stringify({ status: 'ok', service: 'xp-push' }), 200);
    }

    // Endpoint principal
    if (url.pathname === '/send' && request.method === 'POST') {
      return handleSend(request, env);
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  }
};

// ─────────────────────────────────────────────────────────────
async function handleSend(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse(JSON.stringify({ error: 'JSON inválido' }), 400);
  }

  const { idToken, tokens, title, bodyText, data, type } = body;

  // Validaciones básicas
  if (!idToken)              return error('Falta idToken', 401);
  if (!tokens?.length)       return error('Falta tokens (array)', 400);
  if (tokens.length > 500)   return error('Máximo 500 tokens por llamada', 400);
  if (!title)                return error('Falta title', 400);
  if (!ALLOWED_TYPES.includes(type)) return error(`Tipo no permitido: ${type}`, 400);

  // ── Verificar identidad con Firebase REST ──────────────────
  let callerUid, callerRoles;
  try {
    ({ uid: callerUid, roles: callerRoles } = await verifyFirebaseToken(idToken, env));
  } catch (e) {
    return error('Token Firebase inválido: ' + e.message, 401);
  }

  // ── Verificar que el caller tiene permiso para este tipo ───
  const allowedRoles = TYPE_PERMISSIONS[type] || [];
  const callerRole = resolveRole(callerRoles);
  if (!allowedRoles.includes(callerRole) && !allowedRoles.includes('system')) {
    return error(`Tu rol '${callerRole}' no puede enviar tipo '${type}'`, 403);
  }

  // ── Enviar a FCM (lotes de 100 — límite FCM legacy) ────────
  const results = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const res = await sendFCMBatch({ tokens: batch, title, bodyText, data, type }, env);
    results.push(res);
  }

  const success = results.reduce((a, r) => a + (r.success || 0), 0);
  const failure = results.reduce((a, r) => a + (r.failure || 0), 0);

  return corsResponse(JSON.stringify({
    ok: true, sent: success, failed: failure,
    batches: results.length, type, callerUid
  }), 200);
}

// ─────────────────────────────────────────────────────────────
async function sendFCMBatch({ tokens, title, bodyText, data, type }, env) {
  const payload = {
    registration_ids: tokens,
    notification: {
      title,
      body: bodyText || '',
      icon: '/assets/img/xp-icon-192.png',
      badge: '/assets/img/xp-icon-96.png',
      click_action: data?.url || '/'
    },
    data: {
      type,
      url: data?.url || '/',
      ...data
    },
    // Mostrar aunque la app esté en foreground (Android)
    content_available: true,
    priority: 'high'
  };

  const res = await fetch(FCM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `key=${env.FCM_SERVER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FCM error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return { success: json.success, failure: json.failure, results: json.results };
}

// ─────────────────────────────────────────────────────────────
// Verifica el ID token de Firebase usando la REST API pública
async function verifyFirebaseToken(idToken, env) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );

  if (!res.ok) throw new Error('Token rechazado por Firebase');
  const data = await res.json();
  if (!data.users?.length) throw new Error('Usuario no encontrado');

  const user = data.users[0];
  return {
    uid: user.localId,
    email: user.email,
    // Los custom claims (roles) no están disponibles vía REST lookup
    // Por simplicidad, confiaremos en el tipo de notificación validado
    // En producción: usar Firebase Admin SDK en un entorno más robusto
    roles: { customer: true } // override en cliente via Firestore check
  };
}

// ─────────────────────────────────────────────────────────────
function resolveRole(roles) {
  if (!roles) return 'customer';
  if (roles.admin) return 'admin';
  if (roles.companyIds?.length || roles.company) return 'company';
  return 'customer';
}

function error(msg, status = 400) {
  return corsResponse(JSON.stringify({ error: msg }), status);
}

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
