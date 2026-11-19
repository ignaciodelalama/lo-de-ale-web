/**
 * LO DE ALE BARBERÍA - CAPA DE DATOS MULTISUCURSAL (SUPABASE / LOCAL STORAGE DEMO)
 * Mantiene la arquitectura y nombres de entidades (sucursales, barberos, servicios,
 * turnos, reservar_turno) para que conectar Supabase sea solo reemplazar este adaptador.
 */

class DataService {
  constructor() {
    this.isSupabaseEnabled = Boolean(
      window.supabase &&
      CONFIG.supabase.url &&
      CONFIG.supabase.anonKey &&
      !CONFIG.supabase.url.includes("xyzcompany")
    );

    if (this.isSupabaseEnabled) {
      try {
        this.client = window.supabase.createClient(
          CONFIG.supabase.url,
          CONFIG.supabase.anonKey
        );
        console.log("🟢 Conectado a Supabase correctamente");
      } catch (err) {
        console.warn("⚠️ Error inicializando Supabase, cambiando a modo local:", err);
        this.isSupabaseEnabled = false;
      }
    } else {
      console.log("ℹ️ Corriendo en MODO DEMO LOCAL MULTISUCURSAL (persistido en localStorage)");
      this._initLocalStorage();
    }
  }

  _initLocalStorage() {
    // 0. Si cambió la versión de los datos demo (equipo, precios, sedes), refrescamos el catálogo.
    //    Los turnos ya agendados se conservan.
    if (CONFIG.dataVersion && localStorage.getItem("lodeale_data_version") !== CONFIG.dataVersion) {
      ["lodeale_sucursales", "lodeale_barberos", "lodeale_servicios", "lodeale_servicio_color"].forEach(k => localStorage.removeItem(k));
      localStorage.setItem("lodeale_data_version", CONFIG.dataVersion);
    }

    // 1. Sucursales
    if (!localStorage.getItem("lodeale_sucursales")) {
      localStorage.setItem("lodeale_sucursales", JSON.stringify(CONFIG.mockData.sucursales));
    }

    // 2. Barberos
    const barbGuardados = localStorage.getItem("lodeale_barberos");
    if (!barbGuardados) {
      localStorage.setItem("lodeale_barberos", JSON.stringify(CONFIG.mockData.barberos));
    } else {
      try {
        const parsed = JSON.parse(barbGuardados);
        const merge = parsed.map(b => {
          const cfg = CONFIG.mockData.barberos.find(x => x.id === b.id);
          const fotoFinal = (b.foto && b.foto.trim() !== "") ? b.foto : (cfg?.foto || "");
          return {
            ...cfg,
            ...b,
            foto: fotoFinal,
            activo: b.activo !== false,
            horarios: b.horarios || cfg?.horarios
          };
        });
        CONFIG.mockData.barberos.forEach(cfg => {
          if (!merge.some(x => x.id === cfg.id)) {
            merge.push(cfg);
          }
        });
        localStorage.setItem("lodeale_barberos", JSON.stringify(merge));
      } catch (e) {
        localStorage.setItem("lodeale_barberos", JSON.stringify(CONFIG.mockData.barberos));
      }
    }

    // 3. Servicios
    const servGuardados = localStorage.getItem("lodeale_servicios");
    if (!servGuardados) {
      localStorage.setItem("lodeale_servicios", JSON.stringify(CONFIG.mockData.servicios));
    } else {
      try {
        let parsed = JSON.parse(servGuardados);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          parsed = CONFIG.mockData.servicios;
        }
        localStorage.setItem("lodeale_servicios", JSON.stringify(parsed));
      } catch (e) {
        localStorage.setItem("lodeale_servicios", JSON.stringify(CONFIG.mockData.servicios));
      }
    }

    // 3b. Servicio Especial / Color (Consulta previa)
    const colorGuardado = localStorage.getItem("lodeale_servicio_color");
    if (!colorGuardado && CONFIG.mockData.servicioEspecialColor) {
      localStorage.setItem("lodeale_servicio_color", JSON.stringify(CONFIG.mockData.servicioEspecialColor));
    } else if (colorGuardado) {
      try {
        const parsedColor = JSON.parse(colorGuardado);
        if (!parsedColor || typeof parsedColor !== "object") {
          localStorage.setItem("lodeale_servicio_color", JSON.stringify(CONFIG.mockData.servicioEspecialColor));
        }
      } catch (e) {
        localStorage.setItem("lodeale_servicio_color", JSON.stringify(CONFIG.mockData.servicioEspecialColor));
      }
    }

    // 4. Turnos iniciales de demo (1 en City Bell y 1 en Villa Elisa para hoy)
    if (!localStorage.getItem("lodeale_turnos")) {
      const hoy = new Date();
      const año = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, "0");
      const dia = String(hoy.getDate()).padStart(2, "0");
      const fechaBase = `${año}-${mes}-${dia}`;

      const demoTurnos = [
        {
          id: "demo-t1",
          sucursal_id: "suc_city_bell",
          barbero_id: "b3",
          servicio_id: "s1",
          cliente_nombre: "Agustín Benítez",
          cliente_telefono: "2215551234",
          fecha_inicio: `${fechaBase}T11:30:00`,
          fecha_fin: `${fechaBase}T12:00:00`,
          estado: "confirmado"
        },
        {
          id: "demo-t2",
          sucursal_id: "suc_villa_elisa",
          barbero_id: "b2",
          servicio_id: "s3",
          cliente_nombre: "Martín López",
          cliente_telefono: "2214449876",
          fecha_inicio: `${fechaBase}T16:00:00`,
          fecha_fin: `${fechaBase}T16:30:00`,
          estado: "confirmado"
        }
      ];
      localStorage.setItem("lodeale_turnos", JSON.stringify(demoTurnos));
    }
  }

  // Obtener sucursales activas
  async getSucursales(incluirInactivas = false) {
    if (this.isSupabaseEnabled) {
      let query = this.client.from("sucursales").select("*").order("orden", { ascending: true });
      if (!incluirInactivas) query = query.eq("activa", true);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } else {
      const todos = JSON.parse(localStorage.getItem("lodeale_sucursales") || "[]");
      if (incluirInactivas) return todos;
      return todos.filter(s => s.activa !== false);
    }
  }

  // Helper: determinar si un barbero atiende en una sucursal (en algún día de la semana)
  barberoAtiendeEnSucursal(barbero, sucursalId) {
    if (!sucursalId || sucursalId === "todas") return true;
    const horarios = barbero?.horarios || {};
    for (let d = 1; d <= 6; d++) {
      const franjas = horarios[d];
      if (Array.isArray(franjas)) {
        if (franjas.some(f => (f.sucursal_id || "suc_city_bell") === sucursalId)) {
          return true;
        }
      }
    }
    return false;
  }

  // Obtener barberos (opcionalmente filtrados por sucursal_id)
  async getBarberos(incluirInactivos = false, sucursalId = null) {
    let lista = [];
    if (this.isSupabaseEnabled) {
      let query = this.client
        .from("barberos")
        .select("*")
        .order("orden", { ascending: true });
      if (!incluirInactivos) {
        query = query.eq("activo", true);
      }
      const { data, error } = await query;
      if (error) throw error;
      lista = data || [];
    } else {
      const todos = JSON.parse(localStorage.getItem("lodeale_barberos") || "[]");
      lista = incluirInactivos ? todos : todos.filter(b => b.activo !== false);
    }

    if (sucursalId && sucursalId !== "todas") {
      return lista.filter(b => this.barberoAtiendeEnSucursal(b, sucursalId));
    }
    return lista;
  }

  // Guardar lista completa de barberos
  async guardarBarberos(listaBarberos) {
    localStorage.setItem("lodeale_barberos", JSON.stringify(listaBarberos));

    if (this.isSupabaseEnabled) {
      for (const b of listaBarberos) {
        await this.client
          .from("barberos")
          .upsert({
            id: b.id,
            nombre: b.nombre,
            rol: b.rol || "Barbero",
            foto: b.foto || "",
            activo: b.activo !== false,
            horarios: b.horarios || {}
          });
      }
    }

    window.dispatchEvent(new CustomEvent("lodeale_barberos_actualizados", { detail: { barberos: listaBarberos } }));
    return listaBarberos;
  }

  // Obtener servicios
  async getServicios(incluirInactivos = false) {
    if (this.isSupabaseEnabled) {
      let query = this.client
        .from("servicios")
        .select("*")
        .order("orden", { ascending: true });
      if (!incluirInactivos) {
        query = query.eq("activo", true);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } else {
      const todos = JSON.parse(localStorage.getItem("lodeale_servicios") || "[]");
      if (incluirInactivos) return todos;
      return todos.filter(s => s.activo !== false);
    }
  }

  // Obtener turnos de una fecha específica (YYYY-MM-DD), con filtro opcional de barbero y sucursal
  async getTurnosOcupados(fechaStr, barberoId = null, estadoFiltro = null, sucursalId = null) {
    const inicioDia = `${fechaStr}T00:00:00`;
    const finDia = `${fechaStr}T23:59:59`;

    if (this.isSupabaseEnabled) {
      let query = this.client
        .from("turnos")
        .select("id, sucursal_id, barbero_id, servicio_id, cliente_nombre, cliente_telefono, fecha_inicio, fecha_fin, estado, atendido_at")
        .gte("fecha_inicio", inicioDia)
        .lte("fecha_inicio", finDia);

      if (estadoFiltro === "confirmado") {
        query = query.eq("estado", "confirmado");
      } else if (estadoFiltro === "atendido") {
        query = query.eq("estado", "atendido");
      } else if (estadoFiltro === "todos") {
        query = query.in("estado", ["confirmado", "atendido", "cancelado"]);
      } else {
        query = query.in("estado", ["confirmado", "atendido"]);
      }

      if (barberoId && barberoId !== "cualquiera" && barberoId !== "todos") {
        query = query.eq("barbero_id", barberoId);
      }

      if (sucursalId && sucursalId !== "todas") {
        query = query.eq("sucursal_id", sucursalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } else {
      const todos = JSON.parse(localStorage.getItem("lodeale_turnos") || "[]");
      return todos.filter(t => {
        const coincideFecha = t.fecha_inicio.startsWith(fechaStr);
        if (!coincideFecha) return false;

        let coincideEstado = false;
        if (estadoFiltro === "confirmado") {
          coincideEstado = t.estado === "confirmado";
        } else if (estadoFiltro === "atendido") {
          coincideEstado = t.estado === "atendido";
        } else if (estadoFiltro === "todos") {
          coincideEstado = true;
        } else {
          coincideEstado = t.estado === "confirmado" || t.estado === "atendido";
        }
        if (!coincideEstado) return false;

        if (sucursalId && sucursalId !== "todas") {
          if (t.sucursal_id && t.sucursal_id !== sucursalId && t.sucursal_id !== "todas") {
            return false;
          }
        }

        if (barberoId && barberoId !== "cualquiera" && barberoId !== "todos") {
          return t.barbero_id === barberoId || t.barbero_id === "todos";
        }
        return true;
      });
    }
  }

  // Marcar un turno como atendido
  async marcarAtendido(turnoId) {
    let result = null;
    if (this.isSupabaseEnabled) {
      const { data, error } = await this.client
        .from("turnos")
        .update({ estado: "atendido", atendido_at: new Date().toISOString() })
        .eq("id", turnoId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const turnos = JSON.parse(localStorage.getItem("lodeale_turnos") || "[]");
      const turno = turnos.find(t => t.id === turnoId);
      if (turno) {
        turno.estado = "atendido";
        turno.atendido_at = new Date().toISOString();
        localStorage.setItem("lodeale_turnos", JSON.stringify(turnos));
        result = turno;
      }
    }
    window.dispatchEvent(new CustomEvent("lodeale_turnos_actualizados", { detail: { turnoId, estado: "atendido" } }));
    return result;
  }

  // Alias compatible con RPC/función reservar_turno de Supabase
  async reservar_turno(reserva) {
    return this.crearTurno(reserva);
  }

  // Crear una nueva reserva (turno) con validación de superposición horaria
  async crearTurno(reserva) {
    if (this.isSupabaseEnabled) {
      const { data, error } = await this.client.rpc("reservar_turno", {
        p_sucursal_id: reserva.sucursal_id,
        p_barbero_id: reserva.barbero_id,
        p_servicio_id: reserva.servicio_id,
        p_cliente_nombre: reserva.cliente_nombre,
        p_cliente_telefono: reserva.cliente_telefono,
        p_cliente_email: reserva.cliente_email || null,
        p_fecha_inicio: reserva.fecha_inicio,
        p_fecha_fin: reserva.fecha_fin,
        p_notas: reserva.notas || ""
      });

      if (error) {
        if (error.code === "23505" || (error.message && error.message.includes("superp"))) {
          throw new Error("Ese horario acaba de ser reservado por otro cliente. Por favor elegí otro.");
        }
        throw error;
      }
      window.dispatchEvent(new CustomEvent("lodeale_turnos_actualizados", { detail: { turno: data } }));
      return data;
    } else {
      const turnos = JSON.parse(localStorage.getItem("lodeale_turnos") || "[]");
      const nuevoInicio = new Date(reserva.fecha_inicio).getTime();
      const nuevoFin = new Date(reserva.fecha_fin).getTime();

      // Validación de superposición (overlap) para el mismo barbero (o bloqueo general de la sede)
      const conflicto = turnos.some(t => {
        if (t.estado !== "confirmado" && t.estado !== "atendido") return false;
        const mismoBarbero = t.barbero_id === reserva.barbero_id ||
          (t.barbero_id === "todos" && (!t.sucursal_id || t.sucursal_id === reserva.sucursal_id || t.sucursal_id === "todas"));
        if (!mismoBarbero) return false;

        const tInicio = new Date(t.fecha_inicio).getTime();
        const tFin = new Date(t.fecha_fin).getTime();
        return nuevoInicio < tFin && nuevoFin > tInicio;
      });

      if (conflicto) {
        throw new Error("Ese horario se superpone con otro turno o bloqueo. Por favor elegí otro.");
      }

      const nuevoTurno = {
        id: "turno_" + Date.now(),
        sucursal_id: reserva.sucursal_id || "suc_city_bell",
        ...reserva,
        estado: "confirmado",
        created_at: new Date().toISOString()
      };

      turnos.push(nuevoTurno);
      localStorage.setItem("lodeale_turnos", JSON.stringify(turnos));
      window.dispatchEvent(new CustomEvent("lodeale_turnos_actualizados", { detail: { turno: nuevoTurno } }));
      return nuevoTurno;
    }
  }

  // Cancelar un turno
  async cancelarTurno(turnoId) {
    let result = null;
    if (this.isSupabaseEnabled) {
      const { data, error } = await this.client
        .from("turnos")
        .update({ estado: "cancelado" })
        .eq("id", turnoId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const turnos = JSON.parse(localStorage.getItem("lodeale_turnos") || "[]");
      const turno = turnos.find(t => t.id === turnoId);
      if (turno) {
        turno.estado = "cancelado";
        localStorage.setItem("lodeale_turnos", JSON.stringify(turnos));
        result = turno;
      }
    }
    window.dispatchEvent(new CustomEvent("lodeale_turnos_actualizados", { detail: { turnoId } }));
    return result;
  }

  // Buscar turnos activos de un cliente por su número de teléfono
  async getTurnosPorTelefono(telefono) {
    if (!telefono) return [];
    const telLimpio = telefono.replace(/\D/g, "");
    if (telLimpio.length < 4) return [];

    const barberos = await this.getBarberos(true);
    const servicios = await this.getServicios(true);
    const sucursales = await this.getSucursales(true);

    let list = [];
    if (this.isSupabaseEnabled) {
      const { data, error } = await this.client
        .from("turnos")
        .select("*")
        .eq("estado", "confirmado")
        .ilike("cliente_telefono", `%${telLimpio}%`)
        .gte("fecha_inicio", new Date().toISOString())
        .order("fecha_inicio", { ascending: true });
      if (error) throw error;
      list = data || [];
    } else {
      const todos = JSON.parse(localStorage.getItem("lodeale_turnos") || "[]");
      const hoyIso = new Date().toISOString().split("T")[0];
      list = todos.filter(t => {
        const esConfirmado = t.estado === "confirmado" && !t.es_bloqueo;
        const tTel = (t.cliente_telefono || "").replace(/\D/g, "");
        const minLen = Math.min(telLimpio.length, tTel.length);
        const ultimosCoinciden = minLen >= 6 && tTel.slice(-6) === telLimpio.slice(-6);
        const coincideTel = tTel.includes(telLimpio) || telLimpio.includes(tTel) || ultimosCoinciden;
        return esConfirmado && coincideTel && t.fecha_inicio >= hoyIso;
      });
    }

    return list.map(t => {
      const b = barberos.find(x => x.id === t.barbero_id);
      const s = servicios.find(x => x.id === t.servicio_id);
      const suc = sucursales.find(x => x.id === t.sucursal_id);
      return {
        ...t,
        sucursal_nombre: suc ? suc.nombre : "City Bell",
        sucursal_direccion: suc ? suc.direccion : "",
        barbero_nombre: b ? b.nombre : "Barbero",
        servicio_nombre: s ? s.nombre : "Corte",
        servicio_precio: s ? s.precio : null,
        servicio_duracion: s ? s.duracion_minutos : 45
      };
    });
  }

  // Bloquear un horario manualmente
  async bloquearHorario(barberoId, fechaInicio, fechaFin, motivo, sucursalId = "todas") {
    if (this.isSupabaseEnabled) {
      const { data, error } = await this.client
        .from("bloqueos")
        .insert([{
          sucursal_id: sucursalId === "todas" ? null : sucursalId,
          barbero_id: barberoId === "todos" ? null : barberoId,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          motivo: motivo || "Bloqueado manualmente"
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const turnos = JSON.parse(localStorage.getItem("lodeale_turnos") || "[]");
      const nuevoBloqueo = {
        id: "bloqueo_" + Date.now(),
        sucursal_id: sucursalId || "todas",
        barbero_id: barberoId,
        servicio_id: null,
        cliente_nombre: "🔒 Horario Bloqueado",
        cliente_telefono: "-",
        notas: motivo || "Bloqueado por staff",
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: "confirmado",
        es_bloqueo: true
      };
      turnos.push(nuevoBloqueo);
      localStorage.setItem("lodeale_turnos", JSON.stringify(turnos));
      window.dispatchEvent(new CustomEvent("lodeale_turnos_actualizados", { detail: { turnoId: nuevoBloqueo.id } }));
      return nuevoBloqueo;
    }
  }

  // Actualizar precios de los servicios
  async actualizarPrecios(listaPrecios) {
    const servicios = JSON.parse(localStorage.getItem("lodeale_servicios") || "[]");
    listaPrecios.forEach(item => {
      const s = servicios.find(x => x.id === item.id);
      if (s && !isNaN(Number(item.precio)) && Number(item.precio) > 0) {
        s.precio = Number(item.precio);
      }
    });
    return this.guardarServicios(servicios);
  }

  // Guardar configuración de horarios (incluyendo sucursal_id por franja) de un barbero
  async guardarHorariosBarbero(barberoId, nuevosHorarios) {
    const barberos = JSON.parse(localStorage.getItem("lodeale_barberos") || "[]");
    const b = barberos.find(x => x.id === barberoId);
    if (b) {
      b.horarios = nuevosHorarios;
      localStorage.setItem("lodeale_barberos", JSON.stringify(barberos));
    }

    if (this.isSupabaseEnabled) {
      try {
        await this.client
          .from("barberos")
          .update({ horarios: nuevosHorarios })
          .eq("id", barberoId);
      } catch (err) {
        console.warn("Error guardando horarios en Supabase:", err);
      }
    }

    window.dispatchEvent(new CustomEvent("lodeale_horarios_actualizados", { detail: { barberoId, horarios: nuevosHorarios } }));
    return barberos;
  }

  // Obtener configuración de Servicios Especiales / Color (Consulta previa)
  async getServicioEspecialColor() {
    const fallback = { ...(CONFIG.mockData.servicioEspecialColor || {}) };
    try {
      const raw = localStorage.getItem("lodeale_servicio_color");
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  }

  // Normaliza un teléfono argentino para enlaces tel: y wa.me/
  normalizarTelefonosContacto(rawTel) {
    const digits = String(rawTel || "").replace(/\D/g, "") || CONFIG.barberia.telefonoWhatsApp;
    let waDigits = digits;
    if (digits.startsWith("549") && digits.length >= 12) {
      waDigits = digits;
    } else if (digits.startsWith("54")) {
      waDigits = `549${digits.slice(2)}`;
    } else if (digits.startsWith("0")) {
      waDigits = `549${digits.slice(1)}`;
    } else {
      waDigits = `549${digits}`;
    }

    let telDigits = digits;
    if (digits.startsWith("549") && digits.length > 10) {
      telDigits = digits.slice(3);
    } else if (digits.startsWith("0") && digits.length >= 11) {
      telDigits = digits.slice(1);
    }

    return { waDigits, telDigits };
  }

  _normalizarColorCfg(colorCfg, actual = {}) {
    return {
      ...actual,
      ...colorCfg,
      id: "color_especial",
      sucursal_id: colorCfg?.sucursal_id || actual.sucursal_id || "suc_villa_elisa",
      activo: colorCfg?.activo !== false,
      titulo: (colorCfg?.titulo || "").trim() || actual.titulo || "Tintura / Reflejos / Rulos",
      descripcion: (colorCfg?.descripcion || "").trim() || actual.descripcion || "Coordinación y asesoramiento directo por WhatsApp o teléfono.",
      telefono: (colorCfg?.telefono || "").trim() || actual.telefono || CONFIG.barberia.telefonoWhatsApp
    };
  }

  // Guardar configuración del banner de Color y notificar al sitio público
  async guardarServicioEspecialColor(colorCfg) {
    const actual = await this.getServicioEspecialColor();
    const limpio = this._normalizarColorCfg(colorCfg, actual);
    localStorage.setItem("lodeale_servicio_color", JSON.stringify(limpio));
    window.dispatchEvent(new CustomEvent("lodeale_servicios_actualizados", { detail: { servicioEspecialColor: limpio } }));
    window.dispatchEvent(new CustomEvent("lodeale_precios_actualizados"));
    return limpio;
  }

  // Guardar lista completa de servicios (y opcionalmente el bloque de color)
  async guardarServicios(listaServicios, servicioColor = null) {
    localStorage.setItem("lodeale_servicios", JSON.stringify(listaServicios));

    if (servicioColor) {
      const actual = await this.getServicioEspecialColor();
      const limpio = this._normalizarColorCfg(servicioColor, actual);
      localStorage.setItem("lodeale_servicio_color", JSON.stringify(limpio));
    }

    if (this.isSupabaseEnabled) {
      for (const s of listaServicios) {
        await this.client
          .from("servicios")
          .upsert({
            id: s.id,
            nombre: s.nombre,
            duracion_minutos: Number(s.duracion_minutos) || 45,
            precio: Number(s.precio) > 0 ? Number(s.precio) : null,
            activo: s.activo !== false
          });
      }
    }

    window.dispatchEvent(new CustomEvent("lodeale_servicios_actualizados", { detail: { servicios: listaServicios } }));
    window.dispatchEvent(new CustomEvent("lodeale_precios_actualizados"));
    return listaServicios;
  }
}

// Instancia global
window.dataService = new DataService();
