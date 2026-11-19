/**
 * BARTACHE BARBEROS - PANEL DE GESTIÓN Y AGENDA INTEGRADA
 * - Acceso por Email del local o cuenta autorizada (ej: ignaciodelalama10@gmail.com).
 * - Calendario oscuro estilo Calendly integrado (sin datepicker blanco nativo del navegador).
 * - Horarios en formato 24 horas (sin AM/PM).
 * - Bloqueo de horario limpio (sin clientes ficticios ni servicios falsos).
 * - Botón "Cancelar" en rojo.
 * - Módulo para actualizar precios de servicios en tiempo real.
 */

class AdminPanel {
  constructor() {
    this.overlay = null;
    this.loginScreen = null;
    this.appView = null;
    this.loginForm = null;
    this.emailInput = null;
    this.passwordInput = null;
    this.loginError = null;
    this.barberSelect = null;
    this.blockBarberSelect = null;
    this.listContainer = null;
    this.countEl = null;
    this.blockModal = null;
    this.pricesModal = null;
    this.manualBookingModal = null;
    this.manualBookingForm = null;
    this.barberos = [];
    this.servicios = [];
    this.sucursales = [];
    this.selectedBranch = localStorage.getItem("lodeale_admin_branch") && localStorage.getItem("lodeale_admin_branch") !== "todas"
      ? localStorage.getItem("lodeale_admin_branch")
      : "todas";
    this.adminRole = localStorage.getItem("lodeale_admin_role") || "admin_general";
    this.lockedBranch = (this.adminRole === "encargado") ? localStorage.getItem("lodeale_admin_branch") : null;
    this.branchSelectorScreen = null;
    this.tabEstado = "confirmado"; // "confirmado" (Pendientes) o "atendido"

    // Manejo de fecha custom
    const hoy = new Date();
    this.selectedDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    this.calViewDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    this.diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    this.meses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
  }

  async init() {
    this.overlay = document.getElementById("admin-overlay");
    if (!this.overlay) return;

    this.loginScreen = document.getElementById("admin-login-screen");
    this.branchSelectorScreen = document.getElementById("admin-branch-selector-screen");
    this.appView = document.getElementById("admin-app-view");
    this.loginForm = document.getElementById("admin-login-form");
    this.emailInput = document.getElementById("admin-email-input");
    this.passwordInput = document.getElementById("admin-password-input");
    this.loginError = document.getElementById("admin-login-error");
    this.barberSelect = document.getElementById("admin-barber-filter");
    this.blockBarberSelect = document.getElementById("block-barber");
    this.listContainer = document.getElementById("admin-turnos-list");
    this.countEl = document.getElementById("turnos-count");
    this.blockModal = document.getElementById("block-modal");
    this.pricesModal = document.getElementById("prices-modal");
    this.barbersModal = document.getElementById("barbers-modal");
    this.manualBookingModal = document.getElementById("manual-booking-modal");
    this.manualBookingForm = document.getElementById("manual-booking-form");

    this.sucursales = await window.dataService.getSucursales(true);
    this.barberos = await window.dataService.getBarberos(true);
    this.servicios = await window.dataService.getServicios();

    this.setupBranchFilter();
    this.setupBarberSelectors();
    this.setupBlockTimeDropdowns();
    this.setupManualBooking();
    this.setupSidebarHorarios();
    this.setupBarbersModal();
    this.setupEventListeners();
    this.updateDateUI();
    await this.checkAuthAndRoute();
  }

  resolveAdminAccount(email) {
    const clean = (email || "").trim().toLowerCase();
    const cuentas = CONFIG.barberia.cuentasAdmin || [];
    const found = cuentas.find(c => c.email.trim().toLowerCase() === clean);
    if (found) return found;
    const emailsPermitidos = (CONFIG.barberia.emailsAutorizados || [CONFIG.barberia.emailAdmin])
      .map(m => m.trim().toLowerCase());
    if (emailsPermitidos.includes(clean)) {
      return { email: clean, rol: "admin_general", sucursal_id: "todas", nombre: "Admin General" };
    }
    return null;
  }

  getNextMonday6AM() {
    const now = new Date();
    const day = now.getDay(); // 0 Dom, 1 Lun ... 6 Sáb
    let daysToAdd = (8 - day) % 7;
    if (daysToAdd === 0) {
      // Si es lunes, vence hoy a las 06:00 si todavía no pasaron, o el próximo lunes
      const today6 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);
      if (now.getTime() >= today6.getTime()) daysToAdd = 7;
    }
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd, 6, 0, 0, 0);
    return target.getTime();
  }

  getBranchSessionKey(branchId) {
    return `lodeale_auth_${branchId}`;
  }

  getBranchSession(branchId) {
    if (!branchId || branchId === "todas") return null;
    try {
      const raw = localStorage.getItem(this.getBranchSessionKey(branchId));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.expiresAt || Date.now() >= Number(data.expiresAt)) {
        localStorage.removeItem(this.getBranchSessionKey(branchId));
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  saveBranchSession(branchId, email, role) {
    if (!branchId || branchId === "todas") return;
    const session = {
      email,
      role: role || "encargado",
      branchId,
      expiresAt: this.getNextMonday6AM()
    };
    localStorage.setItem(this.getBranchSessionKey(branchId), JSON.stringify(session));
    localStorage.setItem("lodeale_admin_active_branch", branchId);
  }

  clearBranchSession(branchId) {
    if (branchId && branchId !== "todas") {
      localStorage.removeItem(this.getBranchSessionKey(branchId));
    }
    localStorage.removeItem("lodeale_admin_active_branch");
  }

  formatPhone(tel = "") {
    if (!tel || tel === "-") return "Sin teléfono";
    const digits = String(tel).replace(/\D/g, "");
    if (digits.length === 10) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("0")) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length >= 12 && digits.startsWith("549")) {
      const local = digits.slice(3);
      if (local.length === 10) {
        return `${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6)}`;
      }
    }
    return tel;
  }

  formatPriceARS(val) {
    const num = Number(val);
    if (isNaN(num) || num <= 0) return "";
    return new Intl.NumberFormat("es-AR").format(Math.round(num));
  }

  parsePriceARS(val) {
    const cleaned = String(val ?? "").replace(/[^\d]/g, "");
    return cleaned ? Number(cleaned) : 0;
  }

  compressImageFile(file, maxDim = 400) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => resolve(ev.target.result);
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width >= height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          } catch {
            resolve(ev.target.result);
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  showToast(message, type = "success") {
    const toast = document.getElementById("admin-toast");
    if (!toast) return;

    const isBranch = type === "branch";
    const borderClass = type === "error"
      ? "border-rose-500/45"
      : (isBranch
        ? "border-[#FBBF24]/70"
        : (type === "info" ? "border-[#FBBF24]/40" : "border-emerald-500/40"));

    const bgClass = isBranch ? "bg-[#1B1B1F]" : "bg-[#141417]";

    toast.className = `fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[80] px-4 py-3 rounded-xl ${bgClass} border ${borderClass} text-[#FAFAFA] font-medium text-xs shadow-2xl flex items-center gap-2.5 transition-all duration-200`;

    if (isBranch) {
      toast.innerHTML = `
        <span class="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span class="absolute inline-flex h-full w-full rounded-full bg-[#FBBF24] admin-dot-ping"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FBBF24]"></span>
        </span>
        <span class="font-semibold text-[#FAFAFA] tracking-tight">${message}</span>
      `;
      // Reiniciar animación de latido para cada cambio de sede
      toast.classList.remove("admin-toast-branch-pulse");
      void toast.offsetWidth;
      toast.classList.add("admin-toast-branch-pulse");

      // Pulsar también el indicador de sede activa en el sidebar
      const branchCard = document.getElementById("admin-active-branch-card");
      const branchDotPing = document.getElementById("admin-branch-dot-ping");
      if (branchCard) {
        branchCard.classList.remove("admin-branch-card-flash");
        void branchCard.offsetWidth;
        branchCard.classList.add("admin-branch-card-flash");
      }
      if (branchDotPing) {
        branchDotPing.classList.remove("hidden");
        clearTimeout(this._branchDotTimer);
        this._branchDotTimer = setTimeout(() => branchDotPing.classList.add("hidden"), 3000);
      }
    } else {
      const dotClass = type === "error"
        ? "bg-rose-500"
        : (type === "info" ? "bg-[#FBBF24]" : "bg-emerald-400");
      toast.innerHTML = `<span class="w-2 h-2 rounded-full ${dotClass} flex-shrink-0"></span><span>${message}</span>`;
    }

    toast.classList.remove("hidden");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
      toast.classList.remove("admin-toast-branch-pulse");
    }, isBranch ? 4000 : 3200);
  }

  showConfirm({ title = "Confirmar acción", message = "", detail = "", confirmText = "Confirmar", cancelText = "Mantener" } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById("admin-confirm-modal");
      const titleEl = document.getElementById("admin-confirm-title");
      const msgEl = document.getElementById("admin-confirm-message");
      const detailEl = document.getElementById("admin-confirm-detail");
      const btnOk = document.getElementById("btn-admin-confirm-ok");
      const btnCancel = document.getElementById("btn-admin-confirm-cancel");

      if (!modal || !btnOk || !btnCancel) {
        resolve(false);
        return;
      }

      if (titleEl) titleEl.innerText = title;
      if (msgEl) msgEl.innerText = message;
      if (detailEl) {
        if (detail) {
          detailEl.innerHTML = detail;
          detailEl.classList.remove("hidden");
        } else {
          detailEl.classList.add("hidden");
        }
      }
      btnOk.innerText = confirmText;
      btnCancel.innerText = cancelText;

      modal.classList.remove("hidden");
      modal.classList.add("flex");

      const cleanup = (result) => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        btnOk.removeEventListener("click", onOk);
        btnCancel.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onBackdrop);
        resolve(result);
      };

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };

      btnOk.addEventListener("click", onOk);
      btnCancel.addEventListener("click", onCancel);
      modal.addEventListener("click", onBackdrop);
    });
  }

  updateActiveBranchUI() {
    const badge = document.getElementById("admin-active-branch-badge");
    const mobileBranchName = document.getElementById("admin-mobile-branch-name");
    const switchBtn = document.getElementById("btn-admin-switch-branch");
    const suc = this.sucursales.find(s => s.id === this.selectedBranch) || this.sucursales[0];
    const nombreSuc = suc ? suc.nombre : "City Bell";

    if (badge) {
      badge.innerText = nombreSuc;
    }
    if (mobileBranchName) {
      mobileBranchName.innerText = nombreSuc;
    }

    if (switchBtn) {
      if (this.sucursales.length < 2) {
        switchBtn.classList.add("hidden");
      } else {
        const otra = this.sucursales.find(s => s.id !== this.selectedBranch) || this.sucursales[0];
        switchBtn.classList.remove("hidden");
        switchBtn.innerText = `Cambiar a ${otra.nombre}`;
        switchBtn.onclick = () => {
          const otraSesion = this.getBranchSession(otra.id);
          if (otraSesion) {
            // Ya tiene sesión válida esta semana en la otra sede
            localStorage.setItem("lodeale_admin_active_branch", otra.id);
            this.adminRole = otraSesion.role || "encargado";
            this.lockedBranch = otra.id;
            this.setActiveBranch(otra.id);
            if (typeof this.initSidebarHorariosContent === "function") {
              this.initSidebarHorariosContent();
            }
            this.showToast(`Cambiaste a sede ${otra.nombre}`, "branch");
          } else {
            // Pedir login para la otra sede SIN cerrar la sesión de la sede actual
            this.openLoginForBranch(otra.id);
          }
        };
      }
    }
  }

  openLoginForBranch(preselectBranchId = "suc_city_bell") {
    this.appView?.classList.add("hidden");
    this.loginScreen?.classList.remove("hidden");
    if (this.loginError) this.loginError.classList.add("hidden");
    if (this.emailInput) this.emailInput.value = "";
    if (this.passwordInput) this.passwordInput.value = "";
    if (typeof this.setLoginBranchSelection === "function") {
      this.setLoginBranchSelection(preselectBranchId || "suc_city_bell");
    }
    setTimeout(() => this.emailInput?.focus(), 100);
  }

  async logoutToLogin(preselectBranchId = "suc_city_bell") {
    if (window.dataService?.isSupabaseEnabled && window.dataService?.client?.auth) {
      try {
        await window.dataService.client.auth.signOut();
      } catch (err) {
        console.warn("Error al cerrar sesión en Supabase:", err);
      }
    }
    this.clearBranchSession(this.selectedBranch);
    localStorage.removeItem("lodeale_admin_auth");
    localStorage.removeItem("lodeale_admin_email");
    this.adminRole = "encargado";
    this.lockedBranch = null;
    this.openLoginForBranch(preselectBranchId || this.selectedBranch || "suc_city_bell");
  }

  setActiveBranch(branchId) {
    if (this.adminRole === "encargado" && this.lockedBranch) {
      branchId = this.lockedBranch;
    }
    this.selectedBranch = branchId;
    if (this.barberSelect && this.barberSelect.value !== "todos" && this.selectedBranch !== "todas") {
      const b = this.barberos.find(x => x.id === this.barberSelect.value);
      if (b && !window.dataService.barberoAtiendeEnSucursal(b, this.selectedBranch)) {
        this.barberSelect.value = "todos";
      }
    }
    this.setupBranchFilter();
    this.setupBarberSelectors();
    this.updateActiveBranchUI();
    this.renderList();
  }

  setupBranchFilter() {
    const container = document.getElementById("admin-branch-filter-pills");
    if (!container) return;

    const options = (this.adminRole === "encargado" && this.lockedBranch)
      ? this.sucursales.filter(s => s.id === this.lockedBranch).map(s => ({ id: s.id, nombre: s.nombre }))
      : [
          ...this.sucursales.map(s => ({ id: s.id, nombre: s.nombre })),
          { id: "todas", nombre: "Todas" }
        ];

    const renderPills = () => {
      container.innerHTML = options.map(opt => {
        const active = this.selectedBranch === opt.id;
        return `
          <button type="button" data-admin-branch="${opt.id}"
            class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors border whitespace-nowrap ${
              active
                ? "bg-[#FAFAFA] text-[#09090B] border-[#FAFAFA]"
                : "bg-[#1B1B1F] text-[#A1A1AA] border-[#27272A] hover:border-[#3F3F46] hover:text-[#FAFAFA]"
            }">
            ${opt.nombre}
          </button>
        `;
      }).join("");

      container.querySelectorAll("button[data-admin-branch]").forEach(btn => {
        btn.addEventListener("click", () => {
          if (this.adminRole === "encargado") return;
          this.setActiveBranch(btn.dataset.adminBranch);
        });
      });
    };

    renderPills();
    this.updateActiveBranchUI();
  }

  setupBarberSelectors() {
    if (!this.barberSelect || !this.blockBarberSelect) return;

    const ordenNombres = ["Ale", "Rami", "Tomás", "Lucho", "Nacho"];
    const filtrados = (this.selectedBranch && this.selectedBranch !== "todas")
      ? this.barberos.filter(b => window.dataService.barberoAtiendeEnSucursal(b, this.selectedBranch))
      : this.barberos;

    const ordenados = [...filtrados].sort((a, b) => {
      const idxA = ordenNombres.indexOf(a.nombre);
      const idxB = ordenNombres.indexOf(b.nombre);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    this.sortedBarberos = ordenados;

    // 1. Renderizar el menú desplegable oscuro personalizado para el filtro de la Agenda
    this.renderCustomBarberDropdown();

    // 2. Poblar el selector de bloqueo de horario con dropdown oscuro personalizado
    this.renderCustomBlockBarberDropdown();
  }

  renderBarberAvatar(barber, sizeClass = "w-7 h-7", textClass = "text-[10px]", extraClass = "") {
    const nombre = barber?.nombre || "Barbero";
    const iniciales = nombre.replace(/\(.*?\)/g, "").trim().substring(0, 2).toUpperCase() || "B";
    if (barber?.foto) {
      return `<img src="${barber.foto}" alt="${nombre}" class="${sizeClass} rounded-full object-cover object-[50%_36%] border border-[#3F3F46] flex-shrink-0 ${extraClass}">`;
    }
    return `<span class="${sizeClass} rounded-full bg-[#1B1B1F] border border-[#27272A] text-[#A1A1AA] font-semibold ${textClass} inline-flex items-center justify-center flex-shrink-0 ${extraClass}">${iniciales}</span>`;
  }

  renderCustomBarberDropdown() {
    const dropdown = document.getElementById("admin-custom-barber-dropdown");
    const labelEl = document.getElementById("admin-barber-label");
    const pickerAvatarEl = document.getElementById("admin-barber-picker-avatar");
    if (!dropdown || !this.barberSelect) return;

    const currentVal = this.barberSelect.value || "todos";
    const usersIcon = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    const checkIcon = `<svg class="w-3.5 h-3.5 text-[#FAFAFA] flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`;

    const items = [
      { id: "todos", nombre: "Todos los barberos", sub: "Ver agenda general", barber: null, isAll: true },
      ...(this.sortedBarberos || this.barberos).map(b => ({
        id: b.id,
        nombre: b.nombre,
        sub: b.especialidad || (b.rol && b.rol.toLowerCase() !== "fundador" ? b.rol : "Barbero"),
        barber: b,
        isAll: false
      }))
    ];

    const activeItem = items.find(i => i.id === currentVal) || items[0];
    if (labelEl) {
      labelEl.innerText = activeItem.nombre;
    }
    if (pickerAvatarEl) {
      if (activeItem.barber) {
        pickerAvatarEl.innerHTML = this.renderBarberAvatar(activeItem.barber, "w-5 h-5", "text-[9px]");
        pickerAvatarEl.classList.remove("hidden");
      } else {
        pickerAvatarEl.innerHTML = "";
        pickerAvatarEl.classList.add("hidden");
      }
    }

    dropdown.innerHTML = items.map(item => {
      const isSelected = item.id === currentVal;
      const avatarHtml = item.isAll
        ? `<div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            isSelected ? "bg-[#FAFAFA] text-[#09090B]" : "bg-[#1B1B1F] text-[#A1A1AA] border border-[#27272A]"
          }">${usersIcon}</div>`
        : this.renderBarberAvatar(item.barber, "w-7 h-7", "text-[11px]");

      return `
        <button type="button" data-barber-opt="${item.id}"
          class="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left cursor-pointer ${
            isSelected
              ? "bg-[#27272A] text-[#FAFAFA] border border-[#3F3F46]"
              : "hover:bg-[#1B1B1F] text-[#E4E4E7] border border-transparent"
          }">
          <div class="flex items-center gap-2.5 min-w-0">
            ${avatarHtml}
            <div class="min-w-0">
              <div class="text-[14px] font-semibold leading-tight truncate text-[#FAFAFA]">
                ${item.nombre}
              </div>
              <div class="text-[13px] text-[#A1A1AA] leading-tight mt-0.5 truncate">${item.sub}</div>
            </div>
          </div>
          ${isSelected ? checkIcon : ""}
        </button>
      `;
    }).join("");

    dropdown.querySelectorAll("button[data-barber-opt]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const val = btn.dataset.barberOpt;
        this.barberSelect.value = val;
        dropdown.classList.add("hidden");
        this.renderCustomBarberDropdown();
        this.renderList();
      });
    });
  }

  renderCustomBlockBarberDropdown() {
    const dropdown = document.getElementById("block-barber-dropdown");
    const labelEl = document.getElementById("block-barber-label");
    const hiddenInp = document.getElementById("block-barber");
    if (!dropdown || !hiddenInp) return;

    const lockIcon = `<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const checkIcon = `<svg class="w-3.5 h-3.5 text-[#FAFAFA] flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`;

    const ordenados = this.sortedBarberos || this.barberos;
    const items = [
      ...ordenados.map(b => ({
        id: b.id,
        nombre: b.nombre,
        barber: b,
        isAll: false
      })),
      { id: "todos", nombre: "Todos los barberos (Cerrar local)", barber: null, isAll: true }
    ];

    if (!hiddenInp.value && items.length > 0) {
      hiddenInp.value = items[0].id;
    }

    const curVal = hiddenInp.value;
    const activeItem = items.find(i => i.id === curVal) || items[0];
    if (labelEl) labelEl.innerText = activeItem.nombre;

    dropdown.innerHTML = items.map(item => {
      const isSelected = item.id === curVal;
      const avatarHtml = item.isAll
        ? `<span class="w-6 h-6 rounded-full bg-[#1B1B1F] border border-[#27272A] flex items-center justify-center text-[#FAFAFA] flex-shrink-0">${lockIcon}</span>`
        : this.renderBarberAvatar(item.barber, "w-6 h-6", "text-[10px]");

      return `
        <button type="button" data-val="${item.id}"
          class="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
            isSelected
              ? "bg-[#27272A] text-[#FAFAFA] font-semibold border border-[#3F3F46]"
              : "text-[#A1A1AA] hover:bg-[#1B1B1F] hover:text-[#FAFAFA] border border-transparent"
          }">
          <div class="flex items-center gap-2 min-w-0">
            ${avatarHtml}
            <span class="text-[14px] font-medium truncate">${item.nombre}</span>
          </div>
          ${isSelected ? checkIcon : ""}
        </button>
      `;
    }).join("");

    dropdown.querySelectorAll("button[data-val]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        hiddenInp.value = btn.dataset.val;
        dropdown.classList.add("hidden");
        this.renderCustomBlockBarberDropdown();
      });
    });
  }

  setupBlockTimeDropdowns() {
    const startInp = document.getElementById("block-time-start");
    const endInp = document.getElementById("block-time-end");
    const startPicker = document.getElementById("btn-block-time-start-picker");
    const endPicker = document.getElementById("btn-block-time-end-picker");
    const startDropdown = document.getElementById("block-time-start-dropdown");
    const endDropdown = document.getElementById("block-time-end-dropdown");
    const startLabel = document.getElementById("block-time-start-label");
    const endLabel = document.getElementById("block-time-end-label");
    const barberPicker = document.getElementById("btn-block-barber-picker");
    const barberDropdown = document.getElementById("block-barber-dropdown");

    if (!startInp || !endInp) return;

    // Generar todas las opciones posibles de 10:00 a 21:00 cada 30 min
    const allOptions = [];
    for (let h = 10; h <= 21; h++) {
      const hh = String(h).padStart(2, "0");
      allOptions.push(`${hh}:00`);
      if (h < 21) {
        allOptions.push(`${hh}:30`);
      }
    }

    const timeToMinutes = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const renderStartTimeMenu = () => {
      const curStart = startInp.value || "13:00";
      if (startLabel) startLabel.innerText = `${curStart} hs`;

      // 'Desde' puede ser cualquier horario hasta las 20:30
      const startOpts = allOptions.filter(t => timeToMinutes(t) < 21 * 60);

      startDropdown.innerHTML = startOpts.map(t => {
        const isSelected = t === curStart;
        return `
          <button type="button" data-time="${t}"
            class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left admin-tabular text-[14px] transition-colors ${
              isSelected
                ? "bg-[#27272A] text-[#FAFAFA] font-semibold"
                : "text-[#A1A1AA] hover:bg-[#1B1B1F] hover:text-[#FAFAFA]"
            }">
            <span>${t} hs</span>
            ${isSelected ? `<span class="text-[#FAFAFA]">✓</span>` : ""}
          </button>
        `;
      }).join("");

      startDropdown.querySelectorAll("button[data-time]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          startInp.value = btn.dataset.time;
          startDropdown.classList.add("hidden");
          renderStartTimeMenu();
          
          // Al cambiar 'Desde', actualizar 'Hasta' para que solo muestre horarios posteriores
          ensureEndIsAfterStart();
          renderEndTimeMenu();
        });
      });
    };

    const renderEndTimeMenu = () => {
      const startMin = timeToMinutes(startInp.value || "13:00");
      // 'Hasta' solo muestra horarios estrictamente posteriores a 'Desde'
      const endOpts = allOptions.filter(t => timeToMinutes(t) > startMin);

      let curEnd = endInp.value || "14:00";
      if (timeToMinutes(curEnd) <= startMin && endOpts.length > 0) {
        curEnd = endOpts[0];
        endInp.value = curEnd;
      }
      if (endLabel) endLabel.innerText = `${curEnd} hs`;

      endDropdown.innerHTML = endOpts.map(t => {
        const isSelected = t === curEnd;
        return `
          <button type="button" data-time="${t}"
            class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left admin-tabular text-[14px] transition-colors ${
              isSelected
                ? "bg-[#27272A] text-[#FAFAFA] font-semibold"
                : "text-[#A1A1AA] hover:bg-[#1B1B1F] hover:text-[#FAFAFA]"
            }">
            <span>${t} hs</span>
            ${isSelected ? `<span class="text-[#FAFAFA]">✓</span>` : ""}
          </button>
        `;
      }).join("");

      endDropdown.querySelectorAll("button[data-time]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          endInp.value = btn.dataset.time;
          endDropdown.classList.add("hidden");
          renderEndTimeMenu();
        });
      });
    };

    const ensureEndIsAfterStart = () => {
      const startMin = timeToMinutes(startInp.value || "13:00");
      const endMin = timeToMinutes(endInp.value || "14:00");
      if (endMin <= startMin) {
        const nextValid = allOptions.find(t => timeToMinutes(t) > startMin);
        if (nextValid) {
          endInp.value = nextValid;
        }
      }
    };

    renderStartTimeMenu();
    ensureEndIsAfterStart();
    renderEndTimeMenu();

    // Toggle dropdowns para bloqueo
    barberPicker?.addEventListener("click", (e) => {
      e.stopPropagation();
      startDropdown?.classList.add("hidden");
      endDropdown?.classList.add("hidden");
      document.getElementById("block-date-dropdown")?.classList.add("hidden");
      barberDropdown?.classList.toggle("hidden");
    });

    startPicker?.addEventListener("click", (e) => {
      e.stopPropagation();
      barberDropdown?.classList.add("hidden");
      endDropdown?.classList.add("hidden");
      document.getElementById("block-date-dropdown")?.classList.add("hidden");
      startDropdown?.classList.toggle("hidden");
    });

    endPicker?.addEventListener("click", (e) => {
      e.stopPropagation();
      barberDropdown?.classList.add("hidden");
      startDropdown?.classList.add("hidden");
      document.getElementById("block-date-dropdown")?.classList.add("hidden");
      endDropdown?.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!barberDropdown?.contains(e.target) && !barberPicker?.contains(e.target)) {
        barberDropdown?.classList.add("hidden");
      }
      if (!startDropdown?.contains(e.target) && !startPicker?.contains(e.target)) {
        startDropdown?.classList.add("hidden");
      }
      if (!endDropdown?.contains(e.target) && !endPicker?.contains(e.target)) {
        endDropdown?.classList.add("hidden");
      }
    });
  }

  async openManualBookingModal() {
    if (!this.manualBookingModal) {
      this.manualBookingModal = document.getElementById("manual-booking-modal");
    }
    if (!this.manualBookingModal) return;

    this.manualBookingModal.classList.remove("hidden");
    this.manualBookingModal.classList.add("flex");

    if (typeof this.populateManualFormFields === "function") {
      await this.populateManualFormFields();
    }
  }

  openBlockModal() {
    if (!this.blockModal) {
      this.blockModal = document.getElementById("block-modal");
    }
    if (!this.blockModal) return;
    this.blockModal.classList.remove("hidden");
    this.blockModal.classList.add("flex");
    
    // Ocultar alerta de conflicto si quedó abierta
    const conflictAlert = document.getElementById("block-conflict-alert");
    if (conflictAlert) conflictAlert.classList.add("hidden");

    const blockDateInp = document.getElementById("block-date");
    if (blockDateInp) {
      blockDateInp.value = this.formatDateYYYYMMDD(this.selectedDate);
    }
    const blockBranchSel = document.getElementById("block-branch");
    if (blockBranchSel) {
      if (this.adminRole === "encargado" && this.lockedBranch) {
        blockBranchSel.value = this.lockedBranch;
        blockBranchSel.disabled = true;
      } else {
        blockBranchSel.disabled = false;
        if (this.selectedBranch && this.selectedBranch !== "todas") {
          blockBranchSel.value = this.selectedBranch;
        }
      }
    }
    this.renderCustomBlockDatePicker();
    this.renderCustomBlockBarberDropdown();
  }

  renderCustomBlockDatePicker() {
    const label = document.getElementById("block-date-label");
    const dropdown = document.getElementById("block-date-dropdown");
    const hiddenInp = document.getElementById("block-date");
    const pickerBtn = document.getElementById("btn-block-date-picker");
    const monthTitle = document.getElementById("block-cal-month-title");
    const gridEl = document.getElementById("block-cal-days-grid");
    if (!label || !dropdown || !hiddenInp || !gridEl) return;

    if (!hiddenInp.value) {
      hiddenInp.value = this.formatDateYYYYMMDD(this.selectedDate);
    }

    const curVal = hiddenInp.value;
    const [cy, cm, cd] = curVal.split("-").map(Number);
    const dateObj = new Date(cy, cm - 1, cd);

    label.innerText = `${this.diasSemana[dateObj.getDay()]} ${cd} de ${this.meses[cm - 1]}`;

    if (!this.blockCalViewDate) {
      this.blockCalViewDate = new Date(cy, cm - 1, 1);
    }

    const vy = this.blockCalViewDate.getFullYear();
    const vm = this.blockCalViewDate.getMonth();
    if (monthTitle) monthTitle.innerText = `${this.meses[vm]} ${vy}`;

    const primerDia = new Date(vy, vm, 1).getDay();
    const totalDias = new Date(vy, vm + 1, 0).getDate();

    let html = "";
    for (let i = 0; i < primerDia; i++) {
      html += `<div class="p-1"></div>`;
    }

    for (let dia = 1; dia <= totalDias; dia++) {
      const thisD = new Date(vy, vm, dia);
      const thisStr = this.formatDateYYYYMMDD(thisD);
      const isSelected = thisStr === curVal;
      const isSunday = thisD.getDay() === 0;

      let cls = "admin-tabular w-6 h-6 mx-auto rounded-md text-[11px] font-medium flex items-center justify-center transition-colors cursor-pointer ";
      if (isSelected) {
        cls += "bg-[#FAFAFA] text-[#09090B] font-semibold";
      } else if (isSunday) {
        cls += "text-[#52525B] line-through opacity-50 cursor-not-allowed";
      } else {
        cls += "text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]";
      }

      html += `
        <div class="py-0.5">
          <button type="button" class="${cls}" data-block-cal-date="${thisStr}" ${isSunday ? "disabled" : ""}>
            ${dia}
          </button>
        </div>
      `;
    }
    gridEl.innerHTML = html;

    gridEl.querySelectorAll("button[data-block-cal-date]").forEach(btn => {
      btn.addEventListener("click", () => {
        hiddenInp.value = btn.dataset.blockCalDate;
        dropdown.classList.add("hidden");
        this.renderCustomBlockDatePicker();
      });
    });

    if (!this._blockCalBound) {
      this._blockCalBound = true;
      pickerBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        document.getElementById("block-barber-dropdown")?.classList.add("hidden");
        document.getElementById("block-time-start-dropdown")?.classList.add("hidden");
        document.getElementById("block-time-end-dropdown")?.classList.add("hidden");
        dropdown.classList.toggle("hidden");
      });

      document.getElementById("block-cal-prev-month")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.blockCalViewDate.setMonth(this.blockCalViewDate.getMonth() - 1);
        this.renderCustomBlockDatePicker();
      });

      document.getElementById("block-cal-next-month")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.blockCalViewDate.setMonth(this.blockCalViewDate.getMonth() + 1);
        this.renderCustomBlockDatePicker();
      });

      document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && !pickerBtn.contains(e.target)) {
          dropdown.classList.add("hidden");
        }
      });
    }
  }

  switchAdminView(viewName = "agenda") {
    const views = ["agenda", "horarios", "barberos", "precios"];
    const titles = {
      agenda: "Agenda de Turnos",
      horarios: "Días y Horarios",
      barberos: "Profesionales",
      precios: "Servicios y Precios"
    };
    views.forEach(v => {
      const el = document.getElementById(`admin-view-${v}`);
      if (el) el.classList.toggle("hidden", v !== viewName);
    });
    document.querySelectorAll("#admin-sidebar-nav button[data-admin-nav]").forEach(btn => {
      const isAct = btn.dataset.adminNav === viewName;
      btn.className = isAct
        ? "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#27272A] text-[#FAFAFA] text-[15px] font-semibold text-left transition-colors cursor-pointer"
        : "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#1B1B1F] text-[15px] font-medium text-left transition-colors cursor-pointer";
    });
    const mobTitle = document.getElementById("admin-mobile-view-title");
    if (mobTitle) mobTitle.innerText = titles[viewName] || "Gestión";
  }

  async openPricesModal() {
    this.switchAdminView("precios");
    if (typeof this._openPricesModalInternal === "function") {
      await this._openPricesModalInternal();
    }
  }

  async openBarbersModal() {
    this.switchAdminView("barberos");
    if (typeof this._openBarbersModalInternal === "function") {
      await this._openBarbersModalInternal();
    }
  }

  openSidebarHorarios() {
    this.switchAdminView("horarios");
    if (typeof this.initSidebarHorariosContent === "function") {
      this.initSidebarHorariosContent();
    }
  }

  closeSidebarHorarios() {
    this.switchAdminView("agenda");
  }

  setupSidebarHorarios() {
    const panel = document.getElementById("admin-view-horarios");
    const btnSave = document.getElementById("btn-save-sidebar-horarios");
    const tabsContainer = document.getElementById("sidebar-barber-tabs");
    const daysContainer = document.getElementById("sidebar-days-schedule-container");

    if (!panel) return;

    let selectedBarberId = this.barberos[0]?.id || "b1";
    let editingSchedules = {}; // { [dayNum]: [ { sucursal_id, desde, hasta } ] }

    const nombresDias = {
      1: "Lunes",
      2: "Martes",
      3: "Miércoles",
      4: "Jueves",
      5: "Viernes",
      6: "Sábado"
    };

    // Generar horas para los selects (de 08:00 a 22:00 cada 30 min)
    const timeOptions = [];
    for (let h = 8; h <= 22; h++) {
      const hh = String(h).padStart(2, "0");
      timeOptions.push(`${hh}:00`);
      if (h < 22) timeOptions.push(`${hh}:30`);
    }

    // Todos los profesionales disponibles universalmente, sin depender de la sucursal de la sesión
    const getAllBarbers = () => {
      const ordenNombres = ["Ale", "Rami", "Tiago", "Lucho", "Benja", "Toto", "Thiago (Frenchis)", "Lauti"];
      return [...(this.barberos || [])]
        .filter(b => b.activo !== false)
        .sort((a, b) => {
          const idxA = ordenNombres.indexOf(a.nombre);
          const idxB = ordenNombres.indexOf(b.nombre);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
    };

    const defaultScheduleForDay = () => {
      const barber = this.barberos.find(b => b.id === selectedBarberId);
      const sucursalExistente = Object.values(barber?.horarios || {})
        .flat()
        .find(f => f && f.sucursal_id)?.sucursal_id;
      const defaultSuc = sucursalExistente
        || ((this.selectedBranch && this.selectedBranch !== "todas") ? this.selectedBranch : "suc_city_bell");
      return [{ sucursal_id: defaultSuc, desde: "09:30", hasta: "20:00" }];
    };

    this.initSidebarHorariosContent = () => {
      const todos = getAllBarbers();
      if (todos.length === 0) return;
      if (!selectedBarberId || !todos.some(b => b.id === selectedBarberId)) {
        selectedBarberId = todos[0].id;
      }
      loadBarberSchedule(selectedBarberId);
      renderBarberTabs();
    };

    const loadBarberSchedule = (barberId) => {
      const barber = this.barberos.find(b => b.id === barberId);
      const raw = barber?.horarios || {};
      editingSchedules = {};
      for (let d = 1; d <= 6; d++) {
        if (raw[d] && Array.isArray(raw[d]) && raw[d].length > 0) {
          editingSchedules[d] = JSON.parse(JSON.stringify(raw[d]));
        } else if (raw[d] === null || raw[d] === false) {
          editingSchedules[d] = []; // Inactivo
        } else {
          // Por defecto de 10 a 20 (sábados 10 a 21)
          editingSchedules[d] = defaultScheduleForDay(d);
        }
      }
      renderDaysSchedule();
    };

    const renderBarberTabs = () => {
      if (!tabsContainer) return;
      const ordenados = getAllBarbers();
      tabsContainer.innerHTML = ordenados.map(b => {
        const isSel = b.id === selectedBarberId;
        const avatarHtml = this.renderBarberAvatar(
          b,
          "w-7 h-7",
          "text-[11px]",
          isSel ? "ring-1 ring-[#FAFAFA]" : ""
        );
        return `
          <button type="button" data-barber-id="${b.id}"
            class="flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-[14px] font-semibold transition-colors whitespace-nowrap border cursor-pointer ${
              isSel
                ? "bg-[#27272A] text-[#FAFAFA] border-[#52525B]"
                : "bg-[#18181B] text-[#A1A1AA] border-[#27272A] hover:border-[#3F3F46] hover:text-[#FAFAFA]"
            }">
            ${avatarHtml}
            <span>${b.nombre}</span>
          </button>
        `;
      }).join("");

      tabsContainer.querySelectorAll("button[data-barber-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedBarberId = btn.dataset.barberId;
          renderBarberTabs();
          loadBarberSchedule(selectedBarberId);
        });
      });
    };

    const renderDaysSchedule = () => {
      if (!daysContainer) return;
      let html = "";

      for (let d = 1; d <= 6; d++) {
        const diaNombre = nombresDias[d];
        const franjas = editingSchedules[d] || [];
        const isActivo = franjas.length > 0;

        html += `
          <div class="box-border w-full p-4 rounded-xl bg-[#141417] border ${isActivo ? 'border-[#27272A]' : 'border-rose-500/25'} space-y-3 transition-colors">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-semibold text-[15px] text-[#FAFAFA]">${diaNombre}</span>
                <span class="text-[13px] font-medium px-2.5 py-0.5 rounded-full border ${
                  isActivo
                    ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/25"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/25"
                }">
                  ${isActivo ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button type="button" data-toggle-dia="${d}"
                  class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border cursor-pointer ${
                    isActivo
                      ? "bg-[#1B1B1F] text-[#A1A1AA] hover:text-rose-300 hover:border-rose-500/35 border-[#27272A]"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                  }">
                  ${isActivo ? "Desactivar" : "Activar"}
                </button>

                ${isActivo && franjas.length === 1 ? `
                  <button type="button" data-add-parate="${d}"
                    class="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[#1B1B1F] hover:bg-[#27272A] text-[#E4E4E7] border border-[#27272A] hover:border-[#3F3F46] transition-colors whitespace-nowrap cursor-pointer"
                    title="Dividir el día en dos turnos (ej: 09:30 a 13:00 y 15:00 a 20:00)">
                    + Cortar
                  </button>
                ` : ""}
              </div>
            </div>

            <!-- Tabla de turnos / franjas para este día -->
            ${isActivo ? `
              <div class="space-y-2 pt-2.5 border-t border-[#27272A]">
                ${franjas.map((franja, fIdx) => `
                  <div class="box-border w-full p-3 rounded-xl bg-[#1B1B1F] border border-[#27272A] space-y-2.5 text-[13px]">
                    <!-- Fila superior: Turno + Sede + Botón X -->
                    <div class="flex items-center justify-between gap-2 w-full">
                      <div class="flex items-center gap-2 font-medium text-[#A1A1AA] min-w-0">
                        <span class="text-[#E4E4E7] whitespace-nowrap">${franjas.length > 1 ? (fIdx === 0 ? "Turno 1:" : "Turno 2:") : "Sede:"}</span>
                        <div class="relative schedule-time-picker-wrap">
                          <button type="button"
                            class="btn-schedule-time flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#09090B] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3F3F46] text-[#FAFAFA] text-[13px] font-medium transition-colors whitespace-nowrap cursor-pointer"
                            data-branch-day="${d}" data-branch-fidx="${fIdx}">
                            <span>${this.sucursales.find(s => s.id === (franja.sucursal_id || "suc_city_bell"))?.nombre || "City Bell"}</span>
                            <svg class="w-3.5 h-3.5 text-[#A1A1AA] pointer-events-none flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                          <div class="schedule-time-dropdown hidden absolute z-[70] left-0 top-full mt-1 w-40 bg-[#141417] border border-[#27272A] rounded-xl shadow-2xl p-1">
                            ${this.sucursales.map(s => {
                              const isSel = (franja.sucursal_id || "suc_city_bell") === s.id;
                              return `
                                <button type="button" data-branch-val="${s.id}"
                                  class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[13px] font-medium transition-colors cursor-pointer ${
                                    isSel
                                      ? "bg-[#27272A] text-[#FAFAFA] font-semibold"
                                      : "text-[#A1A1AA] hover:bg-[#1B1B1F] hover:text-[#FAFAFA]"
                                  }">
                                  <span>${s.nombre}</span>
                                  ${isSel ? `<span class="text-xs text-[#FAFAFA]">✓</span>` : ""}
                                </button>
                              `;
                            }).join("")}
                          </div>
                        </div>
                      </div>

                      ${franjas.length > 1 ? `
                        <button type="button" data-remove-franja-day="${d}" data-remove-franja-idx="${fIdx}"
                          class="w-7 h-7 flex-shrink-0 rounded-lg bg-rose-500/12 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 flex items-center justify-center transition-colors cursor-pointer"
                          title="Eliminar este turno y volver a horario de corrido" aria-label="Eliminar turno">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      ` : ""}
                    </div>

                    <!-- Fila inferior: Desde y Hasta -->
                    <div class="flex flex-wrap items-center gap-2 w-full">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[#A1A1AA] text-[13px] font-medium whitespace-nowrap">Desde:</span>
                        <div class="relative schedule-time-picker-wrap">
                          <button type="button" 
                            class="btn-schedule-time admin-tabular min-w-[96px] whitespace-nowrap flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#09090B] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3F3F46] text-[#FAFAFA] text-[14px] font-medium transition-colors cursor-pointer"
                            data-day="${d}" data-fidx="${fIdx}" data-field="desde">
                            <span class="whitespace-nowrap">${franja.desde} hs</span>
                            <svg class="w-3.5 h-3.5 text-[#A1A1AA] pointer-events-none flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                          <div class="schedule-time-dropdown hidden absolute z-[70] left-0 top-full mt-1 w-32 max-h-48 overflow-y-auto bg-[#141417] border border-[#27272A] rounded-xl shadow-2xl p-1">
                            ${timeOptions.map(t => {
                              const isSel = t === franja.desde;
                              return `
                                <button type="button" data-time-val="${t}"
                                  class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left admin-tabular text-[14px] transition-colors cursor-pointer ${
                                    isSel
                                      ? "bg-[#27272A] text-[#FAFAFA] font-semibold"
                                      : "text-[#A1A1AA] hover:bg-[#1B1B1F] hover:text-[#FAFAFA]"
                                  }">
                                  <span>${t} hs</span>
                                  ${isSel ? `<span class="text-xs text-[#FAFAFA]">✓</span>` : ""}
                                </button>
                              `;
                            }).join("")}
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5">
                        <span class="text-[#A1A1AA] text-[13px] font-medium whitespace-nowrap">Hasta:</span>
                        <div class="relative schedule-time-picker-wrap">
                          <button type="button" 
                            class="btn-schedule-time admin-tabular min-w-[96px] whitespace-nowrap flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#09090B] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3F3F46] text-[#FAFAFA] text-[14px] font-medium transition-colors cursor-pointer"
                            data-day="${d}" data-fidx="${fIdx}" data-field="hasta">
                            <span class="whitespace-nowrap">${franja.hasta} hs</span>
                            <svg class="w-3.5 h-3.5 text-[#A1A1AA] pointer-events-none flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                          <div class="schedule-time-dropdown hidden absolute z-[70] right-0 top-full mt-1 w-32 max-h-48 overflow-y-auto bg-[#141417] border border-[#27272A] rounded-xl shadow-2xl p-1">
                            ${timeOptions.map(t => {
                              const isSel = t === franja.hasta;
                              return `
                                <button type="button" data-time-val="${t}"
                                  class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left admin-tabular text-[14px] transition-colors cursor-pointer ${
                                    isSel
                                      ? "bg-[#27272A] text-[#FAFAFA] font-semibold"
                                      : "text-[#A1A1AA] hover:bg-[#1B1B1F] hover:text-[#FAFAFA]"
                                  }">
                                  <span>${t} hs</span>
                                  ${isSel ? `<span class="text-xs text-[#FAFAFA]">✓</span>` : ""}
                                </button>
                              `;
                            }).join("")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : `
              <p class="text-[13px] text-[#71717A] italic pt-1">Este profesional no atenderá los ${diaNombre.toLowerCase()}s.</p>
            `}
          </div>
        `;
      }

      daysContainer.innerHTML = html;

      // Listeners de activación / inactivación de día
      daysContainer.querySelectorAll("button[data-toggle-dia]").forEach(btn => {
        btn.addEventListener("click", () => {
          const d = Number(btn.dataset.toggleDia);
          if (editingSchedules[d] && editingSchedules[d].length > 0) {
            editingSchedules[d] = []; // Inactivar
          } else {
            editingSchedules[d] = defaultScheduleForDay(d); // Activar
          }
          renderDaysSchedule();
        });
      });

      // Listeners para agregar parate (2do turno)
      daysContainer.querySelectorAll("button[data-add-parate]").forEach(btn => {
        btn.addEventListener("click", () => {
          const d = Number(btn.dataset.addParate);
          const sucActual = editingSchedules[d]?.[0]?.sucursal_id || "suc_villa_elisa";
          editingSchedules[d] = [
            { sucursal_id: sucActual, desde: "09:30", hasta: "13:00" },
            { sucursal_id: sucActual, desde: "15:00", hasta: "20:00" }
          ];
          renderDaysSchedule();
        });
      });

      // Listeners para cambiar sucursal en una franja (dropdown custom oscuro)
      daysContainer.querySelectorAll(".schedule-time-dropdown button[data-branch-val]").forEach(optBtn => {
        optBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const wrap = optBtn.closest(".schedule-time-picker-wrap");
          const triggerBtn = wrap?.querySelector(".btn-schedule-time");
          const d = Number(triggerBtn?.dataset.branchDay);
          const fIdx = Number(triggerBtn?.dataset.branchFidx);
          if (editingSchedules[d] && editingSchedules[d][fIdx]) {
            editingSchedules[d][fIdx].sucursal_id = optBtn.dataset.branchVal;
          }
          renderDaysSchedule();
        });
      });

      // Listeners para remover un turno cortado
      daysContainer.querySelectorAll("button[data-remove-franja-day]").forEach(btn => {
        btn.addEventListener("click", () => {
          const d = Number(btn.dataset.removeFranjaDay);
          const fIdx = Number(btn.dataset.removeFranjaIdx);
          editingSchedules[d].splice(fIdx, 1);
          if (editingSchedules[d].length === 0) {
            editingSchedules[d] = defaultScheduleForDay(d);
          }
          renderDaysSchedule();
        });
      });

      // Listeners de dropdowns oscuros personalizados de horarios
      daysContainer.querySelectorAll(".btn-schedule-time").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const wrap = btn.closest(".schedule-time-picker-wrap");
          const dropdown = wrap?.querySelector(".schedule-time-dropdown");
          const isCurrentlyOpen = dropdown && !dropdown.classList.contains("hidden");

          // Cerrar todos los dropdowns abiertos en el panel
          panel.querySelectorAll(".schedule-time-dropdown").forEach(d => d.classList.add("hidden"));

          if (!isCurrentlyOpen && dropdown) {
            dropdown.classList.remove("hidden");
          }
        });
      });

      daysContainer.querySelectorAll(".schedule-time-dropdown button[data-time-val]").forEach(optBtn => {
        optBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = optBtn.dataset.timeVal;
          const wrap = optBtn.closest(".schedule-time-picker-wrap");
          const triggerBtn = wrap?.querySelector(".btn-schedule-time");
          const d = Number(triggerBtn?.dataset.day);
          const fIdx = Number(triggerBtn?.dataset.fidx);
          const field = triggerBtn?.dataset.field;

          if (editingSchedules[d] && editingSchedules[d][fIdx]) {
            editingSchedules[d][fIdx][field] = val;
          }

          renderDaysSchedule();
        });
      });
    };

    // Cerrar dropdowns de horarios al hacer click afuera
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".schedule-time-picker-wrap")) {
        panel.querySelectorAll(".schedule-time-dropdown").forEach(d => d.classList.add("hidden"));
      }
    });

    btnSave?.addEventListener("click", async () => {
      btnSave.disabled = true;
      const originalText = btnSave.innerHTML;
      btnSave.innerHTML = `<span>Guardando...</span>`;

      try {
        await window.dataService.guardarHorariosBarbero(selectedBarberId, editingSchedules);
        
        // Actualizar en memoria local
        const b = this.barberos.find(x => x.id === selectedBarberId);
        if (b) b.horarios = editingSchedules;

        this.showToast(`Horarios de ${b ? b.nombre : "barbero"} guardados`);
        this.renderList();
      } catch (err) {
        this.showToast("Error al guardar los horarios: " + err.message, "error");
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
      }
    });
  }

  setupManualBooking() {
    const btnClose = document.getElementById("btn-close-manual-booking-modal");
    const btnCancel = document.getElementById("btn-cancel-manual-booking");
    const form = document.getElementById("manual-booking-form");

    const inputBranch = document.getElementById("manual-booking-branch");
    const branchCardsContainer = document.getElementById("manual-booking-branch-cards");
    const inputService = document.getElementById("manual-booking-service");
    const serviceCardsContainer = document.getElementById("manual-booking-service-cards");
    const inputBarber = document.getElementById("manual-booking-barber");
    const barberCardsContainer = document.getElementById("manual-booking-barber-cards");
    const inputDate = document.getElementById("manual-booking-date");
    const dateStripContainer = document.getElementById("manual-booking-date-strip");
    const selectedDateLabel = document.getElementById("manual-booking-selected-date-label");
    const inputTime = document.getElementById("manual-booking-time");
    const errorEl = document.getElementById("manual-booking-error");
    const submitBtn = document.getElementById("btn-submit-manual-booking");

    if (!this.manualBookingModal || !form) return;

    const renderBranchCards = () => {
      if (!branchCardsContainer || !inputBranch) return;
      const curBranchId = inputBranch.value;
      branchCardsContainer.innerHTML = this.sucursales.map(s => {
        const active = s.id === curBranchId;
        return `
          <button type="button" data-branch-id="${s.id}"
            class="p-2.5 rounded-xl text-left transition-colors border cursor-pointer ${
              active
                ? "bg-[#27272A] border-[#FAFAFA] text-[#FAFAFA]"
                : "bg-[#1B1B1F] border-[#27272A] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#FAFAFA]"
            }">
            <div class="font-semibold text-[14px] text-[#FAFAFA]">${s.nombre}</div>
            <div class="text-[13px] text-[#A1A1AA] truncate mt-0.5">${s.direccion}</div>
          </button>
        `;
      }).join("");

      branchCardsContainer.querySelectorAll("button[data-branch-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          inputBranch.value = btn.dataset.branchId;
          renderBranchCards();
          // Ajustar barbero si el actual no atiende en esta sede
          const filtrados = this.barberos.filter(b => b.activo !== false && window.dataService.barberoAtiendeEnSucursal(b, inputBranch.value));
          if (filtrados.length > 0 && !filtrados.some(b => b.id === inputBarber.value)) {
            inputBarber.value = filtrados[0].id;
          }
          renderBarberCards();
          this.refreshManualBookingSlots();
        });
      });
    };

    const renderServiceCards = () => {
      if (!serviceCardsContainer || !inputService) return;
      const curServiceId = inputService.value;
      serviceCardsContainer.innerHTML = this.servicios.map(s => {
        const active = s.id === curServiceId;
        const tienePrecio = s.precio && Number(s.precio) > 0;
        const precioFmt = tienePrecio ? `$${this.formatPriceARS(s.precio)}` : "Sin precio";
        const nombreLimpio = (s.nombre || "").replace(/\s*\(descuento en efectivo\)/i, "").trim();
        return `
          <button type="button" data-service-id="${s.id}"
            class="p-2.5 rounded-xl text-left transition-colors border cursor-pointer ${
              active
                ? "bg-[#27272A] border-[#FAFAFA] text-[#FAFAFA]"
                : "bg-[#1B1B1F] border-[#27272A] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#FAFAFA]"
            }">
            <div class="font-semibold text-[14px] leading-snug text-[#FAFAFA]">${nombreLimpio}</div>
            <div class="flex items-center justify-between mt-1.5 text-[13px] admin-tabular">
              <span class="font-semibold ${tienePrecio ? "text-[#E4E4E7]" : "text-[#A1A1AA]"}">${precioFmt}</span>
              <span class="text-[#A1A1AA]">${s.duracion_minutos || 45} min</span>
            </div>
          </button>
        `;
      }).join("");

      serviceCardsContainer.querySelectorAll("button[data-service-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          inputService.value = btn.dataset.serviceId;
          renderServiceCards();
          this.refreshManualBookingSlots();
        });
      });
    };

    const renderBarberCards = () => {
      if (!barberCardsContainer || !inputBarber) return;
      const curBarberId = inputBarber.value;
      const branchId = inputBranch?.value || "suc_city_bell";
      const ordenados = (this.sortedBarberos || this.barberos).filter(b =>
        b.activo !== false && window.dataService.barberoAtiendeEnSucursal(b, branchId)
      );

      barberCardsContainer.innerHTML = ordenados.map(b => {
        const active = b.id === curBarberId;
        const iniciales = b.nombre.substring(0, 2).toUpperCase();
        return `
          <button type="button" data-barber-id="${b.id}"
            class="p-2.5 rounded-xl flex items-center gap-2.5 text-left transition-colors border cursor-pointer ${
              active
                ? "bg-[#27272A] border-[#FAFAFA] text-[#FAFAFA]"
                : "bg-[#1B1B1F] border-[#27272A] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#FAFAFA]"
            }">
            <div class="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 overflow-hidden ${
              active ? "ring-2 ring-[#FAFAFA]" : "border border-[#27272A]"
            } bg-[#09090B] text-[#FAFAFA]">
              ${b.foto ? `<img src="${b.foto}" alt="${b.nombre}" class="w-full h-full object-cover object-[50%_36%]">` : iniciales}
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-[14px] leading-tight truncate text-[#FAFAFA]">${b.nombre}</div>
              <div class="text-[13px] text-[#A1A1AA] truncate">${(b.rol && b.rol.toLowerCase() !== "fundador") ? b.rol : "Barbero"}</div>
            </div>
          </button>
        `;
      }).join("");

      barberCardsContainer.querySelectorAll("button[data-barber-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          inputBarber.value = btn.dataset.barberId;
          renderBarberCards();
          this.refreshManualBookingSlots();
        });
      });
    };

    this.initManualBookingBarbers = renderBarberCards;

    const renderDateStrip = () => {
      if (!dateStripContainer || !inputDate) return;
      const curDateStr = inputDate.value;
      const diasCortos = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      const mesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

      const hoy = new Date();
      const baseHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const daysList = [];

      for (let i = 0; i < 14; i++) {
        const d = new Date(baseHoy);
        d.setDate(baseHoy.getDate() + i);
        if (d.getDay() === 0) continue; // Saltar domingos (cerrado)
        daysList.push(d);
      }

      // Si la fecha seleccionada en la agenda no está en los próximos 14 días, agregarla al principio
      if (curDateStr && !daysList.some(d => this.formatDateYYYYMMDD(d) === curDateStr)) {
        const [cy, cm, cd] = curDateStr.split("-").map(Number);
        const customD = new Date(cy, cm - 1, cd);
        if (customD.getDay() !== 0) {
          daysList.unshift(customD);
        }
      }

      if (!curDateStr || !daysList.some(d => this.formatDateYYYYMMDD(d) === curDateStr)) {
        if (daysList.length > 0) {
          inputDate.value = this.formatDateYYYYMMDD(daysList[0]);
        }
      }

      const activeDateStr = inputDate.value;
      if (selectedDateLabel && activeDateStr) {
        const [ay, am, ad] = activeDateStr.split("-").map(Number);
        const activeD = new Date(ay, am - 1, ad);
        selectedDateLabel.innerText = `${this.diasSemana[activeD.getDay()]} ${ad} de ${this.meses[activeD.getMonth()]}`;
      }

      dateStripContainer.innerHTML = daysList.map(d => {
        const fStr = this.formatDateYYYYMMDD(d);
        const active = fStr === activeDateStr;
        return `
          <button type="button" data-date-str="${fStr}"
            class="flex-shrink-0 w-14 py-2 rounded-xl border text-center transition-colors cursor-pointer ${
              active
                ? "bg-[#FAFAFA] text-[#09090B] border-[#FAFAFA] font-semibold"
                : "bg-[#1B1B1F] border-[#27272A] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#FAFAFA]"
            }">
            <span class="block text-[10px] uppercase ${active ? "text-[#52525B] font-semibold" : "text-[#71717A]"}">${diasCortos[d.getDay()]}</span>
            <span class="admin-tabular block text-sm font-semibold leading-tight my-0.5">${d.getDate()}</span>
            <span class="block text-[9px] uppercase ${active ? "text-[#52525B]" : "text-[#71717A]"}">${mesesCortos[d.getMonth()]}</span>
          </button>
        `;
      }).join("");

      dateStripContainer.querySelectorAll("button[data-date-str]").forEach(btn => {
        btn.addEventListener("click", () => {
          inputDate.value = btn.dataset.dateStr;
          renderDateStrip();
          this.refreshManualBookingSlots();
        });
      });
    };

    this.populateManualFormFields = async () => {
      const servicios = await window.dataService.getServicios(false);
      this.servicios = servicios;

      const defaultBranch = (this.selectedBranch && this.selectedBranch !== "todas")
        ? this.selectedBranch
        : (this.sucursales[0]?.id || "suc_city_bell");
      if (inputBranch) inputBranch.value = defaultBranch;

      if (inputService && servicios.length > 0) {
        inputService.value = servicios[0].id;
      }

      const ordenados = (this.sortedBarberos || this.barberos).filter(b =>
        b.activo !== false && window.dataService.barberoAtiendeEnSucursal(b, defaultBranch)
      );
      if (inputBarber && ordenados.length > 0) {
        if (this.barberSelect && this.barberSelect.value !== "todos" && ordenados.some(b => b.id === this.barberSelect.value)) {
          inputBarber.value = this.barberSelect.value;
        } else {
          inputBarber.value = ordenados[0].id;
        }
      }

      if (inputDate) {
        inputDate.value = this.formatDateYYYYMMDD(this.selectedDate);
      }

      renderBranchCards();
      renderServiceCards();
      renderBarberCards();
      renderDateStrip();

      const inputName = document.getElementById("manual-booking-name");
      const inputPhone = document.getElementById("manual-booking-phone");
      const inputNotes = document.getElementById("manual-booking-notes");
      if (inputName) inputName.value = "";
      if (inputPhone) inputPhone.value = "";
      if (inputNotes) inputNotes.value = "";
      if (errorEl) {
        errorEl.innerText = "";
        errorEl.classList.add("hidden");
      }

      await this.refreshManualBookingSlots();
    };

    const closeModal = () => {
      this.manualBookingModal.classList.add("hidden");
      this.manualBookingModal.classList.remove("flex");
    };

    btnClose?.addEventListener("click", closeModal);
    btnCancel?.addEventListener("click", closeModal);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.classList.add("hidden");

      const branchId = inputBranch?.value || "suc_city_bell";
      const serviceId = inputService?.value;
      const barberId = inputBarber?.value;
      const fecha = inputDate?.value;
      const time = inputTime?.value;
      const name = document.getElementById("manual-booking-name")?.value.trim();
      const phone = document.getElementById("manual-booking-phone")?.value.trim();
      const notes = document.getElementById("manual-booking-notes")?.value.trim();

      if (!time) {
        if (errorEl) {
          errorEl.innerText = "Por favor seleccioná un horario disponible.";
          errorEl.classList.remove("hidden");
        }
        return;
      }

      if (!name || !phone) {
        if (errorEl) {
          errorEl.innerText = "Completá el nombre y el número de WhatsApp del cliente.";
          errorEl.classList.remove("hidden");
        }
        return;
      }

      const servicioObj = this.servicios.find(s => s.id === serviceId);
      const duracion = Number(servicioObj?.duracion_minutos) || 45;

      const fechaInicio = `${fecha}T${time}:00`;
      const fechaFinDate = new Date(new Date(fechaInicio).getTime() + duracion * 60000);
      const finH = String(fechaFinDate.getHours()).padStart(2, "0");
      const finM = String(fechaFinDate.getMinutes()).padStart(2, "0");
      const fechaFin = `${this.formatDateYYYYMMDD(fechaFinDate)}T${finH}:${finM}:00`;

      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Guardando en agenda...</span>`;

      try {
        await window.dataService.crearTurno({
          sucursal_id: branchId,
          barbero_id: barberId,
          servicio_id: serviceId,
          cliente_nombre: name,
          cliente_telefono: phone,
          notas: notes || "Agendado por WhatsApp / Staff",
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado: "confirmado"
        });

        closeModal();

        // Actualizar agenda al instante
        if (fecha === this.formatDateYYYYMMDD(this.selectedDate)) {
          await this.renderList();
        } else {
          const [ny, nm, nd] = fecha.split("-").map(Number);
          this.selectedDate = new Date(ny, nm - 1, nd);
          this.calViewDate = new Date(ny, nm - 1, 1);
          this.updateDateUI();
        }

        const barberObj = this.barberos.find(b => b.id === barberId);
        this.showToast(`Turno de ${name} agendado para las ${time} hs con ${barberObj ? barberObj.nombre : "barbero"}.`);

      } catch (err) {
        console.error(err);
        if (errorEl) {
          errorEl.innerText = err.message || "Error al registrar el turno.";
          errorEl.classList.remove("hidden");
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  }

  async refreshManualBookingSlots() {
    const inputBranch = document.getElementById("manual-booking-branch");
    const branchCardsContainer = document.getElementById("manual-booking-branch-cards");
    const inputService = document.getElementById("manual-booking-service");
    const inputBarber = document.getElementById("manual-booking-barber");
    const inputDate = document.getElementById("manual-booking-date");
    const inputTime = document.getElementById("manual-booking-time");
    const slotsGrid = document.getElementById("manual-booking-slots-grid");
    const helperText = document.getElementById("manual-booking-slots-text");
    const statusDot = document.getElementById("manual-booking-status-dot");
    const submitBtn = document.getElementById("btn-submit-manual-booking");

    if (!inputService || !inputBarber || !inputDate || !inputTime || !slotsGrid) return;

    const fecha = inputDate.value;
    const barberoId = inputBarber.value;
    const servicioObj = this.servicios.find(s => s.id === inputService.value);
    const duracionMinutos = Number(servicioObj?.duracion_minutos) || 45;

    if (!fecha || !barberoId) return;

    slotsGrid.innerHTML = `<div class="col-span-full text-center py-3 text-[#A1A1AA] text-xs">Verificando horarios disponibles...</div>`;

    const [y, m, d] = fecha.split("-").map(Number);
    const fechaObj = new Date(y, m - 1, d);
    if (fechaObj.getDay() === 0) {
      inputTime.value = "";
      slotsGrid.innerHTML = `<div class="col-span-full text-center py-3 text-rose-300 text-xs font-semibold bg-rose-500/10 rounded-xl border border-rose-500/20">Los domingos la barbería permanece cerrada.</div>`;
      if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-rose-400";
      if (helperText) helperText.innerText = "Cerrado";
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    // Horarios configurados para este barbero en este día de la semana y sucursal
    const branchId = document.getElementById("manual-booking-branch")?.value || "suc_city_bell";
    const barberoObj = this.barberos.find(b => b.id === barberoId);
    const diaSemana = fechaObj.getDay();
    const franjasBarberoDia = barberoObj?.horarios?.[diaSemana];
    const franjasBarbero = Array.isArray(franjasBarberoDia)
      ? franjasBarberoDia.filter(f => (f.sucursal_id || "suc_city_bell") === branchId)
      : [];

    // Si el día está marcado como inactivo o en otra sucursal para este barbero
    if (franjasBarbero.length === 0) {
      inputTime.value = "";
      const sucObj = this.sucursales.find(s => s.id === branchId);
      slotsGrid.innerHTML = `<div class="col-span-full text-center py-3 text-rose-300 text-xs font-semibold bg-rose-500/10 rounded-xl border border-rose-500/20">${barberoObj ? barberoObj.nombre : 'El barbero'} no atiende este día en ${sucObj ? sucObj.nombre : 'esta sede'}.</div>`;
      if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-rose-400";
      if (helperText) helperText.innerText = "No atiende en esta sede";
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    const franjasEfectivas = franjasBarbero;

    const turnosOcupados = await window.dataService.getTurnosOcupados(fecha, barberoId, "confirmado");

    const slots = [];
    const intervaloMinutos = 30;
    const duracionTurnoMs = (duracionMinutos > 0 ? duracionMinutos : 30) * 60000;

    for (const franja of franjasEfectivas) {
      const [hIni, mIni] = franja.desde.split(":").map(Number);
      const [hFin, mFin] = franja.hasta.split(":").map(Number);
      const minInicioFranja = hIni * 60 + mIni;
      const minFinFranja = hFin * 60 + mFin;

      for (let minTotales = minInicioFranja; minTotales + intervaloMinutos <= minFinFranja; minTotales += intervaloMinutos) {
        const h = Math.floor(minTotales / 60);
        const min = minTotales % 60;

        const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const slotStart = new Date(`${fecha}T${timeStr}:00`).getTime();
        const slotEnd = slotStart + duracionTurnoMs;

        const estaOcupado = turnosOcupados.some(t => {
          if (t.barbero_id !== barberoId && t.barbero_id !== "todos") return false;
          const tInicio = new Date(t.fecha_inicio).getTime();
          const tFin = new Date(t.fecha_fin).getTime();
          return (slotStart < tFin && slotEnd > tInicio);
        });

        slots.push({
          time: timeStr,
          ocupado: estaOcupado
        });
      }
    }

    const disponibles = slots.filter(s => !s.ocupado);

    if (disponibles.length === 0) {
      inputTime.value = "";
      slotsGrid.innerHTML = `<div class="col-span-full text-center py-3 text-rose-300 text-xs font-semibold bg-rose-500/10 rounded-xl border border-rose-500/20">No quedan horarios libres para esta fecha.</div>`;
      if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-rose-400";
      if (helperText) helperText.innerText = "Sin disponibilidad";
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    // Mantener el horario seleccionado si sigue libre, o preseleccionar el primero libre
    if (!inputTime.value || !disponibles.some(s => s.time === inputTime.value)) {
      inputTime.value = disponibles[0].time;
    }

    const renderSlotButtons = () => {
      const selectedTime = inputTime.value;
      slotsGrid.innerHTML = slots.map(s => {
        if (s.ocupado) {
          return `
            <button type="button" disabled
              class="admin-tabular py-2 px-1 rounded-lg bg-[#09090B] border border-[#27272A]/60 text-[#52525B] text-xs line-through cursor-not-allowed">
              ${s.time}
            </button>
          `;
        }
        const isSelected = s.time === selectedTime;
        return `
          <button type="button" data-slot-time="${s.time}"
            class="admin-tabular py-2 px-1 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${
              isSelected
                ? "bg-emerald-500 text-[#09090B] border-emerald-400"
                : "bg-[#1B1B1F] text-[#FAFAFA] border-[#27272A] hover:border-[#3F3F46]"
            }">
            ${s.time}
          </button>
        `;
      }).join("");

      slotsGrid.querySelectorAll("button[data-slot-time]").forEach(btn => {
        btn.addEventListener("click", () => {
          inputTime.value = btn.dataset.slotTime;
          renderSlotButtons();
        });
      });
    };

    renderSlotButtons();

    if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-emerald-400";
    if (helperText) helperText.innerText = `${disponibles.length} libres con ${barberoObj ? barberoObj.nombre : "barbero"}`;
    if (submitBtn) submitBtn.disabled = false;
  }

  formatDateYYYYMMDD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  updateDateUI() {
    const label = document.getElementById("admin-date-label");
    if (label) {
      const diaNom = this.diasSemana[this.selectedDate.getDay()];
      const diaNum = this.selectedDate.getDate();
      const mesNom = this.meses[this.selectedDate.getMonth()];
      const anio = this.selectedDate.getFullYear();
      label.innerText = `${diaNom} ${diaNum} de ${mesNom} ${anio}`;
    }

    // Actualizar fecha en modal de bloqueo
    const blockDate = document.getElementById("block-date");
    if (blockDate) {
      blockDate.value = this.formatDateYYYYMMDD(this.selectedDate);
    }

    this.renderCustomCalendar();
    this.renderList();
  }

  renderCustomCalendar() {
    const titleEl = document.getElementById("admin-cal-month-title");
    const gridEl = document.getElementById("admin-cal-days-grid");
    if (!titleEl || !gridEl) return;

    const y = this.calViewDate.getFullYear();
    const m = this.calViewDate.getMonth();
    titleEl.innerText = `${this.meses[m]} ${y}`;

    const primerDiaSemana = new Date(y, m, 1).getDay(); // 0: Dom ... 6: Sab
    const totalDiasMes = new Date(y, m + 1, 0).getDate();

    const hoy = new Date();
    const hoyStr = this.formatDateYYYYMMDD(hoy);
    const selectedStr = this.formatDateYYYYMMDD(this.selectedDate);

    let html = "";

    // Días vacíos iniciales
    for (let i = 0; i < primerDiaSemana; i++) {
      html += `<div class="p-2"></div>`;
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const thisDate = new Date(y, m, dia);
      const thisDateStr = this.formatDateYYYYMMDD(thisDate);
      const isSelected = thisDateStr === selectedStr;
      const isToday = thisDateStr === hoyStr;

      let classes = "admin-tabular w-7 h-7 mx-auto rounded-lg text-xs font-medium flex items-center justify-center transition-colors cursor-pointer relative ";
      if (isSelected) {
        classes += "bg-[#FAFAFA] text-[#09090B] font-semibold";
      } else if (isToday) {
        classes += "bg-[#27272A] text-[#FAFAFA] border border-[#52525B] hover:bg-[#3F3F46]";
      } else {
        classes += "text-[#A1A1AA] hover:bg-[#1B1B1F] hover:text-[#FAFAFA]";
      }

      html += `
        <div class="py-0.5">
          <button type="button" class="${classes}" data-cal-date="${thisDateStr}">
            ${dia}
          </button>
        </div>
      `;
    }

    gridEl.innerHTML = html;

    gridEl.querySelectorAll("button[data-cal-date]").forEach(btn => {
      btn.addEventListener("click", () => {
        const [yy, mm, dd] = btn.dataset.calDate.split("-").map(Number);
        this.selectedDate = new Date(yy, mm - 1, dd);
        document.getElementById("admin-custom-calendar-dropdown")?.classList.add("hidden");
        this.updateDateUI();
      });
    });
  }

  setupEventListeners() {
    // Cerrar sesión
    document.getElementById("btn-admin-logout")?.addEventListener("click", async () => {
      await this.logoutToLogin(this.selectedBranch && this.selectedBranch !== "todas" ? this.selectedBranch : "suc_city_bell");
    });

    // Menú Desplegable de Gestión (Izquierda)
    const menuContainer = document.getElementById("admin-menu-container");
    const menuToggle = document.getElementById("btn-admin-menu-toggle");
    const menuDropdown = document.getElementById("admin-menu-dropdown");

    const adminSidebar = document.getElementById("admin-sidebar");
    const adminSidebarBackdrop = document.getElementById("admin-sidebar-backdrop");
    const openAdminSidebar = () => {
      adminSidebarBackdrop?.classList.remove("hidden");
      adminSidebar?.classList.remove("-translate-x-full");
    };
    const closeAdminMenu = () => {
      menuDropdown?.classList.add("hidden");
      adminSidebar?.classList.add("-translate-x-full");
      adminSidebarBackdrop?.classList.add("hidden");
    };

    document.getElementById("btn-admin-mobile-sidebar")?.addEventListener("click", openAdminSidebar);
    document.getElementById("btn-close-admin-sidebar")?.addEventListener("click", closeAdminMenu);
    adminSidebarBackdrop?.addEventListener("click", closeAdminMenu);
    document.getElementById("btn-admin-brand-home")?.addEventListener("click", () => {
      closeAdminMenu();
      this.switchAdminView("agenda");
    });
    document.getElementById("nav-opt-agenda")?.addEventListener("click", () => {
      closeAdminMenu();
      this.switchAdminView("agenda");
    });

    document.getElementById("admin-search-input")?.addEventListener("input", () => {
      this.renderList();
    });

    document.getElementById("menu-opt-horarios")?.addEventListener("click", () => {
      closeAdminMenu();
      this.openSidebarHorarios();
    });

    document.getElementById("menu-opt-barberos")?.addEventListener("click", () => {
      closeAdminMenu();
      this.openBarbersModal();
    });

    document.getElementById("menu-opt-precios")?.addEventListener("click", () => {
      closeAdminMenu();
      this.openPricesModal();
    });

    document.getElementById("menu-opt-volver-web")?.addEventListener("click", () => {
      closeAdminMenu();
      this.close();
    });

    document.getElementById("menu-opt-logout")?.addEventListener("click", async () => {
      closeAdminMenu();
      await this.logoutToLogin(this.selectedBranch && this.selectedBranch !== "todas" ? this.selectedBranch : "suc_city_bell");
    });

    // Selector de sucursal en la pantalla de Login
    const loginBranchInp = document.getElementById("login-branch-input");
    const loginBranchBtns = document.querySelectorAll("#login-branch-selector button[data-login-branch]");

    this.setLoginBranchSelection = (branchId) => {
      if (loginBranchInp) loginBranchInp.value = branchId;
      loginBranchBtns.forEach(btn => {
        const isSel = btn.dataset.loginBranch === branchId;
        btn.className = isSel
          ? "py-2.5 px-3 rounded-lg text-xs font-semibold transition-all text-center bg-[#27272A] text-[#FAFAFA] cursor-pointer"
          : "py-2.5 px-3 rounded-lg text-xs font-semibold transition-all text-center text-[#A1A1AA] hover:text-[#FAFAFA] cursor-pointer";
      });
      if (this.emailInput) {
        this.emailInput.placeholder = branchId === "suc_villa_elisa" ? "villaelisa@lodeale.com" : "citybell@lodeale.com";
      }
    };

    loginBranchBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.setLoginBranchSelection(btn.dataset.loginBranch);
        if (this.loginError) this.loginError.classList.add("hidden");
      });
    });

    // Envío del Login por Sucursal + Email + Clave (Supabase Auth o modo local)
    this.loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const chosenBranch = loginBranchInp?.value || "suc_city_bell";
      const inputEmail = this.emailInput?.value.trim().toLowerCase();
      const inputPass = this.passwordInput?.value.trim();
      const submitBtn = document.getElementById("btn-admin-login-submit");

      if (!inputEmail || !inputPass) return;

      let cuenta = this.resolveAdminAccount(inputEmail);

      if (window.dataService?.isSupabaseEnabled && window.dataService?.client?.auth) {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Ingresando...";
        }
        try {
          const { data, error } = await window.dataService.client.auth.signInWithPassword({
            email: inputEmail,
            password: inputPass
          });
          if (error || !data?.session) {
            this.loginError?.classList.remove("hidden");
            if (this.loginError) {
              this.loginError.innerText = "Email o contraseña incorrectos. Verificá tus credenciales.";
            }
            if (this.passwordInput) {
              this.passwordInput.value = "";
              this.passwordInput.focus();
            }
            return;
          }
          if (!cuenta) {
            cuenta = { email: inputEmail, rol: "admin_general", sucursal_id: "todas", nombre: inputEmail };
          }
        } catch (err) {
          this.loginError?.classList.remove("hidden");
          if (this.loginError) {
            this.loginError.innerText = "Error de conexión al iniciar sesión. Intentá nuevamente.";
          }
          return;
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Iniciar Sesión";
          }
        }
      } else {
        const passCorrecto = (CONFIG.barberia.passwordAdmin || CONFIG.barberia.pinAccesoAdmin || "1472").trim();
        const emailValido = Boolean(cuenta);
        const passValido = inputPass === passCorrecto;

        if (!emailValido || !passValido) {
          this.loginError?.classList.remove("hidden");
          if (!emailValido) {
            this.loginError.innerText = "Email no autorizado. Verificá la cuenta ingresada.";
          } else {
            this.loginError.innerText = "Contraseña incorrecta. Por favor verificala.";
          }
          if (this.passwordInput) {
            this.passwordInput.value = "";
            this.passwordInput.focus();
          }
          return;
        }
      }

      if (cuenta.rol === "encargado" && cuenta.sucursal_id !== chosenBranch) {
        if (window.dataService?.isSupabaseEnabled && window.dataService?.client?.auth) {
          try { await window.dataService.client.auth.signOut(); } catch {}
        }
        const sucCuenta = this.sucursales.find(s => s.id === cuenta.sucursal_id);
        this.loginError?.classList.remove("hidden");
        this.loginError.innerText = `Esta cuenta solo tiene acceso a la sede ${sucCuenta ? sucCuenta.nombre : "asignada"}.`;
        return;
      }

      this.adminRole = cuenta.rol || "encargado";
      this.lockedBranch = chosenBranch;
      this.selectedBranch = chosenBranch;

      this.saveBranchSession(chosenBranch, inputEmail, this.adminRole);

      if (this.loginError) this.loginError.classList.add("hidden");
      this.setActiveBranch(chosenBranch);
      this.showAgenda();
      const suc = this.sucursales.find(s => s.id === chosenBranch);
      this.showToast(`Sesión iniciada en ${suc ? suc.nombre : "la sede"}`);
    });

    // Controles de Fecha Custom y Dropdown de Barbero Custom
    const datePickerBtn = document.getElementById("btn-admin-date-picker");
    const calendarDropdown = document.getElementById("admin-custom-calendar-dropdown");
    const barberPickerBtn = document.getElementById("btn-admin-barber-picker");
    const barberDropdown = document.getElementById("admin-custom-barber-dropdown");

    datePickerBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      barberDropdown?.classList.add("hidden");
      calendarDropdown?.classList.toggle("hidden");
    });

    barberPickerBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      calendarDropdown?.classList.add("hidden");
      barberDropdown?.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!calendarDropdown?.contains(e.target) && !datePickerBtn?.contains(e.target)) {
        calendarDropdown?.classList.add("hidden");
      }
      if (!barberDropdown?.contains(e.target) && !barberPickerBtn?.contains(e.target)) {
        barberDropdown?.classList.add("hidden");
      }
    });

    document.getElementById("admin-cal-prev-month")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.calViewDate.setMonth(this.calViewDate.getMonth() - 1);
      this.renderCustomCalendar();
    });

    document.getElementById("admin-cal-next-month")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.calViewDate.setMonth(this.calViewDate.getMonth() + 1);
      this.renderCustomCalendar();
    });

    document.getElementById("btn-admin-prev-day")?.addEventListener("click", () => {
      this.selectedDate.setDate(this.selectedDate.getDate() - 1);
      this.calViewDate = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1);
      this.updateDateUI();
    });

    document.getElementById("btn-admin-next-day")?.addEventListener("click", () => {
      this.selectedDate.setDate(this.selectedDate.getDate() + 1);
      this.calViewDate = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1);
      this.updateDateUI();
    });

    document.getElementById("btn-admin-today")?.addEventListener("click", () => {
      const hoy = new Date();
      this.selectedDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      this.calViewDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      this.updateDateUI();
    });

    this.barberSelect?.addEventListener("change", () => this.renderList());

    // Tabs: Pendientes vs Atendidos
    const tabPendientes = document.getElementById("tab-turnos-pendientes");
    const tabAtendidos = document.getElementById("tab-turnos-atendidos");

    tabPendientes?.addEventListener("click", () => {
      this.tabEstado = "confirmado";
      tabPendientes.className = "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#27272A] text-[#FAFAFA] font-semibold text-[14px] transition-colors cursor-pointer";
      tabAtendidos.className = "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-transparent hover:bg-[#141417] text-[#A1A1AA] text-[14px] font-medium transition-colors cursor-pointer";
      this.renderList();
    });

    tabAtendidos?.addEventListener("click", () => {
      this.tabEstado = "atendido";
      tabAtendidos.className = "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#27272A] text-[#FAFAFA] font-semibold text-[14px] transition-colors cursor-pointer";
      tabPendientes.className = "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-transparent hover:bg-[#141417] text-[#A1A1AA] text-[14px] font-medium transition-colors cursor-pointer";
      this.renderList();
    });

    // Modal de Bloqueo Manual
    document.getElementById("btn-close-block-modal")?.addEventListener("click", () => {
      this.blockModal?.classList.add("hidden");
      this.blockModal?.classList.remove("flex");
    });

    const conflictAlert = document.getElementById("block-conflict-alert");
    const conflictDetails = document.getElementById("block-conflict-details");
    const btnConflictWA = document.getElementById("btn-block-conflict-whatsapp");
    const btnConflictProceed = document.getElementById("btn-block-conflict-proceed");

    let pendingBlockData = null;

    const executeBlock = async (data) => {
      let reasonTxt = data.reason || "";
      if (data.conflictedInfo) {
        reasonTxt = reasonTxt 
          ? `${reasonTxt} (Reemplaza turno de ${data.conflictedInfo})`
          : `Reemplaza turno suspendido de ${data.conflictedInfo}`;
      }

      await window.dataService.bloquearHorario(data.bId, `${data.fecha}T${data.tStart}:00`, `${data.fecha}T${data.tEnd}:00`, reasonTxt, data.sucursalId || "todas");
      
      // Si había un turno previo en conflicto, cancelarlo
      if (data.conflictedTurnoId) {
        await window.dataService.cancelarTurno(data.conflictedTurnoId);
      }

      this.blockModal?.classList.add("hidden");
      this.blockModal?.classList.remove("flex");
      if (conflictAlert) conflictAlert.classList.add("hidden");
      pendingBlockData = null;
      this.renderList();
      this.showToast("Horario bloqueado correctamente en la agenda.");
    };

    btnConflictProceed?.addEventListener("click", async () => {
      if (pendingBlockData) {
        await executeBlock(pendingBlockData);
      }
    });

    document.getElementById("block-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const sucursalId = document.getElementById("block-branch")?.value || this.selectedBranch || "todas";
      const bId = document.getElementById("block-barber").value;
      const fecha = document.getElementById("block-date").value;
      const tStart = document.getElementById("block-time-start").value;
      const tEnd = document.getElementById("block-time-end").value;
      const reason = document.getElementById("block-reason").value;

      const blockStartMs = new Date(`${fecha}T${tStart}:00`).getTime();
      const blockEndMs = new Date(`${fecha}T${tEnd}:00`).getTime();

      if (blockEndMs <= blockStartMs) {
        this.showToast("El horario de fin debe ser posterior al de inicio.", "error");
        return;
      }

      // Verificar si hay turnos confirmados existentes que caigan dentro del bloqueo
      const turnosDelDia = await window.dataService.getTurnosOcupados(fecha, bId === "todos" ? null : bId, "confirmado");
      
      const turnosEnConflicto = turnosDelDia.filter(t => {
        if (t.es_bloqueo || t.cliente_nombre?.startsWith("🔒")) return false;
        if (bId !== "todos" && t.barbero_id !== bId) return false;
        const tInicio = new Date(t.fecha_inicio).getTime();
        const tFin = new Date(t.fecha_fin).getTime();
        return (blockStartMs < tFin && blockEndMs > tInicio);
      });

      if (turnosEnConflicto.length > 0) {
        // Encontramos turno(s) en conflicto: mostrar alerta con botón de WhatsApp adaptado
        const primerTurno = turnosEnConflicto[0];
        const barberoObj = this.barberos.find(b => b.id === primerTurno.barbero_id);
        const servicioObj = this.servicios.find(s => s.id === primerTurno.servicio_id);
        const horaInicioTurno = primerTurno.fecha_inicio.split("T")[1]?.substring(0, 5) || tStart;
        const nombreBarbero = barberoObj ? barberoObj.nombre : "tu barbero";
        const nombreCliente = primerTurno.cliente_nombre || "Cliente";

        pendingBlockData = {
          sucursalId, bId, fecha, tStart, tEnd, reason,
          conflictedTurnoId: primerTurno.id,
          conflictedInfo: `${nombreCliente} (${horaInicioTurno} hs - ${servicioObj?.nombre || 'Corte'})`
        };

        if (conflictDetails) {
          conflictDetails.innerHTML = `
            <strong>${nombreCliente}</strong> a las <strong>${horaInicioTurno} hs</strong> con <strong>${nombreBarbero}</strong> (${servicioObj?.nombre || 'Corte'}).
          `;
        }

        // Redactar mensaje de WhatsApp profesional y empático referenciando al peluquero
        const telLimpio = (primerTurno.cliente_telefono || "").replace(/\D/g, "");
        const textoMsg = `Hola ${nombreCliente}, ¿cómo estás? Te escribimos de Lo de Ale Barbería. Por un imprevisto en el local, hoy no vamos a poder atenderte en tu turno de las ${horaInicioTurno} hs con ${nombreBarbero}. Te pedimos disculpas. Si querés, podés pasar a la web para reagendar o avisanos por acá y coordinamos otro horario. ¡Muchas gracias!`;
        
        if (btnConflictWA) {
          if (telLimpio && telLimpio.length >= 6) {
            btnConflictWA.href = `https://wa.me/549${telLimpio}?text=${encodeURIComponent(textoMsg)}`;
            btnConflictWA.classList.remove("hidden");
          } else {
            btnConflictWA.classList.add("hidden");
          }
        }

        if (conflictAlert) {
          conflictAlert.classList.remove("hidden");
        }
        return;
      }

      await executeBlock({ sucursalId, bId, fecha, tStart, tEnd, reason });
    });

    // Modal Gestionar Servicios y Precios
    const btnClosePrices = document.getElementById("btn-close-prices-modal");
    const btnCancelPrices = document.getElementById("btn-cancel-prices-modal");
    const pricesContainer = document.getElementById("prices-list-container");
    const pricesForm = document.getElementById("prices-form");
    const btnShowAddService = document.getElementById("btn-show-add-service");
    const newServiceContainer = document.getElementById("new-service-container");
    const btnCancelNewService = document.getElementById("btn-cancel-new-service");
    const btnConfirmAddService = document.getElementById("btn-confirm-add-service");
    const colorServiceCard = document.getElementById("color-special-service-card");
    const colorActiveToggle = document.getElementById("color-service-active");
    const colorStatusLabel = document.getElementById("color-service-status-label");
    const colorBranchSelect = document.getElementById("color-service-branch");
    const colorPhoneInput = document.getElementById("color-service-phone");
    const colorTitleInput = document.getElementById("color-service-title");
    const colorDescInput = document.getElementById("color-service-desc");

    let currentEditingServices = [];

    const updateColorSwitchVisual = () => {
      const active = Boolean(colorActiveToggle?.checked);
      if (colorStatusLabel) {
        colorStatusLabel.innerText = active ? "Visible" : "Oculto";
        colorStatusLabel.className = active
          ? "text-[13px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/25"
          : "text-[13px] font-medium px-2.5 py-0.5 rounded-full bg-[#141417] text-[#A1A1AA] border border-[#27272A]";
      }
      if (colorServiceCard) {
        colorServiceCard.classList.toggle("opacity-75", !active);
      }
    };

    const readColorFormValues = () => ({
      activo: Boolean(colorActiveToggle?.checked),
      sucursal_id: colorBranchSelect?.value || "suc_villa_elisa",
      telefono: colorPhoneInput?.value.trim() || CONFIG.barberia.telefonoWhatsApp,
      titulo: colorTitleInput?.value.trim() || "Tintura / Reflejos / Rulos",
      descripcion: colorDescInput?.value.trim() || "Coordinación y asesoramiento directo por WhatsApp o teléfono."
    });

    const populateColorEditor = async () => {
      if (!colorServiceCard) return;
      if (colorBranchSelect && this.sucursales?.length) {
        colorBranchSelect.innerHTML = [
          ...this.sucursales.map(s => `<option value="${s.id}">${s.nombre}</option>`),
          `<option value="todas">Todas las sedes</option>`
        ].join("");
      }
      const colorCfg = await window.dataService.getServicioEspecialColor();
      if (colorActiveToggle) colorActiveToggle.checked = colorCfg.activo !== false;
      if (colorBranchSelect) colorBranchSelect.value = colorCfg.sucursal_id || "suc_villa_elisa";
      if (colorPhoneInput) colorPhoneInput.value = colorCfg.telefono || CONFIG.barberia.telefonoWhatsApp;
      if (colorTitleInput) colorTitleInput.value = colorCfg.titulo || "Tintura / Reflejos / Rulos";
      if (colorDescInput) colorDescInput.value = colorCfg.descripcion || "Coordinación y asesoramiento directo por WhatsApp o teléfono.";
      updateColorSwitchVisual();
    };

    colorActiveToggle?.addEventListener("change", async () => {
      updateColorSwitchVisual();
      await window.dataService.guardarServicioEspecialColor(readColorFormValues());
      this.showToast(
        colorActiveToggle.checked
          ? "Bloque de Color visible en la agenda pública."
          : "Bloque de Color oculto en la agenda pública.",
        "info"
      );
    });

    const renderServiceEditorList = () => {
      if (!pricesContainer) return;
      if (currentEditingServices.length === 0) {
        pricesContainer.innerHTML = `
          <div class="text-center py-6 text-[#71717A] text-xs">
            No hay servicios configurados. Hacé click en "+ Agregar nuevo servicio" abajo.
          </div>
        `;
        return;
      }

      const trashIcon = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;

      pricesContainer.innerHTML = currentEditingServices.map((s, idx) => `
        <div class="service-editor-item p-4 rounded-xl bg-[#1B1B1F] border ${s.activo !== false ? 'border-[#27272A]' : 'border-rose-500/25 opacity-65'} flex flex-col gap-3 transition-colors" data-service-item-id="${s.id}">
          <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
            <div class="flex-1 min-w-[180px]">
              <input type="text" class="service-edit-name saas-input w-full rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors" value="${s.nombre}" placeholder="Nombre del servicio" required>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button type="button" data-idx="${idx}" class="btn-toggle-service-active h-9 px-3 rounded-lg text-[13px] font-medium transition-colors border cursor-pointer ${s.activo !== false ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20' : 'bg-[#141417] text-[#A1A1AA] border-[#27272A] hover:bg-[#27272A]'}">
                ${s.activo !== false ? 'Activo' : 'Pausado'}
              </button>
              <button type="button" data-idx="${idx}" class="btn-delete-service w-9 h-9 rounded-lg bg-[#141417] hover:bg-rose-500/15 text-[#A1A1AA] hover:text-rose-400 border border-[#27272A] hover:border-rose-500/30 flex items-center justify-center transition-colors cursor-pointer" title="Eliminar servicio" aria-label="Eliminar servicio">
                ${trashIcon}
              </button>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13px]">
            <div>
              <label class="block text-[13px] font-medium text-[#A1A1AA] mb-1">Precio (ARS)</label>
              <div class="flex items-center gap-2 bg-[#09090B] border border-[#27272A] focus-within:border-[#A1A1AA] rounded-lg px-3 h-10 transition-colors">
                <span class="text-[#71717A] font-medium text-[14px]">$</span>
                <input type="text" inputmode="numeric" class="service-edit-price admin-tabular w-full bg-transparent text-[14px] text-[#FAFAFA] font-semibold focus:outline-none" value="${this.formatPriceARS(s.precio)}" placeholder="Sin precio">
              </div>
            </div>
            <div>
              <label class="block text-[13px] font-medium text-[#A1A1AA] mb-1">Duración</label>
              <select class="service-edit-duration saas-input admin-tabular w-full rounded-lg px-3 h-10 text-[14px] font-medium">
                <option value="30" ${s.duracion_minutos == 30 ? 'selected' : ''}>30 min</option>
                <option value="40" ${s.duracion_minutos == 40 ? 'selected' : ''}>40 min</option>
                <option value="45" ${s.duracion_minutos == 45 ? 'selected' : ''}>45 min</option>
                <option value="60" ${s.duracion_minutos == 60 ? 'selected' : ''}>60 min</option>
                <option value="75" ${s.duracion_minutos == 75 ? 'selected' : ''}>75 min</option>
                <option value="90" ${s.duracion_minutos == 90 ? 'selected' : ''}>90 min</option>
                <option value="120" ${s.duracion_minutos == 120 ? 'selected' : ''}>120 min</option>
              </select>
            </div>
          </div>
        </div>
      `).join("");

      // Formateo automático de miles en pesos argentinos al salir del campo
      pricesContainer.querySelectorAll(".service-edit-price").forEach(inp => {
        inp.addEventListener("blur", () => {
          const parsed = this.parsePriceARS(inp.value);
          inp.value = parsed > 0 ? this.formatPriceARS(parsed) : "";
        });
      });

      // Vincular eventos de toggle activo y delete
      pricesContainer.querySelectorAll(".btn-toggle-service-active").forEach(btn => {
        btn.addEventListener("click", () => {
          syncInputValuesToMemory();
          const idx = Number(btn.dataset.idx);
          if (currentEditingServices[idx]) {
            currentEditingServices[idx].activo = currentEditingServices[idx].activo === false ? true : false;
            renderServiceEditorList();
          }
        });
      });

      pricesContainer.querySelectorAll(".btn-delete-service").forEach(btn => {
        btn.addEventListener("click", async () => {
          syncInputValuesToMemory();
          const idx = Number(btn.dataset.idx);
          const s = currentEditingServices[idx];
          const ok = await this.showConfirm({
            title: "Eliminar servicio",
            message: "¿Estás seguro de eliminar este servicio?",
            detail: `<span class="font-semibold text-[#FAFAFA]">${s?.nombre || "Servicio"}</span>`,
            confirmText: "Eliminar servicio",
            cancelText: "Mantener"
          });
          if (ok) {
            currentEditingServices.splice(idx, 1);
            renderServiceEditorList();
            this.showToast("Servicio eliminado", "info");
          }
        });
      });
    };

    const syncInputValuesToMemory = () => {
      const items = pricesContainer?.querySelectorAll(".service-editor-item");
      if (!items) return;
      items.forEach((item, idx) => {
        const nameInput = item.querySelector(".service-edit-name");
        const priceInput = item.querySelector(".service-edit-price");
        const durationSelect = item.querySelector(".service-edit-duration");
        if (currentEditingServices[idx]) {
          if (nameInput) currentEditingServices[idx].nombre = nameInput.value.trim() || currentEditingServices[idx].nombre;
          if (priceInput) {
            const parsedPrice = this.parsePriceARS(priceInput.value);
            currentEditingServices[idx].precio = parsedPrice > 0 ? parsedPrice : null;
          }
          if (durationSelect) currentEditingServices[idx].duracion_minutos = Number(durationSelect.value) || 45;
        }
      });
    };

    this._openPricesModalInternal = async () => {
      this.pricesModal?.classList.remove("hidden");
      this.pricesModal?.classList.add("flex");
      newServiceContainer?.classList.add("hidden");

      const servicios = await window.dataService.getServicios(true);
      currentEditingServices = JSON.parse(JSON.stringify(servicios));
      renderServiceEditorList();
      await populateColorEditor();
    };

    const closePricesModal = () => {
      this.pricesModal?.classList.add("hidden");
      this.pricesModal?.classList.remove("flex");
      newServiceContainer?.classList.add("hidden");
    };

    btnClosePrices?.addEventListener("click", closePricesModal);
    btnCancelPrices?.addEventListener("click", closePricesModal);

    btnShowAddService?.addEventListener("click", () => {
      newServiceContainer?.classList.remove("hidden");
      document.getElementById("new-service-name")?.focus();
    });

    btnCancelNewService?.addEventListener("click", () => {
      newServiceContainer?.classList.add("hidden");
    });

    document.getElementById("new-service-price")?.addEventListener("blur", (e) => {
      const parsed = this.parsePriceARS(e.target.value);
      if (parsed > 0) e.target.value = this.formatPriceARS(parsed);
    });

    btnConfirmAddService?.addEventListener("click", () => {
      const nameInp = document.getElementById("new-service-name");
      const priceInp = document.getElementById("new-service-price");
      const durInp = document.getElementById("new-service-duration");

      const nombre = nameInp?.value.trim();
      const precio = this.parsePriceARS(priceInp?.value);
      const duracion = Number(durInp?.value) || 45;

      if (!nombre) {
        this.showToast("Por favor ingresá el nombre del nuevo servicio.", "error");
        nameInp?.focus();
        return;
      }

      syncInputValuesToMemory();
      currentEditingServices.push({
        id: "s_" + Date.now(),
        nombre: nombre,
        precio: precio > 0 ? precio : null,
        duracion_minutos: duracion,
        activo: true
      });

      if (nameInp) nameInp.value = "";
      if (priceInp) priceInp.value = "";
      newServiceContainer?.classList.add("hidden");
      renderServiceEditorList();
    });

    pricesForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      syncInputValuesToMemory();

      await window.dataService.guardarServicios(currentEditingServices, readColorFormValues());
      this.servicios = await window.dataService.getServicios(false);
      closePricesModal();
      this.showToast("Servicios y precios actualizados en toda la web.");
    });

    // Auto-actualización si entra o se cancela una reserva
    window.addEventListener("lodeale_turnos_actualizados", () => {
      if (!this.overlay.classList.contains("hidden")) {
        this.renderList();
      }
    });

    window.addEventListener("lodeale_barberos_actualizados", async () => {
      this.barberos = await window.dataService.getBarberos(true);
      this.setupBarberSelectors();
      if (typeof this.initSidebarHorariosContent === "function") {
        this.initSidebarHorariosContent();
      }
      if (typeof this.initManualBookingBarbers === "function") {
        this.initManualBookingBarbers();
      }
      if (!this.overlay.classList.contains("hidden")) {
        this.renderList();
      }
    });

    window.addEventListener("storage", () => {
      if (!this.overlay.classList.contains("hidden")) {
        this.renderList();
      }
    });

    window.addEventListener("hashchange", () => {
      this.checkInitialHash();
    });
  }

  setupBarbersModal() {
    const view = document.getElementById("admin-view-barberos");
    const listContainer = document.getElementById("barbers-list-container");
    const form = document.getElementById("barbers-form");
    const btnShowAdd = document.getElementById("btn-show-add-barber");
    const newBarberContainer = document.getElementById("new-barber-container");
    const btnCancelNew = document.getElementById("btn-cancel-new-barber");
    const btnConfirmAdd = document.getElementById("btn-confirm-add-barber");
    const newBarberFileInput = document.getElementById("new-barber-file");
    const newBarberFotoInput = document.getElementById("new-barber-foto");
    const newBarberFotoStatus = document.getElementById("new-barber-foto-status");
    const newBarberBranchSelect = document.getElementById("new-barber-branch");

    if (!view || !listContainer) return;

    let currentEditingBarberos = [];

    const cameraIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
    const trashIcon = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
    const uploadIcon = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`;
    const calendarDaysIcon = `<svg class="w-3.5 h-3.5 text-[#A1A1AA] flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;
    const diasAbrev = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 0: "Dom" };

    const formatWorkdaysSummary = (b) => {
      const horarios = b?.horarios || {};
      const activos = [1, 2, 3, 4, 5, 6].filter(d => Array.isArray(horarios[d]) && horarios[d].length > 0);
      if (activos.length === 0) return "Sin días configurados";
      return activos.map(d => diasAbrev[d]).join(" · ");
    };

    const syncInputValuesToMemory = () => {
      if (!listContainer) return;
      const rows = listContainer.querySelectorAll(".barber-editor-item");
      rows.forEach((row, idx) => {
        const nameInp = row.querySelector(".barber-edit-name");
        const rolInp = row.querySelector(".barber-edit-rol");
        if (currentEditingBarberos[idx]) {
          if (nameInp) currentEditingBarberos[idx].nombre = nameInp.value.trim() || currentEditingBarberos[idx].nombre;
          if (rolInp) currentEditingBarberos[idx].rol = rolInp.value.trim() || "Barbero";
        }
      });
    };

    const renderBarbersEditorList = () => {
      if (!listContainer) return;
      if (currentEditingBarberos.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center py-6 text-[#71717A] text-xs">
            No hay profesionales configurados. Hacé click en "+ Agregar nuevo barbero" abajo.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = currentEditingBarberos.map((b, idx) => {
        const isActivo = b.activo !== false;
        const iniciales = b.nombre ? b.nombre.substring(0, 2).toUpperCase() : "B";
        const rolValue = (b.rol && b.rol.toLowerCase() !== "fundador") ? b.rol : "Barbero";
        const sedesBarbero = this.sucursales.filter(s => window.dataService.barberoAtiendeEnSucursal(b, s.id));
        const diasAtencion = formatWorkdaysSummary(b);

        return `
          <div class="barber-editor-item p-4 rounded-xl bg-[#1B1B1F] border ${
            isActivo ? "border-[#27272A]" : "border-rose-500/25 opacity-65"
          } flex flex-col gap-3 transition-colors" data-barber-idx="${idx}">
            <div class="flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <!-- Foto / Avatar circular con selector -->
                <div class="relative group/avatar cursor-pointer w-12 h-12 rounded-full overflow-hidden border border-[#3F3F46] bg-[#09090B] flex-shrink-0 flex items-center justify-center">
                  ${
                    b.foto
                      ? `<img src="${b.foto}" alt="${b.nombre}" class="w-full h-full object-cover object-[50%_36%]">`
                      : `<span class="font-semibold text-sm text-[#A1A1AA]">${iniciales}</span>`
                  }
                  <div class="avatar-change-overlay absolute inset-0 bg-[#09090B]/75 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-[#FAFAFA] transition-opacity">
                    ${cameraIcon}
                  </div>
                  <input type="file" accept="image/*" class="barber-avatar-file-input absolute inset-0 opacity-0 cursor-pointer" data-idx="${idx}" title="Cambiar foto de ${b.nombre}">
                </div>

                <div class="flex-1 min-w-0 space-y-1.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <input type="text" class="barber-edit-name saas-input rounded-lg px-3 py-1.5 text-[15px] font-semibold w-full sm:w-48 transition-colors" value="${b.nombre}" placeholder="Nombre" required>
                    ${sedesBarbero.map(s => `<span class="text-[12px] bg-[#141417] text-[#A1A1AA] font-medium px-2.5 py-0.5 rounded-md border border-[#27272A]">${s.nombre}</span>`).join("")}
                  </div>
                  <div>
                    <input type="text" class="barber-edit-rol bg-transparent border-b border-[#27272A] focus:border-[#A1A1AA] focus:outline-none text-[13px] text-[#A1A1AA] focus:text-[#FAFAFA] px-1 py-0.5 w-full sm:w-48 transition-colors" value="${rolValue}" placeholder="Rol (ej: Barbero)">
                  </div>
                </div>
              </div>

              <!-- Botones de Acción: Activo / Inactivo y Eliminar -->
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button type="button" data-idx="${idx}" class="btn-toggle-barber-active h-9 px-3 rounded-lg text-[13px] font-medium transition-colors border cursor-pointer ${
                  isActivo
                    ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20"
                    : "bg-rose-500/12 text-rose-400 border-rose-500/25 hover:bg-rose-500/20"
                }" title="Si el barbero deja de trabajar, ponelo como inactivo para que no aparezca en la web">
                  ${isActivo ? "Activo" : "Inactivo"}
                </button>
                <button type="button" data-idx="${idx}" class="btn-delete-barber w-9 h-9 rounded-lg bg-[#141417] hover:bg-rose-500/15 text-[#A1A1AA] hover:text-rose-400 border border-[#27272A] hover:border-rose-500/30 flex items-center justify-center transition-colors cursor-pointer" title="Eliminar del sistema" aria-label="Eliminar profesional">
                  ${trashIcon}
                </button>
              </div>
            </div>

            <!-- Días de atención y carga de foto -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#27272A] text-[13px]">
              <div class="flex items-center gap-2 min-w-0">
                ${calendarDaysIcon}
                <span class="text-[#A1A1AA] font-medium flex-shrink-0">Días de atención:</span>
                <span class="text-[#FAFAFA] font-medium truncate">${diasAtencion}</span>
              </div>
              <label class="cursor-pointer h-8 px-3 rounded-lg bg-[#141417] hover:bg-[#27272A] text-[#E4E4E7] text-[13px] font-medium border border-[#27272A] transition-colors inline-flex items-center gap-1.5 flex-shrink-0">
                ${uploadIcon}
                <span>Cambiar foto</span>
                <input type="file" accept="image/*" class="hidden barber-row-file-input" data-idx="${idx}">
              </label>
            </div>
          </div>
        `;
      }).join("");

      // Toggle activo / inactivo
      listContainer.querySelectorAll(".btn-toggle-barber-active").forEach(btn => {
        btn.addEventListener("click", () => {
          syncInputValuesToMemory();
          const idx = Number(btn.dataset.idx);
          if (currentEditingBarberos[idx]) {
            currentEditingBarberos[idx].activo = currentEditingBarberos[idx].activo === false ? true : false;
            renderBarbersEditorList();
          }
        });
      });

      // Eliminar barbero
      listContainer.querySelectorAll(".btn-delete-barber").forEach(btn => {
        btn.addEventListener("click", async () => {
          syncInputValuesToMemory();
          const idx = Number(btn.dataset.idx);
          const b = currentEditingBarberos[idx];
          const ok = await this.showConfirm({
            title: "Quitar profesional",
            message: "¿Estás seguro de quitar a este profesional del equipo?",
            detail: `<span class="font-semibold text-[#FAFAFA]">${b?.nombre || "Profesional"}</span>`,
            confirmText: "Quitar del equipo",
            cancelText: "Mantener"
          });
          if (ok) {
            currentEditingBarberos.splice(idx, 1);
            renderBarbersEditorList();
            this.showToast("Profesional quitado", "info");
          }
        });
      });

      // Manejo de carga de foto comprimida (evita límites de localStorage)
      const handleFileSelect = async (e, idx) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await this.compressImageFile(file, 400);
          syncInputValuesToMemory();
          if (currentEditingBarberos[idx]) {
            currentEditingBarberos[idx].foto = dataUrl;
            renderBarbersEditorList();
            this.showToast("Foto cargada. Tocá Guardar Cambios para confirmar.", "info");
          }
        } catch (err) {
          this.showToast("No se pudo procesar la imagen seleccionada.", "error");
        }
      };

      listContainer.querySelectorAll(".barber-row-file-input").forEach(input => {
        input.addEventListener("change", (e) => {
          handleFileSelect(e, Number(input.dataset.idx));
        });
      });

      listContainer.querySelectorAll(".barber-avatar-file-input").forEach(input => {
        input.addEventListener("change", (e) => {
          handleFileSelect(e, Number(input.dataset.idx));
        });
      });
    };

    this._openBarbersModalInternal = async () => {
      newBarberContainer?.classList.add("hidden");
      if (newBarberBranchSelect && this.selectedBranch && this.selectedBranch !== "todas") {
        newBarberBranchSelect.value = this.selectedBranch;
      }

      const barberos = await window.dataService.getBarberos(true);
      currentEditingBarberos = JSON.parse(JSON.stringify(barberos));
      renderBarbersEditorList();
    };

    btnShowAdd?.addEventListener("click", () => {
      if (newBarberBranchSelect && this.selectedBranch && this.selectedBranch !== "todas") {
        newBarberBranchSelect.value = this.selectedBranch;
      }
      newBarberContainer?.classList.remove("hidden");
      document.getElementById("new-barber-name")?.focus();
    });

    btnCancelNew?.addEventListener("click", () => {
      newBarberContainer?.classList.add("hidden");
    });

    // Subir imagen comprimida para nuevo barbero
    newBarberFileInput?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await this.compressImageFile(file, 400);
        if (newBarberFotoInput) {
          newBarberFotoInput.value = dataUrl;
        }
        if (newBarberFotoStatus) {
          newBarberFotoStatus.innerText = file.name || "Foto cargada";
          newBarberFotoStatus.classList.remove("text-[#A1A1AA]");
          newBarberFotoStatus.classList.add("text-emerald-400");
        }
        this.showToast("Foto lista para el nuevo profesional.", "info");
      } catch {
        this.showToast("No se pudo procesar la imagen seleccionada.", "error");
      }
    });

    btnConfirmAdd?.addEventListener("click", () => {
      const nameInp = document.getElementById("new-barber-name");
      const rolInp = document.getElementById("new-barber-rol");
      const fotoInp = document.getElementById("new-barber-foto");

      const nombre = nameInp?.value.trim();
      const rol = rolInp?.value.trim() || "Barbero";
      const foto = fotoInp?.value.trim() || "";
      const sucursalInicial = newBarberBranchSelect?.value
        || (this.selectedBranch && this.selectedBranch !== "todas" ? this.selectedBranch : "suc_city_bell");

      if (!nombre) {
        this.showToast("Por favor ingresá el nombre del nuevo profesional.", "error");
        nameInp?.focus();
        return;
      }

      syncInputValuesToMemory();

      const defaultHorarios = sucursalInicial === "suc_villa_elisa"
        ? {
            1: [],
            2: [{ sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" }, { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }],
            3: [{ sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" }, { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }],
            4: [{ sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" }, { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }],
            5: [{ sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" }, { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }],
            6: [{ sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" }, { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }]
          }
        : {
            1: [{ sucursal_id: "suc_city_bell", desde: "12:30", hasta: "20:00" }],
            2: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "20:00" }],
            3: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "20:00" }],
            4: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "20:00" }],
            5: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "20:00" }],
            6: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "20:00" }]
          };

      currentEditingBarberos.push({
        id: "b_" + Date.now(),
        nombre,
        rol,
        foto,
        activo: true,
        horarios: defaultHorarios
      });

      if (nameInp) nameInp.value = "";
      if (rolInp) rolInp.value = "Barbero";
      if (fotoInp) fotoInp.value = "";
      if (newBarberFileInput) newBarberFileInput.value = "";
      if (newBarberFotoStatus) {
        newBarberFotoStatus.innerText = "Sin foto (opcional)";
        newBarberFotoStatus.classList.remove("text-emerald-400");
        newBarberFotoStatus.classList.add("text-[#A1A1AA]");
      }
      newBarberContainer?.classList.add("hidden");
      renderBarbersEditorList();
      this.showToast(`${nombre} agregado a la lista. Tocá Guardar Cambios para aplicar.`, "info");
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      syncInputValuesToMemory();

      try {
        await window.dataService.guardarBarberos(currentEditingBarberos);
        this.barberos = await window.dataService.getBarberos(true);
        this.showToast("Equipo de profesionales actualizado con éxito.");
      } catch (err) {
        this.showToast("Error al guardar los profesionales: " + (err.message || "revisá el tamaño de las fotos"), "error");
      }
    });
  }

  async checkAuthAndRoute() {
    this.appView?.classList.add("hidden");
    this.loginScreen?.classList.remove("hidden");

    const activeBranch = localStorage.getItem("lodeale_admin_active_branch") || "suc_city_bell";
    const sesionActiva = this.getBranchSession(activeBranch);

    if (window.dataService?.isSupabaseEnabled && window.dataService?.client?.auth) {
      let sbSession = null;
      try {
        const { data, error } = await window.dataService.client.auth.getSession();
        if (!error) sbSession = data?.session || null;
      } catch (err) {
        console.warn("Error verificando sesión de Supabase:", err);
      }

      if (sbSession && sesionActiva) {
        this.adminRole = sesionActiva.role || "encargado";
        this.lockedBranch = activeBranch;
        this.setActiveBranch(activeBranch);
        this.showAgenda();
        return;
      }

      if (sbSession && !sesionActiva) {
        try {
          await window.dataService.client.auth.signOut();
        } catch {}
      }

      this.clearBranchSession(activeBranch);
      this.openLoginForBranch(activeBranch);
      return;
    }

    if (sesionActiva) {
      this.adminRole = sesionActiva.role || "encargado";
      this.lockedBranch = activeBranch;
      this.setActiveBranch(activeBranch);
      this.showAgenda();
    } else {
      this.openLoginForBranch(activeBranch);
    }
  }

  open() {
    this.checkAuthAndRoute();
  }

  close() {
    window.location.href = "/index.html";
  }

  showAgenda() {
    this.loginScreen?.classList.add("hidden");
    this.branchSelectorScreen?.classList.add("hidden");
    this.appView?.classList.remove("hidden");
    this.setupBranchFilter();
    this.setupBarberSelectors();
    this.updateActiveBranchUI();
    this.updateDateUI();
  }

  async renderList() {
    if (!this.listContainer || !this.barberSelect) return;

    const fecha = this.formatDateYYYYMMDD(this.selectedDate);
    const barberoId = this.barberSelect.value;
    const estadoFiltro = this.tabEstado; // "confirmado" o "atendido"

    this.listContainer.innerHTML = `<div class="p-6 text-[#A1A1AA] text-xs text-center">Cargando agenda...</div>`;

    try {
      // Obtener todos los turnos del día para calcular KPIs reales de la sede
      const todosDelDia = await window.dataService.getTurnosOcupados(fecha, barberoId, null, this.selectedBranch);
      const isBloqueoFn = (t) => t.es_bloqueo || t.cliente_nombre?.startsWith("🔒");
      const kpiBloqueos = todosDelDia.filter(isBloqueoFn).length;
      const kpiPendientes = todosDelDia.filter(t => !isBloqueoFn(t) && t.estado === "confirmado").length;
      const kpiAtendidos = todosDelDia.filter(t => !isBloqueoFn(t) && t.estado === "atendido").length;
      const kpiTotal = kpiPendientes + kpiAtendidos;

      const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
      setKpi("kpi-total", kpiTotal);
      setKpi("kpi-pendientes", kpiPendientes);
      setKpi("kpi-atendidos", kpiAtendidos);
      setKpi("kpi-bloqueos", kpiBloqueos);

      const query = (document.getElementById("admin-search-input")?.value || "").trim().toLowerCase();
      let turnos = todosDelDia.filter(t => t.estado === estadoFiltro);
      if (query) {
        turnos = turnos.filter(t => {
          const nombre = (t.cliente_nombre || "").toLowerCase();
          const tel = (t.cliente_telefono || "").toLowerCase();
          const b = this.barberos.find(x => x.id === t.barbero_id);
          const barberoNom = (b?.nombre || "").toLowerCase();
          return nombre.includes(query) || tel.includes(query) || barberoNom.includes(query);
        });
      }
      if (this.countEl) this.countEl.innerText = turnos.length;

      if (turnos.length === 0) {
        const textoVacio = query
          ? `No se encontraron turnos para "${query}".`
          : (estadoFiltro === "confirmado"
            ? "No hay turnos pendientes para este día."
            : "No hay turnos marcados como atendidos para este día.");
        this.listContainer.innerHTML = `
          <div class="p-10 text-center text-[14px] text-[#A1A1AA]">
            ${textoVacio}
          </div>
        `;
        return;
      }

      turnos.sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio));

      const lockIcon = `<svg class="w-4 h-4 text-[#A1A1AA] flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

      this.listContainer.innerHTML = turnos.map(t => {
        const horaInicio = t.fecha_inicio.split("T")[1]?.substring(0, 5) || "";
        const barbero = this.barberos.find(b => b.id === t.barbero_id);
        const servicio = this.servicios.find(s => s.id === t.servicio_id);
        const sucursal = this.sucursales.find(s => s.id === t.sucursal_id);
        const sucursalLabel = sucursal ? sucursal.nombre : (t.sucursal_id === "todas" ? "Todas" : "City Bell");
        const esBloqueo = isBloqueoFn(t);

        if (esBloqueo) {
          return `
            <div id="turno-row-${t.id}" class="grid grid-cols-1 md:grid-cols-[92px_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_104px_minmax(175px,auto)] gap-2 md:gap-3 px-4 py-4 items-center bg-[#1B1B1F]/40 hover:bg-[#1B1B1F] transition-colors">
              <div class="flex items-center justify-between md:justify-start gap-2">
                <span class="admin-tabular text-[14px] font-semibold text-[#FAFAFA] px-2.5 py-1 rounded-md bg-[#1B1B1F] border border-[#27272A]">${horaInicio} hs</span>
                <span class="md:hidden admin-badge-block px-2.5 py-0.5 rounded-full text-[13px] font-medium">Bloqueo</span>
              </div>
              <div class="min-w-0">
                <span class="text-[15px] font-semibold text-[#FAFAFA] inline-flex items-center gap-1.5">${lockIcon}<span>Horario Bloqueado</span></span>
                ${t.notas ? `<span class="text-[13px] text-[#A1A1AA] block truncate mt-0.5">${t.notas}</span>` : ""}
              </div>
              <div class="flex items-center gap-2 min-w-0">
                ${barbero ? this.renderBarberAvatar(barbero, "w-7 h-7", "text-[11px]") : ""}
                <span class="text-[14px] text-[#E4E4E7] font-medium truncate">${barbero ? barbero.nombre : "Todos"}</span>
              </div>
              <div class="text-[14px] text-[#A1A1AA]">Bloqueo manual</div>
              <div class="hidden md:block">
                <span class="admin-badge-block inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium">Bloqueo</span>
              </div>
              <div class="flex items-center md:justify-end">
                <button class="btn-admin-cancel h-9 px-3 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/15 text-[14px] font-medium transition-colors cursor-pointer"
                        data-turno-id="${t.id}"
                        data-cliente="Horario bloqueado"
                        data-servicio="Bloqueo de agenda"
                        data-hora="${horaInicio}">
                  Quitar
                </button>
              </div>
            </div>
          `;
        }

        const telLimpio = (t.cliente_telefono || "").replace(/\D/g, "");
        const telVisible = this.formatPhone(t.cliente_telefono);
        const waUrl = telLimpio && telLimpio.length >= 6
          ? `https://wa.me/549${telLimpio}?text=${encodeURIComponent(`Hola ${t.cliente_nombre}, te escribo de Lo de Ale Barbería (${sucursalLabel}) por tu turno de hoy a las ${horaInicio} hs.`)}`
          : null;

        const esPendiente = t.estado === "confirmado";
        const servicioNombre = (servicio ? servicio.nombre : "Corte").replace(/\s*\(descuento en efectivo\)/i, "");
        const badgeClass = esPendiente ? "admin-badge-pending" : "admin-badge-done";

        return `
          <div id="turno-row-${t.id}" class="grid grid-cols-1 md:grid-cols-[92px_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_104px_minmax(175px,auto)] gap-2 md:gap-3 px-4 py-4 items-center hover:bg-[#1B1B1F] transition-colors">
            <div class="flex items-center justify-between md:justify-start gap-2">
              <span class="admin-tabular text-[14px] font-semibold text-[#FAFAFA] px-2.5 py-1 rounded-md bg-[#1B1B1F] border border-[#27272A]">${horaInicio} hs</span>
              <span class="md:hidden ${badgeClass} inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium">${esPendiente ? "Pendiente" : "Atendido"}</span>
            </div>

            <div class="min-w-0">
              <div class="text-[15px] font-semibold text-[#FAFAFA] truncate">${t.cliente_nombre || "Cliente"}</div>
              <div class="admin-tabular text-[13px] text-[#A1A1AA] truncate mt-0.5">${telVisible}</div>
            </div>

            <div class="flex items-center gap-2 min-w-0">
              ${barbero ? this.renderBarberAvatar(barbero, "w-7 h-7", "text-[11px]") : ""}
              <span class="text-[14px] text-[#E4E4E7] font-medium truncate">${barbero ? barbero.nombre : "Barbero"}</span>
            </div>

            <div class="text-[14px] text-[#A1A1AA] truncate">
              ${servicioNombre}
            </div>

            <div class="hidden md:block">
              <span class="${badgeClass} inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-medium">${esPendiente ? "Pendiente" : "Atendido"}</span>
            </div>

            <div class="flex flex-wrap items-center md:justify-end gap-1.5 pt-1 md:pt-0">
              ${waUrl && esPendiente ? `
                <a href="${waUrl}" target="_blank" title="Enviar WhatsApp"
                   class="h-9 px-3 rounded-lg bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/25 text-[14px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap">
                  <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.02.559 1.954.819 2.806.82h.005c3.182 0 5.768-2.587 5.768-5.766.001-3.182-2.585-5.769-5.773-5.769zm0 9.873c-.808 0-1.602-.218-2.311-.643l-.165-.099-1.719.451.459-1.674-.108-.172c-.463-.736-.708-1.587-.707-2.463.001-2.457 1.999-4.455 4.457-4.455 2.459 0 4.457 1.998 4.457 4.456 0 2.458-1.998 4.456-4.456 4.456zm7.969-9.873c-2.124-2.124-4.949-3.295-7.969-3.295-6.208 0-11.258 5.05-11.259 11.259 0 1.984.517 3.921 1.5 5.626l-1.593 5.816 5.952-1.561c1.644.896 3.497 1.369 5.399 1.37h.005c6.207 0 11.258-5.051 11.26-11.259 0-3.02-.992-5.845-3.115-7.969z"/>
                  </svg>
                  <span class="hidden xl:inline">WhatsApp</span>
                </a>
              ` : ""}

              ${esPendiente ? `
                <button class="btn-marcar-atendido h-9 px-3 rounded-lg bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/25 text-[14px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        data-turno-id="${t.id}"
                        data-cliente="${t.cliente_nombre || 'Cliente'}"
                        title="Marcar como atendido">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                  <span>Atendido</span>
                </button>
              ` : ""}

              ${esPendiente ? `
                <button class="btn-admin-cancel h-9 px-3 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/15 text-[14px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                        data-turno-id="${t.id}"
                        data-cliente="${t.cliente_nombre || 'Cliente'}"
                        data-servicio="${servicioNombre}"
                        data-hora="${horaInicio}">
                  Cancelar
                </button>
              ` : ""}
            </div>
          </div>
        `;
      }).join("");

      // Listener para botón "Atendido"
      this.listContainer.querySelectorAll(".btn-marcar-atendido").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.turnoId;
          btn.disabled = true;
          await window.dataService.marcarAtendido(id);
          this.showToast("Turno marcado como atendido");
          this.renderList();
        });
      });

      // Listener para botón "Cancelar" con Modal de Confirmación SaaS
      this.listContainer.querySelectorAll(".btn-admin-cancel").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.turnoId;
          const cliente = btn.dataset.cliente;
          const servicio = btn.dataset.servicio || "";
          const hora = btn.dataset.hora;
          const ok = await this.showConfirm({
            title: "Cancelar turno",
            message: "Esta acción liberará el horario inmediatamente en la agenda.",
            detail: `<div class="space-y-1"><div class="font-bold text-[#FAFAFA]">${cliente}</div><div class="text-[#A1A1AA]">${hora} hs${servicio ? ` • ${servicio}` : ""}</div></div>`,
            confirmText: "Confirmar cancelación",
            cancelText: "Mantener"
          });
          if (ok) {
            await window.dataService.cancelarTurno(id);
            this.showToast("Turno cancelado", "info");
            this.renderList();
          }
        });
      });

    } catch (err) {
      this.listContainer.innerHTML = `<p class="text-rose-400 text-xs py-6 text-center">Error al cargar turnos.</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.adminPanel = new AdminPanel();
  window.adminPanel.init();
});
