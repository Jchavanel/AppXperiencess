/**
 * Xperiences — app-public.js v5.0
 * App pública: buscador, resultados, ficha empresa, carrito, cuenta usuario.
 * Requiere: Firebase SDKs + firebase-config.js + seed.js + core.js
 */
(function(){
'use strict';

// ══════════════════════════════════════════════════════════════
// STARFIELD — sistema de partículas dinámicas sobre canvas
// ══════════════════════════════════════════════════════════════
(function initStarfield() {
  // Compatibilidad: si no hay canvas (muy raro) salimos sin error
  if (typeof document === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.id = 'xp-starfield';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  // ── Configuración de partículas ──────────────────────────────
  const PARTICLE_COUNT = 88;

  // Paleta: distintos tonos azul-blanco como los originales
  const COLORS = [
    [200, 230, 255],  // azul muy claro
    [180, 215, 255],  // azul claro
    [220, 240, 255],  // casi blanco-azul
    [255, 255, 255],  // blanco puro (pocas)
    [140, 195, 255],  // azul medio
  ];

  let W = 0, H = 0;
  let particles = [];
  let raf = null;
  let lastResize = 0;

  // ── Clase partícula ──────────────────────────────────────────
  function Particle(fullRandom) {
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.r = col[0]; this.g = col[1]; this.b = col[2];

    if (fullRandom) {
      // Posición aleatoria por toda la pantalla al inicializar
      this.x = Math.random() * W;
      this.y = Math.random() * H;
    } else {
      // Entran por un borde aleatorio
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0)      { this.x = Math.random() * W; this.y = -4; }
      else if (edge === 1) { this.x = W + 4;              this.y = Math.random() * H; }
      else if (edge === 2) { this.x = Math.random() * W; this.y = H + 4; }
      else                 { this.x = -4;                  this.y = Math.random() * H; }
    }

    // Velocidad: lenta y suave, con componente aleatoria pequeña
    const angle  = Math.random() * Math.PI * 2;
    const speed  = 0.12 + Math.random() * 0.38;  // muy lento
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    // Tamaño: entre 1 y 2.4 px de radio
    this.size   = 0.7 + Math.random() * 1.7;

    // Opacidad base y variación de parpadeo
    this.baseAlpha  = 0.28 + Math.random() * 0.55;
    this.alpha      = this.baseAlpha;
    this.twinkleSpd = 0.006 + Math.random() * 0.018;
    this.twinkleOff = Math.random() * Math.PI * 2;  // fase inicial aleatoria
    this.age        = 0;

    // Cada partícula vive entre 18 y 55 segundos (en frames a 60fps)
    this.life     = (1100 + Math.random() * 2200) | 0;
    this.fadeIn   = (40 + Math.random() * 60)   | 0;
    this.fadeOut  = (60 + Math.random() * 80)   | 0;
  }

  Particle.prototype.update = function() {
    this.x  += this.vx;
    this.y  += this.vy;
    this.age++;

    // Parpadeo suave usando seno
    const twinkle = Math.sin(this.age * this.twinkleSpd + this.twinkleOff);
    const flicker = this.baseAlpha + twinkle * (this.baseAlpha * 0.35);

    // Fade in / fade out al nacer y morir
    let fade = 1;
    if (this.age < this.fadeIn) {
      fade = this.age / this.fadeIn;
    } else if (this.age > this.life - this.fadeOut) {
      fade = Math.max(0, (this.life - this.age) / this.fadeOut);
    }

    this.alpha = flicker * fade;
  };

  Particle.prototype.isDead = function() {
    return this.age >= this.life ||
           this.x < -20 || this.x > W + 20 ||
           this.y < -20 || this.y > H + 20;
  };

  Particle.prototype.draw = function() {
    if (this.alpha <= 0.01) return;
    ctx.beginPath();
    // Halo suave: círculo grande muy transparente
    const grd = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.size * 2.8
    );
    grd.addColorStop(0,   `rgba(${this.r},${this.g},${this.b},${(this.alpha).toFixed(3)})`);
    grd.addColorStop(0.45,`rgba(${this.r},${this.g},${this.b},${(this.alpha * 0.4).toFixed(3)})`);
    grd.addColorStop(1,   `rgba(${this.r},${this.g},${this.b},0)`);
    ctx.fillStyle = grd;
    ctx.arc(this.x, this.y, this.size * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo sólido
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${Math.min(1, this.alpha * 1.3).toFixed(3)})`;
    ctx.fill();
  };

  // ── Resize handler ───────────────────────────────────────────
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', () => {
    const now = Date.now();
    if (now - lastResize < 100) return;
    lastResize = now;
    resize();
  });

  // ── Init partículas distribuidas por toda la pantalla ────────
  function init() {
    resize();
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle(true));
      // Envejecemos artificialmente para que no todas nazcan a la vez
      const p = particles[i];
      const skipFrames = Math.floor(Math.random() * p.life * 0.85);
      for (let f = 0; f < skipFrames; f++) p.update();
    }
  }

  // ── Loop principal ───────────────────────────────────────────
  function loop() {
    ctx.clearRect(0, 0, W, H);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      if (p.isDead()) {
        // Reemplazar por una nueva que entra desde un borde
        particles[i] = new Particle(false);
      } else {
        p.draw();
      }
    }

    raf = requestAnimationFrame(loop);
  }

  // ── Pausa cuando la pestaña está oculta (ahorro de CPU) ──────
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(loop);
    }
  });

  init();
  loop();
})();

// ── HOME con chips y autocompletado ──
function renderHome(){
  const chips=getPopularChips();
  const chipsHtml=chips.map(q=>`<button type="button" class="search-chip" data-chip="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('');
  app.innerHTML=shell('Buscador por intención',`
    <section class="hero hero-search">
      <div class="hero-card hero-card-search">
        <div class="search-intro">
          <h1>Encuentra el plan perfecto en el momento exacto</h1>
          <p>Escribe lo que te apetece hacer y encontraremos las experiencias más coherentes para ti.</p>
        </div>
        <form id="search-form" class="search-box search-box-integrated" autocomplete="off">
          <div class="search-field-wrap">
            <span class="search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
            <input id="search-input" type="search" placeholder="Ej: Cena romántica con mi pareja" enterkeyhint="search" autocomplete="off">
            <span class="search-hint">Enter para buscar</span>
            <div id="autocomplete-dropdown" class="autocomplete-dropdown" hidden></div>
          </div>
        </form>
        <div class="search-chips" id="search-chips">${chipsHtml}</div>
      </div>
    </section>`,'public');

  const input=app.querySelector('#search-input');
  const dropdown=app.querySelector('#autocomplete-dropdown');
  const allTags=getAllSearchTags();

  const go=q=>{const val=(q||input.value).trim();if(val)setHashRoute(`/results?q=${encodeURIComponent(val)}`);};

  // Autocompletado
  let acTimer;
  input.addEventListener('input',()=>{
    clearTimeout(acTimer);
    acTimer=setTimeout(()=>{
      const val=normalizeText(input.value);
      if(val.length<2){dropdown.hidden=true;return;}
      const matches=allTags.filter(t=>normalizeText(t).includes(val)).slice(0,6);
      if(!matches.length){dropdown.hidden=true;return;}
      dropdown.innerHTML=matches.map(t=>`<button type="button" class="ac-item" data-val="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');
      dropdown.hidden=false;
    },140);
  });
  dropdown.addEventListener('click',e=>{
    const btn=e.target.closest('.ac-item');
    if(btn){input.value=btn.dataset.val;dropdown.hidden=true;go(btn.dataset.val);}
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.search-field-wrap'))dropdown.hidden=true;},{once:false,capture:false});

  app.querySelector('#search-form').addEventListener('submit',e=>{e.preventDefault();dropdown.hidden=true;go();});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dropdown.hidden=true;go();}});
  // Chips de búsquedas populares
  app.querySelectorAll('.search-chip').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.chip)));
}

// ── RESULTADOS con filtros, chips en cards y sugerencias ──
function renderResults(query,filtersOverride){
  const RESULTS_PER_PAGE=6;
  const filters={...(filtersOverride||{})};
  const requestedPage=Math.max(1,Number(filters.page||routeQuery().params.get('page')||1));
  delete filters.page;
  const {results:allResults,userLocation}=runSearch(query,filters);
  const totalResults=allResults.length;
  const totalPages=Math.max(1,Math.ceil(totalResults/RESULTS_PER_PAGE));
  const page=Math.min(requestedPage,totalPages);
  const pageStart=(page-1)*RESULTS_PER_PAGE;
  const results=allResults.slice(pageStart,pageStart+RESULTS_PER_PAGE);

  const suggestionsHtml=()=>{
    const chips=getPopularChips().filter(c=>normalizeText(c)!==normalizeText(query)).slice(0,5);
    return chips.map(q=>`<button type="button" class="search-chip" data-chip="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('');
  };

  const cardTagsHtml=item=>{
    const tags=(item.displayTags||[]).filter(Boolean).slice(0,3);
    if(!tags.length)return '';
    return `<div class="card-tags">${tags.map(t=>`<span class="card-tag">${escapeHtml(t)}</span>`).join('')}</div>`;
  };

  const publicExtra=`<form id="results-search-mini" class="mini-search-bar" autocomplete="off"><input id="results-search-input" type="search" value="${escapeHtml(query)}" placeholder="Nueva búsqueda"><span class="mini-search-hint">Enter</span></form>`;

  const filterBar=`<div class="results-filter-bar">
    <div class="filter-group">
      <label class="filter-label">Tipo</label>
      <div class="filter-pills">
        <button type="button" class="fpill ${!filters.kind||filters.kind==='todos'?'active':''}" data-filter-kind="todos">Todos</button>
        <button type="button" class="fpill ${filters.kind==='actividad'?'active':''}" data-filter-kind="actividad">Actividades</button>
        <button type="button" class="fpill ${filters.kind==='restauracion'?'active':''}" data-filter-kind="restauracion">Restauración</button>
      </div>
    </div>
    <div class="filter-group">
      <label class="filter-label">Ordenar</label>
      <div class="filter-pills">
        <button type="button" class="fpill ${!filters.sort||filters.sort==='relevancia'?'active':''}" data-filter-sort="relevancia">Relevancia</button>
        <button type="button" class="fpill ${filters.sort==='precio-asc'?'active':''}" data-filter-sort="precio-asc">Precio ↑</button>
        <button type="button" class="fpill ${filters.sort==='precio-desc'?'active':''}" data-filter-sort="precio-desc">Precio ↓</button>
      </div>
    </div>
    ${userLocation?`<div class="filter-group"><label class="filter-label">Distancia</label><div class="filter-pills"><button type="button" class="fpill ${filters.onlyNearby?'active':''}" data-filter-nearby="1">Cerca de mí</button></div></div>`:''}
  </div>`;

  const emptyHtml=`<div class="empty-results-card"><div class="empty-icon">🔍</div><h3>Sin resultados para "${escapeHtml(query)}"</h3><p class="muted">Prueba con otros términos o explora estas búsquedas:</p><div class="search-chips">${suggestionsHtml()}</div></div>`;
  const paginationHtml=totalResults>RESULTS_PER_PAGE?`<nav class="results-pagination" aria-label="Paginación de resultados"><button type="button" class="secondary" data-page-nav="prev" ${page<=1?'disabled':''}>Anterior</button><span class="pagination-status">Página ${page} de ${totalPages} · ${totalResults} resultados</span><button type="button" class="secondary" data-page-nav="next" ${page>=totalPages?'disabled':''}>Siguiente</button></nav>`:'';

  app.innerHTML=shell('Resultados',`
    <section class="section-header compact">
      <div><h2>Resultados</h2><p class="muted">${totalResults} resultado(s) para "<strong>${escapeHtml(query)}</strong>" · mostrando ${results.length} por pantalla</p></div>
    </section>
    ${filterBar}
    ${paginationHtml}
    <section class="results-list results-grid-animated">
      ${results.length
        ?results.map((item,i)=>`
          <button class="result-card result-card-list" data-company-link="${item.slug}" data-exp-id="${item.experienceId}" style="animation-delay:${i*50}ms">
            <div class="result-image result-image-list" style="background-image:url('${item.imageUrl}')"></div>
            <div class="result-overlay result-overlay-list">
              <div class="result-content result-content-list">
                <div class="result-rank">#${pageStart+i+1}</div>
                <h3>${escapeHtml(item.companyName)}</h3>
                <p class="result-type">${escapeHtml(item.experienceTitle||item.businessType)}</p>
                <p class="result-desc">${escapeHtml(item.experienceDescription||item.companyDescription)}</p>
                ${cardTagsHtml(item)}
                <div class="result-meta">
                  <span>${weatherIcon(item.weatherScore)}</span>
                  <span>${sustainabilityLeaf(item.sustainabilityLevel)}</span>
                  ${item.distanceKm!=null?`<span class="dist-pill">📍 ${kmLabel(item.distanceKm)}</span>`:''}
                  <span class="city-pill">${escapeHtml(item.city)}</span>
                </div>
              </div>
              <div class="result-side">
                <div class="result-price result-price-list">Desde ${formatEuro(item.minPrice)}</div>
                <span class="result-cta">Ver oferta</span>
              </div>
            </div>
          </button>`).join('')
        :emptyHtml
      }
    </section>
    ${paginationHtml}
  `,'public',{publicExtra});

  const go=()=>{const q=(app.querySelector('#results-search-input')?.value||'').trim();if(q)setHashRoute(`/results?q=${encodeURIComponent(q)}`);};
  const rerender=(nextPage=1,nextFilters=filters)=>renderResults(query,{...nextFilters,page:nextPage});
  app.querySelector('#results-search-mini')?.addEventListener('submit',e=>{e.preventDefault();go();});
  app.querySelector('#results-search-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
  app.querySelectorAll('[data-company-link]').forEach(btn=>btn.addEventListener('click',()=>setHashRoute(`/company/${btn.dataset.companyLink}?q=${encodeURIComponent(query)}&exp=${encodeURIComponent(btn.dataset.expId||'')}`)));

  app.querySelectorAll('[data-filter-kind]').forEach(btn=>btn.addEventListener('click',()=>{
    const f={...filters,kind:btn.dataset.filterKind};
    rerender(1,f);
  }));
  app.querySelectorAll('[data-filter-sort]').forEach(btn=>btn.addEventListener('click',()=>{
    const f={...filters,sort:btn.dataset.filterSort};
    rerender(1,f);
  }));
  app.querySelector('[data-filter-nearby]')?.addEventListener('click',()=>{
    const f={...filters,onlyNearby:!filters.onlyNearby};
    rerender(1,f);
  });
  app.querySelectorAll('[data-page-nav]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=btn.dataset.pageNav==='next'?page+1:page-1;
    rerender(target,filters);
  }));
  app.querySelectorAll('.search-chip[data-chip]').forEach(btn=>btn.addEventListener('click',()=>setHashRoute(`/results?q=${encodeURIComponent(btn.dataset.chip)}`)));
}

function renderCustomerAuth(){const params=routeQuery().params;const mode=params.get('mode')==='register'?'register':'login';const redirect=sanitizeCustomerRedirect(params.get('redirect')||'/account');const customer=getCustomerAccount();app.innerHTML=shell('Tu cuenta Xperiences',`<section class="auth-grid"><section class="panel auth-panel"><div class="panel-head"><h2>${mode==='register'?'Crear cuenta':'Acceder'}</h2></div>${customer?`<div class="save-hint">Sesión iniciada como <strong>${escapeHtml(customer.displayName||customer.email)}</strong>. <a href="#/account">Ir a mi cuenta</a></div>`:''}<form id="customer-auth-form" class="form-grid">${mode==='register'?`<label>Nombre completo<input name="displayName" autocomplete="name" required></label><label>Teléfono<input name="phone" autocomplete="tel"></label>`:''}<label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="${mode==='register'?'new-password':'current-password'}" required></label>${mode==='register'?`<label class="full inline-check"><input type="checkbox" name="marketingOptIn"> Quiero recibir novedades y beneficios de fidelización</label>`:''}<div class="full button-row"><button type="submit">${mode==='register'?'Crear cuenta':'Entrar'}</button>${mode==='login'?`<button type="button" class="secondary" id="customer-reset-btn">Recuperar contraseña</button>`:''}</div><p class="muted small">Beneficios de la cuenta: reserva más rápida, historial de reservas y datos guardados para futuras compras.</p></form><div id="customer-auth-msg" class="save-hint"></div><p class="muted small">${mode==='register'?'¿Ya tienes cuenta?':'¿Aún no tienes cuenta?'} <a href="#/auth?mode=${mode==='register'?'login':'register'}&redirect=${encodeURIComponent(redirect)}">${mode==='register'?'Accede':'Crea tu cuenta'}</a></p></section></section>`,'public');const form=app.querySelector('#customer-auth-form');const msg=app.querySelector('#customer-auth-msg');form?.addEventListener('submit',async e=>{e.preventDefault();msg.textContent='';const f=e.currentTarget.elements;try{if(mode==='register'){await registerCustomerAccount({displayName:f.displayName.value,email:f.email.value,password:f.password.value,phone:f.phone.value,marketingOptIn:f.marketingOptIn.checked});}else{await loginCustomerAccount(f.email.value,f.password.value);}setHashRoute(redirect);}catch(error){saveMsg(msg,mapAuthError(error),4500);}});app.querySelector('#customer-reset-btn')?.addEventListener('click',async()=>{const email=form?.elements?.email?.value||'';try{if(!String(email).trim())throw new Error('Indica tu correo para enviarte el enlace.');await sendCustomerReset(email);saveMsg(msg,'Te hemos enviado un correo para restablecer la contraseña.',4500);}catch(error){saveMsg(msg,mapAuthError(error),4500);}});}
function renderCustomerAccount(){const account=requireCustomerSession('/auth?mode=login&redirect=%2Faccount');if(!account)return;const profile=account.profile||{};const benefits=profile.benefits||{tier:'member',loyaltyPoints:0,bookingCount:0};app.innerHTML=shell('Mi cuenta',`<section class="admin-grid three"><div class="metric-card"><strong>${escapeHtml(String(benefits.tier||'member')).toUpperCase()}</strong><span>Nivel</span></div><div class="metric-card"><strong>${Number(benefits.loyaltyPoints||0)}</strong><span>Puntos</span></div><div class="metric-card"><strong>${Number(benefits.bookingCount||0)}</strong><span>Reservas</span></div></section><section class="panel"><div class="panel-head"><h2>Datos del cliente</h2></div><form id="customer-profile-form" class="form-grid"><label>Nombre completo<input name="displayName" value="${escapeHtml(profile.displayName||account.displayName||'')}" autocomplete="name" required></label><label>Correo electrónico<input value="${escapeHtml(account.email||'')}" disabled></label><label>Teléfono<input name="phone" value="${escapeHtml(profile.phone||account.phone||'')}" autocomplete="tel"></label><label class="inline-check"><input type="checkbox" name="marketingOptIn" ${(profile.preferences?.marketingOptIn)?'checked':''}> Recibir novedades y ventajas</label><div class="full button-row"><button type="submit">Guardar perfil</button><a class="button-link secondary-link" href="#/my-bookings">Ver mis reservas</a></div></form><div id="customer-profile-msg" class="save-hint"></div></section>`,'public');app.querySelector('#customer-profile-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget.elements;try{await saveCustomerProfile({displayName:f.displayName.value,phone:f.phone.value,marketingOptIn:f.marketingOptIn.checked});saveMsg('#customer-profile-msg','Perfil actualizado correctamente.');render();}catch(error){saveMsg('#customer-profile-msg',mapAuthError(error),4500);}});}

function renderCustomerBookings(){const account=requireCustomerSession('/auth?mode=login&redirect=%2Fmy-bookings');if(!account)return;app.innerHTML=shell('Mis reservas',`<section class="panel"><div class="panel-head"><h2>Historial de reservas</h2></div><div class="xp-loading"><div class="xp-spinner"></div><p>Cargando reservas…</p></div></section>`,'public');fetchCustomerBookings().then(rows=>{app.innerHTML=shell('Mis reservas',`<section class="panel"><div class="panel-head between"><h2>Historial de reservas</h2><a class="status-pill" href="#/account">Mi cuenta</a></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Oferta</th><th>Estado</th><th>Total</th><th>Fecha</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.companyName)}</td><td>${escapeHtml(r.offerName)}</td><td>${escapeHtml(r.status||'pending')}</td><td>${formatEuro(r.totalPrice)}</td><td>${new Date(r.createdAt).toLocaleString('es-ES')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Todavía no tienes reservas registradas.</p>'}</section>`,'public');}).catch(error=>{app.innerHTML=shell('Mis reservas',`<section class="panel"><p>${escapeHtml(mapAuthError(error))}</p></section>`,'public');});}

function renderCart(){
  const items=getCart();
  const total=items.reduce((acc,item)=>acc+Number(item.unitPrice||0)*Number(item.quantity||1),0);
  const continueRoute=getLastCompanyRoute();
  const customer=getCustomerAccount();
  const profile=customer?.profile||{};

  const cartItemsHtml=items.map(item=>`
    <article class="panel cart-item">
      <div class="cart-item-main">
        <div class="cart-thumb" style="background-image:url('${item.imageUrl||''}')"></div>
        <div class="cart-item-info">
          <h3>${escapeHtml(item.companyName)}</h3>
          <p class="muted">${escapeHtml(item.experienceTitle)}</p>
          <strong>${escapeHtml(item.offerName)}</strong>
          ${item.details?`<p class="muted small">${escapeHtml(item.details)}</p>`:''}
        </div>
      </div>
      <div class="cart-item-side">
        <div class="qty-stepper">
          <button type="button" class="qty-btn" data-cart-down="${item.id}">−</button>
          <input type="number" min="1" value="${Number(item.quantity||1)}" data-cart-input="${item.id}">
          <button type="button" class="qty-btn" data-cart-up="${item.id}">+</button>
        </div>
        <div class="cart-price">${formatEuro(Number(item.unitPrice||0)*Number(item.quantity||1))}</div>
        <button class="secondary small-btn" data-cart-remove="${item.id}">Eliminar</button>
      </div>
    </article>`).join('');

  // Panel lateral dinámico según sesión
  function buildSidePanel(){
    const cnt=items.reduce((a,i)=>a+Number(i.quantity||1),0);
    const totalFmt=formatEuro(total);
    if(customer){
      return `<aside class="panel cart-summary">
        <h3>Resumen del pedido</h3>
        <div class="summary-row"><span>Artículos</span><span>${cnt}</span></div>
        <div class="summary-row summary-total"><span>Total</span><strong>${totalFmt}</strong></div>
        <form id="cart-booking-form" class="form-grid">
          <label>Nombre<input name="displayName" value="${escapeHtml(profile.displayName||customer.displayName||'')}" autocomplete="name" required></label>
          <label>Email<input value="${escapeHtml(customer.email||'')}" disabled></label>
          <label class="full">Teléfono<input name="phone" value="${escapeHtml(profile.phone||customer.phone||'')}" autocomplete="tel"></label>
          <label class="full">Notas para la reserva<textarea name="notes" placeholder="Alergias, peticiones especiales…"></textarea></label>
          <label class="full inline-check"><input type="checkbox" name="marketingOptIn" ${(profile.preferences?.marketingOptIn)?'checked':''}> Quiero recibir ventajas</label>
          <div class="full button-row cart-actions">
            <button type="submit">Confirmar reserva</button>
            <button type="button" class="secondary" id="clear-cart">Vaciar</button>
          </div>
        </form>
        <div id="cart-msg" class="save-hint"></div>
      </aside>`;
    }
    return `<aside class="panel cart-summary cart-auth-panel">
      <div class="summary-row"><span>Artículos</span><span>${cnt}</span></div>
      <div class="summary-row summary-total"><span>Total</span><strong>${totalFmt}</strong></div>
      <div class="cart-auth-divider"><span>Para confirmar tu reserva</span></div>
      <div class="cart-auth-tabs">
        <button type="button" class="cart-auth-tab cart-auth-tab-active" id="tab-login">Tengo cuenta</button>
        <button type="button" class="cart-auth-tab" id="tab-register">Soy nuevo</button>
      </div>
      <div id="cart-login-section">
        <form id="cart-login-form" class="form-grid">
          <label class="full">Email<input name="email" type="email" autocomplete="email" required></label>
          <label class="full">Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
          <div class="full button-row"><button type="submit">Entrar y reservar</button></div>
          <p class="full"><button type="button" id="cart-reset-btn" class="link-btn">¿Olvidaste la contraseña?</button></p>
        </form>
      </div>
      <div id="cart-register-section" hidden>
        <form id="cart-register-form" class="form-grid">
          <label class="full">Nombre<input name="displayName" autocomplete="name" required></label>
          <label class="full">Email<input name="email" type="email" autocomplete="email" required></label>
          <label class="full">Teléfono<input name="phone" autocomplete="tel"></label>
          <label class="full">Contraseña<input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
          <label class="full inline-check"><input type="checkbox" name="marketingOptIn"> Quiero recibir novedades</label>
          <div class="full button-row"><button type="submit">Crear cuenta y reservar</button></div>
        </form>
      </div>
      <div id="cart-auth-msg" class="save-hint"></div>
      <div class="button-row" style="margin-top:.75rem">
        <button type="button" class="secondary" id="clear-cart">Vaciar carrito</button>
        <a class="secondary-link" href="${continueRoute}">Seguir comprando</a>
      </div>
    </aside>`;
  }

  const emptyContinueLink=`<a href="${continueRoute}">Seguir comprando</a>`;

  app.innerHTML=shell('Tu carrito',`
    <section class="section-header compact">
      <div>
        <h2>Tu carrito</h2>
        <p class="muted">${customer?'Revisa y confirma tu reserva.':'Inicia sesión para confirmar — el carrito no se borra.'}</p>
      </div>
      ${customer?`<a class="secondary-link" href="${continueRoute}">← Seguir comprando</a>`:''}
    </section>
    ${items.length
      ?`<section class="cart-layout"><div class="cart-items">${cartItemsHtml}</div>${buildSidePanel()}</section>`
      :`<div class="empty-card">Tu carrito está vacío. ${emptyContinueLink}</div>`
    }
  `,'public');

  // Qty handlers
  app.querySelectorAll('[data-cart-remove]').forEach(btn=>btn.addEventListener('click',()=>{removeCartItem(btn.dataset.cartRemove);refreshCartBadges();renderCart();}));
  app.querySelectorAll('[data-cart-up]').forEach(btn=>btn.addEventListener('click',()=>{const inp=app.querySelector(`[data-cart-input="${btn.dataset.cartUp}"]`);inp.value=Number(inp.value||1)+1;updateCartItemQuantity(btn.dataset.cartUp,inp.value);}));
  app.querySelectorAll('[data-cart-down]').forEach(btn=>btn.addEventListener('click',()=>{const inp=app.querySelector(`[data-cart-input="${btn.dataset.cartDown}"]`);inp.value=Math.max(1,Number(inp.value||1)-1);updateCartItemQuantity(btn.dataset.cartDown,inp.value);}));
  app.querySelectorAll('[data-cart-input]').forEach(inp=>inp.addEventListener('change',()=>updateCartItemQuantity(inp.dataset.cartInput,Math.max(1,Number(inp.value||1)))));
  app.querySelector('#clear-cart')?.addEventListener('click',()=>{clearCart();refreshCartBadges();renderCart();});

  // Auth tabs
  app.querySelector('#tab-login')?.addEventListener('click',()=>{
    app.querySelector('#cart-login-section').hidden=false;
    app.querySelector('#cart-register-section').hidden=true;
    app.querySelector('#tab-login').classList.add('cart-auth-tab-active');
    app.querySelector('#tab-register').classList.remove('cart-auth-tab-active');
  });
  app.querySelector('#tab-register')?.addEventListener('click',()=>{
    app.querySelector('#cart-register-section').hidden=false;
    app.querySelector('#cart-login-section').hidden=true;
    app.querySelector('#tab-register').classList.add('cart-auth-tab-active');
    app.querySelector('#tab-login').classList.remove('cart-auth-tab-active');
  });

  // Auto-confirm after auth
  async function postAuthConfirm(){
    const acc=getCustomerAccount();const p=acc?.profile||{};
    try{
      const created=await confirmCartBookings({displayName:p.displayName||acc?.displayName||'',phone:p.phone||'',notes:'',marketingOptIn:false});
      refreshCartBadges();
      saveMsg('#cart-auth-msg',created.length?`✓ Reserva confirmada (${created.length} línea${created.length>1?'s':''}).`:'',5000);
      setTimeout(()=>renderCart(),900);
    }catch(err){saveMsg('#cart-auth-msg',mapAuthError(err),4500);}
  }

  app.querySelector('#cart-login-form')?.addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget.elements;
    const btn=e.currentTarget.querySelector('button[type="submit"]');
    btn.textContent='Entrando…';btn.disabled=true;
    try{await loginCustomerAccount(f.email.value,f.password.value);await postAuthConfirm();}
    catch(err){btn.textContent='Entrar y reservar';btn.disabled=false;saveMsg('#cart-auth-msg',mapAuthError(err),4500);}
  });

  app.querySelector('#cart-register-form')?.addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget.elements;
    const btn=e.currentTarget.querySelector('button[type="submit"]');
    btn.textContent='Creando cuenta…';btn.disabled=true;
    try{
      await registerCustomerAccount({displayName:f.displayName.value,email:f.email.value,password:f.password.value,phone:f.phone?.value||'',marketingOptIn:f.marketingOptIn.checked});
      await postAuthConfirm();
    }catch(err){btn.textContent='Crear cuenta y reservar';btn.disabled=false;saveMsg('#cart-auth-msg',mapAuthError(err),4500);}
  });

  app.querySelector('#cart-reset-btn')?.addEventListener('click',async()=>{
    const email=app.querySelector('#cart-login-form [name="email"]')?.value||'';
    if(!email.trim()){saveMsg('#cart-auth-msg','Escribe tu email primero.',3000);return;}
    try{await sendCustomerReset(email);saveMsg('#cart-auth-msg','Correo de recuperación enviado.',4500);}
    catch(err){saveMsg('#cart-auth-msg',mapAuthError(err),4500);}
  });

  app.querySelector('#cart-booking-form')?.addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget.elements;
    try{
      const created=await confirmCartBookings({displayName:f.displayName.value,phone:f.phone.value,notes:f.notes.value,marketingOptIn:f.marketingOptIn.checked});
      refreshCartBadges();renderCart();
      const node=app.querySelector('#cart-msg');
      if(node)node.textContent=created.length?`✓ Reserva registrada (${created.length} línea${created.length>1?'s':''}).`:'';
    }catch(err){saveMsg('#cart-msg',err?.message==='AUTH_REQUIRED'?'Necesitas iniciar sesión para reservar.':mapAuthError(err),4500);}
  });
}


function renderCompany(slug){
  const company=getCompanyBySlug(slug);
  if(!company){app.innerHTML=shell('Empresa no encontrada','<div class="empty-card">No existe la empresa solicitada.</div>','public');return;}
  const query=routeQuery().params.get('q')||'';
  const requestedExpId=routeQuery().params.get('exp')||'';
  setLastCompanyRoute(`index.html#/company/${company?.slug||slug}?q=${encodeURIComponent(query)}&exp=${encodeURIComponent(requestedExpId||'')}`);
  const firstExp=(company.experiences||[]).find(e=>e.id===requestedExpId&&e.active)||(company.experiences||[]).find(e=>e.active)||company.experiences[0];
  trackCompanyView(company.id,company.name,firstExp?.id||null);
  const searchMode=!!requestedExpId;
  const activeExps=(company.experiences||[]).filter(e=>e.active);
  const km=distanceKm(company,loadUserLocation());
  const hasLocation=company.lat!=null&&company.lat!==''&&company.lng!=null&&company.lng!=='';
  const lat=hasLocation?Number(company.lat):null;
  const lng=hasLocation?Number(company.lng):null;
  const mapsUrl=hasLocation?`https://maps.google.com/?q=${lat},${lng}`:'';
  const wazeUrl=hasLocation?`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`:'';

  // Mapa al final de la ficha
  function buildMapHtml(){
    if(!hasLocation)return company.city?`<p class="company-location-text">📍 ${escapeHtml(company.city)}</p>`:'';
    const dist=km!=null?`<span class="map-distance-pill">📍 ${kmLabel(km)}</span>`:'';
    return `<div class="company-map-section">
      <div class="company-map-container" id="company-map"></div>
      <div class="company-map-actions">
        <a class="map-nav-btn map-nav-primary" href="${mapsUrl}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          Cómo llegar
        </a>
        <a class="map-nav-btn map-nav-waze" href="${wazeUrl}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.5 5.3A9 9 0 0 0 3 12a9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-3.5-7.1l-1.3 1.7A7 7 0 0 1 19 12a7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 11.2-5.6L17.5 5.3z"/></svg>
          Waze
        </a>
        ${dist}
      </div>
    </div>`;
  }

  // Tabs de experiencias
  const tabsHtml=activeExps.length>1
    ?`<div class="exp-tab-bar">${activeExps.map(e=>`<button class="exp-tab${firstExp&&e.id===firstExp.id?' exp-tab-active':''}" data-exp="${e.id}">${escapeHtml(e.title)}</button>`).join('')}</div>`
    :'';

  // Hero badges
  function buildBadges(){
    const parts=[];
    if(km!=null)parts.push(`<span class="hero-badge">📍 ${kmLabel(km)}</span>`);
    parts.push(`<span class="hero-badge">${sustainabilityLeaf(company.sustainabilityLevel)}</span>`);
    parts.push(`<span class="hero-badge">${weatherIcon(company.weatherScore)}</span>`);
    return parts.join('');
  }

  const heroImg=company.imageUrl?`<div class="company-hero-img" style="background-image:url('${company.imageUrl}')"></div>`:'';
  const heroType=`${escapeHtml(company.businessType||'')}${company.city?` · ${escapeHtml(company.city)}`:''}`;

  app.innerHTML=shell(company.name,`
    <div class="company-page">
      <div class="company-hero-compact">
        ${heroImg}
        <div class="company-hero-info">
          <a class="company-back-link" href="#/results?q=${encodeURIComponent(query)}">← Resultados</a>
          <h1 class="company-hero-name">${escapeHtml(company.name)}</h1>
          <p class="company-hero-type">${heroType}</p>
          <p class="company-hero-desc">${escapeHtml(company.companyDescription)}</p>
          <div class="company-hero-badges">${buildBadges()}</div>
        </div>
      </div>
      ${tabsHtml}
      <div id="experience-detail"></div>
      ${buildMapHtml()}
    </div>
  `,false);

  // Mini mapa Leaflet (read-only, click abre Google Maps)
  if(hasLocation){
    function initMiniMap(){
      const el=app.querySelector('#company-map');
      if(!el||typeof L==='undefined')return;
      const m=L.map(el,{zoomControl:false,scrollWheelZoom:false,dragging:false,attributionControl:false}).setView([lat,lng],15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(m);
      L.marker([lat,lng],{icon:L.divIcon({
        html:'<div style="width:14px;height:14px;background:#2563eb;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',
        className:'',iconSize:[14,14],iconAnchor:[7,7]
      })}).addTo(m);
      el.addEventListener('click',()=>window.open(mapsUrl,'_blank'));
      el.style.cursor='pointer';
    }
    if(typeof L!=='undefined'){setTimeout(initMiniMap,80);}
    else{
      const lc=document.createElement('link');lc.rel='stylesheet';lc.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(lc);
      const ls=document.createElement('script');ls.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';ls.onload=()=>setTimeout(initMiniMap,80);document.head.appendChild(ls);
    }
  }

  const detail=app.querySelector('#experience-detail');

  function paint(expId){
    const exp=activeExps.find(e=>e.id===expId)||firstExp;
    if(!exp){detail.innerHTML='<div class="empty-card">Esta empresa no tiene experiencias activas.</div>';return;}
    const offers=(exp.offers||[]).filter(o=>o.active)
      .map(o=>({...o,matchScore:scoreOfferForQuery(o,query)}))
      .sort((a,b)=>b.matchScore-a.matchScore||Number(a.price||0)-Number(b.price||0));

    // Solo etiquetas manuales, sin presets de categoría
    const tags=(exp.manualSearchTags||[]).slice(0,4);

    // Construir filas de ofertas
    function buildOfferRows(){
      if(!offers.length)return '<p class="muted">Sin ofertas disponibles en este momento.</p>';
      return `<div class="offers-list">${offers.map((o,i)=>{
        const featured=i===0&&offers.length>1;
        const badge=featured?'<span class="offer-best-badge">Recomendada</span>':'';
        const details=o.details?`<p class="offer-row-details">${escapeHtml(o.details)}</p>`:'';
        return `<div class="offer-row${featured?' offer-row-featured':''}">
          <div class="offer-row-info">
            ${badge}
            <strong class="offer-row-name">${escapeHtml(o.name)}</strong>
            ${details}
          </div>
          <div class="offer-row-action">
            <div class="offer-row-price">${formatEuro(o.price)}</div>
            <div class="qty-stepper compact-qty">
              <button type="button" class="qty-btn" data-qty-down="${o.id}">−</button>
              <input type="number" min="1" value="1" data-qty-input="${o.id}">
              <button type="button" class="qty-btn" data-qty-up="${o.id}">+</button>
            </div>
            <button class="offer-reserve-btn" data-book="${o.id}">Reservar</button>
          </div>
        </div>`;
      }).join('')}</div>`;
    }

    const tagsHtml=tags.length?`<div class="exp-tags">${tags.map(t=>`<button type="button" class="exp-tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div>`:'';
    const descHtml=exp.description?`<p class="exp-description">${escapeHtml(exp.description)}</p>`:'';
    const seeAll=searchMode&&activeExps.length>1?`<p class="exp-see-all"><a href="#/company/${company.slug}">Ver todas las experiencias →</a></p>`:'';

    detail.innerHTML=`<div class="exp-detail-block">${descHtml}${tagsHtml}${seeAll}${buildOfferRows()}</div>`;

    // Qty controls
    detail.querySelectorAll('[data-qty-up]').forEach(btn=>btn.addEventListener('click',()=>{
      const i=detail.querySelector(`[data-qty-input="${btn.dataset.qtyUp}"]`);
      i.value=Number(i.value||1)+1;
    }));
    detail.querySelectorAll('[data-qty-down]').forEach(btn=>btn.addEventListener('click',()=>{
      const i=detail.querySelector(`[data-qty-input="${btn.dataset.qtyDown}"]`);
      i.value=Math.max(1,Number(i.value||1)-1);
    }));

    // Reservar
    detail.querySelectorAll('[data-book]').forEach(btn=>btn.addEventListener('click',()=>{
      const offer=offers.find(o=>o.id===btn.dataset.book);
      const qty=Number(detail.querySelector(`[data-qty-input="${offer.id}"]`).value||1);
      addToCart({company,experience:exp,offer,quantity:qty});
      refreshCartBadges();
      const orig=btn.textContent;
      btn.textContent='✓ Añadido';btn.disabled=true;
      setTimeout(()=>{btn.textContent=orig;btn.disabled=false;},2000);
    }));

    // Tags clicables → búsqueda
    detail.querySelectorAll('.exp-tag-chip[data-tag]').forEach(b=>b.addEventListener('click',()=>setHashRoute(`/results?q=${encodeURIComponent(b.dataset.tag)}`)));
  }

  paint(firstExp?.id);

  app.querySelectorAll('[data-exp]').forEach(btn=>btn.addEventListener('click',()=>{
    app.querySelectorAll('[data-exp]').forEach(v=>v.classList.remove('exp-tab-active'));
    btn.classList.add('exp-tab-active');
    paint(btn.dataset.exp);
  }));
}



// ── Enrutador público ─────────────────────────────────────────
function render(){
  const route=routeQuery();
  try{
    if(route.path==='/user-logout'||route.path==='/logout'){
      logoutCustomerAccount().catch(console.error);
      setHashRoute('/');
      return;
    }
    if(route.path==='/'||route.path==='')return renderHome();
    if(route.path==='/auth')return renderCustomerAuth();
    if(route.path==='/account')return renderCustomerAccount();
    if(route.path==='/my-bookings')return renderCustomerBookings();
    if(route.path==='/results')return renderResults(route.params.get('q')||'');
    if(route.path==='/cart')return renderCart();
    if(route.path.startsWith('/company/'))return renderCompany(decodeURIComponent(route.path.split('/')[2]||''));
    // Redireccionar admin y portal a sus apps
    if(route.path.startsWith('/admin')){location.href='admin.html#/login';return;}
    if(route.path.startsWith('/company')){location.href='portal.html';return;}
    app.innerHTML=`<div class="error-screen"><h1>Página no encontrada</h1><a href="#/">Volver al inicio</a></div>`;
  }catch(err){
    console.error('[XP] render:',err);
    app.innerHTML=`<div class="error-screen"><h1>Error</h1><p>${escapeHtml(err.message||String(err))}</p><button onclick="location.reload()">Reintentar</button></div>`;
  }
}

// ── Arranque app pública ──────────────────────────────────────
async function initPublicApp(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="xp-loading"><div class="xp-spinner"></div><p>Cargando…</p></div>`;
  try{
    await _xpBootstrap({pageType:'public'});
    window.addEventListener('hashchange',render);
    if(!location.hash)location.hash='#/';
    const autoGeo=maybeAutoRequestLocation(()=>render());
    if(!autoGeo)render();
  }catch(e){
    _xpBootstrapError(e,'#/');
  }
}
initPublicApp();

})();
