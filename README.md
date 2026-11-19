# 💈 Barbershop Lo de Ale — Web, Turnos Multisucursal & Panel de Gestión

Sistema web a medida para **Barbershop Lo de Ale** (*City Bell & Villa Elisa, La Plata*).

## ✨ Características Principales

1. **Identidad Visual Fiel al Salón:**
   - Inspirada en la fachada de madera oscura, el cartel clásico **BARBERSHOP ★ LO DE ALE ★**, la puerta *Welcome to the Man Salon*, los espejos dorados, las paredes a rayas y empapeladas con diarios, y el poste de barbero.
   - Galería real del salón (City Bell y Villa Elisa), pizarra de precios con descuento en efectivo y diseño 100% **Mobile-First**.
2. **Motor de Reservas Multisucursal (5 pasos rápidos):**
   - **Paso 1 (Sede):** Selección entre **City Bell** (*473 bis y Jorge Bell*) y **Villa Elisa** (*Calle Buenos Aires 1265*).
   - **Paso 2 (Servicio):** Corte ($20.000), Barba ($12.000), Corte y Barba ($24.000), Corte para dos personas ($40.000).
   - **Paso 3 (Barbero):** Filtrado automático según la sede elegida (*Ale, Rami, Tiago, Lucho, Benja, Toto, Thiago (Frenchis), Lauti* o *Primer profesional disponible*).
   - **Paso 4 (Día y Hora):** Calendario interactivo con cálculo en tiempo real de horarios disponibles según la sede y franja horaria de cada barbero (corrido o cortado).
   - **Paso 5 (Confirmación):** Ticket de reserva inmediato + enlace directo a WhatsApp y autogestión para consultar o cancelar turnos.
3. **Panel de Administración y Agenda (`#agenda` / `admin.html`):**
   - Filtro por sucursal (**Todas / City Bell / Villa Elisa**), fecha y profesional.
   - Alta manual de turnos (WhatsApp / clientes espontáneos) y bloqueo de horarios con detección de conflictos.
   - Gestión de horarios por barbero y sede, alta/baja de profesionales y edición de servicios y precios en vivo.

---

## 🚀 Cómo probarlo localmente

Ejecutá el servidor integrado de Python desde la raíz del proyecto:

```bash
python3 -m http.server 8000
```

Luego abrí en tu navegador:
- **Web y Turnos Online:** [http://localhost:8000](http://localhost:8000)
- **Panel de Administración (Staff):** [http://localhost:8000/admin.html](http://localhost:8000/admin.html) *(Credenciales demo: `lodeale@barberia.com` / `1265`)*
