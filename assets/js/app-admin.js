/**
 * Xperiences Admin — app-admin.js v5.0
 * Panel administrador maestro. Completamente separado de la app pública.
 * Requiere: Firebase SDKs + firebase-config.js + seed.js + core.js
 */
(function(){
'use strict';


function renderAdminLogin(){
  const bootstrapPending=isBootstrapPending();
  app.innerHTML=shell('Acceso admin',`<section class="auth-grid ${bootstrapPending?'':'single-auth'}"><section class="panel auth-panel"><div class="panel-head"><h2>Administrador</h2></div><form id="admin-login-form" class="form-grid"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><div class="full button-row"><button type="submit">Entrar</button></div><p class="muted small">Acceso exclusivo del equipo interno mediante Firebase Auth.</p></form><div id="admin-login-msg" class="save-hint"></div></section>${bootstrapPending?`<section class="panel auth-panel"><div class="panel-head"><h2>Alta inicial</h2></div><form id="admin-bootstrap-form" class="form-grid"><label>Nombre<input name="displayName" autocomplete="name" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="new-password" minlength="6" required></label><div class="full button-row"><button type="submit">Crear primer administrador</button></div><p class="muted small">Solo disponible hasta que exista el primer admin.</p></form><div id="admin-bootstrap-msg" class="save-hint"></div></section>`:''}</section>`,'admin');
  app.querySelector('#admin-login-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget.elements;try{await loginPanelAccount(f.email.value,f.password.value,'admin');setHashRoute('/admin');}catch(error){saveMsg('#admin-login-msg',mapAuthError(error),4500);}});
  app.querySelector('#admin-bootstrap-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget.elements;try{await bootstrapAdminAccount({displayName:f.displayName.value,email:f.email.value,password:f.password.value});setHashRoute('/admin');}catch(error){saveMsg('#admin-bootstrap-msg',mapAuthError(error),4500);}});
}

function renderAdminDashboard(){
  const companies=getCompanies(),analytics=getAnalytics();
  const bookings=getBookings();
  const failed=(analytics.searches||[]).filter(s=>s.noResults).length;
  const ready=companies.filter(c=>isSearchReady(c)).length;
  const account=getCustomerAccount();
  const roles=getProfileRoles(account?.profile||{});
  const boot=getSystemConfig();

  // ── Preparar datos para gráficos ──────────────────────────
  // Búsquedas últimos 7 días
  const now=Date.now();
  const dayMs=24*60*60*1000;
  const searchesByDay=Array.from({length:7},(_,i)=>{
    const dayStart=new Date(now-(6-i)*dayMs);dayStart.setHours(0,0,0,0);
    const dayEnd=new Date(dayStart.getTime()+dayMs);
    return{label:dayStart.toLocaleDateString('es-ES',{weekday:'short',day:'numeric'}),
      total:(analytics.searches||[]).filter(s=>new Date(s.createdAt)>=dayStart&&new Date(s.createdAt)<dayEnd).length,
      failed:(analytics.searches||[]).filter(s=>s.noResults&&new Date(s.createdAt)>=dayStart&&new Date(s.createdAt)<dayEnd).length};
  });
  // Reservas por empresa (top 5)
  const bookingsByCompany={};
  (analytics.bookings||[]).forEach(b=>{bookingsByCompany[b.companyName||b.companyId]=(bookingsByCompany[b.companyName||b.companyId]||0)+1;});
  const topCompanies=Object.entries(bookingsByCompany).sort((a,b)=>b[1]-a[1]).slice(0,5);
  // Búsquedas con y sin resultado (donut)
  const totalSearches=analytics.searches.length;
  const withResults=totalSearches-failed;

  app.innerHTML=shell('Dashboard maestro',`
    <!-- KPIs -->
    <section class="admin-grid four kpi-row">
      <a href="#/admin/companies" class="metric-card kpi-card">
        <div class="kpi-icon kpi-blue"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <strong>${companies.length}</strong><span>Empresas</span>
        <div class="kpi-sub">${ready} preparadas para buscador</div>
      </a>
      <a href="#/admin/analytics" class="metric-card kpi-card">
        <div class="kpi-icon kpi-green"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
        <strong>${analytics.searches.length}</strong><span>Búsquedas</span>
        <div class="kpi-sub">${failed} sin resultado</div>
      </a>
      <a href="#/admin/analytics" class="metric-card kpi-card">
        <div class="kpi-icon kpi-amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>
        <strong>${bookings.length}</strong><span>Reservas</span>
        <div class="kpi-sub">${bookings.filter(b=>Date.now()-new Date(b.createdAt).getTime()<7*24*60*60*1000).length} esta semana</div>
      </a>
      <a href="#/admin/analytics" class="metric-card kpi-card">
        <div class="kpi-icon kpi-teal"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
        <strong>${analytics.companyViews.length}</strong><span>Fichas vistas</span>
        <div class="kpi-sub">${analytics.companyViews.filter(v=>Date.now()-new Date(v.createdAt).getTime()<24*60*60*1000).length} hoy</div>
      </a>
    </section>

    <!-- Gráficos -->
    <section class="admin-charts-grid">
      <div class="panel chart-panel">
        <div class="panel-head between"><h2>Búsquedas — últimos 7 días</h2></div>
        <div class="chart-wrap"><canvas id="chart-searches" height="200"></canvas></div>
      </div>
      <div class="panel chart-panel">
        <div class="panel-head between"><h2>Tasa de éxito de búsquedas</h2></div>
        <div class="chart-wrap chart-donut-wrap"><canvas id="chart-donut" height="180"></canvas>
        <div class="donut-center-label"><strong>${totalSearches?Math.round(withResults/totalSearches*100):0}%</strong><span>con resultado</span></div></div>
      </div>
      ${topCompanies.length?`<div class="panel chart-panel chart-panel-wide">
        <div class="panel-head between"><h2>Empresas con más reservas</h2></div>
        <div class="chart-wrap"><canvas id="chart-companies" height="180"></canvas></div>
      </div>`:''}
    </section>

    <!-- Cuenta admin -->
    <section class="panel">
      <div class="panel-head between"><h2>Cuenta administradora</h2></div>
      <div class="save-hint">Sesión: <code>${escapeHtml(account?.email||'-')}</code> · Bootstrap: <code>${boot.adminBootstrapCompleted?'cerrado':'pendiente'}</code></div>
      <div class="button-row" style="margin-top:1rem"><button id="admin-reset-password" class="secondary">Enviar reseteo de contraseña</button><span class="save-hint" id="admin-reset-msg" style="margin-left:1rem"></span></div>
    </section>

    <!-- Tabla resumen empresas -->
    <section class="panel">
      <div class="panel-head between"><h2>Estado del catálogo</h2><a href="#/admin/companies">Gestionar →</a></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Empresa</th><th>Experiencias</th><th>Ofertas</th><th>Ficha</th><th>Estado buscador</th><th>Actualizado</th></tr></thead>
        <tbody>${companies.map(c=>{const info=companyCompleteness(c);return `<tr>
          <td><a href="#/admin/company/${c.id}">${escapeHtml(c.name)}</a></td>
          <td>${(c.experiences||[]).length}</td>
          <td>${(c.experiences||[]).reduce((a,e)=>a+(e.offers||[]).filter(o=>o.active).length,0)}</td>
          <td><div class="completeness-bar"><div class="completeness-fill" style="width:${info.score}%"></div></div><span class="muted small">${info.score}%</span></td>
          <td>${isSearchReady(c)?'<span class="status-pill status-ok">Lista</span>':'<span class="status-pill status-warn">Incompleta</span>'}</td>
          <td class="muted small">${c.updatedAt?new Date(c.updatedAt).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'-'}</td>
        </tr>`;}).join('')}</tbody>
      </table></div>
    </section>
  `,'admin');

  app.querySelector('#admin-reset-password')?.addEventListener('click',async()=>{try{await sendCustomerReset(account?.email||'');saveMsg('#admin-reset-msg','Correo enviado.',4500);}catch(err){saveMsg('#admin-reset-msg',mapAuthError(err),4500);}});

  // ── Cargar Chart.js y renderizar gráficos ─────────────────
  function loadChartJs(cb){
    if(window.Chart){cb();return;}
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload=cb;document.head.appendChild(s);
  }

  loadChartJs(()=>{
    // Palette
    const blue='rgba(55,138,221,0.85)',blueL='rgba(55,138,221,0.25)';
    const red='rgba(226,75,74,0.75)',redL='rgba(226,75,74,0.2)';
    const teal='rgba(29,158,117,0.85)',amber='rgba(186,117,23,0.85)';
    const grid='rgba(128,128,128,0.12)',tick='rgba(128,128,128,0.7)';
    const font={family:'system-ui,sans-serif',size:12};

    Chart.defaults.font=font;
    Chart.defaults.color=tick;

    // Bar chart: búsquedas 7 días
    const ctxBar=app.querySelector('#chart-searches')?.getContext('2d');
    if(ctxBar){
      new Chart(ctxBar,{type:'bar',data:{
        labels:searchesByDay.map(d=>d.label),
        datasets:[
          {label:'Total',data:searchesByDay.map(d=>d.total),backgroundColor:blue,borderRadius:4,borderSkipped:false},
          {label:'Sin resultado',data:searchesByDay.map(d=>d.failed),backgroundColor:red,borderRadius:4,borderSkipped:false}
        ]
      },options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{
        x:{grid:{color:grid}},y:{grid:{color:grid},ticks:{precision:0}}
      }}});
    }

    // Donut: tasa de éxito
    const ctxDonut=app.querySelector('#chart-donut')?.getContext('2d');
    if(ctxDonut&&totalSearches>0){
      new Chart(ctxDonut,{type:'doughnut',data:{
        labels:['Con resultado','Sin resultado'],
        datasets:[{data:[withResults,failed],backgroundColor:[teal,red],borderWidth:0,hoverOffset:4}]
      },options:{responsive:true,maintainAspectRatio:false,cutout:'72%',
        plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/totalSearches*100)}%)`}}}
      }});
    }else if(ctxDonut){
      const p=ctxDonut.canvas.parentElement;p.innerHTML='<p class="muted" style="text-align:center;padding:2rem">Sin datos de búsqueda aún</p>';
    }

    // Horizontal bar: top empresas
    const ctxComp=app.querySelector('#chart-companies')?.getContext('2d');
    if(ctxComp&&topCompanies.length){
      new Chart(ctxComp,{type:'bar',data:{
        labels:topCompanies.map(([name])=>name.length>18?name.slice(0,16)+'…':name),
        datasets:[{label:'Reservas',data:topCompanies.map(([,v])=>v),backgroundColor:amber,borderRadius:4,borderSkipped:false}]
      },options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{grid:{color:grid},ticks:{precision:0}},y:{grid:{color:grid}}}
      }});
    }
  });
}


function renderAdminCompanies(){
  const companies=getCompanies();
  app.innerHTML=shell('Empresas',`<section class="panel"><div class="panel-head between"><h2>Empresas</h2><div class="button-row"><button id="add-company">Nueva empresa</button><button id="clear-companies" class="secondary">Vaciar empresas</button></div></div><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Tipo</th><th>Ciudad</th><th>Experiencias</th><th>Ofertas activas</th><th>Ficha</th><th>Preparada</th><th>Última actualización</th><th>Acceso empresa</th><th>Acciones</th></tr></thead><tbody>${companies.length?companies.map(c=>{const info=companyCompleteness(c);const portal=c.portalAuth||{};return `<tr><td>${escapeHtml(c.name||'(sin nombre)')}</td><td>${escapeHtml(c.businessType||'')}</td><td>${escapeHtml(c.city||'')}</td><td>${(c.experiences||[]).length}</td><td>${(c.experiences||[]).reduce((acc,exp)=>acc+(exp.offers||[]).filter(o=>o.active).length,0)}</td><td>${info.score}%</td><td>${isSearchReady(c)?'<span class="status-pill">Sí</span>':'<span class="status-pill muted-pill">No</span>'}</td><td>${c.updatedAt?new Date(c.updatedAt).toLocaleString('es-ES'):'-'}</td><td><div class="cred-mini"><strong>${escapeHtml(portal.email||'-')}</strong><span>${escapeHtml(portal.uid?'activa':'sin cuenta')}</span></div></td><td><div class="button-row"><a href="#/admin/company/${c.id}">Editar</a><button type="button" class="secondary" data-delete-company="${c.id}">Eliminar</button></div></td></tr>`;}).join(''):`<tr><td colspan="10" class="muted">No hay empresas dadas de alta.</td></tr>`}</tbody></table></div><div class="save-hint">Gestión de acceso empresa desde cada ficha. Portal empresa: <a href="portal.html" target="_blank">portal.html</a></div></section>`,'admin');
  const btn=app.querySelector('#add-company');if(btn)btn.addEventListener('click',()=>{const company=addCompany({name:'',businessType:'',city:'',companyDescription:'',imageUrl:''});setHashRoute(`/admin/company/${company.id}`);});
  const clearBtn=app.querySelector('#clear-companies');if(clearBtn)clearBtn.addEventListener('click',async()=>{if(window.confirm&& !window.confirm('Se eliminarán todas las empresas de Firestore. ¿Continuar?'))return;await clearCompanies();render();});
  app.querySelectorAll('[data-delete-company]').forEach(btn=>btn.addEventListener('click',async()=>{if(window.confirm&& !window.confirm('Esta empresa se eliminará de Firestore. ¿Continuar?'))return;await deleteCompany(btn.dataset.deleteCompany);render();}));
}


function renderAdminCompanyDetail(companyId){
  const company=getCompanyById(companyId);
  if(!company){app.innerHTML=shell('Empresa no encontrada','<div class="empty-card">No existe la empresa solicitada.</div>','admin');return;}
  const selected=company.experiences[0]||{id:uid('exp'),title:'',venueType:company.businessType,description:'',intentTags:[],audienceTags:[],contextTags:[],reasonHighlights:[],manualSearchTags:[],weatherSensitivity:'medium',indoorOutdoor:'mixed',searchPresets:['general'],audiencePresets:['general'],contextPresets:['dia'],active:true,offers:[]};
  const inferred=inferPresetFromExperience(selected);
  selected.searchPresets=presetArray(selected,'searchPresets','searchPreset',inferred.searchPreset||'general');
  selected.audiencePresets=presetArray(selected,'audiencePresets','audiencePreset',inferred.audiencePreset||'general');
  selected.contextPresets=presetArray(selected,'contextPresets','contextPreset',inferred.contextPreset||'dia');
  const options={searchPresets:[['general','General'],['plan_familiar','Plan familiar'],['restaurante_familiar','Restaurante familiar'],['actividad','Actividad / ocio'],['restauracion','Restauración'],['romantico','Plan romántico'],['cena_romantica','Cena romántica'],['indoor','Plan indoor / lluvia']],audiencePresets:[['general','General'],['familia','Familias'],['pareja','Parejas'],['grupos','Grupos / amigos']],contextPresets:[['dia','De día'],['tarde','Por la tarde'],['noche','Por la noche']]};
  const checks=(name,opts,selectedValues)=>`<div class="check-grid">${opts.map(([value,label])=>`<label class="check-item"><input type="checkbox" name="${name}" value="${value}" ${selectedValues.includes(value)?'checked':''}> <span>${label}</span></label>`).join('')}</div>`;
  app.innerHTML=shell(`Empresa · ${company.name||'Nueva empresa'}`,`<section class="admin-two-cols"><section class="panel"><div class="panel-head between"><h2>Perfil de empresa</h2><a class="status-pill" target="_blank" href="portal.html">Portal empresa ↗</a></div><div class="save-hint">Acceso empresa · correo: <code>${escapeHtml(company.portalAuth?.email||"-")}</code> · estado: <code>${escapeHtml(company.portalAuth?.uid?"activa":"sin cuenta")}</code></div><div class="quality-box">${(()=>{const info=companyCompleteness(company);return `<strong>Ficha preparada: ${info.score}%</strong><div class="muted">${info.missing.length?`Faltan: ${escapeHtml(info.missing.join(', '))}`:'La empresa está lista para el buscador.'}</div>`;})()}</div><div class="plan-panel">
          <div class="plan-panel-head">
            <div>
              <strong class="plan-name-display">${getPlanLimits(company).label}</strong>
              <span class="plan-commission-display">· comisión ${Math.round(getPlanLimits(company).commission*100)}%</span>
            </div>
            ${(()=>{
              const limits=getPlanLimits(company);
              const daysLeft=getTrialDaysLeft(company);
              const status=company.subscription?.status||'active';
              const label={active:'Activo',trial:'Trial',overdue:'Con deuda',cancelled:'Cancelado'}[status]||'Activo';
              const cls = limits.trialExpired ? 'plan-status-expired'
                : daysLeft !== null && daysLeft <= 7 ? 'plan-status-trial-urgent'
                : `plan-status-${status}`;
              const extra = daysLeft !== null && daysLeft > 0 ? ` · ${daysLeft}d`
                : limits.trialExpired ? ' · EXPIRADO' : '';
              return `<span class="plan-status-pill ${cls}">${label}${extra}</span>`;
            })()}
          </div>
          <div class="plan-meta">
            ${company.subscription?.trialEndsAt?`<span>Trial hasta: <strong>${company.subscription.trialEndsAt}</strong>${getTrialDaysLeft(company)===0?' <em style="color:#f87">— expirado</em>':''}</span>`:''} 
            ${company.subscription?.renewsAt?`<span>Renueva: <strong>${company.subscription.renewsAt}</strong></span>`:''}
            ${company.subscription?.stripeSubscriptionId?`<span class="plan-stripe-id">Stripe: <code>${escapeHtml(company.subscription.stripeSubscriptionId)}</code></span>`:''}
          </div>
          <div class="plan-selector">
            <select id="plan-select">
              ${Object.entries(PLANS).map(([key,p])=>`<option value="${key}" ${(company.subscription?.plan||'trial')===key?'selected':''}>${escapeHtml(p.label)} — ${Math.round(p.commission*100)}%${p.monthlyFee?` · ${p.monthlyFee}€/mes`:' (sin cuota)'}</option>`).join('')}
            </select>
            <select id="plan-status-select">
              <option value="active" ${(company.subscription?.status||'active')==='active'?'selected':''}>Activo</option>
              <option value="trial" ${company.subscription?.status==='trial'?'selected':''}>Trial</option>
              <option value="overdue" ${company.subscription?.status==='overdue'?'selected':''}>Con deuda</option>
              <option value="cancelled" ${company.subscription?.status==='cancelled'?'selected':''}>Cancelado</option>
            </select>
            <button type="button" id="save-plan-btn">Guardar plan</button>
          </div>
          <span class="save-hint" id="plan-save-msg"></span>
        </div>
        <form id="company-auth-form" class="form-grid auth-inline-panel"><label>Email de acceso empresa<input type="email" name="portalEmail" value="${escapeHtml(company.portalAuth?.email||'')}" ${company.portalAuth?.uid?'disabled':''} placeholder="correo@empresa.com"></label><label>Contraseña temporal<input type="password" name="portalPassword" ${company.portalAuth?.uid?'disabled':''} placeholder="${company.portalAuth?.uid?'Cuenta ya creada':'Mínimo 6 caracteres'}"></label><div class="full button-row">${company.portalAuth?.uid?'<button type="button" id="company-send-reset" class="secondary">Enviar reseteo de contraseña</button>':'<button type="submit">Crear acceso empresa</button>'}<span class="save-hint" id="company-auth-msg"></span></div></form><form id="company-form" class="form-grid"><label>Nombre<input name="name" value="${escapeHtml(company.name)}" placeholder="Ej: Rancho El Pino" required></label><label>Tipo de plan de negocio<input name="businessType" value="${escapeHtml(company.businessType||'')}" placeholder="Ej: parque acuático, restaurante italiano"></label><label>Ciudad<input name="city" value="${escapeHtml(company.city||'')}" placeholder="Ej: Las Palmas de Gran Canaria"></label><div class="full form-section-head"><strong>Ubicación</strong><span class="muted small" style="font-weight:400;margin-left:8px">Busca o haz clic en el mapa</span></div>
         <div class="full location-bar">
           <input type="search" id="admin-map-search" placeholder="Buscar dirección…" autocomplete="off">
           <button type="button" id="admin-gps-btn" class="secondary gps-btn" title="GPS">
             <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>GPS
           </button>
         </div>
         <div class="full" id="admin-map-container" style="height:240px;border-radius:var(--border-radius-lg);overflow:hidden;border:0.5px solid var(--color-border-secondary);margin:.25rem 0"></div>
         <div class="full map-coords-row"><span id="admin-map-coords" class="muted small">${(company.lat!=null&&company.lat!=='')?`📍 ${Number(company.lat).toFixed(6)}, ${Number(company.lng).toFixed(6)}`:'Sin ubicación seleccionada'}</span></div>
         <input type="hidden" name="lat" id="admin-hidden-lat" value="${company.lat??''}">
         <input type="hidden" name="lng" id="admin-hidden-lng" value="${company.lng??''}"><label>Estado operativo<select name="operationalStatus">${['active','trial','paused_non_payment','paused_quality','suspended','cancelled'].map(v=>`<option value="${v}" ${company.operationalStatus===v?'selected':''}>${statusLabel('operationalStatus',v)}</option>`).join('')}</select></label><label>Estado financiero<select name="financeStatus">${['active','trial','overdue','cancelled'].map(v=>`<option value="${v}" ${company.financeStatus===v?'selected':''}>${statusLabel('financeStatus',v)}</option>`).join('')}</select></label><label>Mostrar con deuda<input type="checkbox" name="graceVisible" ${company.graceVisible?'checked':''}></label><label>Sostenibilidad (1-5)<input type="number" min="1" max="5" name="sustainabilityLevel" value="${Number(company.sustainabilityLevel||3)}"></label><label>Climatología base (1-5)<input type="number" min="1" max="5" name="weatherScore" value="${Number(company.weatherScore||3)}"></label><label>Imagen URL<input name="imageUrl" value="${escapeHtml(company.imageUrl||'')}" placeholder="https://…  (o sube una imagen abajo)"></label><label class="full">Descripción del negocio<textarea name="companyDescription" placeholder="Describe brevemente el negocio y lo que ofrece al cliente…">${escapeHtml(company.companyDescription||'')}</textarea></label><label class="full">Notas internas<textarea name="notes" placeholder="Notas internas del equipo de Xperiences (no visibles al cliente)">${escapeHtml(company.notes||'')}</textarea></label><div class="full button-row"><button type="submit">Guardar empresa</button><span class="save-hint" id="company-form-msg">Última actualización: ${company.updatedAt?new Date(company.updatedAt).toLocaleString('es-ES'):'sin cambios aún'}</span></div></form></section><section class="panel"><div class="panel-head between"><h2>Experiencias</h2><button id="new-exp">Nueva experiencia</button></div><div class="experience-admin-list">${company.experiences.map(exp=>`<button class="experience-pill" type="button" data-pick-exp="${exp.id}">${escapeHtml(exp.title)}</button>`).join('')||'<p class="muted">No hay experiencias todavía.</p>'}</div><form id="experience-form" class="form-grid"><input type="hidden" name="experienceId" value="${selected.id}"><label>Título<input name="title" value="${escapeHtml(selected.title||'')}" required placeholder="Ej: Parque acuático familiar"></label><label>Tipo de plan de experiencia<input name="venueType" value="${escapeHtml(selected.venueType||'')}" placeholder="Ej: parque acuático, restaurante familiar"></label><label class="full">Perfil para el buscador${checks('searchPresets',options.searchPresets,selected.searchPresets)}</label><label class="full">Público principal${checks('audiencePresets',options.audiencePresets,selected.audiencePresets)}</label><label class="full">Momento ideal${checks('contextPresets',options.contextPresets,selected.contextPresets)}</label><label>Interior / exterior<select name="indoorOutdoor"><option value="indoor" ${selected.indoorOutdoor==='indoor'?'selected':''}>Interior</option><option value="mixed" ${selected.indoorOutdoor==='mixed'?'selected':''}>Mixto</option><option value="outdoor" ${selected.indoorOutdoor==='outdoor'?'selected':''}>Exterior</option></select></label><label>Sensibilidad climática<select name="weatherSensitivity"><option value="low" ${selected.weatherSensitivity==='low'?'selected':''}>Baja</option><option value="medium" ${selected.weatherSensitivity==='medium'?'selected':''}>Media</option><option value="high" ${selected.weatherSensitivity==='high'?'selected':''}>Alta</option></select></label><label class="full">Descripción de la experiencia<textarea name="description" placeholder="Describe la experiencia: qué incluye, qué hace especial a esta actividad, qué puede esperar el cliente…">${escapeHtml(selected.description||'')}</textarea></label><label class="full">Etiquetas manuales para buscador<input name="manualSearchTags" value="${escapeHtml((selected.manualSearchTags||[]).join(', '))}" placeholder="Ej: paseo a caballo, ruta ecuestre, cena romántica, menú degustación…"></label><details class="full"><summary>Etiquetas avanzadas</summary><div class="form-grid" style="margin-top:.75rem"><label>Etiquetas de intención<input name="intentTags" value="${escapeHtml((selected.intentTags||[]).join(', '))}"></label><label>Etiquetas de audiencia<input name="audienceTags" value="${escapeHtml((selected.audienceTags||[]).join(', '))}"></label><label>Etiquetas de contexto<input name="contextTags" value="${escapeHtml((selected.contextTags||[]).join(', '))}"></label><label class="full">Razones destacadas<input name="reasonHighlights" value="${escapeHtml((selected.reasonHighlights||[]).join(', '))}"></label></div></details><label>Activa<input type="checkbox" name="active" ${selected.active?'checked':''}></label><div class="full button-row"><button type="submit">Guardar experiencia</button><span class="save-hint" id="experience-form-msg">${selected.updatedAt?`Actualizado: ${new Date(selected.updatedAt).toLocaleString('es-ES')}`:'Nueva experiencia'}</span>${company.experiences.length?'<button type="button" id="delete-exp" class="secondary">Eliminar experiencia</button>':''}</div></form></section></section><section class="panel"><div class="panel-head between"><h2>Ofertas</h2><button id="new-offer">Nueva oferta</button></div><div id="offers-host"></div></section>`,'admin');

  const getChecked=(name)=>[...app.querySelectorAll(`#experience-form input[name="${name}"]:checked`)].map(el=>el.value);
  function currentExperience(){const expId=app.querySelector('#experience-form [name="experienceId"]').value;return getCompanyById(companyId)?.experiences.find(e=>e.id===expId)||null;}
  function refreshOffers(){
    const exp=currentExperience();const host=app.querySelector('#offers-host');
    if(!exp){host.innerHTML='<p class="muted">Crea o selecciona una experiencia para editar sus ofertas.</p>';return;}
    host.innerHTML=(exp.offers||[]).length?exp.offers.map(offer=>`<form class="offer-form panel nested" data-offer-id="${offer.id}"><label>Nombre<input name="name" value="${escapeHtml(offer.name)}" placeholder="Ej: Entrada adulto, Menú individual, Ruta 2h…"></label><label>Precio<input type="number" name="price" min="0" step="1" value="${Number(offer.price||0)}"></label><label class="full">Observaciones / detalles<textarea name="details" placeholder="Incluye, precio base, condiciones…">${escapeHtml(offer.details||'')}</textarea></label><label>Activa<input type="checkbox" name="active" ${offer.active?'checked':''}></label><div class="full button-row"><button type="submit">Guardar oferta</button><button type="button" class="secondary" data-delete-offer="${offer.id}">Eliminar</button></div></form>`).join(''):'<p class="muted">No hay ofertas todavía.</p>';
    host.querySelectorAll('.offer-form').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const expNow=currentExperience();if(!expNow)return;upsertOffer(companyId,expNow.id,{id:form.dataset.offerId,name:form.elements.name.value.trim(),price:Number(form.elements.price.value||0),details:form.elements.details.value.trim(),active:form.elements.active.checked});refreshOffers();saveMsg(form.querySelector('span.save-hint, button[type="submit"]'),'Oferta guardada');}));
    host.querySelectorAll('[data-delete-offer]').forEach(btn=>btn.addEventListener('click',()=>{const expNow=currentExperience();if(!expNow)return;deleteOffer(companyId,expNow.id,btn.dataset.deleteOffer);refreshOffers();}));
  }
  refreshOffers();

  // ── Map for admin company detail ─────────────────────────
  (function initAdminMap(){
    const hasLoc=company.lat!=null&&company.lat!==''&&company.lng!=null&&company.lng!=='';
    let _map=null,_marker=null;
    let _lat=hasLoc?Number(company.lat):null;
    let _lng=hasLoc?Number(company.lng):null;

    function setCoords(lat,lng,confirm=false){
      if(confirm&&_lat!==null){if(!window.confirm('¿Cambiar la ubicación de la empresa?'))return;}
      _lat=lat;_lng=lng;
      const hLat=app.querySelector('#admin-hidden-lat');
      const hLng=app.querySelector('#admin-hidden-lng');
      const disp=app.querySelector('#admin-map-coords');
      if(hLat)hLat.value=lat.toFixed(6);
      if(hLng)hLng.value=lng.toFixed(6);
      if(disp)disp.textContent=`📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      if(_marker)_marker.setLatLng([lat,lng]);
      else{_marker=L.marker([lat,lng],{draggable:true}).addTo(_map);_marker.on('dragend',()=>{const p=_marker.getLatLng();setCoords(p.lat,p.lng);});}
      _map.setView([lat,lng],15);
    }

    function buildMap(){
      const dLat=_lat||28.1248,dLng=_lng||-15.4300;
      _map=L.map('admin-map-container').setView([dLat,dLng],_lat?15:9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(_map);
      if(_lat&&_lng){_marker=L.marker([_lat,_lng],{draggable:true}).addTo(_map);_marker.on('dragend',()=>{const p=_marker.getLatLng();setCoords(p.lat,p.lng);});}
      _map.on('click',e=>setCoords(e.latlng.lat,e.latlng.lng,true));
    }

    function loadLeaflet(cb){
      if(typeof L!=='undefined'){cb();return;}
      const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css);
      const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.onload=cb;document.head.appendChild(js);
    }
    setTimeout(()=>loadLeaflet(buildMap),120);

    let _st;
    app.querySelector('#admin-map-search')?.addEventListener('input',e=>{
      clearTimeout(_st);const q=(e.target.value||'').trim();if(q.length<3)return;
      _st=setTimeout(async()=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);const d=await r.json();if(d[0])setCoords(parseFloat(d[0].lat),parseFloat(d[0].lon),true);}catch(e){}},700);
    });
    app.querySelector('#admin-map-search')?.addEventListener('keydown',async e=>{
      if(e.key!=='Enter')return;e.preventDefault();const q=(e.target.value||'').trim();if(!q)return;
      try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);const d=await r.json();if(d[0])setCoords(parseFloat(d[0].lat),parseFloat(d[0].lon),true);else saveMsg('#company-form-msg','Dirección no encontrada',3000);}catch(e){}
    });
    app.querySelector('#admin-gps-btn')?.addEventListener('click',()=>{
      requestUserLocation((coords,err)=>{if(!coords){saveMsg('#company-form-msg',err==='insecure'?'Requiere HTTPS':'GPS no disponible',3000);return;}setCoords(coords.lat,coords.lng,true);saveMsg('#company-form-msg','✓ GPS obtenido');});
    });
  })();


  // ── Gestión de plan ────────────────────────────────────────
  app.querySelector('#save-plan-btn')?.addEventListener('click',()=>{
    const planKey=app.querySelector('#plan-select')?.value||'trial';
    const status=app.querySelector('#plan-status-select')?.value||'active';
    const now=nowIso();
    const trialEnds=new Date(Date.now()+90*24*60*60*1000).toISOString().slice(0,10);
    saveCompanyProfile(companyId,{
      subscription:{
        ...(getCompanyById(companyId)?.subscription||{}),
        plan:planKey,
        status,
        commission:PLANS[planKey]?.commission||0.10,
        monthlyFee:PLANS[planKey]?.monthlyFee||0,
        trialEndsAt:planKey==='trial'?(getCompanyById(companyId)?.subscription?.trialEndsAt||trialEnds):(getCompanyById(companyId)?.subscription?.trialEndsAt||''),
        updatedAt:now
      }
    });
    saveMsg('#plan-save-msg','✓ Plan actualizado',3000);
    // Refrescar vista para mostrar nuevo plan
    setTimeout(()=>renderAdminCompanyDetail(companyId),400);
  });

  app.querySelector('#company-auth-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget.elements;try{const created=await provisionCompanyPortalAccount(companyId,{email:f.portalEmail.value,password:f.portalPassword.value,displayName:company.name});saveMsg('#company-auth-msg',`Cuenta creada: ${created.email}`,4500);render();}catch(error){saveMsg('#company-auth-msg',mapAuthError(error),4500);}});
  app.querySelector('#company-send-reset')?.addEventListener('click',async()=>{try{await sendCompanyPortalReset(companyId);saveMsg('#company-auth-msg','Correo de reseteo enviado.',4500);}catch(error){saveMsg('#company-auth-msg',mapAuthError(error),4500);}});
  app.querySelector('#company-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;saveCompanyProfile(companyId,{name:f.elements.name.value.trim(),businessType:f.elements.businessType.value.trim(),city:f.elements.city.value.trim(),lat:f.elements.lat.value.trim()===''?null:Number(f.elements.lat.value),lng:f.elements.lng.value.trim()===''?null:Number(f.elements.lng.value),operationalStatus:f.elements.operationalStatus.value,financeStatus:f.elements.financeStatus.value,graceVisible:f.elements.graceVisible.checked,sustainabilityLevel:Number(f.elements.sustainabilityLevel.value||3),weatherScore:Number(f.elements.weatherScore.value||3),imageUrl:f.elements.imageUrl.value.trim(),companyDescription:f.elements.companyDescription.value.trim(),notes:f.elements.notes.value.trim()});saveMsg('#company-form-msg','✓ Empresa guardada',3000);});
  app.querySelector('#experience-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const selectedSearchPresets=getChecked('searchPresets');const selectedAudiencePresets=getChecked('audiencePresets');const selectedContextPresets=getChecked('contextPresets');const presetTags=presetsToTags(selectedSearchPresets,selectedAudiencePresets,selectedContextPresets,f.elements.indoorOutdoor.value,f.elements.venueType.value.trim());const manualSearchTags=parseTags(f.elements.manualSearchTags.value);const manualIntent=parseTags(f.elements.intentTags.value);const manualAudience=parseTags(f.elements.audienceTags.value);const manualContext=parseTags(f.elements.contextTags.value);const manualReasons=parseTags(f.elements.reasonHighlights.value);const mergeUnique=(...groups)=>[...new Set(groups.flat().filter(Boolean))];upsertExperience(companyId,{id:f.elements.experienceId.value.trim()||uid('exp'),title:f.elements.title.value.trim(),venueType:f.elements.venueType.value.trim(),description:f.elements.description.value.trim(),searchPresets:selectedSearchPresets.length?selectedSearchPresets:['general'],audiencePresets:selectedAudiencePresets.length?selectedAudiencePresets:['general'],contextPresets:selectedContextPresets.length?selectedContextPresets:['dia'],indoorOutdoor:f.elements.indoorOutdoor.value,weatherSensitivity:f.elements.weatherSensitivity.value,manualSearchTags,manualTagText:f.elements.manualSearchTags.value.trim(),intentTags:mergeUnique(presetTags.intentTags,manualSearchTags,manualIntent),audienceTags:mergeUnique(presetTags.audienceTags,manualAudience),contextTags:mergeUnique(presetTags.contextTags,manualContext),reasonHighlights:mergeUnique(presetTags.reasonHighlights,manualReasons),active:f.elements.active.checked});saveMsg('#experience-form-msg','✓ Experiencia guardada — cambios activos en buscador',3500);refreshOffers();});
  app.querySelectorAll('[data-pick-exp]').forEach(btn=>btn.addEventListener('click',()=>{const exp=getCompanyById(companyId).experiences.find(e=>e.id===btn.dataset.pickExp);const inferred=inferPresetFromExperience(exp);const form=app.querySelector('#experience-form');form.elements.experienceId.value=exp.id;form.elements.title.value=exp.title||'';form.elements.venueType.value=exp.venueType||'';form.elements.description.value=exp.description||'';form.elements.indoorOutdoor.value=exp.indoorOutdoor||'mixed';form.elements.weatherSensitivity.value=exp.weatherSensitivity||'medium';form.elements.manualSearchTags.value=(exp.manualSearchTags||[]).join(', ');form.elements.intentTags.value=(exp.intentTags||[]).join(', ');form.elements.audienceTags.value=(exp.audienceTags||[]).join(', ');form.elements.contextTags.value=(exp.contextTags||[]).join(', ');form.elements.reasonHighlights.value=(exp.reasonHighlights||[]).join(', ');form.elements.active.checked=exp.active!==false;const searchVals=presetArray(exp,'searchPresets','searchPreset',inferred.searchPreset||'general');const audienceVals=presetArray(exp,'audiencePresets','audiencePreset',inferred.audiencePreset||'general');const contextVals=presetArray(exp,'contextPresets','contextPreset',inferred.contextPreset||'dia');app.querySelectorAll('#experience-form input[name="searchPresets"]').forEach(el=>el.checked=searchVals.includes(el.value));app.querySelectorAll('#experience-form input[name="audiencePresets"]').forEach(el=>el.checked=audienceVals.includes(el.value));app.querySelectorAll('#experience-form input[name="contextPresets"]').forEach(el=>el.checked=contextVals.includes(el.value));refreshOffers();}));
  app.querySelector('#new-exp').addEventListener('click',()=>{const form=app.querySelector('#experience-form');form.reset();form.elements.experienceId.value=uid('exp');form.elements.venueType.value=getCompanyById(companyId).businessType;form.elements.indoorOutdoor.value='mixed';form.elements.weatherSensitivity.value='medium';form.elements.active.checked=true;app.querySelectorAll('#experience-form input[name="searchPresets"]').forEach(el=>el.checked=el.value==='general');app.querySelectorAll('#experience-form input[name="audiencePresets"]').forEach(el=>el.checked=el.value==='general');app.querySelectorAll('#experience-form input[name="contextPresets"]').forEach(el=>el.checked=el.value==='dia');refreshOffers();});
  const deleteExpBtn=app.querySelector('#delete-exp');if(deleteExpBtn)deleteExpBtn.addEventListener('click',()=>{const expId=app.querySelector('#experience-form [name="experienceId"]').value;if(!expId)return;deleteExperience(companyId,expId);saveMsg('#experience-form-msg','Experiencia eliminada');refreshOffers();});
  app.querySelector('#new-offer').addEventListener('click',()=>{const exp=currentExperience();if(!exp){saveMsg('#experience-form-msg','Selecciona primero una experiencia',3000);return;}upsertOffer(companyId,exp.id,{id:uid('offer'),name:'Nueva oferta',price:0,details:'',active:true});refreshOffers();saveMsg('#experience-form-msg','✓ Nueva oferta creada');});
}

function renderAdminAnalytics(){
  const analytics=getAnalytics(),bookings=getBookings();const recent=bookings.filter(b=>Date.now()-new Date(b.createdAt).getTime()<=30*24*60*60*1000);const failed=(analytics.searches||[]).filter(s=>s.noResults).length;const topFailed=groupedFailedSearches(analytics.searches||[]);const byExperience={};(analytics.companyViews||[]).forEach(v=>{const key=`${v.companyId}::${v.experienceId||'none'}`;byExperience[key]=byExperience[key]||{companyId:v.companyId,experienceId:v.experienceId,views:0,bookings:0};byExperience[key].views++;});(analytics.bookings||[]).forEach(v=>{const key=`${v.companyId||''}::${v.experienceId||''}`;byExperience[key]=byExperience[key]||{companyId:v.companyId,experienceId:v.experienceId,views:0,bookings:0};byExperience[key].bookings++;});const rows=Object.values(byExperience).sort((a,b)=>(b.bookings*3+b.views)-(a.bookings*3+a.views)).slice(0,10).map(r=>{const c=getCompanyById(r.companyId);const e=c?.experiences?.find(x=>x.id===r.experienceId);return `<tr><td>${escapeHtml(c?.name||r.companyId||'-')}</td><td>${escapeHtml(e?.title||'Sin experiencia')}</td><td>${r.views}</td><td>${r.bookings}</td></tr>`;}).join('');
  app.innerHTML=shell('Reservas y analítica',`<section class="admin-grid four"><div class="metric-card"><strong>${analytics.searches.length}</strong><span>Búsquedas</span></div><div class="metric-card"><strong>${analytics.companyViews.length}</strong><span>Fichas vistas</span></div><div class="metric-card"><strong>${bookings.length}</strong><span>Reservas</span></div><div class="metric-card"><strong>${failed}</strong><span>Búsquedas sin resultado</span></div></section><section class="panel"><div class="panel-head"><h2>Reservas últimos 30 días</h2></div>${recent.length?`<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Oferta</th><th>Cantidad</th><th>Total</th><th>Fecha</th></tr></thead><tbody>${recent.map(r=>`<tr><td>${escapeHtml(r.companyName)}</td><td>${escapeHtml(r.offerName)}</td><td>${r.quantity}</td><td>${formatEuro(r.totalPrice)}</td><td>${new Date(r.createdAt).toLocaleString('es-ES')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No hay reservas recientes.</p>'}</section><section class="panel"><div class="panel-head"><h2>Experiencias con mejor respuesta</h2></div>${rows?`<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Experiencia</th><th>Fichas vistas</th><th>Reservas</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="muted">Sin datos todavía.</p>'}</section><section class="panel"><div class="panel-head"><h2>Búsquedas fallidas agrupadas</h2></div>${topFailed.length?`<div class="table-wrap"><table><thead><tr><th>Consulta</th><th>Veces</th><th>Última vez</th></tr></thead><tbody>${topFailed.map(r=>`<tr><td>${escapeHtml(r.query)}</td><td>${r.count}</td><td>${new Date(r.lastSeen).toLocaleString('es-ES')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Sin búsquedas fallidas.</p>'}</section><section class="panel"><div class="panel-head"><h2>Búsquedas recientes</h2></div>${(analytics.searches||[]).length?`<div class="table-wrap"><table><thead><tr><th>Consulta</th><th>Resultados</th><th>Fecha</th></tr></thead><tbody>${analytics.searches.map(r=>`<tr><td>${escapeHtml(r.query)}</td><td>${r.count}${r.noResults?' · sin resultados':''}</td><td>${new Date(r.createdAt).toLocaleString('es-ES')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Sin búsquedas.</p>'}</section>`,'admin');
}
function renderAdminFinance(){
  const companies=getCompanies();
  app.innerHTML=shell('Finanzas',`<section class="panel"><div class="panel-head"><h2>Estado financiero de empresas</h2></div><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Estado financiero</th><th>Operativa</th><th>Mostrar con deuda</th><th>Prioridad</th></tr></thead><tbody>${companies.map(c=>`<tr><td><a href="#/admin/company/${c.id}">${escapeHtml(c.name)}</a></td><td><select data-finance-status="${c.id}">${['active','trial','overdue','cancelled'].map(v=>`<option value="${v}" ${c.financeStatus===v?'selected':''}>${statusLabel('financeStatus',v)}</option>`).join('')}</select></td><td><select data-operational-status="${c.id}">${['active','trial','paused_non_payment','paused_quality','suspended','cancelled'].map(v=>`<option value="${v}" ${c.operationalStatus===v?'selected':''}>${statusLabel('operationalStatus',v)}</option>`).join('')}</select></td><td><label class="inline-check"><input type="checkbox" data-grace-visible="${c.id}" ${c.graceVisible?'checked':''}>Sí</label></td><td><select data-search-priority="${c.id}">${Array.from({length:10},(_,i)=>i+1).map(v=>`<option value="${v}" ${Number(c.searchPriority||5)===v?'selected':''}>${v}/10</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></section>`,'admin');
  app.querySelectorAll('[data-finance-status]').forEach(el=>el.addEventListener('change',()=>{saveCompanyProfile(el.dataset.financeStatus,{financeStatus:el.value});}));
  app.querySelectorAll('[data-operational-status]').forEach(el=>el.addEventListener('change',()=>{saveCompanyProfile(el.dataset.operationalStatus,{operationalStatus:el.value});}));
  app.querySelectorAll('[data-grace-visible]').forEach(el=>el.addEventListener('change',()=>{saveCompanyProfile(el.dataset.graceVisible,{graceVisible:el.checked});}));
  app.querySelectorAll('[data-search-priority]').forEach(el=>el.addEventListener('change',()=>{saveCompanyProfile(el.dataset.searchPriority,{searchPriority:Number(el.value||5)});}));
}
function renderAdminSearchQuality(){
  const cfg=loadState().rankingConfig||{},analytics=getAnalytics();const failed=(analytics.searches||[]).filter(s=>s.noResults).slice(0,8);const incomplete=getCompanies().map(c=>({company:c,info:companyCompleteness(c)})).filter(row=>!isSearchReady(row.company)).sort((a,b)=>a.info.score-b.info.score).slice(0,10);
  app.innerHTML=shell('Calidad de búsqueda',`<section class="panel"><div class="panel-head"><h2>Pesos de ranking</h2></div><form id="search-quality-form" class="form-grid small"><label>Umbral romántico<input type="number" min="1" max="10" name="romanticThreshold" value="${cfg.romanticThreshold||4}"></label><label>Umbral familiar<input type="number" min="1" max="10" name="familyThreshold" value="${cfg.familyThreshold||4}"></label><label>Umbral familiar restauración<input type="number" min="1" max="10" name="familyDiningThreshold" value="${cfg.familyDiningThreshold||3}"></label><label>Umbral indoor<input type="number" min="1" max="10" name="indoorThreshold" value="${cfg.indoorThreshold||3}"></label><label>Peso semántico<input type="number" min="0" max="10" step="0.1" name="semanticWeight" value="${cfg.semanticWeight||5}"></label><label>Peso climatología<input type="number" min="0" max="10" step="0.1" name="climateWeight" value="${cfg.climateWeight||1.2}"></label><label>Peso sostenibilidad<input type="number" min="0" max="10" step="0.1" name="sustainabilityWeight" value="${cfg.sustainabilityWeight||0.7}"></label><label>Peso cercanía<input type="number" min="0" max="10" step="0.1" name="distanceWeight" value="${cfg.distanceWeight||1}"></label><label>Peso prioridad empresa<input type="number" min="0" max="10" step="0.1" name="companyPriorityWeight" value="${cfg.companyPriorityWeight||1}"></label><label>Peso aprendizaje<input type="number" min="0" max="10" step="0.1" name="learningWeight" value="${cfg.learningWeight||1.4}"></label><div class="full button-row"><button type="submit">Guardar configuración</button></div></form></section><section class="panel"><div class="panel-head"><h2>Búsquedas sin resultado</h2></div>${failed.length?`<div class="table-wrap"><table><thead><tr><th>Consulta</th><th>Fecha</th></tr></thead><tbody>${failed.map(r=>`<tr><td>${escapeHtml(r.query)}</td><td>${new Date(r.createdAt).toLocaleString('es-ES')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No hay búsquedas fallidas recientes.</p>'}</section><section class="panel"><div class="panel-head"><h2>Empresas no preparadas para buscador</h2></div>${incomplete.length?`<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Ficha</th><th>Faltan</th></tr></thead><tbody>${incomplete.map(row=>`<tr><td><a href="#/admin/company/${row.company.id}">${escapeHtml(row.company.name)}</a></td><td>${row.info.score}%</td><td>${escapeHtml(row.info.missing.join(', '))}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Todas las empresas activas tienen una base razonable para buscador.</p>'}</section>`,'admin');
  app.querySelector('#search-quality-form').addEventListener('submit',e=>{e.preventDefault();const s=loadState(),f=e.currentTarget.elements;s.rankingConfig.romanticThreshold=Number(f.romanticThreshold.value);s.rankingConfig.familyThreshold=Number(f.familyThreshold.value);s.rankingConfig.familyDiningThreshold=Number(f.familyDiningThreshold.value);s.rankingConfig.indoorThreshold=Number(f.indoorThreshold.value);s.rankingConfig.semanticWeight=Number(f.semanticWeight.value);s.rankingConfig.climateWeight=Number(f.climateWeight.value);s.rankingConfig.sustainabilityWeight=Number(f.sustainabilityWeight.value);s.rankingConfig.distanceWeight=Number(f.distanceWeight.value);s.rankingConfig.companyPriorityWeight=Number(f.companyPriorityWeight.value);s.rankingConfig.learningWeight=Number(f.learningWeight.value);saveState(s,'public');saveMsg(e.currentTarget.querySelector('button[type="submit"]'),'✓ Configuración guardada',3000);});
}



// ── Enrutador admin master ────────────────────────────────────
function render(){
  const route=routeQuery();
  try{
    if(route.path==='/logout'){
      logoutCustomerAccount().then(()=>{
        // Redirigir a la app pública, no al login de admin
        location.href='index.html';
      }).catch(()=>{ location.href='index.html'; });
      return;
    }
    if(route.path==='/'||route.path===''||route.path==='/login'){
      // Si ya está logueado como admin → ir directo al dashboard
      if(isAdminLogged())return setHashRoute('/admin');
      return renderAdminLogin();
    }
    if(route.path==='/admin'){if(!requireAdmin())return;return renderAdminDashboard();}
    if(route.path==='/admin/companies'){if(!requireAdmin())return;return renderAdminCompanies();}
    if(route.path.startsWith('/admin/company/')){if(!requireAdmin())return;return renderAdminCompanyDetail(decodeURIComponent(route.path.split('/')[3]||''));}
    if(route.path==='/admin/analytics'){if(!requireAdmin())return;return renderAdminAnalytics();}
    if(route.path==='/admin/finance'){if(!requireAdmin())return;return renderAdminFinance();}
    if(route.path==='/admin/search-quality'){if(!requireAdmin())return;return renderAdminSearchQuality();}
    app.innerHTML=`<div class="error-screen"><h1>Página no encontrada</h1><a href="#/admin">Volver al dashboard</a></div>`;
  }catch(err){
    console.error('[XP] admin render:',err);
    const _back=isAdminLogged()?'#/admin/companies':'#/login';app.innerHTML=`<div class="error-screen"><h1>Error en el panel</h1><p class="muted">${escapeHtml(err.message||String(err))}</p><div class="button-row"><button onclick="location.reload()">Reintentar</button><a class="button-link secondary-link" href="${_back}">Volver</a></div></div>`;
  }
}

// ── Arranque admin master ─────────────────────────────────────
async function initAdminApp(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="xp-loading"><div class="xp-spinner"></div><p>Conectando…</p></div>`;
  try{
    await _xpBootstrap({pageType:'admin'});
    window.addEventListener('hashchange',render);
    // Si ya está logueado como admin, ir al dashboard; si no, al login
    if(!location.hash||location.hash==='#/'||location.hash==='#/login'){
      if(isAdminLogged()){
        setHashRoute('/admin');
      }else{
        setHashRoute('/login');
      }
    }
    render();
  }catch(e){
    _xpBootstrapError(e,'admin.html#/login');
  }
}
initAdminApp();

})();
