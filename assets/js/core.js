/**
 * Xperiences — core.js v5.0
 * Motor compartido: Firebase, autenticación, Firestore, estado, datos, buscador.
 * Cargado por index.html, admin.html y portal.html.
 * NO contiene código de renderizado específico de ninguna página.
 */

'use strict';


const APP_VERSION='portable-web-v4-1-commercial';
const FIRESTORE_PATHS={publicConfig:'config/public',systemConfig:'config/system',analytics:'analytics/main',users:'users',bookings:'bookings',userState:'userState'};

// ── Firebase: instancia y estado en memoria ──────────────────
let _db         = null;   // Firestore instance
let _auth       = null;   // Firebase Auth instance
let _state      = null;   // estado en memoria (fuente de verdad)
let _syncTimer  = null;   // debounce para writes públicas a Firestore
let _analyticsTimer = null;
let _userStateTimer = null;
let _authReadyPromise = Promise.resolve();
let _resolveAuthReady = null;
let _authBootstrapped = false;
let _customerUser = null;
let _customerProfile = null;
let _systemConfig = {adminBootstrapCompleted:false,bootstrapAdminUid:null,updatedAt:null};
let _panelContext = {role:null,companyId:null};
let _provisioningApp = null;
let _provisioningAuth = null;
// PAGE_TYPE se establece por cada app al llamar a _xpBootstrap({pageType})
let PAGE_TYPE='public';
let IS_ADMIN_PAGE=false;
let IS_PORTAL_PAGE=false;
const app=document.getElementById('app');
const clone=o=>JSON.parse(JSON.stringify(o));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const uid=(prefix='id')=>`${prefix}-${Math.random().toString(36).slice(2,10)}`;
const nowIso=()=>new Date().toISOString();
const slugify=(text='')=>text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const normalizeText=(text='')=>text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const normalizeEmail=value=>String(value||'').trim().toLowerCase();
const parseTags=(text='')=>normalizeText(text).split(',').map(v=>v.trim()).filter(Boolean);
const formatEuro=value=>`${Number(value||0).toFixed(0)}€`;
const escapeHtml=(str='')=>String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
// ── BUG FIX: saveMsg estaba referenciada pero nunca definida ──
const saveMsg=(selector,msg,duration=3000)=>{
  const el=typeof selector==='string'?document.querySelector(selector):selector;
  if(!el) return;
  el.textContent=msg;
  el.setAttribute('data-visible','1');
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.removeAttribute('data-visible'),duration);
};
const setHashRoute=route=>location.hash=route;
const routeQuery=()=>{const hash=location.hash||'#/';const parts=hash.slice(1).split('?');return {path:parts[0]||'/',params:new URLSearchParams(parts[1]||'')};};
const haversineKm=(a,b,c,d)=>{const R=6371;const toRad=x=>x*Math.PI/180;const dLat=toRad(c-a),dLng=toRad(d-b);const aa=Math.sin(dLat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa));};

const STATUS_LABELS={
  operationalStatus:{active:'Activa',trial:'Prueba',paused_non_payment:'Pausada por impago',paused_quality:'Pausada por calidad',suspended:'Suspendida',cancelled:'Cancelada'},
  financeStatus:{active:'Activa',trial:'Prueba',overdue:'Con deuda',cancelled:'Cancelada'}
};

// ════════════════════════════════════════════════════════════
// SISTEMA DE PLANES — Xperiences v7.0
// Fuente de verdad: company.subscription en Firestore
// ════════════════════════════════════════════════════════════

// ── Definición de planes ─────────────────────────────────────
const PLANS = {
  trial: {
    label: 'Básico (trial)',
    monthlyFee: 0,
    commission: 0.10,
    searchPriority: 3,
    analytics: null,       // sin analytics
    hasContactData: false, // solo nombre del cliente
    hasPush: false,
    hasBadge: null,
    hasCompanyPromo: false,
    hasXpPromo: false,
    analyticsLabel: null
  },
  basico_a: {
    label: 'Básico sin cuota (25%)',
    monthlyFee: 0,
    commission: 0.25,
    searchPriority: 3,
    analytics: null,
    hasContactData: false,
    hasPush: false,
    hasBadge: null,
    hasCompanyPromo: false,
    hasXpPromo: false,
    analyticsLabel: null
  },
  basico_b: {
    label: 'Básico (29,90€/mes)',
    monthlyFee: 29.90,
    commission: 0.10,
    searchPriority: 3,
    analytics: null,
    hasContactData: false,
    hasPush: false,
    hasBadge: null,
    hasCompanyPromo: false,
    hasXpPromo: false,
    analyticsLabel: null
  },
  pro: {
    label: 'Pro',
    monthlyFee: 69.90,
    commission: 0.08,
    searchPriority: 6,
    analytics: 90,         // días de histórico
    hasContactData: true,  // tel + email cliente
    hasPush: true,
    hasBadge: 'verified',  // badge verificado
    hasCompanyPromo: true, // empresa puede enviar oferta a sus clientes
    hasXpPromo: false,
    analyticsLabel: '90 días'
  },
  infinity: {
    label: 'Infinity',
    monthlyFee: 119.90,
    commission: 0.05,
    searchPriority: 9,
    analytics: 365,
    hasContactData: true,
    hasPush: true,
    hasBadge: 'featured',  // badge destacado
    hasCompanyPromo: true,
    hasXpPromo: true,      // Xperiences puede incluirla en promos globales
    analyticsSector: true, // métricas de sector (datos agregados plataforma)
    analyticsLabel: '365 días + sector'
  }
};

// ── API principal del motor de planes ────────────────────────

/** Retorna el objeto de límites/capacidades del plan activo de una empresa */
function getPlanLimits(company) {
  const sub = company?.subscription || {};
  const planKey = sub.status === 'cancelled' ? 'basico_a'
    : sub.status === 'overdue' && !company?.graceVisible ? 'basico_a'
    : (sub.plan || 'trial');
  return { ...(PLANS[planKey] || PLANS.trial), planKey };
}

/** ¿El plan está activo y puede mostrar la empresa en el buscador? */
function planAllowsVisibility(company) {
  const sub = company?.subscription || {};
  if (sub.status === 'cancelled') return false;
  if (sub.status === 'overdue' && !company?.graceVisible) return false;
  return true;
}

/** Comisión aplicable a un booking concreto (decimal, ej: 0.08) */
function getBookingCommission(company) {
  return getPlanLimits(company).commission;
}

/** Prioridad de búsqueda sincronizada con el plan */
function getPlanSearchPriority(company) {
  return getPlanLimits(company).searchPriority;
}

/** Retrocompatibilidad: normalizar empresa que llega de Firestore sin subscription */
function normalizeSubscription(company) {
  if (company.subscription && company.subscription.plan) return company;
  // Migrar campos legacy financeStatus/operationalStatus → subscription
  const isActive = company.operationalStatus === 'active' || company.operationalStatus === 'trial';
  const plan = !isActive ? 'basico_a' : 'trial';
  company.subscription = {
    plan,
    status: isActive ? (company.financeStatus === 'overdue' ? 'overdue' : 'active') : 'cancelled',
    commission: PLANS[plan].commission,
    monthlyFee: PLANS[plan].monthlyFee,
    trialStartedAt: company.createdAt || nowIso(),
    trialEndsAt: company.trialEndsAt || '',
    renewsAt: '',
    stripeCustomerId: '',
    stripeSubscriptionId: '',
    updatedAt: nowIso()
  };
  return company;
}


const statusLabel=(group,value)=>STATUS_LABELS[group]?.[value]||value;

const randomLetters=(len=4)=>Array.from({length:len},()=>String.fromCharCode(97+Math.floor(Math.random()*26))).join('');
const randomDigits=(len=4)=>Array.from({length:len},()=>Math.floor(Math.random()*10)).join('');
const normalizeUser=(value='')=>normalizeText(value).replace(/[^a-z0-9]/g,'').slice(0,24);
const generateCompanyUsername=company=>((normalizeUser(company?.name||company?.slug||'').slice(0,8))||randomLetters(4));

function normalizeRolePayload(raw={}){
  const source=(raw&&typeof raw==='object')?raw:{};
  const companyIds=Array.isArray(source.companyIds)
    ?source.companyIds
    :(source.companyId?[source.companyId]:[]);
  return {
    customer:source.customer!==false,
    admin:!!source.admin,
    companyIds:[...new Set(companyIds.map(v=>String(v||'').trim()).filter(Boolean))]
  };
}
function getProfileRoles(profile){return normalizeRolePayload(profile?.roles||{});}
function refreshPanelContextFromProfile(){
  const roles=getProfileRoles(_customerProfile||{});
  _panelContext={
    role:roles.admin?'admin':(roles.companyIds[0]?'company':null),
    companyId:roles.companyIds[0]||null
  };
  return clone(_panelContext);
}
function getSystemConfig(){return {...(_systemConfig||{adminBootstrapCompleted:false,bootstrapAdminUid:null,updatedAt:null})};}
function isBootstrapPending(){return !getSystemConfig().adminBootstrapCompleted;}
const isAdminLogged=()=>!!_customerUser&&refreshPanelContextFromProfile().role==='admin';
const currentCompanySessionId=()=>{const ctx=refreshPanelContextFromProfile();return ctx.role==='company'?ctx.companyId:null;};
function requireAdmin(){if(!isAdminLogged()){setHashRoute('/login');return false;}return true;}
function requireCompanySession(){const companyId=currentCompanySessionId();if(!companyId){if(IS_PORTAL_PAGE){setHashRoute('/');}else{setHashRoute('/company-login');}return null;}return companyId;}
function requireCustomerSession(target='/auth?mode=login'){if(!isCustomerLogged()){setHashRoute(target);return null;}return getCustomerAccount();}
function emptyRuntimeState(){return {ui:{},userLocation:null,cart:[]};}
function normalizeRuntimeState(payload={}){return {ui:(payload&&typeof payload.ui==='object'&&payload.ui)?payload.ui:{},userLocation:payload?.userLocation||null,cart:Array.isArray(payload?.cart)?payload.cart:[]};}
function loadUiState(){const state=loadState();return {ui:state.ui||{},userLocation:state.userLocation||null};}
function saveUiState(payload){const state=loadState();state.ui=payload?.ui||{};state.userLocation=payload?.userLocation||null;saveState(state,'user');}
function patchUiState(updates={},userLocation){const state=loadState();const next={ui:{...(state.ui||{}),...(updates||{})},userLocation:userLocation===undefined?state.userLocation:userLocation};state.ui=next.ui;state.userLocation=next.userLocation;saveState(state,'user');return next;}
function sanitizeCustomerRedirect(raw){const value=String(raw||'').trim();if(!value||!value.startsWith('/')||value.startsWith('/admin')||value.startsWith('/company-admin')||value.startsWith('/company-login')||value.startsWith('/login'))return '/account';return value;}
function mapAuthError(error){
  const code=String(error?.code||error?.message||'');
  if(code==='auth/email-already-in-use')return 'Ese correo ya tiene una cuenta.';
  if(code==='auth/invalid-email')return 'El correo no tiene un formato válido.';
  if(code==='auth/weak-password'||code==='APP_WEAK_PASSWORD')return 'La contraseña debe tener al menos 6 caracteres.';
  if(code==='auth/user-not-found'||code==='auth/wrong-password'||code==='auth/invalid-credential')return 'Correo o contraseña incorrectos.';
  if(code==='auth/too-many-requests')return 'Demasiados intentos. Prueba de nuevo más tarde.';
  if(code==='auth/network-request-failed')return 'No se pudo conectar con Firebase Auth.';if(code==='permission-denied'||code==='firestore/permission-denied')return 'Firestore está bloqueando esta operación. Publica las reglas firestore.rules de esta versión y vuelve a probar.';
  if(code==='auth/configuration-not-found'||code==='auth/operation-not-allowed')return 'Firebase Auth no está listo: revisa la configuración del proyecto y activa Email/Password en Authentication.';
  if(code==='panel/not-admin')return 'Esta cuenta no tiene permisos de administrador.';
  if(code==='panel/not-company')return 'Esta cuenta no tiene acceso de empresa.';
  if(code==='ADMIN_BOOTSTRAP_LOCKED')return 'El alta inicial de administrador ya está cerrada.';
  if(code==='COMPANY_ACCOUNT_EXISTS')return 'Esta empresa ya tiene una cuenta vinculada.';
  return error?.message||'No se pudo completar la operación.';
}
function runtimeStatePath(uid){return `${FIRESTORE_PATHS.userState}/${uid}`;}
function buildCartKey(item){return [item.companyId,item.experienceId,item.offerId].join('::');}
function mergeCartItems(baseItems=[],incomingItems=[]){const map=new Map();[...(Array.isArray(baseItems)?baseItems:[]),...(Array.isArray(incomingItems)?incomingItems:[])].forEach(raw=>{if(!raw)return;const item={...raw};const key=buildCartKey(item);if(!map.has(key)){map.set(key,{...item,quantity:Math.max(1,Number(item.quantity||1)),updatedAt:item.updatedAt||nowIso(),createdAt:item.createdAt||item.updatedAt||nowIso()});return;}const current=map.get(key);current.quantity=Math.max(1,Number(current.quantity||1))+Math.max(1,Number(item.quantity||1));current.updatedAt=nowIso();map.set(key,current);});return Array.from(map.values()).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));}
async function loadCustomerRuntimeState(uid){if(!_db||!uid)return emptyRuntimeState();const snap=await _db.doc(runtimeStatePath(uid)).get();return snap.exists?normalizeRuntimeState(snap.data()||{}):emptyRuntimeState();}
async function persistCustomerRuntimeState(){if(!_db||!_customerUser||!_state)return;const payload={ui:_state.ui||{},userLocation:_state.userLocation||null,cart:_state.cart||[],updatedAt:nowIso()};await _db.doc(runtimeStatePath(_customerUser.uid)).set(payload,{merge:true});}
function scheduleUserStateSync(){if(!_customerUser)return;clearTimeout(_userStateTimer);_userStateTimer=setTimeout(()=>persistCustomerRuntimeState().catch(e=>console.error('[XP] User state sync error:',e)),350);}
async function syncRuntimeStateForCurrentUser({mergeGuestCart=false}={}){if(!_state)return; if(!_customerUser){_state={..._state,...emptyRuntimeState()};return;} const guestCart=mergeGuestCart?clone(_state.cart||[]):[]; const remote=await loadCustomerRuntimeState(_customerUser.uid); const mergedCart=mergeGuestCart&&guestCart.length?mergeCartItems(remote.cart,guestCart):remote.cart; _state={..._state,ui:remote.ui||{},userLocation:remote.userLocation||null,cart:mergedCart}; if(mergeGuestCart&&guestCart.length){await persistCustomerRuntimeState();}}

function buildDefaultCustomerProfile(user,extra={}){
  const createdAt=extra.createdAt||nowIso();
  return {
    uid:user.uid,
    email:normalizeEmail(user.email||extra.email||''),
    displayName:String(extra.displayName||user.displayName||'').trim(),
    phone:String(extra.phone||'').trim(),
    ageRange:extra.ageRange||null,  // '18-25'|'26-35'|'36-50'|'51+'|null
    roles:normalizeRolePayload(extra.roles||{}),
    preferences:{marketingOptIn:!!extra.marketingOptIn},
    benefits:{tier:(extra.benefits&&extra.benefits.tier)||'member',loyaltyPoints:Number(extra.benefits?.loyaltyPoints||0),bookingCount:Number(extra.benefits?.bookingCount||0),memberSince:(extra.benefits&&extra.benefits.memberSince)||createdAt},
    createdAt,
    updatedAt:nowIso(),
    lastLoginAt:nowIso()
  };
}
function getCustomerAccount(){if(!_customerUser)return null;const profile=_customerProfile?clone(_customerProfile):null;return {uid:_customerUser.uid,email:_customerUser.email||profile?.email||'',emailVerified:!!_customerUser.emailVerified,displayName:profile?.displayName||_customerUser.displayName||'',phone:profile?.phone||'',profile};}
const isCustomerLogged=()=>!!_customerUser;
async function waitForAuthReady(){await _authReadyPromise;}
async function ensureCustomerProfile(user,extra={}){
  if(!_db||!user)return null;
  const ref=_db.doc(`${FIRESTORE_PATHS.users}/${user.uid}`);
  const snap=await ref.get();
  const base=buildDefaultCustomerProfile(user,extra);
  let profile=snap.exists?{...base,...(snap.data()||{})}:base;
  profile.uid=user.uid;
  profile.email=normalizeEmail(user.email||profile.email||'');
  profile.displayName=String(extra.displayName??profile.displayName??user.displayName??'').trim();
  profile.phone=String(extra.phone??profile.phone??'').trim();
  profile.roles=normalizeRolePayload({...profile.roles,...extra.roles});
  profile.preferences={marketingOptIn:!!(extra.marketingOptIn??profile.preferences?.marketingOptIn)};
  profile.benefits={tier:profile.benefits?.tier||'member',loyaltyPoints:Number(profile.benefits?.loyaltyPoints||0),bookingCount:Number(profile.benefits?.bookingCount||0),memberSince:profile.benefits?.memberSince||profile.createdAt||base.createdAt};
  profile.createdAt=profile.createdAt||base.createdAt;
  profile.updatedAt=nowIso();
  profile.lastLoginAt=nowIso();
  await ref.set(profile,{merge:true});
  _customerProfile=profile;
  refreshPanelContextFromProfile();
  return clone(profile);
}
async function refreshCustomerProfile(){
  if(!_customerUser||!_db){_customerProfile=null;refreshPanelContextFromProfile();return null;}
  const snap=await _db.doc(`${FIRESTORE_PATHS.users}/${_customerUser.uid}`).get();
  _customerProfile=snap.exists?{uid:_customerUser.uid,...buildDefaultCustomerProfile(_customerUser),...(snap.data()||{})}:buildDefaultCustomerProfile(_customerUser);
  _customerProfile.roles=normalizeRolePayload(_customerProfile.roles);
  refreshPanelContextFromProfile();
  return clone(_customerProfile);
}
async function registerCustomerAccount(payload){
  if(!_auth)throw new Error('AUTH_NOT_READY');
  const email=normalizeEmail(payload?.email||'');
  const password=String(payload?.password||'');
  // Bloquear emails ya usados por cuentas de empresa
  if(_db){
    const companiesSnap=await _db.collection('companies')
      .where('portalAuth.email','==',email).limit(1).get().catch(()=>null);
    if(companiesSnap&&!companiesSnap.empty){
      const err=new Error('EMAIL_RESERVED_COMPANY');
      err.code='EMAIL_RESERVED_COMPANY';
      throw err;
    }
  }
  const cred=await _auth.createUserWithEmailAndPassword(email,password);
  if(payload?.displayName&&cred.user?.updateProfile)await cred.user.updateProfile({displayName:String(payload.displayName).trim()});
  await ensureCustomerProfile(cred.user,{...(payload||{}),roles:{customer:true}});
  return getCustomerAccount();
}
async function loginCustomerAccount(email,password){
  if(!_auth)throw new Error('AUTH_NOT_READY');
  const cred=await _auth.signInWithEmailAndPassword(normalizeEmail(email||''),String(password||''));
  if(cred?.user)await ensureCustomerProfile(cred.user,_customerProfile||{});
  return getCustomerAccount();
}
async function loginPanelAccount(email,password,requiredRole='admin'){
  const account=await loginCustomerAccount(email,password);
  const roles=getProfileRoles(_customerProfile||{});
  if(requiredRole==='admin'&&!roles.admin){await logoutCustomerAccount();const err=new Error('panel/not-admin');err.code='panel/not-admin';throw err;}
  if(requiredRole==='company'&&!roles.companyIds.length){await logoutCustomerAccount();const err=new Error('panel/not-company');err.code='panel/not-company';throw err;}
  refreshPanelContextFromProfile();
  // CRITICAL FIX: After company login, reload state from Firestore to get company data.
  // On first portal load the state was loaded with no user session (companies=[]).
  // We must reload now that we know which company this user belongs to.
  if(requiredRole==='company'){
    _state=await _loadStateFromFirestore();
    await syncRuntimeStateForCurrentUser({mergeGuestCart:false});
  }
  return account;
}
async function logoutCustomerAccount(){if(!_auth)return;await _auth.signOut();_customerProfile=null;_panelContext={role:null,companyId:null};}
async function sendCustomerReset(email){if(!_auth)throw new Error('AUTH_NOT_READY');await _auth.sendPasswordResetEmail(normalizeEmail(email||''));}
async function saveCustomerProfile(updates){
  if(!_customerUser||!_db)throw new Error('AUTH_REQUIRED');
  const profile=await ensureCustomerProfile(_customerUser,updates||{});
  if(updates?.displayName&&_customerUser.updateProfile){try{await _customerUser.updateProfile({displayName:String(updates.displayName).trim()});}catch(err){console.warn('[XP] updateProfile:',err);}}
  _customerProfile={...profile,...updates,displayName:String((updates?.displayName??profile.displayName)||'').trim(),phone:String((updates?.phone??profile.phone)||'').trim(),roles:normalizeRolePayload(profile.roles),preferences:{marketingOptIn:!!(updates?.marketingOptIn??profile.preferences?.marketingOptIn)}};
  await _db.doc(`${FIRESTORE_PATHS.users}/${_customerUser.uid}`).set({displayName:_customerProfile.displayName,phone:_customerProfile.phone,preferences:_customerProfile.preferences,updatedAt:nowIso()},{merge:true});
  return clone(_customerProfile);
}
async function applyCustomerBenefits(createdBookings){
  if(!_customerUser||!_db||!createdBookings?.length)return null;
  const profile=await ensureCustomerProfile(_customerUser,_customerProfile||{});
  const totalSpent=createdBookings.reduce((acc,b)=>acc+Number(b.totalPrice||0),0);
  const nextBenefits={...profile.benefits,bookingCount:Number(profile.benefits?.bookingCount||0)+createdBookings.length,loyaltyPoints:Number(profile.benefits?.loyaltyPoints||0)+Math.max(0,Math.round(totalSpent))};
  _customerProfile={...profile,benefits:nextBenefits,updatedAt:nowIso()};
  await _db.doc(`${FIRESTORE_PATHS.users}/${_customerUser.uid}`).set({benefits:nextBenefits,updatedAt:_customerProfile.updatedAt},{merge:true});
  return clone(_customerProfile);
}
async function loadSystemConfig(){
  if(!_db)return getSystemConfig();
  try{
    const snap=await _db.doc(FIRESTORE_PATHS.systemConfig).get();
    _systemConfig=snap.exists?{adminBootstrapCompleted:!!snap.data()?.adminBootstrapCompleted,bootstrapAdminUid:snap.data()?.bootstrapAdminUid||null,updatedAt:snap.data()?.updatedAt||null}:{adminBootstrapCompleted:false,bootstrapAdminUid:null,updatedAt:null};
  }catch(err){
    console.warn('[XP] system config:',err);
    _systemConfig={adminBootstrapCompleted:false,bootstrapAdminUid:null,updatedAt:null};
  }
  return clone(_systemConfig);
}
function getProvisioningAuth(){
  const cfg=window.XP_FIREBASE_CONFIG;
  if(!cfg||!cfg.apiKey)throw new Error('CONFIG_MISSING');
  if(!_provisioningApp){
    const existing=(firebase.apps||[]).find(appItem=>appItem.name==='xp-provisioning');
    _provisioningApp=existing||firebase.initializeApp(cfg,'xp-provisioning');
    _provisioningAuth=_provisioningApp.auth();
    if(firebase.auth?.Auth?.Persistence?.NONE&&_provisioningAuth?.setPersistence){
      _provisioningAuth.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(err=>console.warn('[XP] Provisioning persistence:',err));
    }
  }
  return _provisioningAuth;
}
async function bootstrapAdminAccount(payload){
  if(!isBootstrapPending()){const err=new Error('ADMIN_BOOTSTRAP_LOCKED');err.code='ADMIN_BOOTSTRAP_LOCKED';throw err;}
  const email=normalizeEmail(payload?.email||'');
  const password=String(payload?.password||'');
  const displayName=String(payload?.displayName||'').trim();
  if(password.length<6){const err=new Error('APP_WEAK_PASSWORD');err.code='APP_WEAK_PASSWORD';throw err;}
  const cred=await _auth.createUserWithEmailAndPassword(email,password);
  if(displayName&&cred.user?.updateProfile)await cred.user.updateProfile({displayName});
  const profile=buildDefaultCustomerProfile(cred.user,{displayName,roles:{admin:true,customer:true}});
  await _db.doc(`${FIRESTORE_PATHS.users}/${cred.user.uid}`).set(profile,{merge:true});
  _systemConfig={adminBootstrapCompleted:true,bootstrapAdminUid:cred.user.uid,updatedAt:nowIso()};
  await _db.doc(FIRESTORE_PATHS.systemConfig).set(_systemConfig,{merge:true});
  _customerProfile=profile;
  refreshPanelContextFromProfile();
  return getCustomerAccount();
}
async function provisionCompanyPortalAccount(companyId,payload){
  if(!isAdminLogged()){const err=new Error('panel/not-admin');err.code='panel/not-admin';throw err;}
  const company=getCompanyById(companyId);
  if(!company)throw new Error('Empresa no encontrada');
  if(company.portalAuth?.uid){const err=new Error('COMPANY_ACCOUNT_EXISTS');err.code='COMPANY_ACCOUNT_EXISTS';throw err;}
  // Asegurar que los datos de la empresa estén en Firestore antes de crear la cuenta
  clearTimeout(_syncTimer);
  await _persistToFirestore().catch(e=>console.warn('[XP] Pre-provision persist:',e));
  const email=normalizeEmail(payload?.email||'');
  const password=String(payload?.password||'');
  const displayName=String(payload?.displayName||company.name||'').trim();
  if(password.length<6){const err=new Error('APP_WEAK_PASSWORD');err.code='APP_WEAK_PASSWORD';throw err;}
  const provisionAuth=getProvisioningAuth();
  let createdUser=null;
  try{
    const cred=await provisionAuth.createUserWithEmailAndPassword(email,password);
    createdUser=cred.user||null;
    if(displayName&&createdUser?.updateProfile)await createdUser.updateProfile({displayName});
  }finally{
    try{await provisionAuth.signOut();}catch(err){console.warn('[XP] Provisioning signOut:',err);}
  }
  if(!createdUser?.uid)throw new Error('No se pudo crear la cuenta de empresa.');
  const existingSnap=await _db.doc(`${FIRESTORE_PATHS.users}/${createdUser.uid}`).get();
  const existing=existingSnap.exists?(existingSnap.data()||{}):{};
  const roles=normalizeRolePayload({...existing.roles,customer:false,companyIds:[...(existing.roles?.companyIds||[]),companyId]});
  await _db.doc(`${FIRESTORE_PATHS.users}/${createdUser.uid}`).set({
    ...buildDefaultCustomerProfile(createdUser,{displayName,email,roles}),
    roles,
    updatedAt:nowIso()
  },{merge:true});
  const linkedAt=nowIso();
  await _db.doc(`companies/${companyId}`).set({portalAuth:{email,uid:createdUser.uid,status:'active',linkedAt,updatedAt:linkedAt}},{merge:true});
  const state=loadState();
  const target=(state.companies||[]).find(c=>c.id===companyId);
  if(target){
    target.portalAuth={email,uid:createdUser.uid,status:'active',linkedAt,updatedAt:linkedAt};
    target.updatedAt=linkedAt;
    _state=state;
  }
  return {uid:createdUser.uid,email};
}
async function sendCompanyPortalReset(companyId){
  const company=getCompanyById(companyId);
  const email=normalizeEmail(company?.portalAuth?.email||'');
  if(!email)throw new Error('La empresa no tiene correo vinculado.');
  await sendCustomerReset(email);
}
function startAuthObserver(){
  if(!_auth||_authBootstrapped)return;
  _authBootstrapped=true;
  _authReadyPromise=new Promise(resolve=>{_resolveAuthReady=resolve;});
  _auth.onAuthStateChanged(async user=>{
    const hadState=!!_state;
    const guestCart=hadState?clone((_state&&_state.cart)||[]):[];
    _customerUser=user||null;
    try{
      if(user){
        await ensureCustomerProfile(user,_customerProfile||{});
        if(hadState){
          const remote=await loadCustomerRuntimeState(user.uid);
          _state={..._state,ui:remote.ui||{},userLocation:remote.userLocation||null,cart:guestCart.length?mergeCartItems(remote.cart,guestCart):remote.cart};
          if(guestCart.length)await persistCustomerRuntimeState();
        }
      }else{
        _customerProfile=null;
        _panelContext={role:null,companyId:null};
        if(hadState)_state={..._state,...emptyRuntimeState()};
      }
    }catch(err){
      console.error('[XP] Auth profile error:',err);
      _customerProfile=null;
      _panelContext={role:null,companyId:null};
    }
    if(_resolveAuthReady){_resolveAuthReady();_resolveAuthReady=null;}
    // Solo re-renderizar si _state ya fue cargado (evita render con estado vacío)
    if(location.hash&&_state){render();}
  });
}

function companyCompleteness(company){
  let score=0;const missing=[];
  if((company.name||'').trim()){score+=10}else missing.push('nombre');
  if((company.businessType||'').trim()){score+=8}else missing.push('tipo de negocio');
  if((company.city||'').trim()){score+=8}else missing.push('ciudad');
  if((company.companyDescription||'').trim()){score+=10}else missing.push('descripción');
  if((company.imageUrl||'').trim()){score+=8}else missing.push('imagen');
  if(company.lat!=null&&company.lng!=null&&company.lat!==''&&company.lng!==''){score+=8}else missing.push('ubicación');
  const experiences=(company.experiences||[]);
  if(experiences.length){score+=8}else missing.push('experiencias');
  const activeExperiences=experiences.filter(e=>e.active!==false);
  if(activeExperiences.length){score+=8}else missing.push('experiencia activa');
  const hasActiveOffer=activeExperiences.some(e=>(e.offers||[]).some(o=>o.active));
  if(hasActiveOffer){score+=8}else missing.push('oferta activa');
  const semanticReady=activeExperiences.some(e=>(e.intentTags||[]).length||(e.manualSearchTags||[]).length||(e.searchPresets||[]).length);
  if(semanticReady){score+=10}else missing.push('etiquetas de buscador');
  const richExperience=activeExperiences.some(e=>(e.description||'').trim()&&(e.venueType||'').trim());
  if(richExperience){score+=8}else missing.push('detalle de experiencia');
  const richOffer=activeExperiences.some(e=>(e.offers||[]).some(o=>(o.name||'').trim()&&(o.details||'').trim()));
  if(richOffer){score+=6}else missing.push('detalle de oferta');
  return {score:clamp(score,0,100),missing};
}
function isSearchReady(company){const info=companyCompleteness(company);return info.score>=60&&!info.missing.includes('experiencia activa')&&!info.missing.includes('oferta activa');}
function groupedFailedSearches(searches){
  const map={};
  (searches||[]).filter(s=>s.noResults).forEach(s=>{const key=normalizeText(s.query||'');if(!key)return;map[key]=map[key]||{query:s.query,count:0,lastSeen:s.createdAt};map[key].count++;if((s.createdAt||'')>(map[key].lastSeen||''))map[key].lastSeen=s.createdAt;});
  return Object.values(map).sort((a,b)=>b.count-a.count||String(b.lastSeen).localeCompare(String(a.lastSeen))).slice(0,10);
}

function hydrateState(state){
  state.companies=(state.companies||[]).map(c=>{
    c.adminKey=c.adminKey||uid('admin');
    const legacyPortal=(c.portalAuth&&typeof c.portalAuth==='object')?c.portalAuth:{};
    c.portalAuth={
      email:normalizeEmail(legacyPortal.email||''),
      uid:String(legacyPortal.uid||'').trim(),
      status:String(legacyPortal.status||((legacyPortal.uid||legacyPortal.email)?'active':'pending')).trim()||'pending',
      linkedAt:legacyPortal.linkedAt||'',
      updatedAt:legacyPortal.updatedAt||c.updatedAt||nowIso(),
      legacyUsername:String(legacyPortal.username||legacyPortal.legacyUsername||'').trim()
    };
    c.updatedAt=c.updatedAt||nowIso();c.createdAt=c.createdAt||c.updatedAt;
    c=normalizeSubscription(c);  // migrar a subscription si viene de legacy
    c.searchPriority=clamp(Number(c.searchPriority||5),1,10);
    c.experiences=(c.experiences||[]).map(e=>{
      e.id=e.id||uid('exp');e.createdAt=e.createdAt||nowIso();e.updatedAt=e.updatedAt||e.createdAt;
      e.searchPresets=Array.isArray(e.searchPresets)?e.searchPresets:(e.searchPreset?[e.searchPreset]:['general']);
      e.audiencePresets=Array.isArray(e.audiencePresets)?e.audiencePresets:(e.audiencePreset?[e.audiencePreset]:['general']);
      e.contextPresets=Array.isArray(e.contextPresets)?e.contextPresets:(e.contextPreset?[e.contextPreset]:['dia']);
      e.manualSearchTags=Array.isArray(e.manualSearchTags)?e.manualSearchTags:[];
      e.offers=(e.offers||[]).map(o=>({createdAt:o.createdAt||nowIso(),updatedAt:o.updatedAt||o.createdAt||nowIso(),active:o.active!==false,...o,id:o.id||uid('offer')}));
      return e;
    });
    return c;
  });
  state.analytics=state.analytics||{searches:[],companyViews:[],bookings:[],events:[]};
  state.bookings=state.bookings||[];
  state.cart=Array.isArray(state.cart)?state.cart:[];
  state.rankingConfig={semanticWeight:5,climateWeight:1.2,sustainabilityWeight:0.7,distanceWeight:1,companyPriorityWeight:1.0,learningWeight:1.4,romanticThreshold:4,familyThreshold:4,familyDiningThreshold:3,indoorThreshold:3,...(state.rankingConfig||{})};
  state.ui=state.ui&&typeof state.ui==='object'?state.ui:{};
  state.userLocation=state.userLocation||null;
  return state;
}

// ── Estado en memoria (sync, siempre disponible) ─────────────
function loadState(){
  return _state||{companies:[],analytics:{searches:[],companyViews:[],bookings:[],events:[]},bookings:[],cart:[],rankingConfig:{},ui:{},userLocation:null};
}

function saveState(state,scope='public'){
  _state=state;
  if(scope==='public'||scope==='both'){
    clearTimeout(_syncTimer);
    _syncTimer=setTimeout(()=>_persistToFirestore().catch(e=>console.error('[XP] Sync error:',e)),700);
  }
  if(scope==='user'||scope==='both'){
    scheduleUserStateSync();
  }
}

function resetState(){
  const seed=clone(window.XP_SEED||{});
  seed.version=APP_VERSION;
  const h=hydrateState(seed);
  h.cart=[];
  h.ui={};
  h.userLocation=null;
  _state=h;
  _persistToFirestore().catch(console.error);
  return h;
}

// ── Firestore: carga inicial ──────────────────────────────────
async function _loadStateFromFirestore(){
  const emptySnap={exists:false,data(){return {};}};
  const publicCfgSnap=await _db.doc(FIRESTORE_PATHS.publicConfig).get().catch(()=>emptySnap);
  const analyticsSnap=(!IS_ADMIN_PAGE&&!IS_PORTAL_PAGE||isAdminLogged())
    ?await _db.doc(FIRESTORE_PATHS.analytics).get().catch(()=>emptySnap)
    :emptySnap;

  let companies=[];
  if(!IS_ADMIN_PAGE&&!IS_PORTAL_PAGE||isAdminLogged()){
    const comSnap=await _db.collection('companies').get().catch(()=>({empty:true,forEach(){}}));
    comSnap.forEach(doc=>{const d=doc.data();if(d&&d.id)companies.push(d);});
    if(!publicCfgSnap.exists&&comSnap.empty&&isAdminLogged()&&(window.XP_SEED?.companies||[]).length){
      const seed=clone(window.XP_SEED||{});
      seed.version=APP_VERSION;
      const h=hydrateState(seed);
      h.cart=[];
      h.ui={};
      h.userLocation=null;
      _state=h;
      await _persistToFirestore();
      console.info('[XP] Base de datos inicializada con datos de ejemplo.');
      return h;
    }
  }else if(currentCompanySessionId()){
    const companySnap=await _db.doc(`companies/${currentCompanySessionId()}`).get().catch(()=>emptySnap);
    if(companySnap.exists){const d=companySnap.data();if(d&&d.id)companies=[d];}
  }

  const publicCfg=publicCfgSnap.data()||{};
  const ana=analyticsSnap.data()||{searches:[],companyViews:[],bookings:[],events:[]};

  return hydrateState({
    version:APP_VERSION,
    rankingConfig:publicCfg.rankingConfig||{},
    ui:{},
    userLocation:null,
    companies,
    analytics:ana,
    bookings:ana.bookings||[],
    cart:[]
  });
}

// ── Firestore: escritura ──────────────────────────────────────
async function _persistAnalyticsOnly(){
  if(!_db||!_state)return;
  const a=_state.analytics||{};
  await _db.doc(FIRESTORE_PATHS.analytics).set({
    searches:(a.searches||[]).slice(0,400),
    companyViews:(a.companyViews||[]).slice(0,400),
    bookings:(a.bookings||[]).slice(0,400),
    events:(a.events||[]).slice(0,800),
  });
}
function scheduleAnalyticsSync(){
  clearTimeout(_analyticsTimer);
  _analyticsTimer=setTimeout(()=>_persistAnalyticsOnly().catch(e=>console.error('[XP] Analytics sync error:',e)),350);
}
async function _persistToFirestore(){
  if(!_db||!_state)return;
  const s=_state;

  if(isAdminLogged()){
    await _db.doc(FIRESTORE_PATHS.publicConfig).set({rankingConfig:s.rankingConfig||{}},{merge:true});
  }

  const companies=s.companies||[];
  for(let i=0;i<companies.length;i+=400){
    const batch=_db.batch();
    companies.slice(i,i+400).forEach(c=>batch.set(_db.doc(`companies/${c.id}`),c,{merge:true}));
    await batch.commit();
  }

  await _persistAnalyticsOnly();
}
function getCompanies(){return clone(loadState().companies);}
function getCompanyById(id){return getCompanies().find(c=>c.id===id)||null;}
function getCompanyBySlug(slug){return getCompanies().find(c=>c.slug===slug)||null;}
function saveCompanyProfile(id,updates){
  const s=loadState();const c=s.companies.find(v=>v.id===id);
  if(!c)throw new Error('Empresa no encontrada');
  Object.assign(c,updates);
  // Si se actualiza el plan, sincronizar comisión y prioridad
  if(updates.subscription?.plan){
    const limits=getPlanLimits(c);
    c.subscription.commission=limits.commission;
    c.searchPriority=limits.searchPriority;
  }else{
    c.searchPriority=getPlanSearchPriority(c);
  }
  c.slug=slugify(c.name||c.id);
  c.updatedAt=nowIso();
  saveState(s,'public');
}

function addCompany(data){
  const s=loadState();
  const defaultExperience={id:uid('exp'),title:'',venueType:(data.businessType||''),description:'',intentTags:[],audienceTags:['general'],contextTags:['dia'],reasonHighlights:[],weatherSensitivity:'medium',indoorOutdoor:'mixed',searchPresets:['general'],audiencePresets:['general'],contextPresets:['dia'],active:true,createdAt:nowIso(),updatedAt:nowIso(),offers:[{id:uid('offer'),name:'',price:0,details:'',active:true,createdAt:nowIso(),updatedAt:nowIso()}]};
  const _now=nowIso();
  const _trialEnds=new Date(Date.now()+90*24*60*60*1000).toISOString().slice(0,10);
  const c={id:uid('company'),adminKey:uid('admin'),slug:slugify(data.name||uid('company')),
    name:'',city:'',businessType:'',companyDescription:'',imageUrl:'',lat:null,lng:null,
    sustainabilityLevel:3,weatherScore:3,searchPriority:PLANS.trial.searchPriority,
    operationalStatus:'active',financeStatus:'trial',graceVisible:false,
    notes:'',createdAt:_now,updatedAt:_now,
    subscription:{plan:'trial',status:'active',commission:PLANS.trial.commission,
      monthlyFee:0,trialStartedAt:_now,trialEndsAt:_trialEnds,
      renewsAt:'',stripeCustomerId:'',stripeSubscriptionId:'',updatedAt:_now},
    portalAuth:{email:'',uid:'',status:'pending',linkedAt:'',updatedAt:_now,legacyUsername:''},
    experiences:[defaultExperience],...data};
  if(!c.experiences||!c.experiences.length)c.experiences=[defaultExperience];
  if(!c.portalAuth)c.portalAuth={email:'',uid:'',status:'pending',linkedAt:'',updatedAt:nowIso(),legacyUsername:''};
  s.companies.unshift(c);saveState(s,'public');return clone(c);
}
async function deleteCompany(companyId){
  const s=loadState();
  const before=(s.companies||[]).length;
  s.companies=(s.companies||[]).filter(v=>v.id!==companyId);
  if(s.companies.length===before)return false;
  if(currentCompanySessionId()===companyId){await logoutCustomerAccount().catch(console.error);}
  saveState(s,'public');
  if(_db){try{await _db.doc(`companies/${companyId}`).delete();}catch(err){console.error('[XP] Delete company:',err);}}
  return true;
}
async function clearCompanies(){
  const current=(loadState().companies||[]).map(c=>c.id);
  for(const companyId of current){await deleteCompany(companyId);}
  return true;
}
function upsertExperience(companyId,payload){const s=loadState();const c=s.companies.find(v=>v.id===companyId);if(!c)throw new Error('Empresa no encontrada');c.experiences||=[];const idx=c.experiences.findIndex(e=>e.id===payload.id);const exp={id:payload.id||uid('exp'),title:'Experiencia',venueType:c.businessType||'experiencia',description:'',intentTags:[],audienceTags:[],contextTags:[],reasonHighlights:[],weatherSensitivity:'medium',indoorOutdoor:'mixed',active:true,offers:idx>=0?c.experiences[idx].offers:[],createdAt:idx>=0?(c.experiences[idx].createdAt||nowIso()):nowIso(),updatedAt:nowIso(),...payload};if(idx>=0)c.experiences[idx]={...c.experiences[idx],...exp};else c.experiences.push(exp);c.updatedAt=nowIso();saveState(s,'public');}
function deleteExperience(companyId,expId){const s=loadState();const c=s.companies.find(v=>v.id===companyId);if(c){c.experiences=(c.experiences||[]).filter(e=>e.id!==expId);c.updatedAt=nowIso();saveState(s,'public');}}
function upsertOffer(companyId,expId,payload){const s=loadState();const c=s.companies.find(v=>v.id===companyId);const e=c?.experiences.find(x=>x.id===expId);if(!e)throw new Error('Experiencia no encontrada');e.offers||=[];const idx=e.offers.findIndex(o=>o.id===payload.id);const offer={id:payload.id||uid('offer'),name:'Oferta',price:0,details:'',active:true,createdAt:idx>=0?(e.offers[idx].createdAt||nowIso()):nowIso(),updatedAt:nowIso(),...payload};if(idx>=0)e.offers[idx]={...e.offers[idx],...offer};else e.offers.push(offer);c.updatedAt=nowIso();saveState(s,'public');}
function deleteOffer(companyId,expId,offerId){const s=loadState();const c=s.companies.find(v=>v.id===companyId);const e=c?.experiences.find(x=>x.id===expId);if(e){e.offers=(e.offers||[]).filter(o=>o.id!==offerId);c.updatedAt=nowIso();saveState(s,'public');}}
function getBookings(){return clone(loadState().bookings||[]);}
function addBooking(b){const s=loadState();s.analytics=s.analytics||{searches:[],companyViews:[],bookings:[],events:[]};b.createdAt=b.createdAt||nowIso();s.bookings=(s.bookings||[]);s.bookings.unshift(b);s.analytics.bookings.unshift({id:b.id,companyId:b.companyId,experienceId:b.experienceId,companyName:b.companyName,offerName:b.offerName,totalPrice:b.totalPrice,createdAt:b.createdAt});s.analytics.events.unshift({id:uid('event'),type:'booking',label:`${b.companyName} · ${b.offerName}`,createdAt:b.createdAt});_state=s;scheduleAnalyticsSync();}
function getAnalytics(){const a=loadState().analytics||{searches:[],companyViews:[],bookings:[],events:[]};return clone(a);}
function getCart(){return clone(loadState().cart||[]);}
function getCartCount(){return (loadState().cart||[]).reduce((acc,item)=>acc+Number(item.quantity||1),0);}
function addToCart(payload){const s=loadState();s.cart=s.cart||[];const found=s.cart.find(i=>i.companyId===payload.company.id&&i.experienceId===payload.experience.id&&i.offerId===payload.offer.id);if(found){found.quantity=Number(found.quantity||1)+Number(payload.quantity||1);found.updatedAt=nowIso();}else{s.cart.unshift({id:uid('cart'),companyId:payload.company.id,companyName:payload.company.name,companySlug:payload.company.slug,experienceId:payload.experience.id,experienceTitle:payload.experience.title,offerId:payload.offer.id,offerName:payload.offer.name,details:payload.offer.details||'',unitPrice:Number(payload.offer.price||0),quantity:Math.max(1,Number(payload.quantity||1)),imageUrl:payload.company.imageUrl||'',createdAt:nowIso(),updatedAt:nowIso()});}saveState(s,'user');return clone(s.cart);}
function updateCartItemQuantity(itemId,quantity){const s=loadState();const item=(s.cart||[]).find(i=>i.id===itemId);if(!item)return;item.quantity=Math.max(1,Number(quantity||1));item.updatedAt=nowIso();saveState(s,'user');}
function removeCartItem(itemId){const s=loadState();s.cart=(s.cart||[]).filter(i=>i.id!==itemId);saveState(s,'user');}
function clearCart(){const s=loadState();s.cart=[];saveState(s,'user');}
async function confirmCartBookings(reservationData={}){const account=requireCustomerSession(`/auth?mode=login&redirect=${encodeURIComponent('/cart')}`);if(!account)throw new Error('AUTH_REQUIRED');const items=getCart();if(!items.length)return[];const profile=await saveCustomerProfile({displayName:reservationData.displayName||account.displayName||'',phone:reservationData.phone||account.phone||'',marketingOptIn:!!reservationData.marketingOptIn});const createdAt=nowIso();const reservationGroupId=uid('reservation');const created=items.map(item=>({id:uid('booking'),reservationGroupId,userId:account.uid,userEmail:account.email||profile.email||'',customer:{displayName:profile.displayName||reservationData.displayName||'',email:account.email||profile.email||'',phone:profile.phone||reservationData.phone||'',notes:String(reservationData.notes||'').trim()},companyId:item.companyId,companyName:item.companyName,companySlug:item.companySlug,experienceId:item.experienceId,experienceTitle:item.experienceTitle,offerId:item.offerId,offerName:item.offerName,quantity:Number(item.quantity||1),unitPrice:Number(item.unitPrice||0),totalPrice:Number(item.unitPrice||0)*Number(item.quantity||1),status:'pending',source:'app',createdAt,
      commission:getBookingCommission(getCompanyById(item.companyId)||{})
    }));if(_db){const batch=_db.batch();created.forEach(booking=>batch.set(_db.doc(`${FIRESTORE_PATHS.bookings}/${booking.id}`),booking));await batch.commit();}created.forEach(({customer,userId,userEmail,reservationGroupId,status,source,companySlug,...publicBooking})=>addBooking(publicBooking));clearCart();await applyCustomerBenefits(created);return created;}

function trackSearch(query,results){
  const s=loadState();s.analytics=s.analytics||{searches:[],companyViews:[],bookings:[],events:[]};
  s.analytics.searches.unshift({id:uid('search'),query,count:results.length,noResults:results.length===0,createdAt:new Date().toISOString()});
  s.analytics.events.unshift({id:uid('event'),type:'search',label:query,createdAt:new Date().toISOString()});
  if(results.length===0)s.analytics.events.unshift({id:uid('event'),type:'search_no_results',label:query,createdAt:new Date().toISOString()});
  _state=s;
  scheduleAnalyticsSync();
}
function trackCompanyView(companyId,companyName,experienceId){
  const s=loadState();s.analytics=s.analytics||{searches:[],companyViews:[],bookings:[],events:[]};
  s.analytics.companyViews.unshift({id:uid('view'),companyId,companyName,experienceId:experienceId||null,createdAt:new Date().toISOString()});
  s.analytics.events.unshift({id:uid('event'),type:'company_view',label:companyName,createdAt:new Date().toISOString()});
  _state=s;
  scheduleAnalyticsSync();
}
function getExperienceLearning(companyId,experienceId){
  const analytics=getAnalytics();
  const viewCount=(analytics.companyViews||[]).filter(v=>v.companyId===companyId&&v.experienceId===experienceId).length;
  const bookingCount=(analytics.bookings||[]).filter(v=>v.companyId===companyId&&v.experienceId===experienceId).length;
  return {viewCount,bookingCount,boost:Math.min(5,viewCount*0.12+bookingCount*0.9)};
}
function loadUserLocation(){return loadState().userLocation||null;}
function saveUserLocation(coords){patchUiState({geoPrompted:true,geoDenied:false},coords);}
function getGeoUi(){return loadState().ui||{};}
function setGeoUi(updates){patchUiState(updates);}
function getLastCompanyRoute(){return loadState().ui?.lastCompanyRoute||'index.html#/';}
function setLastCompanyRoute(route){patchUiState({lastCompanyRoute:route});}
function refreshCartBadges(){const count=getCartCount();document.querySelectorAll('.cart-access-icon').forEach(el=>{let badge=el.querySelector('.cart-badge');if(count>0){if(!badge){badge=document.createElement('span');badge.className='cart-badge';el.appendChild(badge);}badge.textContent=String(count);}else if(badge){badge.remove();}});}
function isSecureGeoContext(){try{if(typeof window!=='undefined'&&'isSecureContext'in window)return !!window.isSecureContext;}catch{}const protocol=(typeof location!=='undefined'&&location&&location.protocol)?location.protocol:'';const hostname=(typeof location!=='undefined'&&location&&location.hostname)?location.hostname:'';return protocol==='https:'||hostname==='localhost'||hostname==='127.0.0.1';}
function requestUserLocation(cb){
  if(!navigator.geolocation){setGeoUi({geoPrompted:true,geoDenied:true,geoError:'unsupported'});cb(null,'unsupported');return;}
  if(!isSecureGeoContext()){setGeoUi({geoPrompted:true,geoDenied:true,geoError:'insecure'});cb(null,'insecure');return;}
  navigator.geolocation.getCurrentPosition(pos=>{const coords={lat:pos.coords.latitude,lng:pos.coords.longitude,updatedAt:new Date().toISOString()};saveUserLocation(coords);cb(coords,null);},err=>{const reason=err&&err.code===1?'denied':'error';setGeoUi({geoPrompted:true,geoDenied:true,geoError:reason});cb(null,reason);},{enableHighAccuracy:false,maximumAge:1800000,timeout:6000});
}
function maybeAutoRequestLocation(onDone){
  const ui=getGeoUi();const hasLocation=!!loadUserLocation();
  if(hasLocation||ui.geoPrompted)return false;
  requestUserLocation(()=>{if(typeof onDone==='function')onDone();});return true;
}
function sustainabilityLeaf(level){const n=clamp(Math.round(Number(level)||0),1,5);const fills=[0.08,0.25,0.45,0.7,1],fill=fills[n-1];return `<svg viewBox="0 0 24 24" class="icon"><path d="M20.5 3.5c-8 0-14 4.5-14 12.5 0 3.2 2.2 5.5 5.3 5.5 8 0 12.2-6.7 12.2-14.4 0-2-.8-3.6-3.5-3.6z" fill="rgba(31,181,77,${fill})" stroke="#1fb54d" stroke-width="1.5"></path><path d="M8 16c2-2 5-4.5 10-7" stroke="#1b7f37" stroke-width="1.5" fill="none" stroke-linecap="round"></path></svg>`;}
function weatherIcon(score){const n=clamp(Math.round(Number(score)||0),1,5);if(n===1)return `<svg viewBox="0 0 24 24" class="icon"><path d="M7 15h10a4 4 0 0 0 .3-8A5 5 0 0 0 7.3 8 3.5 3.5 0 0 0 7 15z" fill="#6b7280"></path><path d="M9 17l-1.2 3M13 17l-1.2 3M17 17l-1.2 3" stroke="#3b82f6" stroke-width="1.8" stroke-linecap="round"></path></svg>`;if(n===2)return `<svg viewBox="0 0 24 24" class="icon"><path d="M7 16h10a4 4 0 0 0 .3-8A5 5 0 0 0 7.3 9 3.5 3.5 0 0 0 7 16z" fill="#4b5563"></path></svg>`;if(n===3)return `<svg viewBox="0 0 24 24" class="icon"><circle cx="8" cy="9" r="3.5" fill="#fbbf24"></circle><path d="M9 16h9a3.5 3.5 0 0 0 .2-7 4.5 4.5 0 0 0-8.7 1.2A3 3 0 0 0 9 16z" fill="#9ca3af"></path></svg>`;if(n===4)return `<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="5" fill="#fbbf24" fill-opacity="0.75"></circle><path d="M13 15h5a2.8 2.8 0 0 0 .1-5.6A3.4 3.4 0 0 0 13 10" fill="#d1d5db"></path></svg>`;return `<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="5" fill="#f59e0b"></circle></svg>`;}

// ── NUEVA FUNCIÓN: obtener todas las etiquetas del sistema ──
function getAllSearchTags(){
  const seen=new Set();const result=[];
  getCompanies().forEach(c=>{
    (c.experiences||[]).filter(e=>e.active!==false).forEach(e=>{
      [...(e.manualSearchTags||[]),...(e.intentTags||[])].forEach(t=>{
        const n=normalizeText(t);
        if(n&&n.length>2&&!seen.has(n)){seen.add(n);result.push(t);}
      });
    });
  });
  return result;
}

// ── NUEVA FUNCIÓN: sugerencias populares para el home ──
function getPopularChips(){
  const analytics=getAnalytics();
  const counts={};
  (analytics.searches||[]).filter(s=>!s.noResults&&(s.query||'').length>2).forEach(s=>{
    const q=s.query.trim();
    counts[q]=(counts[q]||0)+1;
  });
  const fromAnalytics=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>k);
  const staticChips=['Plan en pareja','Cena romántica','Plan familiar','Actividad si llueve','Experiencia al atardecer','Plan con niños','Actividad aventura'];
  return [...new Set([...fromAnalytics,...staticChips])].slice(0,7);
}

// ── Iconos SVG reutilizables ──────────────────────────────────
const _SVG = {
  // Maletín (Portal empresas) — sustituye el icono de casa que confundía
  briefcase: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="2" y1="14" x2="22" y2="14"/></svg>`,
  // Persona (Acceder)
  person: `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>`,
  // Salida (Salir / Cerrar sesión)
  logout: `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  // Hamburguesa (Menú admin)
  menu: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  // X cerrar menú
  close: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

// ── Toggle menú hamburguesa admin (global, persiste entre renders) ──
(function(){
  var _init=false;
  window._xpToggleAdminMenu=function(){
    var m=document.getElementById('admin-ham-menu');
    var btn=document.getElementById('admin-ham-btn');
    if(!m||!btn)return;
    var open=!m.classList.contains('open');
    m.classList.toggle('open',open);
    btn.setAttribute('aria-expanded',String(open));
    btn.innerHTML=open?_SVG.close:_SVG.menu;
  };
  if(!_init){
    _init=true;
    document.addEventListener('click',function(e){
      if(!e.target.closest('.admin-hamburger-wrap')){
        var m=document.getElementById('admin-ham-menu');
        var btn=document.getElementById('admin-ham-btn');
        if(m&&m.classList.contains('open')){
          m.classList.remove('open');
          if(btn){btn.setAttribute('aria-expanded','false');btn.innerHTML=_SVG.menu;}
        }
      }
    },true);
    // Cierra menú al navegar (hashchange)
    window.addEventListener('hashchange',function(){
      var m=document.getElementById('admin-ham-menu');
      var btn=document.getElementById('admin-ham-btn');
      if(m&&m.classList.contains('open')){
        m.classList.remove('open');
        if(btn){btn.setAttribute('aria-expanded','false');btn.innerHTML=_SVG.menu;}
      }
    });
  }
})();

function shell(title,content,mode='public',opts={}){
  // ── Icono maletín (Portal empresas) — no confunde con "volver al inicio" ──
  const companyAccessIcon=`<a href="portal.html" class="company-access-icon" aria-label="Acceso empresas" title="Portal empresas">${_SVG.briefcase}</a>`;
  const cartCount=getCartCount();
  const cartIcon=`<a href="index.html#/cart" class="company-access-icon cart-access-icon" aria-label="Carrito" title="Carrito"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.6" fill="currentColor"/><circle cx="17" cy="20" r="1.6" fill="currentColor"/><path d="M3 4h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>${cartCount?`<span class="cart-badge">${cartCount}</span>`:''}</a>`;
  const publicExtra=opts.publicExtra||'';
  const brand=`<a class="brand brand-link brand-logo" href="index.html#/" aria-label="Inicio Xperiences" title="Inicio"><img src="assets/img/logo-xperiences.png" alt="Xperiences"></a>`;
  const customer=getCustomerAccount();
  // ── Iconos en la nav pública ──
  const customerNav=customer
    ?`<a href="#/my-bookings">Mis reservas</a><a href="#/account">${escapeHtml(customer.displayName||customer.email||'Mi cuenta')}</a><a href="#/user-logout" class="nav-icon-link" title="Cerrar sesión" aria-label="Cerrar sesión">${_SVG.logout}</a>`
    :`<a href="#/auth?mode=login" class="nav-icon-link nav-icon-text" title="Acceder" aria-label="Acceder">${_SVG.person}<span>Acceder</span></a>`;

  // ── Nav admin: menú hamburguesa compacto ──
  const adminHamMenu=`
    <div class="admin-hamburger-wrap">
      <button type="button" id="admin-ham-btn" class="admin-ham-btn" onclick="window._xpToggleAdminMenu()" aria-label="Menú" aria-expanded="false" aria-controls="admin-ham-menu">${_SVG.menu}</button>
      <nav id="admin-ham-menu" class="admin-ham-menu" role="navigation" aria-label="Navegación admin">
        <a href="#/admin">📊 Dashboard</a>
        <a href="#/admin/companies">🏢 Empresas</a>
        <a href="#/admin/analytics">📈 Reservas y analítica</a>
        <a href="#/admin/finance">💰 Finanzas</a>
        <a href="#/admin/search-quality">🔍 Calidad de búsqueda</a>
        <a href="index.html#/">🔎 Ver buscador</a>
        <a href="#/logout" class="admin-ham-logout">${_SVG.logout} Salir</a>
      </nav>
    </div>`;

  const nav=mode==='admin'
    ?adminHamMenu
    :mode==='company'
      ?`<nav class="nav-links nav-links-company"><a href="#/company-logout" class="nav-icon-link nav-icon-text" title="Cerrar sesión">${_SVG.logout}<span>Salir</span></a></nav>`
      :`<nav class="nav-links nav-links-public">${publicExtra}${customerNav}${cartIcon}${companyAccessIcon}</nav>`;
  return `<div class="shell ${(mode==='admin'||mode==='company')?'shell-admin':''}"><header class="topbar ${mode==='public'?'topbar-public':''}"><div>${brand}<div class="subtitle">${title}</div></div>${nav}</header><main class="main">${content}</main></div>`;
}

function effectiveVisibility(company){
  // Plan-based visibility (new system)
  if(company.subscription)return planAllowsVisibility(company);
  // Legacy fallback
  if(['paused_non_payment','paused_quality','suspended','cancelled'].includes(company.operationalStatus))return false;
  if(['cancelled','suspended'].includes(company.financeStatus))return false;
  if(company.financeStatus==='overdue'&&!company.graceVisible)return false;
  return true;
}
// ══════════════════════════════════════════════════════════════
// MOTOR DE BÚSQUEDA v5.1 — Prioridad diferencial
// Principio: tokens específicos (caballo, quad) dominan sobre
// tokens genéricos (paseo, plan). Las etiquetas manuales son
// la fuente de verdad con el mayor peso del sistema.
// ══════════════════════════════════════════════════════════════

// Palabras genéricas de actividad — no discriminan entre experiencias
const GENERIC_TOKENS = new Set([
  'paseo','plan','actividad','experiencia','excursion','visita','salida','ruta',
  'tour','viaje','aventura','ocio','hacer','algo','placer','entretenimiento',
  'disfrutar','pasar','tarde','dia','noche','momento','rato','tiempo',
  'busco','quiero','necesito','realizar','apuntarse','apuntar'
]);

// Stopwords extendidas: incluye preposiciones cortas que se colaban
const STOPWORDS = new Set([
  'busco','quiero','necesito','algo','una','un','de','del','la','el','lo',
  'con','mi','para','esta','este','por','y','en','a','al','las','los',
  'nos','les','sus','ser','que','hay','mas','muy','bien','todo','otro'
]);

function parseIntent(query){
  const q=normalizeText(query);

  // ── Intención semántica ──────────────────────────────────────
  const romantic=/romantic|pareja|cena romantica|romantico|romantica/.test(q);
  const family=/familia|familiar|hijos|ninos|niños|infantil|kids/.test(q);
  const dining=/cena|comer|restaurante|menu|menú|comida|desayuno|almuerzo/.test(q);
  const indoor=/lluvia|indoor|interior|cubierto/.test(q);
  const activity=/plan|actividad|parque|kayak|aventura|experiencia|ruta|moto|caballo|spa|escape|quad|surf|escalada|senderismo/.test(q);
  let type='generic';
  if(romantic&&dining)type='romantic_dining';
  else if(romantic)type='romantic';
  else if(family&&dining)type='family_dining';
  else if(family)type='family_activity';
  else if(indoor)type='indoor';
  else if(dining)type='dining';
  else if(activity)type='activity';

  // ── Tokenización mejorada ────────────────────────────────────
  // Primero intentar frase completa normalizada (para tags multi-palabra)
  const fullPhrase = q;

  // Tokens individuales: filtrar stopwords Y palabras muy cortas (≤2 chars)
  const rawTokens = q.split(/\s+/).map(t=>t.trim()).filter(t=>t.length>2&&!STOPWORDS.has(t));
  const tokens = [...new Set(rawTokens)];

  // Clasificar tokens: específicos (discriminan) vs genéricos (contexto)
  const specific = tokens.filter(t=>!GENERIC_TOKENS.has(t));
  const generic  = tokens.filter(t=> GENERIC_TOKENS.has(t));

  return {q, fullPhrase, type, tokens, specific, generic};
}

function presetArray(exp,pluralKey,singularKey,fallback){
  const arr=Array.isArray(exp?.[pluralKey])?exp[pluralKey]:(exp?.[singularKey]?[exp[singularKey]]:(fallback?[fallback]:[]));
  return [...new Set(arr.filter(Boolean))];
}

function tokensFromExperience(company,exp){
  return normalizeText([
    company.name,company.businessType,company.companyDescription,company.city,
    exp.title,exp.venueType,exp.description,exp.weatherSensitivity,exp.indoorOutdoor
  ].concat(
    exp.intentTags||[],exp.audienceTags||[],exp.contextTags||[],
    exp.reasonHighlights||[],exp.manualSearchTags||[],
    presetArray(exp,'searchPresets','searchPreset'),
    presetArray(exp,'audiencePresets','audiencePreset'),
    presetArray(exp,'contextPresets','contextPreset'),
    (exp.offers||[]).flatMap(o=>[o.name,o.details])
  ).join(' '));
}

function exactOrIncludes(haystack,needle){
  return !!needle&&(haystack===needle||haystack.includes(needle));
}

// matchStrength: mide cómo de bien coincide un token con una lista de valores
// Retorna: 2=exacto, 1=incluido, 0.4=sub-token, 0=sin coincidencia
function matchStrength(values,token){
  if(!token||!values.length)return 0;
  for(const v of values){
    if(v===token)return 2;         // coincidencia exacta
    if(v.includes(token))return 1; // token contenido en el valor
    if(token.length>3&&token.includes(v))return 0.4; // valor dentro del token
  }
  return 0;
}

// matchPhrase: comprueba si la frase completa aparece en algún valor
function matchPhrase(values,phrase){
  return values.some(v=>v.includes(phrase));
}

function scoringSignals(company,exp){
  const presets=presetArray(exp,'searchPresets','searchPreset').map(v=>normalizeText(v));
  const audiencePresets=presetArray(exp,'audiencePresets','audiencePreset').map(v=>normalizeText(v));
  const contextPresets=presetArray(exp,'contextPresets','contextPreset').map(v=>normalizeText(v));
  const manual=(exp.manualSearchTags||[]).map(v=>normalizeText(v));
  const intent=(exp.intentTags||[]).map(v=>normalizeText(v));
  const audience=(exp.audienceTags||[]).map(v=>normalizeText(v));
  const context=(exp.contextTags||[]).map(v=>normalizeText(v));
  const reasons=(exp.reasonHighlights||[]).map(v=>normalizeText(v));
  const offerNames=(exp.offers||[]).flatMap(o=>[normalizeText(o.name||''),normalizeText(o.details||'')]).filter(Boolean);
  const title=normalizeText(exp.title||'');
  const venue=normalizeText(exp.venueType||company.businessType||'');
  return {presets,audiencePresets,contextPresets,manual,intent,audience,context,reasons,offerNames,title,venue};
}

function queryMatchStats(intent,company,exp){
  const s=scoringSignals(company,exp);
  const searchable=[s.title,s.venue].concat(s.manual,s.intent,s.audience,s.context,s.reasons,s.offerNames,s.presets,s.audiencePresets,s.contextPresets).filter(Boolean);
  const matched=intent.tokens.filter(tok=>searchable.some(v=>exactOrIncludes(v,tok)||(tok.length>3&&v.includes(tok))||(v.length>3&&tok.includes(v))));
  return {matched:[...new Set(matched)],count:[...new Set(matched)].length,total:intent.tokens.length};
}

function climateFit(company,exp){
  const weather=Number(company.weatherScore||3);
  const sensitivity=exp.weatherSensitivity||'medium';
  if(sensitivity==='low')return 4;
  if(sensitivity==='high')return weather;
  return Math.round((weather+3)/2);
}

function distanceKm(company,user){
  if(!user||company.lat==null||company.lng==null)return null;
  return haversineKm(user.lat,user.lng,Number(company.lat),Number(company.lng));
}

function distanceScore(km){
  if(km==null)return 2.5;if(km<=5)return 5;if(km<=15)return 4;if(km<=30)return 3;if(km<=50)return 2;return 1;
}

function experienceAllowed(intent,company,exp){
  if(!effectiveVisibility(company)||!exp.active||!(exp.offers||[]).some(o=>o.active))return false;
  const text=tokensFromExperience(company,exp);
  const s=scoringSignals(company,exp);
  const venue=normalizeText(exp.venueType||company.businessType||'');
  const presets=presetArray(exp,'searchPresets','searchPreset');
  const isRestaurant=venue.includes('restaurante')||venue.includes('comida')||venue.includes('bodega')||
    venue.includes('cafeteria')||venue.includes('cafetería')||
    presets.includes('restauracion')||presets.includes('restaurante_familiar')||presets.includes('cena_romantica');

  // ── Filtro por tokens específicos ───────────────────────────
  // Si la búsqueda tiene tokens ESPECÍFICOS (no genéricos),
  // la experiencia debe responder a AL MENOS UNO de ellos.
  // Esto evita que "paseo en quad" devuelva experiencias de caballo.
  if(intent.specific.length>0){
    const allSearchable=[s.title,s.venue,...s.manual,...s.intent,...s.offerNames,...s.reasons,...s.audience,...s.context].filter(Boolean);
    const specificMatch=intent.specific.some(tok=>
      allSearchable.some(v=>exactOrIncludes(v,tok)||(tok.length>3&&v.includes(tok))||(v.length>3&&tok.includes(v)))
    );
    if(!specificMatch)return false;
  }else if(intent.tokens.length>0){
    // Solo tokens genéricos: aplicar filtro mínimo original
    const stats=queryMatchStats(intent,company,exp);
    const minimumGeneric=intent.tokens.length===1?1:Math.min(2,Math.ceil(intent.tokens.length/2));
    if(intent.type==='generic'&&stats.count<minimumGeneric)return false;
    if(intent.type!=='generic'&&stats.count===0)return false;
  }

  // ── Filtros por tipo de intención ────────────────────────────
  if(intent.type==='family_activity'){
    if(isRestaurant)return /restaurante familiar|menu infantil|menú infantil|zona infantil|kids|ninos|niños|familia/.test(text);
    return /familia|familiar|ninos|niños|hijos|parque|actividad|ocio|kayak|ruta|acuatico|acuático/.test(text);
  }
  if(intent.type==='family_dining')return isRestaurant&&/familia|familiar|menu infantil|menú infantil|ninos|niños/.test(text);
  if(intent.type==='romantic_dining')return (isRestaurant||presets.includes('cena_romantica'))&&/romantico|romantica|pareja|cena|premium|atardecer|maridaje/.test(text);
  if(intent.type==='romantic')return /romantico|romantica|pareja|atardecer|premium/.test(text)&&!/ninos|niños|infantil/.test(text);
  if(intent.type==='indoor')return /indoor|interior|lluvia|cubierto/.test(text)||exp.indoorOutdoor==='indoor';
  if(intent.type==='dining')return isRestaurant;
  return true;
}

// ── NUEVO: puntuación diferencial ───────────────────────────────
// Pesos por fuente (de mayor a menor confianza):
//   Manual tags  → fuente de verdad del admin/empresa  → peso MÁXIMO
//   Título       → segunda fuente más fiable            → peso alto
//   Intent tags  → inferidos automáticamente            → peso medio
//   Offer names  → relevantes cuando matchan            → peso medio-bajo
//   Venue/desc   → contexto general                    → peso bajo
//   Presets      → metadatos de categoría              → peso muy bajo
//
// Token específico vs genérico:
//   Específico (caballo, quad, kayak…) → multiplica el peso base ×3
//   Genérico (paseo, plan, actividad…) → peso base ×0.3
function semanticScore(intent,company,exp){
  const text=tokensFromExperience(company,exp);
  const s=scoringSignals(company,exp);
  let score=0;

  // ── 1. Bonus de frase completa ───────────────────────────────
  // La consulta completa normalizada en manual/título es un hit de máxima calidad
  const fullQ=intent.fullPhrase||intent.q||'';
  if(fullQ.length>3){
    if(matchPhrase(s.manual,fullQ))  score+=25;
    if(s.title.includes(fullQ))      score+=20;
    if(matchPhrase(s.intent,fullQ))  score+=14;
    if(matchPhrase(s.offerNames,fullQ)) score+=10;
    if(text.includes(fullQ))         score+=6;
  }

  // ── 2. Score por token con peso diferencial ──────────────────
  for(const tok of intent.tokens){
    const isSpecific = !GENERIC_TOKENS.has(tok);
    // Multiplicador: tokens específicos valen 3× más que genéricos
    const mult = isSpecific ? 3.0 : 0.3;

    // Puntúa según fuente, escalado por el multiplicador
    const mManual = matchStrength(s.manual, tok);
    const mTitle  = matchStrength([s.title], tok);
    const mIntent = matchStrength(s.intent, tok);
    const mOffer  = matchStrength(s.offerNames, tok);
    const mVenue  = matchStrength([s.venue], tok);
    const mReason = matchStrength(s.reasons, tok);

    // Pesos base por fuente (tokens específicos los triplica)
    if(mManual)  score += mManual  * 18 * mult;  // manual: 54 max para específico exacto
    if(mTitle)   score += mTitle   * 12 * mult;  // título:  36
    if(mIntent)  score += mIntent  * 8  * mult;  // intent:  24
    if(mOffer)   score += mOffer   * 5  * mult;  // oferta:  15
    if(mVenue)   score += mVenue   * 4  * mult;  // venue:   12
    if(mReason)  score += mReason  * 3  * mult;  // reasons:  9

    // Penalización suave: token específico sin coincidencia en ninguna fuente relevante
    if(isSpecific && !mManual && !mTitle && !mIntent && !mOffer && !mVenue){
      // Comprobar texto completo como último recurso
      if(text.includes(tok)) score += 2;
      else score -= 8; // penaliza si el diferencial no aparece en ningún lado
    }
  }

  // ── 3. Bonuses por tipo de intención (compatibilidad) ────────
  const add=(arr,pts)=>{if(arr.some(w=>text.includes(w)))score+=pts;};
  const penal=(arr,pts)=>{if(arr.some(w=>text.includes(w)))score-=pts;};
  if(intent.type==='romantic_dining'){add(['romantico','romantica','pareja','cena','maridaje','atardecer','premium'],4);penal(['ninos','niños','infantil','familia'],4);}
  else if(intent.type==='romantic'){add(['romantico','romantica','pareja','atardecer','premium'],3.5);penal(['ninos','niños','infantil','familia'],3);}
  else if(intent.type==='family_activity'){add(['familia','familiar','ninos','niños','hijos','parque','actividad','ocio','kayak','ruta','acuatico','acuático','caballo'],4);penal(['romantico','romantica','pareja','cena'],3);}
  else if(intent.type==='family_dining'){add(['familia','familiar','menu infantil','menú infantil','ninos','niños'],4);}
  else if(intent.type==='indoor'){add(['indoor','interior','lluvia','cubierto'],4);}
  else if(intent.type==='dining'){add(['restaurante','menu','menú','cena','comida','vino','bodega'],3);}

  // ── 4. Bonuses por preset coincidente ────────────────────────
  if(intent.type==='romantic_dining'&&s.presets.includes('cena_romantica'))score+=8;
  if(intent.type==='romantic'&&(s.presets.includes('romantico')||s.presets.includes('cena_romantica')))score+=6;
  if(intent.type==='family_activity'&&s.presets.includes('plan_familiar'))score+=6;
  if(intent.type==='family_dining'&&s.presets.includes('restaurante_familiar'))score+=6;
  if(intent.type==='dining'&&(s.presets.includes('restauracion')||s.presets.includes('cena_romantica')||s.presets.includes('restaurante_familiar')))score+=4;
  if(intent.type==='activity'&&s.presets.includes('actividad'))score+=4;
  if(intent.type==='indoor'&&s.presets.includes('indoor'))score+=5;

  return score;
}

function runSearch(query,filters){
  const intent=parseIntent(query||'');
  const userLocation=loadUserLocation();
  const cfg={
    semanticWeight:5,climateWeight:1.2,sustainabilityWeight:0.7,
    distanceWeight:1,companyPriorityWeight:1.0,learningWeight:1.4,
    ...(loadState().rankingConfig||{})
  };
  const candidates=[];
  getCompanies().forEach(company=>{
    (company.experiences||[]).forEach(exp=>{
      if(!experienceAllowed(intent,company,exp))return;
      const offers=(exp.offers||[]).filter(o=>o.active);if(!offers.length)return;
      const minPrice=Math.min.apply(null,offers.map(o=>Number(o.price||0)));
      const climate=climateFit(company,exp);
      const sustain=Number(company.sustainabilityLevel||3);
      const priority=clamp(Number(company.searchPriority||5),1,10);
      const km=distanceKm(company,userLocation);
      const dist=distanceScore(km);
      const sem=semanticScore(intent,company,exp);
      const learning=getExperienceLearning(company.id,exp.id);
      const presets=presetArray(exp,'searchPresets','searchPreset').map(v=>normalizeText(v));
      const kind=((normalizeText(exp.venueType||company.businessType).includes('restaurante')||
        normalizeText(company.businessType).includes('restaurante')||
        normalizeText(company.businessType).includes('bodega'))||
        presets.some(v=>['restauracion','restaurante_familiar','cena_romantica'].includes(v)))
        ?'restauracion':'actividad';
      if(filters){
        if(Number(filters.minClimate||0)>climate)return;
        if(Number(filters.minSustainability||0)>sustain)return;
        if(filters.kind&&filters.kind!=='todos'&&filters.kind!==kind)return;
        if(filters.onlyNearby&&km!=null&&km>25)return;
        if(filters.maxPrice&&minPrice>Number(filters.maxPrice))return;
      }
      const priorityBoost=priority*cfg.companyPriorityWeight*10;
      const finalScore=sem*cfg.semanticWeight+climate*cfg.climateWeight+sustain*cfg.sustainabilityWeight+dist*cfg.distanceWeight+priorityBoost+learning.boost*cfg.learningWeight;
      candidates.push({company,experience:exp,minPrice,climate,sustain,priority,km,kind,semanticScore:sem,learningBoost:learning.boost,finalScore});
    });
  });
  const grouped=new Map();
  candidates.forEach(c=>{const prev=grouped.get(c.company.id);if(!prev||c.finalScore>prev.finalScore)grouped.set(c.company.id,c);});
  let results=[...grouped.values()]
    .sort((a,b)=>(b.finalScore-a.finalScore))
    .map(c=>({
      companyId:c.company.id,slug:c.company.slug,companyName:c.company.name,
      city:c.company.city,businessType:c.company.businessType,
      companyDescription:c.company.companyDescription,imageUrl:c.company.imageUrl,
      sustainabilityLevel:c.sustain,weatherScore:c.climate,searchPriority:c.priority,
      experienceId:c.experience.id,experienceTitle:c.experience.title,
      experienceDescription:c.experience.description,venueType:c.experience.venueType,
      minPrice:c.minPrice,distanceKm:c.km,kind:c.kind,
      semanticScore:c.semanticScore,learningBoost:c.learningBoost,finalScore:c.finalScore,
      displayTags:[...(c.experience.manualSearchTags||[]),...(c.experience.intentTags||[])].slice(0,4),
      planBadge:getPlanLimits(c.company).hasBadge||null
    }));
  if(filters?.sort==='precio-asc')results=results.sort((a,b)=>a.minPrice-b.minPrice);
  else if(filters?.sort==='precio-desc')results=results.sort((a,b)=>b.minPrice-a.minPrice);
  trackSearch(query,results);
  return {results,userLocation};
}

function scoreOfferForQuery(offer,query=''){const q=normalizeText(query||'');if(!q)return 0;const text=normalizeText([offer?.name||'',offer?.details||''].join(' '));const tokens=[...new Set(q.split(' ').filter(t=>t.length>2))];let score=0;if(text.includes(q))score+=10;tokens.forEach(tok=>{if(text.includes(tok))score+=3;});return score;}
function kmLabel(km){return km==null?'·':`${km.toFixed(1)} km`;}

// ─────────────────────────────────────────────
// RENDERIZADO PÚBLICO MEJORADO
// ── Consultas de reservas desde Firestore ─────────────────────
async function fetchCustomerBookings(){
  if(!_db||!_customerUser)return[];
  await waitForAuthReady();
  const rows=[];
  const snap=await _db.collection(FIRESTORE_PATHS.bookings).where('userId','==',_customerUser.uid).get();
  snap.forEach(doc=>rows.push({id:doc.id,...doc.data()}));
  return rows.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
async function fetchCompanyBookings(companyId){
  if(!_db||!_customerUser||!companyId)return[];
  await waitForAuthReady();
  const rows=[];
  try{
    const snap=await _db.collection(FIRESTORE_PATHS.bookings).where('companyId','==',companyId).get();
    snap.forEach(doc=>rows.push({id:doc.id,...doc.data()}));
  }catch(err){console.warn('[XP] fetchCompanyBookings:',err);}
  return rows.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}


// ── Helpers compartidos admin + portal (inferencia de presets) ─
function inferPresetFromExperience(exp){const text=normalizeText([exp.title,exp.venueType,exp.description].concat(exp.intentTags||[],exp.audienceTags||[],exp.contextTags||[]).join(' '));let searchPreset='general';if(/romantico|romantica|pareja/.test(text)&&/restaurante|cena|comida|menu|menú|bodega/.test(text))searchPreset='cena_romantica';else if(/romantico|romantica|pareja/.test(text))searchPreset='romantico';else if(/restaurante familiar|menu infantil|menú infantil|familia|familiar/.test(text)&&/restaurante|comida|menu|menú/.test(text))searchPreset='restaurante_familiar';else if(/parque|ocio|acuatico|acuático|kayak|ruta|caballo|aventura|actividad/.test(text)&&/familia|familiar|ninos|niños|hijos/.test(text))searchPreset='plan_familiar';else if(/indoor|interior|lluvia|cubierto/.test(text))searchPreset='indoor';else if(/restaurante|comida|menu|menú|bodega/.test(text))searchPreset='restauracion';else if(/actividad|parque|kayak|ruta|aventura|ocio/.test(text))searchPreset='actividad';let audiencePreset='general';if(/pareja/.test(text))audiencePreset='pareja';else if(/familia|familiar|ninos|niños|hijos/.test(text))audiencePreset='familia';else if(/amigos|grupos/.test(text))audiencePreset='grupos';let contextPreset='dia';if(/noche/.test(text))contextPreset='noche';else if(/tarde|atardecer/.test(text))contextPreset='tarde';return {searchPreset,audiencePreset,contextPreset};}
function presetsToTags(searchPresets,audiencePresets,contextPresets,indoorOutdoor,venueType){const intent=[];const audience=[];const context=[];const reasons=[];const addUnique=(arr,items)=>items.forEach(i=>{if(i&&!arr.includes(i))arr.push(i);});const searchList=Array.isArray(searchPresets)?searchPresets:[searchPresets||'general'];const audienceList=Array.isArray(audiencePresets)?audiencePresets:[audiencePresets||'general'];const contextList=Array.isArray(contextPresets)?contextPresets:[contextPresets||'dia'];searchList.forEach(sp=>{if(sp==='cena_romantica'){addUnique(intent,['romantico','pareja','cena','premium','restaurante','comida','cena romantica']);addUnique(reasons,['ideal para pareja','ambiente romántico','cena para dos']);}else if(sp==='romantico'){addUnique(intent,['romantico','pareja','experiencia']);addUnique(reasons,['plan para parejas']);}else if(sp==='plan_familiar'){addUnique(intent,['familia','actividad','plan familiar']);addUnique(reasons,['ideal para familias']);}else if(sp==='restaurante_familiar'){addUnique(intent,['familia','restaurante familiar','comida familiar','menu infantil']);addUnique(reasons,['restaurante familiar']);}else if(sp==='restauracion'){addUnique(intent,['comida','restaurante']);addUnique(reasons,['experiencia gastronómica']);}else if(sp==='indoor'){addUnique(intent,['indoor','interior']);addUnique(reasons,['buena opción si llueve']);}else if(sp==='actividad'){addUnique(intent,['actividad','ocio']);addUnique(reasons,['plan de actividad']);}});audienceList.forEach(ap=>{if(ap==='pareja')addUnique(audience,['parejas']);else if(ap==='familia')addUnique(audience,['familias','niños']);else if(ap==='grupos')addUnique(audience,['grupos','amigos']);else addUnique(audience,['general']);});contextList.forEach(cp=>{if(cp==='tarde')addUnique(context,['tarde']);else if(cp==='noche')addUnique(context,['noche']);else addUnique(context,['dia']);});if(indoorOutdoor==='indoor')addUnique(context,['indoor','interior']);else if(indoorOutdoor==='outdoor')addUnique(context,['outdoor','exterior']);else addUnique(context,['mixed']);if(venueType){const vt=normalizeText(venueType);if(vt&&!intent.includes(vt))intent.push(vt);}return {intentTags:intent,audienceTags:audience,contextTags:context,reasonHighlights:reasons};}


// ── Firebase Storage — subir imagen de empresa ───────────────
async function uploadCompanyImage(companyId, file){
  if(!window.firebase||!firebase.storage){
    throw new Error('STORAGE_NOT_LOADED');
  }
  if(!file||!file.type.startsWith('image/')){
    throw new Error('Archivo no válido. Solo se permiten imágenes.');
  }
  if(file.size>5*1024*1024){
    throw new Error('La imagen no puede superar 5 MB.');
  }
  const storage=firebase.storage();
  const ext=file.name.split('.').pop().toLowerCase()||'jpg';
  const path=`companies/${companyId}/logo.${ext}`;
  const ref=storage.ref(path);
  const snap=await ref.put(file,{contentType:file.type,customMetadata:{companyId,uploadedAt:nowIso()}});
  const url=await snap.ref.getDownloadURL();
  return url;
}

// ════════════════════════════════════════════════════════════
// BOOTSTRAP COMPARTIDO — llamado por cada app al arrancar
// ════════════════════════════════════════════════════════════
async function _xpBootstrap({pageType='public'}={}){
  PAGE_TYPE=pageType;
  IS_ADMIN_PAGE=pageType==='admin';
  IS_PORTAL_PAGE=pageType==='portal';

  const cfg=window.XP_FIREBASE_CONFIG;
  if(!cfg||!cfg.apiKey||cfg.apiKey==='TU_API_KEY'
      ||String(cfg.projectId||'').includes('tu-proyecto')
      ||String(cfg.authDomain||'').includes('tu-proyecto')){
    throw new Error('CONFIG_MISSING');
  }

  if(!(firebase.apps||[]).length)firebase.initializeApp(cfg);
  _db=firebase.firestore();
  _auth=firebase.auth();

  if(firebase.auth?.Auth?.Persistence?.SESSION&&_auth.setPersistence){
    try{await _auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);}
    catch(e){console.warn('[XP] Auth persistence:',e);}
  }

  startAuthObserver();

  try{
    await _db.enablePersistence({synchronizeTabs:true});
  }catch(pe){
    if(pe.code!=='failed-precondition'&&pe.code!=='unimplemented'){
      console.warn('[XP] Offline persistence:',pe.code);
    }
  }

  await waitForAuthReady();
  await loadSystemConfig();
  _state=await _loadStateFromFirestore();
  await syncRuntimeStateForCurrentUser({mergeGuestCart:false});
}

function _xpBootstrapError(e,backUrl=''){
  const app=document.getElementById('app');
  if(!app)return;
  if(e.message==='CONFIG_MISSING'){
    app.innerHTML=`
      <div class="xp-loading xp-loading-error">
        <div class="xp-error-icon">⚙️</div>
        <h2>Configuración Firebase pendiente</h2>
        <p>Edita <code>assets/js/firebase-config.js</code> con las credenciales de tu proyecto.</p>
        <p class="muted">Consulta <strong>DEPLOY.md</strong> para instrucciones.</p>
      </div>`;
  }else{
    app.innerHTML=`
      <div class="xp-loading xp-loading-error">
        <div class="xp-error-icon">⚠️</div>
        <h2>Error de conexión</h2>
        <p>${typeof escapeHtml==='function'?escapeHtml(String(e.message||e)):String(e.message||e)}</p>
        <button onclick="location.reload()">Reintentar</button>
        ${backUrl?`<a href="${backUrl}" style="margin-left:1rem">Volver</a>`:''}
      </div>`;
  }
  console.error('[XP] Bootstrap error:',e);
}
