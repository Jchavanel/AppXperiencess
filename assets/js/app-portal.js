/**
 * Xperiences Empresa — app-portal.js v5.0
 * Portal de empresa. Completamente separado de la app pública y del panel admin.
 * Requiere: Firebase SDKs + firebase-config.js + seed.js + core.js
 */
(function(){
'use strict';

function renderCompanyLogin(){
  app.innerHTML=shell('Acceso empresas',`<section class="auth-grid single-auth"><section class="panel auth-panel"><div class="panel-head"><h2>Portal empresa</h2></div><form id="company-login-form" class="form-grid"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><div class="full button-row"><button type="submit">Entrar como empresa</button></div><p class="muted small">Acceso de empresa mediante Firebase Auth.</p></form><div class="button-row"><a class="button-link secondary-link" href="#" id="company-reset-link">He olvidado mi contraseña</a></div><div id="company-login-msg" class="save-hint"></div></section></section>`,'company');
  app.querySelector('#company-login-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget.elements;try{await loginPanelAccount(f.email.value,f.password.value,'company');setHashRoute('/company-admin');}catch(error){saveMsg('#company-login-msg',mapAuthError(error),4500);}});
  app.querySelector('#company-reset-link').addEventListener('click',async e=>{e.preventDefault();const email=app.querySelector('#company-login-form [name="email"]').value; if(!email){saveMsg('#company-login-msg','Indica el correo de acceso para enviar el reseteo.',4500);return;} try{await sendCustomerReset(email);saveMsg('#company-login-msg','Correo de reseteo enviado.',4500);}catch(error){saveMsg('#company-login-msg',mapAuthError(error),4500);}});
}


// ── HOME con chips y autocompletado ──

function renderCompanyAdmin(){
  const companyId=requireCompanySession();if(!companyId)return;
  const company=getCompanyById(companyId);
  if(!company){logoutCustomerAccount().catch(console.error);app.innerHTML=shell('Acceso empresa no válido','<div class="empty-card">El acceso de empresa no es válido.</div>','company');return;}

  const selected=company.experiences[0]||{id:uid('exp'),title:'',venueType:company.businessType,description:'',intentTags:[],audienceTags:[],contextTags:[],reasonHighlights:[],manualSearchTags:[],weatherSensitivity:'medium',indoorOutdoor:'mixed',searchPresets:['general'],audiencePresets:['general'],contextPresets:['dia'],active:true,offers:[]};
  const inferred=inferPresetFromExperience(selected);
  selected.searchPresets=presetArray(selected,'searchPresets','searchPreset',inferred.searchPreset||'general');
  selected.audiencePresets=presetArray(selected,'audiencePresets','audiencePreset',inferred.audiencePreset||'general');
  selected.contextPresets=presetArray(selected,'contextPresets','contextPreset',inferred.contextPreset||'dia');

  const options={
    searchPresets:[['general','General'],['plan_familiar','Plan familiar'],['restaurante_familiar','Restaurante familiar'],['actividad','Actividad / ocio'],['restauracion','Restauración'],['romantico','Plan romántico'],['cena_romantica','Cena romántica'],['indoor','Plan indoor / lluvia']],
    audiencePresets:[['general','General'],['familia','Familias'],['pareja','Parejas'],['grupos','Grupos / amigos']],
    contextPresets:[['dia','Día'],['tarde','Tarde'],['noche','Noche'],['lluvia','Lluvia / mal tiempo']]
  };
  const checkGroup=(name,items,sel)=>`<div class="check-grid">${items.map(([v,l])=>`<label class="check-item"><input type="checkbox" name="${name}" value="${v}" ${(sel||[]).includes(v)?'checked':''}>${l}</label>`).join('')}</div>`;

  // Determine if company has existing location
  const hasLocation=company.lat!=null&&company.lng!=null&&company.lat!==''&&company.lng!=='';
  const existingLat=hasLocation?Number(company.lat).toFixed(6):'';
  const existingLng=hasLocation?Number(company.lng).toFixed(6):'';

  app.innerHTML=shell(`Panel empresa · ${escapeHtml(company.name)}`,
    `<section class="panel"><div class="panel-head between"><h2>Portal de empresa</h2><a class="status-pill" href="index.html#/company/${company.slug}">Ver ficha pública</a></div>
     <p class="muted">Gestiona el contenido, experiencias, ofertas y ubicación de tu negocio.</p></section>

     ${company.lat && company.lng ? `<section class="panel company-weather-portal-panel">
       <div class="panel-head between">
         <h2>Tiempo en tu zona</h2>
         <span class="muted small" id="weather-portal-updated"></span>
       </div>
       <div id="weather-portal-slot"><div class="xp-loading"><div class="xp-spinner"></div><p>Cargando meteorología…</p></div></div>
     </section>` : ''}

     <section class="admin-two-cols">
      <section class="panel"><div class="panel-head"><h2>Datos del negocio</h2></div>
       <form id="company-admin-form" class="form-grid">
         <label>Nombre del negocio<input name="name" value="${escapeHtml(company.name)}" placeholder="Nombre de tu negocio" required></label>
         <label>Tipo de negocio<input name="businessType" value="${escapeHtml(company.businessType||'')}" placeholder="Ej: restaurante italiano, rancho ecuestre, parque acuático"></label>
         <label>Ciudad<input name="city" value="${escapeHtml(company.city||'')}" placeholder="Ciudad donde está el negocio"></label>
         <label class="full">Descripción del negocio<textarea name="companyDescription" placeholder="Describe tu negocio en pocas líneas: qué ofreces, qué te hace único, qué puede esperar el cliente…">${escapeHtml(company.companyDescription||'')}</textarea></label>

         <!-- IMAGEN DEL NEGOCIO -->
         <div class="full form-section-head"><strong>Imagen del negocio</strong></div>
         ${company.imageUrl?`<div class="full image-preview-wrap"><img src="${escapeHtml(company.imageUrl)}" class="company-image-preview" alt="Logo actual"><span class="muted small">Imagen actual</span></div>`:''}
         <div class="full upload-area" id="upload-area">
           <input type="file" id="company-image-file" accept="image/*" class="upload-input">
           <label for="company-image-file" class="upload-label">
             <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
             <span id="upload-label-text">Haz clic o arrastra una imagen aquí</span>
             <span class="muted small">JPG, PNG o WEBP · máx. 5 MB</span>
           </label>
           <div id="upload-progress" class="upload-progress hidden"></div>
         </div>
         <input type="hidden" name="imageUrl" value="${escapeHtml(company.imageUrl||'')}">

         <!-- ACCESO EMPRESA -->
         <div class="full quality-box">
           <strong>Acceso empresa</strong>
           <div class="muted">Correo: ${escapeHtml(company.portalAuth?.email||'sin configurar')} · Estado: ${escapeHtml(company.portalAuth?.uid?'activo':'sin cuenta')}</div>
           ${company.portalAuth?.email?'<div class="button-row" style="margin-top:.75rem"><button type="button" id="company-self-reset" class="secondary">Enviar reseteo de contraseña</button></div>':''}
         </div>

         <!-- UBICACIÓN CON MAPA -->
         <div class="full form-section-head">
           <strong>Ubicación del negocio</strong>
           <span class="muted small">Busca tu dirección o haz clic en el mapa para marcar la ubicación exacta</span>
         </div>
         <div class="full location-bar">
           <input type="search" id="map-search" placeholder="Buscar dirección o nombre del lugar…" autocomplete="off">
           <button type="button" id="gps-company" class="secondary gps-btn" title="Usar mi ubicación GPS">
             <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="M12 5a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7"/></svg>
             GPS
           </button>
         </div>
         <div class="full" id="map-container" style="height:280px;border-radius:var(--border-radius-lg);overflow:hidden;border:0.5px solid var(--color-border-secondary);margin:.25rem 0"></div>
         <div class="full map-coords-row">
           <span id="map-coords-display" class="muted small">${hasLocation?`📍 ${existingLat}, ${existingLng}`:'Sin ubicación seleccionada'}</span>
         </div>
         <input type="hidden" name="lat" id="hidden-lat" value="${existingLat}">
         <input type="hidden" name="lng" id="hidden-lng" value="${existingLng}">
         <span class="save-hint" id="company-admin-gps-msg"></span>

         <div class="full button-row" style="margin-top:.5rem">
           <button type="submit">Guardar negocio</button>
           <span class="save-hint" id="company-admin-save-msg"></span>
         </div>
       </form>
      </section>

      <section class="panel"><div class="panel-head between"><h2>Experiencia principal</h2><button type="button" id="company-new-exp" class="secondary">Nueva experiencia</button></div>
       <div class="experience-admin-list">${(company.experiences||[]).map(exp=>`<button class="experience-pill" type="button" data-company-pick-exp="${exp.id}">${escapeHtml(exp.title)}</button>`).join('')}</div>
       <form id="company-admin-exp-form" class="form-grid">
        <input type="hidden" name="experienceId" value="${selected.id}">
        <label>Título experiencia<input name="title" value="${escapeHtml(selected.title||'')}" required></label>
        <label>Tipo de experiencia<input name="venueType" value="${escapeHtml(selected.venueType||'')}" placeholder="Ej: rancho, restaurante, escuela de surf…"></label>
        <label class="full">Descripción<textarea name="description" placeholder="Describe la experiencia: qué incluye, duración, qué hace especial esta actividad…">${escapeHtml(selected.description||'')}</textarea></label>
        <label class="full">Perfil para el buscador${checkGroup('searchPresets',options.searchPresets,selected.searchPresets)}</label>
        <label class="full">Público principal${checkGroup('audiencePresets',options.audiencePresets,selected.audiencePresets)}</label>
        <label class="full">Momento ideal${checkGroup('contextPresets',options.contextPresets,selected.contextPresets)}</label>
        <label class="full">Etiquetas manuales para buscador<input name="manualSearchTags" value="${escapeHtml((selected.manualSearchTags||[]).join(', '))}" placeholder="ej: rooftop, menu degustacion, kids, surf, caballo"></label>
        <label>Interior / exterior<select name="indoorOutdoor"><option value="mixed" ${selected.indoorOutdoor==='mixed'?'selected':''}>Mixto</option><option value="indoor" ${selected.indoorOutdoor==='indoor'?'selected':''}>Interior</option><option value="outdoor" ${selected.indoorOutdoor==='outdoor'?'selected':''}>Exterior</option></select></label>
        <label>Sensibilidad climática<select name="weatherSensitivity"><option value="low" ${selected.weatherSensitivity==='low'?'selected':''}>Baja</option><option value="medium" ${selected.weatherSensitivity==='medium'?'selected':''}>Media</option><option value="high" ${selected.weatherSensitivity==='high'?'selected':''}>Alta</option></select></label>
        <div class="full button-row"><button type="submit">Guardar experiencia</button><span class="save-hint" id="company-exp-save-msg"></span></div>
       </form>
      </section>
     </section>

     <section class="panel"><div class="panel-head between"><h2>Ofertas</h2><button id="company-new-offer" type="button">Nueva oferta</button></div><div id="company-offers-host"></div></section>
     <section class="panel plan-info-panel">
      <div class="panel-head between">
        <h2>Tu plan</h2>
        ${getPlanLimits(company).hasBadge?`<span class="plan-badge-pill plan-badge-${getPlanLimits(company).hasBadge}">${getPlanLimits(company).hasBadge==='featured'?'★ Destacado':'✓ Verificado'}</span>`:''}
      </div>
      <div class="plan-portal-grid">
        <div class="plan-portal-item">
          <span class="plan-portal-label">Plan activo</span>
          <strong class="plan-portal-value">${escapeHtml(getPlanLimits(company).label)}</strong>
        </div>
        <div class="plan-portal-item">
          <span class="plan-portal-label">Comisión por reserva</span>
          <strong class="plan-portal-value">${Math.round(getPlanLimits(company).commission*100)}%</strong>
        </div>
        <div class="plan-portal-item">
          <span class="plan-portal-label">Cuota mensual</span>
          <strong class="plan-portal-value">${getPlanLimits(company).monthlyFee?getPlanLimits(company).monthlyFee.toFixed(2).replace('.',',')+' €':'Sin cuota'}</strong>
        </div>
        <div class="plan-portal-item">
          <span class="plan-portal-label">Visibilidad búsqueda</span>
          <strong class="plan-portal-value">${getPlanLimits(company).searchPriority}/10</strong>
        </div>
      </div>
      ${(()=>{
        const limits=getPlanLimits(company);
        const daysLeft=getTrialDaysLeft(company);
        const parts=[];
        // ── Banner trial activo ──────────────────────────────
        if(limits.isTrial && daysLeft !== null && daysLeft > 0){
          const urgency = daysLeft <= 7 ? 'trial-banner-urgent' : daysLeft <= 30 ? 'trial-banner-warn' : 'trial-banner-ok';
          parts.push(`<div class="trial-banner ${urgency}">
            <span class="trial-banner-icon">🎁</span>
            <span class="trial-banner-text">
              <strong>Período de prueba — acceso completo</strong>
              ${daysLeft <= 1
                ? `Expira <strong>hoy</strong>. Contrata un plan para mantener tus funciones.`
                : `Te quedan <strong>${daysLeft} días</strong>. Al terminar, pasarás al plan gratuito sin comisión fija (25%).`
              }
            </span>
            <a href="#" class="trial-banner-cta" id="btn-ver-planes">Ver planes</a>
          </div>`);
        }
        // ── Banner trial expirado (ya en basico_a) ───────────
        if(limits.trialExpired){
          parts.push(`<div class="trial-banner trial-banner-expired">
            <span class="trial-banner-icon">⚠️</span>
            <span class="trial-banner-text">
              <strong>Tu período de prueba ha finalizado.</strong>
              Estás en el plan gratuito (25% comisión). Actualiza para recuperar push, analytics y más visibilidad.
            </span>
            <a href="#" class="trial-banner-cta trial-banner-cta-upgrade" id="btn-ver-planes-upgrade">Upgrade</a>
          </div>`);
        }
        // ── Nota analytics ───────────────────────────────────
        if(limits.analytics && !limits.trialExpired){
          parts.push(`<div class="plan-analytics-note">📊 Analytics: ${escapeHtml(limits.analyticsLabel||'')} · <a href="#/analytics">Ver informe</a></div>`);
        }
        return parts.join('');
      })()}
    </section>
    <section class="panel" id="company-bookings-panel"><div class="panel-head between"><h2>Reservas de tu empresa</h2></div><div class="xp-loading"><div class="xp-spinner"></div><p>Cargando reservas…</p></div></section>`
  ,'company');

  // ── Listeners: Ver planes ──────────────────────────────────
  ['btn-ver-planes','btn-ver-planes-upgrade'].forEach(id=>{
    const btn=app.querySelector('#'+id);
    if(btn) btn.addEventListener('click',e=>{e.preventDefault();renderPlanesModal(company);});
  });

  // ── Badge de mensajes no leídos en el nav ──────────────────
  getTotalUnreadForCompany(companyId).then(total => {
    const badge = document.getElementById('nav-chat-unread');
    if (!badge) return;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
    badge.textContent = total > 9 ? '9+' : String(total || '');
  }).catch(() => {});

  // ── Tiempo real para el portal empresa ─────────────────────
  if(company.lat && company.lng){
    fetchWeather(company.lat, company.lng).then(wd=>{
      const slot = app.querySelector('#weather-portal-slot');
      if(!slot || !wd) return;
      slot.innerHTML = weatherBadgeHtml(wd, 'expanded');
      const ts = app.querySelector('#weather-portal-updated');
      if(ts) ts.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
    }).catch(()=>{
      const slot = app.querySelector('#weather-portal-slot');
      if(slot) slot.innerHTML = '<p class="muted small">No se pudo obtener la meteorología.</p>';
    });
  }

  // ── Mapa Leaflet ──────────────────────────────────────────
  let _map=null;let _marker=null;
  let _pendingLat=hasLocation?Number(company.lat):null;
  let _pendingLng=hasLocation?Number(company.lng):null;
  const hiddenLat=app.querySelector('#hidden-lat');
  const hiddenLng=app.querySelector('#hidden-lng');
  const coordsDisplay=app.querySelector('#map-coords-display');

  function setMapCoords(lat,lng,confirm=false){
    if(confirm&&(hasLocation||(_pendingLat!==null))){
      if(!window.confirm('¿Seguro que quieres cambiar la ubicación del negocio?'))return;
    }
    _pendingLat=lat;_pendingLng=lng;
    hiddenLat.value=lat.toFixed(6);
    hiddenLng.value=lng.toFixed(6);
    coordsDisplay.textContent=`📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if(_marker)_marker.setLatLng([lat,lng]);
    else{_marker=L.marker([lat,lng],{draggable:true}).addTo(_map);_marker.on('dragend',()=>{const p=_marker.getLatLng();setMapCoords(p.lat,p.lng);});}
    _map.setView([lat,lng],15);
  }

  function initMap(){
    if(typeof L==='undefined'){
      // Load Leaflet dynamically
      const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css);
      const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload=()=>buildMap();document.head.appendChild(js);
    }else{buildMap();}
  }

  function buildMap(){
    const defaultLat=_pendingLat||28.1248;
    const defaultLng=_pendingLng||-15.4300;
    const zoom=_pendingLat?15:10;
    _map=L.map('map-container').setView([defaultLat,defaultLng],zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(_map);
    if(_pendingLat&&_pendingLng){
      _marker=L.marker([_pendingLat,_pendingLng],{draggable:true}).addTo(_map);
      _marker.on('dragend',()=>{const p=_marker.getLatLng();setMapCoords(p.lat,p.lng);});
    }
    _map.on('click',e=>{setMapCoords(e.latlng.lat,e.latlng.lng,true);});
  }

  // Init mapa con pequeño delay para que el DOM esté listo
  setTimeout(initMap,100);

  // Buscador de dirección (Nominatim, sin API key)
  let _searchTimer;
  app.querySelector('#map-search').addEventListener('input',e=>{
    clearTimeout(_searchTimer);
    const q=(e.target.value||'').trim();
    if(q.length<3)return;
    _searchTimer=setTimeout(async()=>{
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        const data=await r.json();
        if(data&&data[0]){setMapCoords(parseFloat(data[0].lat),parseFloat(data[0].lon),true);}
      }catch(err){console.warn('[XP] Nominatim:',err);}
    },700);
  });
  app.querySelector('#map-search').addEventListener('keydown',async e=>{
    if(e.key!=='Enter')return;e.preventDefault();
    const q=(e.target.value||'').trim();if(!q)return;
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data=await r.json();
      if(data&&data[0]){setMapCoords(parseFloat(data[0].lat),parseFloat(data[0].lon),true);}
      else saveMsg('#company-admin-gps-msg','No se encontró esa dirección.',3000);
    }catch(err){saveMsg('#company-admin-gps-msg','Error al buscar dirección.',3000);}
  });

  // GPS
  app.querySelector('#gps-company').addEventListener('click',()=>{
    saveMsg('#company-admin-gps-msg','Obteniendo ubicación GPS…');
    requestUserLocation((coords,err)=>{
      if(!coords){saveMsg('#company-admin-gps-msg',err==='unsupported'?'GPS no soportado':err==='insecure'?'Requiere HTTPS':'No se pudo obtener ubicación GPS');return;}
      setMapCoords(coords.lat,coords.lng,true);
      saveMsg('#company-admin-gps-msg','✓ Ubicación GPS obtenida');
    });
  });

  // ── Upload imagen con Firebase Storage ───────────────────
  const uploadArea=app.querySelector('#upload-area');
  const fileInput=app.querySelector('#company-image-file');
  const uploadLabel=app.querySelector('#upload-label-text');
  const uploadProgress=app.querySelector('#upload-progress');

  async function handleImageFile(file){
    if(!file||!file.type.startsWith('image/')){saveMsg('#company-admin-save-msg','Solo se permiten imágenes (JPG, PNG, WEBP).',4000);return;}
    if(file.size>5*1024*1024){saveMsg('#company-admin-save-msg','La imagen no puede superar 5 MB.',4000);return;}
    uploadLabel.textContent='Subiendo imagen…';
    uploadProgress.classList.remove('hidden');
    uploadProgress.style.width='20%';
    try{
      let url;
      // Intentar Firebase Storage primero
      if(window.firebase&&typeof firebase.storage==='function'){
        uploadProgress.style.width='50%';
        url=await uploadCompanyImage(company.id,file);
        uploadProgress.style.width='100%';
      }else{
        // Fallback: Base64 (máx ~750KB recomendado para Firestore)
        url=await new Promise((res,rej)=>{
          const reader=new FileReader();
          reader.onload=()=>res(reader.result);
          reader.onerror=rej;
          reader.readAsDataURL(file);
        });
        uploadProgress.style.width='100%';
      }
      app.querySelector('input[name="imageUrl"]').value=url;
      // Preview
      let preview=app.querySelector('.company-image-preview');
      if(!preview){
        const wrap=document.createElement('div');wrap.className='full image-preview-wrap';
        preview=document.createElement('img');preview.className='company-image-preview';preview.alt='Logo actual';
        const lbl=document.createElement('span');lbl.className='muted small';lbl.textContent='Imagen cargada (guarda para aplicar)';
        wrap.appendChild(preview);wrap.appendChild(lbl);
        uploadArea.parentNode.insertBefore(wrap,uploadArea);
      }
      preview.src=url;
      uploadLabel.textContent='✓ Imagen lista — pulsa Guardar negocio';
      saveMsg('#company-admin-save-msg','✓ Imagen lista. Pulsa Guardar para aplicar.',4000);
    }catch(err){
      uploadLabel.textContent='Haz clic o arrastra una imagen aquí';
      saveMsg('#company-admin-save-msg',mapAuthError(err)||'Error al subir la imagen.',5000);
    }finally{
      setTimeout(()=>{uploadProgress.classList.add('hidden');uploadProgress.style.width='0';},1200);
    }
  }

  if(fileInput)fileInput.addEventListener('change',()=>fileInput.files[0]&&handleImageFile(fileInput.files[0]));

  // Drag & drop
  uploadArea.addEventListener('dragover',e=>{e.preventDefault();uploadArea.classList.add('drag-over');});
  uploadArea.addEventListener('dragleave',()=>uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop',e=>{e.preventDefault();uploadArea.classList.remove('drag-over');const file=e.dataTransfer.files[0];if(file)handleImageFile(file);});

  // ── Formulario guardar negocio ────────────────────────────
  app.querySelector('#company-admin-form').addEventListener('submit',e=>{
    e.preventDefault();
    const f=e.currentTarget.elements;
    const lat=f.lat.value?Number(f.lat.value):null;
    const lng=f.lng.value?Number(f.lng.value):null;
    saveCompanyProfile(company.id,{
      name:f.name.value.trim(),
      businessType:f.businessType.value.trim(),
      city:f.city.value.trim(),
      imageUrl:f.imageUrl.value.trim(),
      lat,lng,
      companyDescription:f.companyDescription.value.trim()
    });
    saveMsg('#company-admin-save-msg','✓ Negocio guardado');
  });

  app.querySelector('#company-self-reset')?.addEventListener('click',async()=>{
    try{await sendCompanyPortalReset(company.id);saveMsg('#company-admin-save-msg','Correo de reseteo enviado.',4500);}
    catch(error){saveMsg('#company-admin-save-msg',mapAuthError(error),4500);}
  });

  // ── Ofertas ───────────────────────────────────────────────
  const currentExperience=()=>{const expId=app.querySelector('#company-admin-exp-form [name="experienceId"]').value;return getCompanyById(companyId)?.experiences.find(e=>e.id===expId)||null;};
  const refreshOffers=()=>{
    const exp=currentExperience();const host=app.querySelector('#company-offers-host');
    if(!exp){host.innerHTML='<p class="muted">Crea o selecciona una experiencia para editar sus ofertas.</p>';return;}
    host.innerHTML=(exp.offers||[]).length?exp.offers.map(offer=>`<form class="offer-form panel nested" data-offer-id="${offer.id}"><label>Nombre<input name="name" value="${escapeHtml(offer.name)}" placeholder="Ej: Entrada adulto, Menú individual…"></label><label>Precio<input type="number" name="price" min="0" step="1" value="${Number(offer.price||0)}"></label><label class="full">Detalles<textarea name="details" placeholder="Qué incluye esta oferta, condiciones especiales…">${escapeHtml(offer.details||'')}</textarea></label><label>Activa<input type="checkbox" name="active" ${offer.active?'checked':''}></label><div class="full button-row"><button type="submit">Guardar oferta</button><button type="button" class="secondary" data-company-delete-offer="${offer.id}">Eliminar</button></div></form>`).join(''):'<p class="muted">No hay ofertas todavía.</p>';
    host.querySelectorAll('.offer-form').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const expNow=currentExperience();if(!expNow)return;upsertOffer(company.id,expNow.id,{id:form.dataset.offerId,name:form.elements.name.value.trim(),price:Number(form.elements.price.value||0),details:form.elements.details.value.trim(),active:form.elements.active.checked});refreshOffers();saveMsg('#company-exp-save-msg','✓ Oferta guardada');}));
    host.querySelectorAll('[data-company-delete-offer]').forEach(btn=>btn.addEventListener('click',()=>{const expNow=currentExperience();if(!expNow)return;deleteOffer(company.id,expNow.id,btn.dataset.companyDeleteOffer);refreshOffers();saveMsg('#company-exp-save-msg','Oferta eliminada');}));
  };
  refreshOffers();

  // Reservas
  fetchCompanyBookings(companyId).then(rows=>{
    const panel=app.querySelector('#company-bookings-panel');if(!panel)return;
    const sm={pending:'Pendiente',confirmed:'Confirmada',cancelled:'Cancelada',attended:'Asistida'};
    panel.innerHTML=`<div class="panel-head between"><h2>Reservas de tu empresa</h2><span class="muted small">${rows.length} reserva(s)</span></div>`+(rows.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Experiencia</th><th>Oferta</th><th>Uds.</th><th>Total</th><th>Estado</th></tr></thead><tbody>${rows.slice(0,50).map(r=>`<tr><td>${new Date(r.createdAt).toLocaleString('es-ES')}</td><td>${escapeHtml(r.customer?.displayName||r.userEmail||'-')}<br><small class="muted">${escapeHtml(r.customer?.phone||'')}</small></td><td>${escapeHtml(r.experienceTitle||'-')}</td><td>${escapeHtml(r.offerName||'-')}</td><td>${r.quantity||1}</td><td>${formatEuro(r.totalPrice)}</td><td><span class="status-pill">${sm[r.status]||r.status||'Pendiente'}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No hay reservas todavía para tu empresa.</p>');
  }).catch(err=>{const panel=app.querySelector('#company-bookings-panel');if(panel)panel.innerHTML=`<div class="panel-head"><h2>Reservas</h2></div><p class="muted">${escapeHtml(mapAuthError(err))}</p>`;});

  // Experiencias
  app.querySelector('#company-admin-exp-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const vals=name=>Array.from(f.querySelectorAll(`input[name="${name}"]:checked`)).map(v=>v.value);upsertExperience(company.id,{id:f.elements.experienceId.value.trim(),title:f.elements.title.value.trim(),venueType:f.elements.venueType.value.trim(),description:f.elements.description.value.trim(),searchPresets:vals('searchPresets'),audiencePresets:vals('audiencePresets'),contextPresets:vals('contextPresets'),manualSearchTags:parseTags(f.elements.manualSearchTags.value),indoorOutdoor:f.elements.indoorOutdoor.value,weatherSensitivity:f.elements.weatherSensitivity.value,active:true});refreshOffers();saveMsg('#company-exp-save-msg','✓ Experiencia guardada');});
  app.querySelectorAll('[data-company-pick-exp]').forEach(btn=>btn.addEventListener('click',()=>{const exp=getCompanyById(companyId).experiences.find(e=>e.id===btn.dataset.companyPickExp);const f=app.querySelector('#company-admin-exp-form');f.elements.experienceId.value=exp.id;f.elements.title.value=exp.title||'';f.elements.venueType.value=exp.venueType||'';f.elements.description.value=exp.description||'';f.elements.manualSearchTags.value=(exp.manualSearchTags||[]).join(', ');f.elements.indoorOutdoor.value=exp.indoorOutdoor||'mixed';f.elements.weatherSensitivity.value=exp.weatherSensitivity||'medium';['searchPresets','audiencePresets','contextPresets'].forEach(name=>f.querySelectorAll(`input[name="${name}"]`).forEach(i=>{const source=name==='searchPresets'?exp.searchPresets:name==='audiencePresets'?exp.audiencePresets:exp.contextPresets;i.checked=(source||[]).includes(i.value);}));refreshOffers();}));
  app.querySelector('#company-new-exp').addEventListener('click',()=>{const f=app.querySelector('#company-admin-exp-form');f.reset();f.elements.experienceId.value=uid('exp');f.elements.venueType.value=getCompanyById(companyId).businessType||'experiencia';f.querySelectorAll('input[type="checkbox"]').forEach(i=>i.checked=false);const first=f.querySelector('input[name="searchPresets"][value="general"]');if(first)first.checked=true;const aud=f.querySelector('input[name="audiencePresets"][value="general"]');if(aud)aud.checked=true;const ctx=f.querySelector('input[name="contextPresets"][value="dia"]');if(ctx)ctx.checked=true;refreshOffers();});
  app.querySelector('#company-new-offer').addEventListener('click',()=>{const exp=currentExperience();if(!exp){saveMsg('#company-exp-save-msg','Selecciona primero una experiencia',3000);return;}upsertOffer(company.id,exp.id,{id:uid('offer'),name:'Nueva oferta',price:0,details:'',active:true});refreshOffers();saveMsg('#company-exp-save-msg','✓ Nueva oferta creada');});
}


// ── Enrutador portal empresa ──────────────────────────────────
function render(){
  const route=routeQuery();
  try{
    if(route.path==='/company-logout'||route.path==='/logout'){
      logoutCustomerAccount().then(()=>{
        location.href='index.html';
      }).catch(()=>{ location.href='index.html'; });
      return;
    }
    if(route.path==='/'||route.path===''||route.path==='/company-login')return renderCompanyLogin();
    if(route.path==='/company-admin')return renderCompanyAdmin();
    if(route.path==='/company-chat')return renderCompanyChat();
    app.innerHTML=`<div class="error-screen"><h1>Página no encontrada</h1><a href="portal.html">Volver al portal</a></div>`;
  }catch(err){
    console.error('[XP] portal render:',err);
    app.innerHTML=`<div class="error-screen"><h1>Error</h1><p>${escapeHtml(err.message||String(err))}</p><button onclick="location.reload()">Reintentar</button> <a href="portal.html">Volver</a></div>`;
  }
}

// ══════════════════════════════════════════════════════════════
//  Modal de comparativa de planes
// ══════════════════════════════════════════════════════════════
function renderPlanesModal(company){
  // Quitar modal previo si existe
  document.getElementById('xp-planes-modal')?.remove();

  const limits = getPlanLimits(company);
  const currentPlanKey = limits.planKey;
  const daysLeft = getTrialDaysLeft(company);

  // ── Datos de cada plan ──────────────────────────────────────
  const planes = [
    {
      key: 'basico_b',
      name: 'Básico',
      price: '29,90',
      period: '/ mes',
      commission: '10%',
      color: 'teal',
      highlight: false,
      features: [
        { ok: true,  text: 'Ficha pública completa' },
        { ok: true,  text: 'Fotos, mapa y experiencias ilimitadas' },
        { ok: true,  text: 'Portal de gestión' },
        { ok: true,  text: 'Nombre del cliente en reservas' },
        { ok: false, text: 'Push notifications' },
        { ok: false, text: 'Analytics de reservas' },
        { ok: false, text: 'Teléfono y email del cliente' },
        { ok: false, text: 'Envío de promos a tus clientes' },
        { ok: false, text: 'Badge en el buscador' },
      ],
      cta: 'Elegir Básico',
      note: 'Visibilidad búsqueda 3/10'
    },
    {
      key: 'pro',
      name: 'Pro',
      price: '69,90',
      period: '/ mes',
      commission: '8%',
      color: 'blue',
      highlight: true,
      features: [
        { ok: true,  text: 'Todo lo del plan Básico' },
        { ok: true,  text: 'Push — nueva reserva (inmediato)' },
        { ok: true,  text: 'Push — confirmación al cliente' },
        { ok: true,  text: 'Push — promos a tus clientes' },
        { ok: true,  text: 'Analytics 90 días (reservas, búsquedas)' },
        { ok: true,  text: 'Edad de clientes por rangos' },
        { ok: true,  text: 'Teléfono y email del cliente' },
        { ok: true,  text: 'Exportar reservas CSV' },
        { ok: true,  text: 'Badge verificado en el buscador' },
      ],
      cta: 'Elegir Pro',
      note: 'Visibilidad búsqueda 6/10'
    },
    {
      key: 'infinity',
      name: 'Infinity',
      price: '119,90',
      period: '/ mes',
      commission: '5%',
      color: 'amber',
      highlight: false,
      features: [
        { ok: true,  text: 'Todo lo del plan Pro' },
        { ok: true,  text: 'Analytics 365 días + métricas de sector' },
        { ok: true,  text: 'Comparativa con negocios similares' },
        { ok: true,  text: 'Estacionalidad y tendencias de tu actividad' },
        { ok: true,  text: 'Incluida en promos globales de Xperiences' },
        { ok: true,  text: 'Badge destacado (★) en el buscador' },
        { ok: true,  text: 'Máxima prioridad en búsqueda' },
        { ok: true,  text: 'Soporte directo prioritario' },
        { ok: true,  text: 'Acceso anticipado a nuevas funciones' },
      ],
      cta: 'Elegir Infinity',
      note: 'Visibilidad búsqueda 9/10'
    }
  ];

  // ── Colores por plan ────────────────────────────────────────
  const palettes = {
    teal:  { bg:'rgba(29,158,117,.10)', border:'rgba(29,158,117,.30)', name:'rgba(100,220,180,.95)', price:'rgba(29,158,117,1)', btn:'rgba(29,158,117,.85)', btnHover:'rgba(29,158,117,1)' },
    blue:  { bg:'rgba(55,138,221,.14)', border:'rgba(55,138,221,.45)', name:'rgba(120,190,255,.95)', price:'rgba(77,163,255,1)',  btn:'rgba(22,119,255,.9)',  btnHover:'rgba(22,119,255,1)' },
    amber: { bg:'rgba(186,117,23,.10)', border:'rgba(239,159,39,.30)', name:'rgba(240,185,80,.95)', price:'rgba(239,159,39,1)',  btn:'rgba(186,117,23,.85)', btnHover:'rgba(239,159,39,1)' }
  };

  // ── Punto de equilibrio dinámico ────────────────────────────
  const breakEven = Math.round(29.90 / (0.25 - 0.10));

  // ── HTML del modal ──────────────────────────────────────────
  const cardsHtml = planes.map(p => {
    const pal = palettes[p.color];
    const isCurrent = p.key === currentPlanKey;
    const featHtml = p.features.map(f =>
      `<div class="xp-plan-feat ${f.ok?'on':'off'}">
        <span class="xp-plan-dot ${f.ok?'dot-on':'dot-off'}"></span>
        <span>${escapeHtml(f.text)}</span>
      </div>`
    ).join('');

    return `
    <div class="xp-plan-card ${p.highlight?'xp-plan-highlighted':''} ${isCurrent?'xp-plan-current':''}"
         style="background:${pal.bg};border-color:${pal.border}">
      ${p.highlight ? '<div class="xp-plan-popular-tag">Más elegido</div>' : ''}
      ${isCurrent    ? '<div class="xp-plan-current-tag">Plan actual</div>' : ''}
      <div class="xp-plan-name" style="color:${pal.name}">${p.name}</div>
      <div class="xp-plan-price-row">
        <span class="xp-plan-price" style="color:${pal.price}">${p.price}€</span>
        <span class="xp-plan-period">${p.period}</span>
      </div>
      <div class="xp-plan-commission">+ ${p.commission} por reserva</div>
      <div class="xp-plan-divider" style="background:${pal.border}"></div>
      <div class="xp-plan-features">${featHtml}</div>
      <div class="xp-plan-note">${escapeHtml(p.note)}</div>
      ${!isCurrent ? `
      <a href="mailto:hola@xperiences.es?subject=Contratar%20plan%20${encodeURIComponent(p.name)}"
         class="xp-plan-cta" style="background:${pal.btn}" 
         onmouseover="this.style.background='${pal.btnHover}'"
         onmouseout="this.style.background='${pal.btn}'">${escapeHtml(p.cta)}</a>
      ` : '<div class="xp-plan-cta-current">✓ Tu plan actual</div>'}
    </div>`;
  }).join('');

  // Banner trial info dentro del modal
  const trialBanner = (limits.isTrial && daysLeft > 0) ? `
    <div class="xp-plans-trial-note">
      🎁 Durante tu prueba tienes acceso completo (${daysLeft} días restantes). 
      Elige el plan que mejor se adapte a tu negocio para cuando finalice.
    </div>` : '';

  const breakEvenNote = `
    <div class="xp-plans-breakeven">
      💡 <strong>Punto de equilibrio Básico vs sin cuota:</strong>
      Con más de <strong>${breakEven}€/mes en reservas</strong>, el plan Básico 
      (29,90€ + 10%) sale más barato que el plan gratuito (25% sin cuota).
    </div>`;

  const modalHtml = `
  <div id="xp-planes-modal" class="xp-modal-overlay" role="dialog" aria-modal="true" aria-label="Comparativa de planes">
    <div class="xp-modal-box xp-planes-box">
      <div class="xp-modal-header">
        <div>
          <h2 class="xp-modal-title">Planes Xperiences</h2>
          <p class="xp-modal-sub">Elige el plan que mejor encaje con tu negocio. Sin permanencia.</p>
        </div>
        <button class="xp-modal-close" id="xp-planes-close" aria-label="Cerrar">✕</button>
      </div>
      ${trialBanner}
      <div class="xp-plans-grid">${cardsHtml}</div>
      ${breakEvenNote}
      <p class="xp-plans-footer-note">
        Todos los planes incluyen ficha pública, foto, mapa y experiencias ilimitadas. 
        Sin permanencia — cancela cuando quieras. 
        <a href="mailto:hola@xperiences.es">¿Dudas? Escríbenos.</a>
      </p>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // ── Cerrar modal ────────────────────────────────────────────
  const overlay = document.getElementById('xp-planes-modal');
  document.getElementById('xp-planes-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.addEventListener('keydown', function onKey(e){
    if(e.key === 'Escape'){ overlay.remove(); document.removeEventListener('keydown', onKey); }
  });

  // Animar entrada
  requestAnimationFrame(() => overlay.classList.add('xp-modal-visible'));
}


// ════════════════════════════════════════════════════════════════
//  Chat empresa — lista de conversaciones + vista de hilo
// ════════════════════════════════════════════════════════════════
let _portalChatUnsub = null;
let _portalMsgUnsub  = null;

function renderCompanyChat(openChatId) {
  const companyId = requireCompanySession();
  if (!companyId) return;
  const company = getCompanyById(companyId);

  if (_portalChatUnsub) { _portalChatUnsub(); _portalChatUnsub = null; }
  if (_portalMsgUnsub)  { _portalMsgUnsub();  _portalMsgUnsub  = null; }

  app.innerHTML = shell('Mensajes', `
    <div class="company-chat-layout">
      <aside class="company-chat-sidebar" id="chat-sidebar">
        <div class="company-chat-sidebar-head">
          <h2>Mensajes</h2>
          <span class="muted small" id="chat-conv-count">Cargando…</span>
        </div>
        <div class="company-chat-list" id="chat-conv-list">
          <div class="xp-loading"><div class="xp-spinner"></div></div>
        </div>
      </aside>
      <section class="company-chat-thread" id="chat-thread">
        <div class="company-chat-empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>Selecciona una conversación</p>
        </div>
      </section>
    </div>
  `, 'company');

  const listEl   = document.getElementById('chat-conv-list');
  const countEl  = document.getElementById('chat-conv-count');
  const threadEl = document.getElementById('chat-thread');
  let _activeChatId = openChatId || null;

  // ── Renderizar hilo de mensajes ──────────────────────────
  function openThread(chatMeta) {
    _activeChatId = chatMeta.chatId;
    if (_portalMsgUnsub) { _portalMsgUnsub(); _portalMsgUnsub = null; }

    // Marcar conversación activa en sidebar
    listEl.querySelectorAll('.chat-conv-item').forEach(el =>
      el.classList.toggle('active', el.dataset.chatId === chatMeta.chatId)
    );

    threadEl.innerHTML = `
      <div class="company-chat-thread-header">
        <span class="xp-chat-avatar">${escapeHtml((chatMeta.userName||'?')[0].toUpperCase())}</span>
        <div>
          <strong>${escapeHtml(chatMeta.userName || chatMeta.userEmail || 'Cliente')}</strong>
          <span class="muted small">${escapeHtml(chatMeta.userEmail || '')}</span>
        </div>
      </div>
      <div class="xp-chat-messages company-thread-messages" id="portal-chat-msgs">
        <div class="xp-chat-loading">Cargando mensajes…</div>
      </div>
      <form class="xp-chat-input-row" id="portal-chat-form" autocomplete="off">
        <input type="text" class="xp-chat-input" id="portal-chat-input"
          placeholder="Responder…" maxlength="2000" required>
        <button type="submit" class="xp-chat-send" aria-label="Enviar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>`;

    const msgsEl  = document.getElementById('portal-chat-msgs');
    const form    = document.getElementById('portal-chat-form');
    const input   = document.getElementById('portal-chat-input');
    const account = getCustomerAccount();

    function scrollBottom() { msgsEl.scrollTop = msgsEl.scrollHeight; }

    // Escuchar mensajes en tiempo real
    _portalMsgUnsub = listenChatMessages(chatMeta.chatId, msgs => {
      if (!msgs.length) {
        msgsEl.innerHTML = '<div class="xp-chat-empty">Sin mensajes aún.</div>';
        return;
      }
      const wasAtBottom = msgsEl.scrollHeight - msgsEl.scrollTop <= msgsEl.clientHeight + 60;
      msgsEl.innerHTML = msgs.map(m => {
        const isMe = m.senderRole === 'company';
        const time = new Date(m.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        return `<div class="xp-chat-msg ${isMe ? 'mine' : 'theirs'}">
          <div class="xp-chat-bubble">${escapeHtml(m.text)}</div>
          <span class="xp-chat-time">${isMe ? '' : escapeHtml(m.senderName||'Cliente') + ' · '}${time}</span>
        </div>`;
      }).join('');
      if (wasAtBottom) scrollBottom();
      markChatRead(chatMeta.chatId, 'company').catch(() => {});
    });

    // Enviar
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const btn = form.querySelector('.xp-chat-send');
      btn.disabled = true;
      input.value = '';
      try {
        await sendChatMessage(chatMeta.chatId, text, 'company');
        scrollBottom();
      } catch (err) {
        input.value = text;
        alert('No se pudo enviar: ' + err.message);
      } finally {
        btn.disabled = false;
        input.focus();
      }
    });

    markChatRead(chatMeta.chatId, 'company').catch(() => {});
    setTimeout(() => input.focus(), 100);
  }

  // ── Escuchar lista de conversaciones en tiempo real ──────
  _portalChatUnsub = listenCompanyChats(companyId, chats => {
    const total = chats.reduce((a, c) => a + (c.unreadCompany || 0), 0);
    countEl.textContent = `${chats.length} conversación${chats.length !== 1 ? 'es' : ''}`;

    // Actualizar badge nav
    const badge = document.getElementById('nav-chat-unread');
    if (badge) {
      badge.style.display = total > 0 ? 'inline-flex' : 'none';
      badge.textContent = total > 9 ? '9+' : String(total);
    }

    if (!chats.length) {
      listEl.innerHTML = '<div class="xp-chat-empty" style="padding:1.5rem">Ningún cliente te ha escrito todavía.</div>';
      return;
    }

    listEl.innerHTML = chats.map(ch => {
      const unread = ch.unreadCompany || 0;
      const ts = ch.lastMessageAt
        ? new Date(ch.lastMessageAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '';
      return `<div class="chat-conv-item ${ch.chatId === _activeChatId ? 'active' : ''}"
                   data-chat-id="${escapeHtml(ch.chatId)}">
        <span class="xp-chat-avatar sm">${escapeHtml((ch.userName||'?')[0].toUpperCase())}</span>
        <div class="chat-conv-body">
          <div class="chat-conv-top">
            <strong>${escapeHtml(ch.userName || ch.userEmail || 'Cliente')}</strong>
            <span class="chat-conv-time">${ts}</span>
          </div>
          <div class="chat-conv-preview">${escapeHtml(ch.lastMessage || '…')}</div>
        </div>
        ${unread > 0 ? `<span class="chat-unread-dot">${unread}</span>` : ''}
      </div>`;
    }).join('');

    // Listeners en cada conversación
    listEl.querySelectorAll('.chat-conv-item').forEach(el => {
      el.addEventListener('click', () => {
        const meta = chats.find(ch => ch.chatId === el.dataset.chatId);
        if (meta) openThread(meta);
      });
    });

    // Abrir la primera o la que estaba abierta
    if (_activeChatId) {
      const meta = chats.find(ch => ch.chatId === _activeChatId);
      if (meta) openThread(meta);
    } else if (chats.length) {
      openThread(chats[0]);
    }
  });
}


// ── Arranque portal empresa ───────────────────────────────────
async function initPortalApp(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="xp-loading"><div class="xp-spinner"></div><p>Conectando…</p></div>`;
  try{
    await _xpBootstrap({pageType:'portal'});
    window.addEventListener('hashchange',render);
    // Si ya hay sesión de empresa activa, ir directo al panel
    if(!location.hash||location.hash==='#/'){
      if(currentCompanySessionId()){
        setHashRoute('/company-admin');
      }else{
        setHashRoute('/');
      }
    }
    render();
  }catch(e){
    _xpBootstrapError(e,'portal.html');
  }
}
initPortalApp();

})();
