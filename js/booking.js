/**
 * BARBERSHOP LO DE ALE - MOTOR DE TURNOS MULTISUCURSAL
 * Flujo Mobile-First: Paso 0 (Sede) -> 1 (Servicio) -> 2 (Barbero) -> 3 (Día y hora) -> 4 (Confirmar)
 */

class BookingEngine {
  constructor() {
    this.currentStep = 0;
    this.totalSteps = 4;

    const hoy = new Date();
    this.currentYear = hoy.getFullYear();
    this.currentMonth = hoy.getMonth();

    let fechaInicial = new Date(hoy);
    if (fechaInicial.getDay() === 0) {
      fechaInicial.setDate(fechaInicial.getDate() + 1);
    }

    this.state = {
      sucursal: null,
      service: null,
      barber: null,
      date: this.formatDateYYYYMMDD(fechaInicial),
      time: null,
      assignedBarber: null,
      client: {
        nombre: "",
        telefono: "",
        notas: ""
      }
    };

    this.sucursales = [];
    this.barberos = [];
    this.servicios = [];
    this.servicioEspecialColor = null;

    this.meses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    this.diasCortos = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    this.stepLabels = ["Sede", "Servicio", "Barbero", "Día y hora", "Confirmar"];
  }

  escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async init() {
    this.sucursales = await window.dataService.getSucursales();
    this.barberos = await window.dataService.getBarberos();
    this.servicios = await window.dataService.getServicios();
    this.servicioEspecialColor = await window.dataService.getServicioEspecialColor();

    this.renderBranches();
    this.renderServices();
    this.renderPriceBoard();
    this.renderBarbers();
    this.renderTeamSection();
    this.renderCalendar();
    this.setupEventListeners();
    this.setupCancellationModal();
    this.goToStep(0, true);

    window.addEventListener("lodeale_barberos_actualizados", async () => {
      this.barberos = await window.dataService.getBarberos();
      this.renderBranches();
      this.renderBarbers();
      this.renderTeamSection();
    });
  }

  // Helper: días que un barbero atiende en determinada sucursal
  getDiasEnSucursal(barbero, sucursalId) {
    const dias = [];
    const horarios = barbero?.horarios || {};
    for (let d = 1; d <= 6; d++) {
      const franjas = horarios[d];
      if (Array.isArray(franjas) && franjas.some(f => (f.sucursal_id || "suc_city_bell") === sucursalId)) {
        dias.push(this.diasCortos[d]);
      }
    }
    return dias;
  }

  // Helper: sucursales en las que atiende un barbero
  getSucursalesDeBarbero(barbero) {
    return this.sucursales.filter(s => window.dataService.barberoAtiendeEnSucursal(barbero, s.id));
  }

  // Iniciales limpias (ignora apodos entre paréntesis)
  getInitials(nombre = "") {
    const limpio = nombre.replace(/\(.*?\)/g, "").trim();
    const partes = limpio.split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return limpio.substring(0, 2).toUpperCase();
  }

  // -------------------------------------------------------------
  // PASO 0: SELECCIÓN DE SEDE INTEGRADA (CITY BELL VS VILLA ELISA)
  // -------------------------------------------------------------
  renderBranches() {
    const container = document.getElementById("branches-grid");
    if (!container) return;

    container.innerHTML = this.sucursales.map((s) => {
      const isSelected = this.state.sucursal?.id === s.id;
      const barberosSede = this.barberos.filter(b => window.dataService.barberoAtiendeEnSucursal(b, s.id));
      return `
        <article class="heritage-frame item-card cursor-pointer overflow-hidden flex flex-col justify-between group !bg-[#1B1815] ${
          isSelected ? "selected" : ""
        }" data-branch-id="${s.id}">
          ${
            s.foto
              ? `<div class="relative aspect-[16/9] sm:aspect-auto sm:h-44 overflow-hidden border-b border-mustard/20">
                   <img src="${s.foto}" alt="Barbershop Lo de Ale ${s.nombre}" loading="lazy" decoding="async"
                        class="w-full h-full object-cover photo-vintage img-zoom ${s.slug === 'villa-elisa' ? 'object-[50%_35%]' : 'object-center'}">
                   <div class="absolute inset-0 bg-gradient-to-t from-[#1B1815] via-transparent to-transparent" aria-hidden="true"></div>
                   <span data-open-badge="${s.id}" class="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-md bg-ink/85 backdrop-blur-sm text-[11px] font-semibold tracking-wide border border-mustard/30 text-cream">
                     Lun a Sáb
                   </span>
                   ${
                     isSelected
                       ? `<span class="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-mustard text-black text-[10px] uppercase tracking-[0.14em] font-bold shadow">
                            ✓ Elegida
                          </span>`
                       : `<span class="absolute top-3 right-3 px-2 py-1 rounded-md bg-ink/80 backdrop-blur-sm border border-cream/15 text-[10px] uppercase tracking-[0.12em] text-cream-dim font-semibold">
                            ${barberosSede.length} prof.
                          </span>`
                   }
                 </div>`
              : ""
          }
          <div class="p-4 sm:p-5 flex-1 flex flex-col gap-3">
            <div>
              <h4 class="font-serif-display font-bold text-2xl sm:text-[1.65rem] text-cream group-hover:text-mustard transition-colors leading-tight">${s.nombre}</h4>
            </div>
            <div class="h-px w-full bg-gradient-to-r from-mustard/40 via-mustard/15 to-transparent" aria-hidden="true"></div>
            <div class="space-y-1.5 text-xs sm:text-sm text-cream-dim">
              <p class="flex items-start gap-2.5">
                <span class="text-mustard font-bold uppercase tracking-wider text-[10px] sm:text-[11px] mt-0.5 min-w-[68px] flex-shrink-0">Dirección</span>
                <span>${s.direccion}</span>
              </p>
              <p class="flex items-start gap-2.5">
                <span class="text-mustard font-bold uppercase tracking-wider text-[10px] sm:text-[11px] mt-0.5 min-w-[68px] flex-shrink-0">Horarios</span>
                <span>${s.horariosTexto}</span>
              </p>
            </div>

            <div class="mt-auto pt-3 border-t border-cream/10 flex flex-col sm:flex-row gap-2">
              <a href="${s.googleMapsUrl}" target="_blank" rel="noopener"
                 onclick="event.stopPropagation()"
                 class="btn btn-ghost btn-sm sm:w-auto">
                Ver ubicación ↗
              </a>
              <button type="button"
                      class="btn btn-primary btn-sm flex-1">
                ${isSelected ? "Continuar en esta sede →" : "Sacar turno acá →"}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    container.querySelectorAll(".item-card[data-branch-id]").forEach(card => {
      card.addEventListener("click", () => {
        const s = this.sucursales.find(x => x.id === card.dataset.branchId);
        if (s) this.selectBranch(s);
      });
    });

    if (typeof window.updateBranchOpenBadges === "function") {
      window.updateBranchOpenBadges();
    }
  }

  selectBranch(sucursal) {
    const cambioSucursal = this.state.sucursal && this.state.sucursal.id !== sucursal.id;
    this.state.sucursal = sucursal;

    if (cambioSucursal) {
      if (this.state.barber && this.state.barber.id !== "cualquiera") {
        const atiende = window.dataService.barberoAtiendeEnSucursal(this.state.barber, sucursal.id);
        if (!atiende) {
          this.state.barber = null;
        }
      }
      this.state.time = null;
      this.state.assignedBarber = null;
    }

    this.renderBranches();
    this.renderServices();
    this.renderBarbers();
    this.renderBranchBanner();
    this.updateSummary();
    this.goToStep(1);
  }

  renderBranchBanner() {
    const banner = document.getElementById("selected-branch-banner");
    if (!banner) return;
    if (!this.state.sucursal || this.currentStep === 0) {
      banner.classList.add("hidden");
      return;
    }
    const s = this.state.sucursal;
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="px-2 py-0.5 rounded bg-mustard/15 text-mustard border border-mustard/40 font-cond font-bold tracking-[0.1em] text-[11px] uppercase flex-shrink-0">★ ${s.nombre}</span>
          <span class="text-cream-dim truncate text-[11px] sm:text-xs">${s.direccion}</span>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <a href="${s.googleMapsUrl}" target="_blank" rel="noopener" class="text-mustard hover:underline font-semibold text-xs">Ver ubicación ↗</a>
          <button type="button" id="btn-banner-change-branch" class="text-cream-dim hover:text-cream underline text-xs">Cambiar</button>
        </div>
      </div>
    `;
    document.getElementById("btn-banner-change-branch")?.addEventListener("click", () => this.goToStep(0));
  }

  // -------------------------------------------------------------
  // PIZARRA DE PRECIOS + PASO 1: SERVICIOS
  // -------------------------------------------------------------
  renderPriceBoard() {
    const list = document.getElementById("price-board-list");
    if (!list) return;

    const activos = this.servicios.filter(s => s.activo !== false);
    list.innerHTML = activos.map(s => {
      const hasPrice = s.precio && Number(s.precio) > 0;
      return `
      <li class="group cursor-pointer rounded-lg px-2 py-2.5 -mx-2 hover:bg-white/5 transition-colors" data-chalk-service-id="${s.id}">
        <div class="flex items-baseline gap-3 chalk">
          <span class="font-cond font-bold uppercase tracking-[0.08em] text-lg sm:text-xl group-hover:text-mustard transition-colors">
            ${s.nombre.replace(/\s*\(descuento en efectivo\)/i, "").trim()}
          </span>
          <span class="price-leader"></span>
          ${hasPrice ? `<span class="font-cond font-extrabold text-xl sm:text-2xl text-mustard">$${Number(s.precio).toLocaleString("es-AR")}</span>` : ""}
        </div>
        <div class="flex items-center justify-between text-xs text-cream-mute mt-0.5">
          <span>${s.descripcion || `Duración estimada: ${s.duracion_minutos} min`}</span>
          <span class="font-cond uppercase tracking-[0.1em] text-cream-dim group-hover:text-mustard">${s.duracion_minutos} min · Reservar →</span>
        </div>
      </li>
    `;
    }).join("");

    list.querySelectorAll("[data-chalk-service-id]").forEach(item => {
      item.addEventListener("click", () => {
        const s = this.servicios.find(x => x.id === item.dataset.chalkServiceId);
        if (!s) return;
        this.state.service = s;
        this.updateSummary();
        if (!this.state.sucursal) {
          this.goToStep(0, true);
        } else if (!this.state.barber) {
          this.goToStep(2, true);
        } else {
          this.goToStep(3, true);
          this.refreshAvailableSlots();
        }
        requestAnimationFrame(() => window.scrollToSection?.("reservas"));
      });
    });
  }

  renderServices() {
    const container = document.getElementById("services-grid");
    if (!container) return;

    let html = this.servicios
      .filter(s => s.activo !== false)
      .map(s => {
        const isSelected = this.state.service?.id === s.id;
        const tituloLimpio = s.nombre.replace(/\s*\(descuento en efectivo\)/i, "").trim();
        const tienePrecio = s.precio && Number(s.precio) > 0;
        return `
          <div class="item-card cursor-pointer p-4 flex flex-col justify-between group ${isSelected ? "selected" : ""}" data-service-id="${s.id}">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h4 class="font-cond font-extrabold uppercase tracking-wide text-lg sm:text-xl text-cream group-hover:text-mustard transition-colors">${tituloLimpio}</h4>
              </div>
              ${tienePrecio ? `<span class="font-cond font-extrabold text-2xl text-mustard tracking-tight whitespace-nowrap">$${Number(s.precio).toLocaleString("es-AR")}</span>` : ""}
            </div>
            <div class="flex items-center justify-between text-xs text-cream-mute pt-3 mt-3 border-t border-cream/10">
              <span class="flex items-center gap-1.5">
                <span class="text-mustard">⏱</span> ${s.duracion_minutos} min
              </span>
              <span class="font-cond font-bold uppercase tracking-[0.1em] text-sm text-cream group-hover:text-mustard group-hover:translate-x-0.5 transition-all">
                Reservar →
              </span>
            </div>
          </div>
        `;
      }).join("");

    const colorCfg = this.servicioEspecialColor;
    const mostrarBannerColor = colorCfg && colorCfg.activo !== false && (
      colorCfg.sucursal_id === "todas" ||
      (this.state.sucursal && this.state.sucursal.id === colorCfg.sucursal_id)
    );

    if (mostrarBannerColor) {
      const sucColorObj = this.sucursales.find(s => s.id === colorCfg.sucursal_id);
      const sucColorNombre = colorCfg.sucursal_id === "todas"
        ? "Todas las sedes"
        : (sucColorObj?.nombre || "Villa Elisa");
      const tituloColor = this.escapeHtml(colorCfg.titulo || "Tintura / Reflejos / Rulos");
      const descColor = this.escapeHtml(colorCfg.descripcion || "Coordinación y asesoramiento directo por WhatsApp o teléfono.");
      const { waDigits, telDigits } = window.dataService.normalizarTelefonosContacto(colorCfg.telefono);
      const waColorMsg = encodeURIComponent(
        `Hola! Quiero más información para reservar el servicio ${colorCfg.titulo || "Tintura / Reflejos / Rulos"}${colorCfg.sucursal_id === "todas" ? "" : ` en ${sucColorNombre}`}`
      );
      html += `
        <div class="item-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:col-span-2 border-dashed border-mustard/30 bg-black/20">
          <div>
            <span class="text-[10px] uppercase tracking-[0.18em] font-semibold text-mustard block">Color · ${this.escapeHtml(sucColorNombre)}</span>
            <h4 class="font-cond font-extrabold uppercase tracking-wide text-base sm:text-lg text-cream mt-0.5">${tituloColor}</h4>
            <p class="text-xs text-cream-mute mt-0.5">${descColor}</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <a href="tel:${telDigits}" class="btn btn-ghost btn-sm">Llamar</a>
            <a href="https://wa.me/${waDigits}?text=${waColorMsg}" target="_blank" rel="noopener" class="btn btn-wa btn-sm">Consultar WhatsApp</a>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    container.querySelectorAll(".item-card[data-service-id]").forEach(card => {
      card.addEventListener("click", () => {
        const s = this.servicios.find(item => item.id === card.dataset.serviceId);
        if (s) this.selectService(s);
      });
    });
  }

  selectService(service) {
    this.state.service = service;
    this.renderServices();
    this.updateSummary();
    if (!this.state.sucursal) {
      this.goToStep(0);
    } else if (!this.state.barber) {
      this.goToStep(2);
    } else {
      this.goToStep(3);
      this.refreshAvailableSlots();
    }
  }

  // -------------------------------------------------------------
  // EL EQUIPO (LANDING) — retratos verticales de salón
  // -------------------------------------------------------------
  renderTeamSection() {
    const grid = document.getElementById("landing-equipo-grid");
    if (!grid) return;

    const ale = this.barberos.find(b => b.id === "b1" || b.nombre.toLowerCase() === "ale");
    const otros = this.barberos.filter(b => b !== ale);
    const ordenados = ale ? [ale, ...otros] : otros;

    grid.innerHTML = ordenados.map(b => {
      const iniciales = this.getInitials(b.nombre);
      const rolTexto = (b.rol && b.rol.toLowerCase() !== "fundador") ? b.rol : "Barbero";

      return `
        <article class="portrait-card flex flex-row sm:flex-col items-center sm:items-stretch p-2.5 sm:p-0 gap-3.5 sm:gap-0 group cursor-pointer"
                 onclick="window.bookingEngine.selectBarberFromTeam('${b.id}')">
          <div class="relative w-16 h-16 rounded-full sm:w-full sm:h-56 sm:rounded-none overflow-hidden bg-wood-900 flex-shrink-0 border border-mustard/50 sm:border-0">
            ${
              b.foto
                ? `<img src="${b.foto}" alt="${b.nombre}" loading="lazy" decoding="async"
                        class="w-full h-full object-cover object-[50%_36%] scale-[1.2] origin-[50%_38%] sm:scale-100 sm:origin-center">`
                : `<div class="w-full h-full flex items-center justify-center">
                     <span class="font-serif-display font-bold text-xl sm:text-3xl text-cream-dim">${iniciales}</span>
                   </div>`
            }
          </div>

          <!-- Pie compacto: horizontal en celular (foto + nombre/reservar), tarjeta chica en escritorio -->
          <div class="flex-1 min-w-0 sm:p-2.5 sm:bg-[#1B1815] sm:border-t sm:border-mustard/15 flex flex-col justify-center sm:justify-between gap-1.5 sm:gap-2 items-start sm:items-stretch">
            <div class="w-full min-w-0">
              <h3 class="font-serif-display font-bold text-base text-cream leading-tight truncate">
                ${b.nombre}
              </h3>
              <span class="hidden sm:block text-[9px] uppercase tracking-[0.16em] font-semibold mt-0.5 text-cream-mute">
                ${rolTexto}
              </span>
            </div>

            <button type="button"
                    onclick="event.stopPropagation(); window.bookingEngine.selectBarberFromTeam('${b.id}')"
                    class="px-5 sm:w-full min-h-[34px] py-1 rounded-md bg-wood-800 hover:bg-mustard text-cream hover:text-ink border border-mustard/35 hover:border-mustard font-bold uppercase tracking-[0.12em] text-[10px] transition-colors cursor-pointer">
              Reservar
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  selectBarberFromTeam(barberId) {
    const b = this.barberos.find(item => item.id === barberId);
    if (!b) return;
    this.state.barber = b;

    const sedes = this.getSucursalesDeBarbero(b);
    if (sedes.length === 1) {
      this.state.sucursal = sedes[0];
      this.renderBranches();
      this.renderBarbers();
      this.renderBranchBanner();
    }

    this.updateSummary();

    if (!this.state.sucursal) {
      this.goToStep(0, true);
    } else if (!this.state.service) {
      this.goToStep(1, true);
    } else {
      this.goToStep(3, true);
      this.refreshAvailableSlots();
    }

    requestAnimationFrame(() => window.scrollToSection?.("reservas"));
  }

  // -------------------------------------------------------------
  // PASO 2: BARBEROS (FILTRADOS POR SUCURSAL ELEGIDA)
  // -------------------------------------------------------------
  renderBarbers() {
    const container = document.getElementById("barbers-grid");
    if (!container) return;

    const sucursalId = this.state.sucursal?.id || null;
    const barberosSede = sucursalId
      ? this.barberos.filter(b => window.dataService.barberoAtiendeEnSucursal(b, sucursalId))
      : this.barberos;

    let html = `
      <div class="item-card cursor-pointer p-3.5 sm:p-4 flex items-center justify-between gap-3 group sm:col-span-2 border-dashed border-mustard/40 bg-mustard/5"
           data-barber-id="cualquiera">
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="barber-avatar w-12 h-12 text-mustard text-base font-bold">
            ⚡
          </div>
          <div class="min-w-0">
            <h4 class="font-cond font-extrabold uppercase tracking-wide text-base sm:text-lg text-cream group-hover:text-mustard transition-colors">
              Primer profesional disponible
            </h4>
            <span class="text-xs text-cream-dim block">El turno libre más próximo en ${this.state.sucursal ? this.state.sucursal.nombre : "la sede"}</span>
          </div>
        </div>
        <span class="font-cond font-bold uppercase tracking-[0.1em] text-xs text-mustard flex-shrink-0">
          Elegir →
        </span>
      </div>
    `;

    html += barberosSede.map(b => {
      const diasTexto = sucursalId ? this.getDiasEnSucursal(b, sucursalId).join(", ") : "";
      const iniciales = this.getInitials(b.nombre);
      const isSelected = this.state.barber?.id === b.id;
      return `
        <div class="item-card cursor-pointer p-3.5 sm:p-4 flex items-center justify-between gap-3 group ${isSelected ? "selected" : ""}"
             data-barber-id="${b.id}">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="barber-avatar w-12 h-12">
              ${
                b.foto
                  ? `<img src="${b.foto}" alt="${b.nombre}" class="object-[50%_36%]">`
                  : `<span class="font-cond font-bold text-sm text-cream">${iniciales}</span>`
              }
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="font-cond font-extrabold uppercase tracking-wide text-base sm:text-lg text-cream group-hover:text-mustard transition-colors truncate">${b.nombre}</h4>
              </div>
              ${diasTexto ? `<span class="text-[11px] text-cream-mute block">Atiende: ${diasTexto}</span>` : ""}
            </div>
          </div>
          <span class="font-cond font-bold uppercase tracking-[0.1em] text-xs text-cream-mute group-hover:text-mustard flex-shrink-0 transition-colors">
            Elegir →
          </span>
        </div>
      `;
    }).join("");

    container.innerHTML = html;

    container.querySelectorAll(".item-card[data-barber-id]").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.barberId;
        if (id === "cualquiera") {
          this.selectBarber({ id: "cualquiera", nombre: "Primer disponible" });
        } else {
          const b = this.barberos.find(item => item.id === id);
          if (b) this.selectBarber(b);
        }
      });
    });
  }

  selectBarber(barber) {
    this.state.barber = barber;
    this.state.time = null;
    this.updateSummary();
    this.goToStep(3);
    this.renderCalendar();
    this.refreshAvailableSlots();
  }

  // -------------------------------------------------------------
  // PASO 3: CALENDARIO Y HORARIOS FILTRADOS POR SUCURSAL
  // -------------------------------------------------------------
  getMaxAllowedDate() {
    const hoy = new Date();
    const añoActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    const ultimoDiaMesActual = new Date(añoActual, mesActual + 1, 0).getDate();
    const diasRestantesMes = ultimoDiaMesActual - hoy.getDate();

    if (diasRestantesMes <= 14) {
      return new Date(añoActual, mesActual + 2, 0);
    } else {
      return new Date(añoActual, mesActual + 1, 0);
    }
  }

  hasScheduleInBranchOnDay(diaSemana) {
    if (diaSemana === 0) return false;
    const sucursalId = this.state.sucursal?.id;
    const barberosAevaluar = (this.state.barber && this.state.barber.id !== "cualquiera")
      ? [this.state.barber]
      : this.barberos;

    return barberosAevaluar.some(b => {
      const franjas = b.horarios?.[diaSemana];
      if (!Array.isArray(franjas) || franjas.length === 0) return false;
      if (!sucursalId) return true;
      return franjas.some(f => (f.sucursal_id || "suc_city_bell") === sucursalId);
    });
  }

  renderCalendar() {
    const monthTitle = document.getElementById("cal-month-title");
    const grid = document.getElementById("cal-days-grid");
    const prevBtn = document.getElementById("cal-prev-month");
    const nextBtn = document.getElementById("cal-next-month");
    if (!monthTitle || !grid) return;

    monthTitle.innerText = `${this.meses[this.currentMonth]} ${this.currentYear}`;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const maxAllowedDate = this.getMaxAllowedDate();
    maxAllowedDate.setHours(23, 59, 59, 999);

    if (prevBtn) {
      const esMesActual = this.currentYear === hoy.getFullYear() && this.currentMonth <= hoy.getMonth();
      prevBtn.classList.toggle("opacity-20", esMesActual);
      prevBtn.classList.toggle("pointer-events-none", esMesActual);
    }

    if (nextBtn) {
      const maxMes = maxAllowedDate.getMonth();
      const maxAño = maxAllowedDate.getFullYear();
      const esMaximoMes = this.currentYear > maxAño || (this.currentYear === maxAño && this.currentMonth >= maxMes);
      nextBtn.classList.toggle("opacity-20", esMaximoMes);
      nextBtn.classList.toggle("pointer-events-none", esMaximoMes);
    }

    const primerDia = new Date(this.currentYear, this.currentMonth, 1);
    const ultimoDia = new Date(this.currentYear, this.currentMonth + 1, 0);
    const totalDias = ultimoDia.getDate();
    const diaSemanaInicio = primerDia.getDay();

    let html = "";
    for (let i = 0; i < diaSemanaInicio; i++) {
      html += `<div class="h-11"></div>`;
    }

    for (let dia = 1; dia <= totalDias; dia++) {
      const fechaActual = new Date(this.currentYear, this.currentMonth, dia);
      const fechaStr = this.formatDateYYYYMMDD(fechaActual);
      const diaSemana = fechaActual.getDay();

      const esPasado = fechaActual < hoy;
      const excedeLimite = fechaActual > maxAllowedDate;
      const esDomingo = diaSemana === 0;
      const sinAtencion = !this.hasScheduleInBranchOnDay(diaSemana);
      const esNoDisponible = esPasado || excedeLimite || esDomingo || sinAtencion;
      const esSeleccionado = fechaStr === this.state.date;
      const esHoy = fechaStr === this.formatDateYYYYMMDD(hoy);

      let clases = "cal-day h-11 w-full rounded-[10px] flex items-center justify-center font-cond text-base font-bold transition-all ";
      if (esNoDisponible) {
        clases += "text-cream-mute/35 cursor-not-allowed";
      } else if (esSeleccionado) {
        clases += "bg-mustard text-black font-extrabold shadow-lg scale-105 cursor-pointer";
      } else {
        clases += "text-cream hover:bg-cream/10 cursor-pointer ";
        if (esHoy) clases += "border border-mustard/70 text-mustard";
      }

      html += `
        <button type="button"
                class="${clases}"
                ${esNoDisponible ? "disabled" : ""}
                data-date="${fechaStr}">
          ${dia}
        </button>
      `;
    }

    grid.innerHTML = html;

    grid.querySelectorAll(".cal-day:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        this.state.date = btn.dataset.date;
        this.state.time = null;
        document.getElementById("btn-to-step-4")?.classList.add("opacity-40", "pointer-events-none");
        this.renderCalendar();
        this.updateSummary();
        this.refreshAvailableSlots();
        if (window.innerWidth < 768) {
          setTimeout(() => {
            const slotsSec = document.getElementById("slots-section");
            if (slotsSec) {
              const rect = slotsSec.getBoundingClientRect();
              if (rect.top > window.innerHeight * 0.68) {
                window.scrollToSection?.(slotsSec, { extraOffset: 10 });
              }
            }
          }, 120);
        }
      });
    });
  }

  prevMonth() {
    const hoy = new Date();
    if (this.currentYear === hoy.getFullYear() && this.currentMonth <= hoy.getMonth()) return;
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.renderCalendar();
  }

  nextMonth() {
    const maxAllowedDate = this.getMaxAllowedDate();
    if (this.currentYear > maxAllowedDate.getFullYear() ||
        (this.currentYear === maxAllowedDate.getFullYear() && this.currentMonth >= maxAllowedDate.getMonth())) {
      return;
    }
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.renderCalendar();
  }

  updateSelectedDateLabel() {
    const label = document.getElementById("selected-date-label");
    if (!label || !this.state.date) return;

    const [y, m, d] = this.state.date.split("-").map(Number);
    const f = new Date(y, m - 1, d);
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    label.innerText = `${dias[f.getDay()]} ${d} de ${this.meses[m - 1]}`;
  }

  async refreshAvailableSlots() {
    const container = document.getElementById("slots-container");
    if (!container) return;

    this.updateSelectedDateLabel();

    if (!this.state.date) {
      container.innerHTML = `<p class="text-cream-mute text-xs py-4 text-center">Seleccioná un día en el calendario.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="col-span-2 py-6 text-center text-cream-dim text-xs">
        Buscando horarios libres...
      </div>
    `;

    try {
      const duracion = this.state.service ? this.state.service.duracion_minutos : 45;
      const turnosOcupados = await window.dataService.getTurnosOcupados(
        this.state.date,
        this.state.barber ? this.state.barber.id : null,
        null,
        null
      );

      const slots = this.calculateAvailableSlots(this.state.date, duracion, turnosOcupados);

      if (slots.length === 0) {
        container.innerHTML = `
          <div class="col-span-2 py-7 text-center bg-black/25 rounded-xl border border-cream/10 p-4">
            <p class="text-cream text-xs font-semibold">No quedan turnos libres para este día</p>
            <p class="text-cream-mute text-[11px] mt-1">Probá otra fecha o cambiá de barbero/sede.</p>
          </div>
        `;
        document.getElementById("btn-to-step-4")?.classList.add("opacity-40", "pointer-events-none");
        return;
      }

      container.innerHTML = slots.map(slot => `
        <button type="button"
                class="slot-pill"
                data-time="${slot.time}"
                data-assigned-barber="${slot.assignedBarberId || ""}">
          <span>${slot.time} hs</span>
          ${slot.barberName ? `<span class="text-[11px] text-cream-dim font-sans font-normal ml-1">(${slot.barberName.split(" ")[0]})</span>` : ""}
        </button>
      `).join("");

      container.querySelectorAll(".slot-pill").forEach(btn => {
        btn.addEventListener("click", () => {
          container.querySelectorAll(".slot-pill").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");

          this.state.time = btn.dataset.time;

          if (this.state.barber?.id === "cualquiera" && btn.dataset.assignedBarber) {
            this.state.assignedBarber = this.barberos.find(b => b.id === btn.dataset.assignedBarber);
          } else {
            this.state.assignedBarber = this.state.barber;
          }

          this.updateSummary();
          document.getElementById("btn-to-step-4")?.classList.remove("opacity-40", "pointer-events-none");

          if (window.innerWidth < 768) {
            setTimeout(() => {
              document.getElementById("btn-to-step-4")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 100);
          }
        });
      });
    } catch (err) {
      console.error(err);
      container.innerHTML = `<p class="col-span-2 text-red-400 text-xs text-center py-4">Error al cargar horarios.</p>`;
    }
  }

  calculateAvailableSlots(dateStr, duracionMinutos, turnosOcupados) {
    const slotsMap = new Map();
    const hoy = new Date();
    const esHoy = dateStr === this.formatDateYYYYMMDD(hoy);

    const [y, m, d] = dateStr.split("-").map(Number);
    const diaSemana = new Date(y, m - 1, d).getDay();
    if (diaSemana === 0) return [];

    const sucursalId = this.state.sucursal?.id || "suc_city_bell";
    // Grilla estándar cada 30 minutos (idéntica a Wonoma: 09:30, 10:00, 10:30...)
    const intervaloMinutos = 30;
    const duracionEfectiva = duracionMinutos > 0 ? duracionMinutos : 30;

    const barberosAevaluar = (this.state.barber && this.state.barber.id !== "cualquiera")
      ? [this.state.barber]
      : this.barberos;

    for (const b of barberosAevaluar) {
      const franjasDia = b.horarios?.[diaSemana];
      if (!Array.isArray(franjasDia) || franjasDia.length === 0) continue;

      const franjasSede = franjasDia.filter(f => (f.sucursal_id || "suc_city_bell") === sucursalId);
      if (franjasSede.length === 0) continue;

      for (const franja of franjasSede) {
        const [hIni, mIni] = franja.desde.split(":").map(Number);
        const [hFin, mFin] = franja.hasta.split(":").map(Number);
        const minInicioFranja = hIni * 60 + mIni;
        const minFinFranja = hFin * 60 + mFin;

        for (let minTotales = minInicioFranja; minTotales + intervaloMinutos <= minFinFranja; minTotales += intervaloMinutos) {
          const hora = Math.floor(minTotales / 60);
          const min = minTotales % 60;
          const timeStr = `${String(hora).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
          const slotStart = new Date(`${dateStr}T${timeStr}:00`);

          if (esHoy) {
            const margen = new Date(hoy.getTime() + 30 * 60000);
            if (slotStart <= margen) continue;
          }

          const sInicio = slotStart.getTime();
          const sFin = sInicio + duracionEfectiva * 60000;

          const estaOcupado = turnosOcupados.some(t => {
            const aplicaBarbero = t.barbero_id === b.id ||
              (t.barbero_id === "todos" && (!t.sucursal_id || t.sucursal_id === sucursalId || t.sucursal_id === "todas"));
            if (!aplicaBarbero) return false;
            const tInicio = new Date(t.fecha_inicio).getTime();
            const tFin = new Date(t.fecha_fin).getTime();
            return sInicio < tFin && sFin > tInicio;
          });

          if (!estaOcupado && !slotsMap.has(timeStr)) {
            slotsMap.set(timeStr, {
              time: timeStr,
              assignedBarberId: b.id,
              barberName: this.state.barber?.id === "cualquiera" ? b.nombre : null
            });
          }
        }
      }
    }

    const slots = Array.from(slotsMap.values());
    slots.sort((a, b) => a.time.localeCompare(b.time));
    return slots;
  }

  // -------------------------------------------------------------
  // PASO 4: CONFIRMACIÓN
  // -------------------------------------------------------------
  async submitBooking() {
    const btn = document.getElementById("btn-submit-booking");
    const errorEl = document.getElementById("booking-error-msg");
    if (errorEl) errorEl.classList.add("hidden");

    const nombre = document.getElementById("client-name")?.value.trim();
    const telefono = document.getElementById("client-phone")?.value.trim();
    const notas = document.getElementById("client-notes")?.value.trim() || "";

    if (!nombre || nombre.length < 3) {
      this.showError("Ingresá tu nombre y apellido.");
      return;
    }

    if (!telefono || telefono.length < 8) {
      this.showError("Ingresá un número de WhatsApp válido.");
      return;
    }

    this.state.client = { nombre, telefono, notas };

    if (btn) {
      btn.disabled = true;
      btn.innerText = "Confirmando turno...";
    }

    try {
      const barberoFinal = this.state.assignedBarber || this.state.barber;
      const duracion = this.state.service.duracion_minutos;

      const fechaInicio = `${this.state.date}T${this.state.time}:00`;
      const inicioDate = new Date(fechaInicio);
      const finDate = new Date(inicioDate.getTime() + duracion * 60000);
      const finH = String(finDate.getHours()).padStart(2, "0");
      const finM = String(finDate.getMinutes()).padStart(2, "0");
      const fechaFin = `${this.formatDateYYYYMMDD(finDate)}T${finH}:${finM}:00`;

      const nuevoTurno = await window.dataService.reservar_turno({
        sucursal_id: this.state.sucursal.id,
        barbero_id: barberoFinal.id,
        servicio_id: this.state.service.id,
        cliente_nombre: nombre,
        cliente_telefono: telefono,
        cliente_email: null,
        notas: notas,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      });

      this.showSuccessModal(nuevoTurno);
    } catch (err) {
      console.error(err);
      this.showError(err.message || "Error al confirmar. Probá nuevamente.");
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Confirmar Turno";
      }
    }
  }

  showSuccessModal(turno) {
    const modal = document.getElementById("success-modal");
    if (!modal) return;

    const sucursalNombre = this.state.sucursal ? this.state.sucursal.nombre : "City Bell";
    const barberoNombre = (this.state.assignedBarber || this.state.barber).nombre;
    const servicioNombre = this.state.service.nombre;
    const fechaHora = `${this.state.date} a las ${this.state.time} hs`;

    const branchEl = document.getElementById("modal-summary-branch");
    if (branchEl) branchEl.innerText = sucursalNombre;
    document.getElementById("modal-summary-service").innerText = servicioNombre;
    document.getElementById("modal-summary-barber").innerText = barberoNombre;
    document.getElementById("modal-summary-datetime").innerText = fechaHora;
    document.getElementById("modal-summary-client").innerText = `${this.state.client.nombre} (${this.state.client.telefono})`;

    const waBtn = document.getElementById("modal-btn-whatsapp");
    if (waBtn && this.state.sucursal) {
      const waTel = this.state.sucursal.telefonoWhatsApp || CONFIG.barberia.telefonoWhatsApp;
      const msg = `¡Hola Lo de Ale (${sucursalNombre})! Acabo de reservar un turno:\n• Servicio: ${servicioNombre}\n• Barbero: ${barberoNombre}\n• Día y hora: ${fechaHora}\n• Nombre: ${this.state.client.nombre}`;
      waBtn.href = `https://wa.me/${waTel}?text=${encodeURIComponent(msg)}`;
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  showError(msg) {
    const errorEl = document.getElementById("booking-error-msg");
    if (errorEl) {
      errorEl.innerText = msg;
      errorEl.classList.remove("hidden");
    } else {
      alert(msg);
    }
  }

  goToStep(stepNumber, skipScroll = false) {
    this.currentStep = stepNumber;

    for (let i = 0; i <= this.totalSteps; i++) {
      const stepEl = document.getElementById(`step-content-${i}`);
      const stepLabelEl = document.getElementById(`step-label-${i}`);

      if (stepEl) {
        stepEl.classList.toggle("hidden", i !== stepNumber);
      }

      if (stepLabelEl) {
        stepLabelEl.classList.remove("is-done", "is-current", "is-todo");
        if (i < stepNumber) {
          stepLabelEl.classList.add("is-done");
        } else if (i === stepNumber) {
          stepLabelEl.classList.add("is-current");
        } else {
          stepLabelEl.classList.add("is-todo");
        }
      }
    }

    const pct = Math.round(((stepNumber + 1) / (this.totalSteps + 1)) * 100);
    const fillEl = document.getElementById("booking-progress-fill");
    const barEl = document.getElementById("booking-progress-bar");
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (barEl) barEl.setAttribute("aria-valuenow", String(pct));

    const labelEl = document.getElementById("step-current-label");
    if (labelEl) {
      labelEl.innerText = this.stepLabels[stepNumber] || "";
    }

    // Mostrar banner compacto solo cuando ya se avanzó más allá del paso de Sede
    this.renderBranchBanner();

    if (!skipScroll) {
      requestAnimationFrame(() => {
        const target = document.getElementById("reservas");
        if (!target) return;
        const headerH = document.getElementById("main-header")?.getBoundingClientRect().height || 72;
        const rect = target.getBoundingClientRect();
        // En celular siempre encuadrar el paso actual; en escritorio encuadrar si el bloque quedó muy pegado al header
        if (window.innerWidth < 768 || rect.top < headerH + 16 || rect.top > window.innerHeight * 0.45) {
          window.scrollToSection?.("reservas");
        }
      });
    }
  }

  updateSummary() {
    const summaryCard = document.getElementById("booking-summary");
    if (!summaryCard) return;

    if (!this.state.sucursal && !this.state.service) {
      summaryCard.classList.add("hidden");
      return;
    }

    summaryCard.classList.remove("hidden");
    const branchEl = document.getElementById("sum-branch");
    if (branchEl) branchEl.innerText = this.state.sucursal ? this.state.sucursal.nombre : "Pendiente";
    document.getElementById("sum-service").innerText = this.state.service
      ? (() => {
          const cleanName = this.state.service.nombre.replace(/\s*\(descuento en efectivo\)/i, "").trim();
          const hasPrice = this.state.service.precio && Number(this.state.service.precio) > 0;
          return hasPrice ? `${cleanName} ($${Number(this.state.service.precio).toLocaleString("es-AR")})` : cleanName;
        })()
      : "Pendiente";
    const barberoMostrado = this.state.assignedBarber || this.state.barber;
    document.getElementById("sum-barber").innerText = barberoMostrado ? barberoMostrado.nombre : "Pendiente";
    document.getElementById("sum-datetime").innerText = (this.state.date && this.state.time)
      ? `${this.state.date} · ${this.state.time} hs`
      : "Pendiente";
  }

  setupEventListeners() {
    document.getElementById("btn-back-to-0")?.addEventListener("click", () => this.goToStep(0));
    document.getElementById("btn-back-to-1")?.addEventListener("click", () => this.goToStep(1));
    document.getElementById("btn-back-to-2")?.addEventListener("click", () => this.goToStep(2));
    document.getElementById("btn-back-to-3")?.addEventListener("click", () => this.goToStep(3));

    document.getElementById("cal-prev-month")?.addEventListener("click", () => this.prevMonth());
    document.getElementById("cal-next-month")?.addEventListener("click", () => this.nextMonth());

    document.getElementById("btn-to-step-4")?.addEventListener("click", () => {
      if (this.state.time) this.goToStep(4);
    });

    document.getElementById("booking-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.submitBooking();
    });

    document.getElementById("btn-close-modal")?.addEventListener("click", () => {
      window.location.reload();
    });

    // Botones directos de reserva por sucursal (compatibilidad)
    document.querySelectorAll("[data-reserve-branch]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const branchId = btn.getAttribute("data-reserve-branch");
        const suc = this.sucursales.find(s => s.id === branchId);
        if (suc) {
          e.preventDefault();
          this.selectBranch(suc);
          requestAnimationFrame(() => window.scrollToSection?.("reservas"));
        }
      });
    });

    window.addEventListener("lodeale_turnos_actualizados", () => {
      if (this.currentStep === 3) this.refreshAvailableSlots();
    });

    const reloadServicios = async () => {
      this.servicios = await window.dataService.getServicios();
      this.servicioEspecialColor = await window.dataService.getServicioEspecialColor();
      this.renderServices();
      this.renderPriceBoard();
      this.updateSummary();
    };
    window.addEventListener("lodeale_precios_actualizados", reloadServicios);
    window.addEventListener("lodeale_servicios_actualizados", reloadServicios);
    window.addEventListener("storage", (e) => {
      if (!e.key || e.key === "lodeale_servicios" || e.key === "lodeale_servicio_color") {
        reloadServicios();
      }
    });
  }

  setupCancellationModal() {
    const cancelModal = document.getElementById("cancel-modal");
    const openBtns = [
      document.getElementById("btn-open-cancel-modal"),
      document.getElementById("nav-btn-mis-turnos"),
      ...document.querySelectorAll(".js-open-mis-turnos")
    ];
    const closeBtn = document.getElementById("btn-close-cancel-modal");
    const searchBtn = document.getElementById("btn-search-appointments");
    const phoneInput = document.getElementById("lookup-phone-input");
    const resultsContainer = document.getElementById("lookup-results-container");
    const feedbackEl = document.getElementById("lookup-feedback");

    if (!cancelModal) return;

    const openModal = () => {
      cancelModal.classList.remove("hidden");
      cancelModal.classList.add("flex");
      if (feedbackEl) {
        feedbackEl.className = "hidden";
        feedbackEl.innerText = "";
      }
      setTimeout(() => phoneInput?.focus(), 100);
    };

    const closeModal = () => {
      cancelModal.classList.add("hidden");
      cancelModal.classList.remove("flex");
    };

    openBtns.forEach(btn => btn?.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    }));

    closeBtn?.addEventListener("click", closeModal);
    cancelModal.addEventListener("click", (e) => {
      if (e.target === cancelModal) closeModal();
    });

    const handleSearch = async () => {
      const phone = phoneInput?.value.trim() || "";
      if (phone.length < 4) {
        if (feedbackEl) {
          feedbackEl.className = "mt-3 p-2.5 rounded-xl bg-mustard/10 border border-mustard/30 text-mustard text-xs block";
          feedbackEl.innerText = "Por favor ingresá tu número de teléfono o WhatsApp.";
        }
        return;
      }

      if (feedbackEl) feedbackEl.className = "hidden";
      resultsContainer.innerHTML = `<p class="text-cream-dim text-xs text-center py-4">Buscando tus turnos...</p>`;

      try {
        const turnos = await window.dataService.getTurnosPorTelefono(phone);
        if (!turnos || turnos.length === 0) {
          resultsContainer.innerHTML = `
            <div class="p-4 rounded-xl bg-cream/5 border border-cream/10 text-center text-xs text-cream-dim">
              No encontramos reservas activas para el número <strong>${phone}</strong>.<br>
              <span class="text-[11px] text-cream-mute mt-1 block">Verificá que coincida con el número ingresado al reservar.</span>
            </div>
          `;
          return;
        }

        const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        resultsContainer.innerHTML = turnos.map(t => {
          const [fPart, hPart] = t.fecha_inicio.split("T");
          const [anio, mes, dia] = fPart.split("-").map(Number);
          const fechaObj = new Date(anio, mes - 1, dia);
          const diaNombre = diasSemana[fechaObj.getDay()];
          const mesNombre = meses[fechaObj.getMonth()];
          const hora = hPart ? hPart.substring(0, 5) : "";

          return `
            <div class="p-3.5 rounded-xl bg-[#1f1813] border border-cream/10 space-y-2.5 text-xs">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                    Confirmado
                  </span>
                  <span class="px-2 py-0.5 rounded-full bg-mustard/15 text-mustard border border-mustard/30 text-[10px] font-bold">
                    📍 ${t.sucursal_nombre}
                  </span>
                </div>
                <span class="text-cream font-mono font-bold">${hora} hs</span>
              </div>

              <div class="space-y-0.5">
                <h4 class="font-bold text-cream text-sm">${t.servicio_nombre}</h4>
                <p class="text-cream-dim text-xs">
                  Profesional: <strong class="text-mustard">${t.barbero_nombre}</strong>
                </p>
                <p class="text-cream-dim text-xs">
                  📅 ${diaNombre} ${dia} de ${mesNombre} a las ${hora} hs
                </p>
                <p class="text-[11px] text-cream-mute">Cliente: ${t.cliente_nombre}</p>
              </div>

              <div class="pt-2 border-t border-cream/10 flex items-center justify-end">
                <button type="button" class="btn-cancel-client-turno px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/60 text-xs font-semibold transition-all flex items-center gap-1.5"
                        data-turno-id="${t.id}"
                        data-resumen="${t.sucursal_nombre} • ${diaNombre} ${dia} de ${mesNombre} a las ${hora} hs con ${t.barbero_nombre}">
                  Cancelar Reserva
                </button>
              </div>
            </div>
          `;
        }).join("");

        resultsContainer.querySelectorAll(".btn-cancel-client-turno").forEach(btn => {
          btn.addEventListener("click", async () => {
            const turnoId = btn.dataset.turnoId;
            const resumen = btn.dataset.resumen;
            const confirma = confirm(`¿Estás seguro de cancelar tu turno?\n\nDetalle: ${resumen}\n\nEste horario quedará disponible inmediatamente.`);
            if (!confirma) return;

            btn.disabled = true;
            btn.innerText = "Cancelando...";

            try {
              await window.dataService.cancelarTurno(turnoId);
              if (feedbackEl) {
                feedbackEl.className = "mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium block text-center";
                feedbackEl.innerHTML = `✓ Turno cancelado con éxito.<br><span class="text-[11px] text-cream-dim">El horario quedó liberado.</span>`;
              }
              await handleSearch();
              if (this.currentStep === 3) this.refreshAvailableSlots();
            } catch (err) {
              alert("Hubo un error al cancelar el turno.");
              btn.disabled = false;
              btn.innerText = "Cancelar Reserva";
            }
          });
        });
      } catch (err) {
        resultsContainer.innerHTML = `<p class="text-rose-400 text-xs text-center py-4">Error al buscar turnos.</p>`;
      }
    };

    searchBtn?.addEventListener("click", handleSearch);
    phoneInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
    });
  }

  formatDateYYYYMMDD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.bookingEngine = new BookingEngine();
  window.bookingEngine.init();
});
