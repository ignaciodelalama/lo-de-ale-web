/**
 * BARBERSHOP LO DE ALE - CONFIGURACIÓN GENERAL (SINCRONIZADA CON WONOMA)
 * City Bell (Jorge Bell y 473 Bis) & Villa Elisa (Calle 6 Nº 1265)
 */

const CONFIG = {
  dataVersion: "2026-11-18-wonoma-v9",

  barberia: {
    nombre: "Barbershop Lo de Ale",
    subtitulo: "City Bell & Villa Elisa",
    ciudad: "City Bell & Villa Elisa, La Plata",
    direccion: "City Bell (Jorge Bell y 473 Bis) • Villa Elisa (Calle 6 Nº 1265)",
    telefonoWhatsApp: "5492215073940",
    telefonoVisible: "0221 507-3940",
    instagram: "barbershop_lodeale",
    instagramUrl: "https://instagram.com/barbershop_lodeale",
    linktreeUrl: "https://linktr.ee/barbershoplodeale",
    googleMapsUrl: "https://share.google/l34myvZPnahb2L7XS",
    horariosTexto: "Lun a Sáb • Consultar por sede",
    duracionTurnoDefectoMinutos: 30,
    horaApertura: 9,
    horaCierre: 20,
    diasLaborales: [1, 2, 3, 4, 5, 6],
    pinAccesoAdmin: "1265",
    emailAdmin: "lodeale@barberia.com",
    emailsAutorizados: [
      "ignaciodelalama10@gmail.com",
      "lodeale@barberia.com",
      "ale@lodeale.com",
      "citybell@lodeale.com",
      "villaelisa@lodeale.com"
    ],
    cuentasAdmin: [
      { email: "ale@lodeale.com", rol: "admin_general", sucursal_id: "todas", nombre: "Ale (Admin General)" },
      { email: "lodeale@barberia.com", rol: "admin_general", sucursal_id: "todas", nombre: "Ale (Admin General)" },
      { email: "ignaciodelalama10@gmail.com", rol: "admin_general", sucursal_id: "todas", nombre: "Admin General" },
      { email: "citybell@lodeale.com", rol: "encargado", sucursal_id: "suc_city_bell", nombre: "Encargado City Bell" },
      { email: "villaelisa@lodeale.com", rol: "encargado", sucursal_id: "suc_villa_elisa", nombre: "Encargado Villa Elisa" }
    ],
    passwordAdmin: "1265"
  },

  supabase: {
    url: "",
    anonKey: ""
  },

  mockData: {
    sucursales: [
      {
        id: "suc_city_bell",
        slug: "city-bell",
        nombre: "City Bell",
        nombreCompleto: "Barbershop Lo de Ale Jorge Bell",
        direccion: "Jorge Bell y 473 Bis, City Bell",
        foto: "assets/salon/fachada-city-bell.jpg",
        telefonoWhatsApp: "5492215073940",
        telefonoVisible: "0221 507-3940",
        googleMapsUrl: "https://share.google/l34myvZPnahb2L7XS",
        horariosTexto: "Lun 13 a 20:30 hs • Mar a Sáb 9:30 a 20:30 hs",
        activa: true
      },
      {
        id: "suc_villa_elisa",
        slug: "villa-elisa",
        nombre: "Villa Elisa",
        nombreCompleto: "Barbershop Lo de Ale Villa Elisa",
        direccion: "Calle 6 Nº 1265 (e/ 45 y 46), Villa Elisa",
        foto: "assets/salon/fachada-villa-elisa.jpg",
        telefonoWhatsApp: "5492215073940",
        telefonoVisible: "0221 507-3940",
        googleMapsUrl: "https://share.google/pp1HSwKZjvedjCHxd",
        horariosTexto: "Mar a Sáb 9:30 a 13 hs y 15 a 20 hs",
        activa: true
      }
    ],

    barberos: [
      {
        id: "b1",
        nombre: "Ale",
        rol: "Barbero",
        foto: "assets/barberos/ale.jpg",
        activo: true,
        horarios: {
          1: [],
          2: [
            { sucursal_id: "suc_city_bell", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_city_bell", desde: "16:00", hasta: "20:00" }
          ],
          3: [{ sucursal_id: "suc_city_bell", desde: "16:00", hasta: "20:00" }],
          4: [{ sucursal_id: "suc_city_bell", desde: "16:00", hasta: "20:00" }],
          5: [
            { sucursal_id: "suc_city_bell", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_city_bell", desde: "16:00", hasta: "20:00" }
          ],
          6: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "13:00" }]
        }
      },
      {
        id: "b2",
        nombre: "Rami",
        rol: "Barbero",
        foto: "assets/barberos/rami.jpg",
        activo: true,
        horarios: {
          1: [],
          2: [
            { sucursal_id: "suc_city_bell", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }
          ],
          3: [
            { sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }
          ],
          4: [
            { sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }
          ],
          5: [
            { sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }
          ],
          6: [
            { sucursal_id: "suc_city_bell", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }
          ]
        }
      },
      {
        id: "b3",
        nombre: "Tiago",
        rol: "Barbero",
        foto: "assets/barberos/tiago.jpg",
        activo: true,
        horarios: {
          1: [],
          2: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "15:00" }],
          3: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "16:00" }],
          4: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "16:00" }],
          5: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "15:30" }],
          6: [{ sucursal_id: "suc_city_bell", desde: "13:00", hasta: "20:00" }]
        }
      },
      {
        id: "b4",
        nombre: "Lucho",
        rol: "Barbero",
        foto: "assets/barberos/lucho.jpg",
        activo: true,
        horarios: {
          1: [{ sucursal_id: "suc_city_bell", desde: "12:30", hasta: "20:00" }],
          2: [{ sucursal_id: "suc_city_bell", desde: "13:00", hasta: "20:00" }],
          3: [],
          4: [{ sucursal_id: "suc_city_bell", desde: "16:00", hasta: "20:00" }],
          5: [{ sucursal_id: "suc_city_bell", desde: "15:00", hasta: "20:00" }],
          6: [{ sucursal_id: "suc_city_bell", desde: "15:00", hasta: "20:00" }]
        }
      },
      {
        id: "b5",
        nombre: "Benja",
        rol: "Barbero",
        foto: "assets/barberos/benja.jpg",
        activo: true,
        horarios: {
          1: [{ sucursal_id: "suc_city_bell", desde: "12:30", hasta: "20:00" }],
          2: [],
          3: [{ sucursal_id: "suc_city_bell", desde: "15:00", hasta: "20:00" }],
          4: [{ sucursal_id: "suc_city_bell", desde: "14:00", hasta: "20:00" }],
          5: [{ sucursal_id: "suc_city_bell", desde: "13:00", hasta: "20:00" }],
          6: []
        }
      },
      {
        id: "b6",
        nombre: "Toto",
        rol: "Barbero",
        foto: "assets/barberos/toto.jpg",
        activo: true,
        horarios: {
          1: [],
          2: [{ sucursal_id: "suc_city_bell", desde: "15:00", hasta: "20:00" }],
          3: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "15:00" }],
          4: [{ sucursal_id: "suc_city_bell", desde: "16:00", hasta: "20:00" }],
          5: [{ sucursal_id: "suc_city_bell", desde: "16:00", hasta: "20:00" }],
          6: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "15:00" }]
        }
      },
      {
        id: "b7",
        nombre: "Thiago (Frenchis)",
        rol: "Barbero",
        foto: "assets/barberos/thiago.jpg",
        activo: true,
        horarios: {
          1: [],
          2: [
            { sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }
          ],
          3: [{ sucursal_id: "suc_city_bell", desde: "15:00", hasta: "20:00" }],
          4: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "16:00" }],
          5: [{ sucursal_id: "suc_city_bell", desde: "09:30", hasta: "14:30" }],
          6: [
            { sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }
          ]
        }
      },
      {
        id: "b8",
        nombre: "Lauti",
        rol: "Barbero",
        foto: "assets/barberos/lauti.jpg",
        activo: true,
        horarios: {
          1: [],
          2: [],
          3: [{ sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }],
          4: [{ sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }],
          5: [{ sucursal_id: "suc_villa_elisa", desde: "15:00", hasta: "20:00" }],
          6: [
            { sucursal_id: "suc_villa_elisa", desde: "09:30", hasta: "13:00" },
            { sucursal_id: "suc_city_bell", desde: "13:00", hasta: "20:00" }
          ]
        }
      }
    ],

    servicios: [
      {
        id: "s2",
        nombre: "Barba",
        duracion_minutos: 30,
        precio: 12000,
        activo: true
      },
      {
        id: "s1",
        nombre: "Corte",
        duracion_minutos: 30,
        precio: 20000,
        activo: true
      },
      {
        id: "s4",
        nombre: "Corte para dos personas",
        duracion_minutos: 60,
        precio: null,
        activo: true
      },
      {
        id: "s3",
        nombre: "Corte y Barba",
        duracion_minutos: 30,
        precio: 24000,
        activo: true
      }
    ],

    servicioEspecialColor: {
      id: "color_especial",
      sucursal_id: "suc_villa_elisa",
      activo: true,
      titulo: "Tintura / Reflejos / Rulos",
      descripcion: "Coordinación y asesoramiento directo por WhatsApp o teléfono.",
      telefono: "5492215073940"
    }
  }
};
