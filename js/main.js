/**
 * BARBERSHOP LO DE ALE - SCRIPT PRINCIPAL DE LA LANDING
 * Navegación precisa (sin recortes), menú móvil, estado de sedes, barra CTA móvil, WhatsApp y acceso staff.
 */

// Helper global: scroll preciso a cualquier sección descontando el header sticky real
window.scrollToSection = function scrollToSection(targetOrId, options = {}) {
  const { instant = false, extraOffset = 4 } = options;
  const header = document.getElementById("main-header");
  const headerHeight = header ? Math.round(header.getBoundingClientRect().height) : 76;

  if (!targetOrId || targetOrId === "#" || targetOrId === "#top" || targetOrId === "top") {
    window.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
    return true;
  }

  let el = null;
  if (typeof targetOrId === "string") {
    let cleanId = targetOrId.replace(/^#/, "");
    // Compatibilidad si un enlace apunta a #sucursales (ahora integrado en #reservas)
    if (cleanId === "sucursales") cleanId = "reservas";
    el = document.getElementById(cleanId);
  } else if (targetOrId instanceof Element) {
    el = targetOrId;
  }

  if (!el) return false;

  const targetTop = Math.max(
    0,
    Math.round(el.getBoundingClientRect().top + window.scrollY - headerHeight - extraOffset)
  );

  window.scrollTo({
    top: targetTop,
    behavior: instant ? "auto" : "smooth"
  });

  return true;
};

// Helper global: estado en vivo de cada sede (Abierto ahora / Cerrado)
window.updateBranchOpenBadges = function updateBranchOpenBadges() {
  const ahora = new Date();
  const dia = ahora.getDay(); // 0 Dom, 1 Lun ... 6 Sáb
  const minActual = ahora.getHours() * 60 + ahora.getMinutes();

  const cbAbierto =
    (dia === 1 && minActual >= 13 * 60 && minActual < 20 * 60 + 30) ||
    (dia >= 2 && dia <= 6 && minActual >= 9 * 60 + 30 && minActual < 20 * 60 + 30);

  const veAbierto =
    dia >= 2 &&
    dia <= 6 &&
    ((minActual >= 9 * 60 + 30 && minActual < 13 * 60) ||
      (minActual >= 15 * 60 && minActual < 20 * 60));

  document.querySelectorAll('[data-open-badge="suc_city_bell"]').forEach(cbBadge => {
    cbBadge.innerHTML = cbAbierto
      ? `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 flex-shrink-0"></span><span>Abierto ahora · Hasta 20:30 hs</span>`
      : `<span class="inline-block w-2 h-2 rounded-full bg-stone-400/70 mr-1.5 flex-shrink-0"></span><span>Cerrado ahora</span>`;
  });

  document.querySelectorAll('[data-open-badge="suc_villa_elisa"]').forEach(veBadge => {
    veBadge.innerHTML = veAbierto
      ? `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 flex-shrink-0"></span><span>Abierto ahora</span>`
      : `<span class="inline-block w-2 h-2 rounded-full bg-stone-400/70 mr-1.5 flex-shrink-0"></span><span>Cerrado ahora</span>`;
  });
};

document.addEventListener("DOMContentLoaded", () => {
  // 1. Menú móvil hamburguesa
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  const closeMobileMenu = () => {
    if (!mobileMenu) return;
    mobileMenu.classList.add("hidden");
    mobileMenuBtn?.setAttribute("aria-expanded", "false");
  };

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = mobileMenu.classList.toggle("hidden");
      mobileMenuBtn.setAttribute("aria-expanded", String(!isHidden));
    });

    mobileMenu.querySelectorAll("a, button").forEach(item => {
      item.addEventListener("click", () => {
        closeMobileMenu();
      });
    });

    // Cerrar menú móvil al tocar fuera
    document.addEventListener("click", (e) => {
      if (!mobileMenu.classList.contains("hidden") && !mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        closeMobileMenu();
      }
    });
  }

  // 2. Actualizar año en el footer
  const yearEl = document.getElementById("current-year");
  if (yearEl) {
    yearEl.innerText = new Date().getFullYear();
  }

  // 3. Enlaces dinámicos de WhatsApp general
  const waLinks = document.querySelectorAll(".dynamic-wa-link");
  const waUrl = `https://wa.me/${CONFIG.barberia.telefonoWhatsApp}?text=${encodeURIComponent(
    "¡Hola Barbershop Lo de Ale! Quiero hacer una consulta sobre los turnos."
  )}`;
  waLinks.forEach(link => {
    link.href = waUrl;
    link.target = "_blank";
    link.rel = "noopener";
  });

  // 4. Navegación precisa por enlaces internos (escritorio y celular, cero recortes)
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    if (link.classList.contains("dynamic-wa-link")) return;

    const href = link.getAttribute("href");
    if (!href) return;

    const lower = href.toLowerCase();
    if (lower === "#agenda" || lower === "#admin" || lower === "#staff") return;

    // El logo del header maneja además triple toque para staff; dejamos que haga scroll suave al inicio
    e.preventDefault();
    closeMobileMenu();

    requestAnimationFrame(() => {
      const scrolled = window.scrollToSection(href);
      if (scrolled && href !== "#" && href !== "#top") {
        const cleanHash = href === "#sucursales" ? "#reservas" : href;
        try {
          history.replaceState(null, "", cleanHash);
        } catch {
          // Ignorar en entornos file:// restrictivos
        }
      }
    });
  });

  // Alinear correctamente si la página se abre o navega por hash directo (#reservas, #equipo, #salon)
  const alignInitialHash = (instant = true) => {
    const hash = window.location.hash;
    if (!hash) return;
    const lower = hash.toLowerCase();
    if (lower === "#agenda" || lower === "#admin" || lower === "#staff") return;
    window.scrollToSection(hash, { instant });
  };
  if (window.location.hash) {
    setTimeout(() => alignInitialHash(true), 120);
    window.addEventListener("load", () => setTimeout(() => alignInitialHash(true), 60), { once: true });
  }
  window.addEventListener("hashchange", () => alignInitialHash(false));

  // 5. Header con sombra cálida en scroll
  const header = document.getElementById("main-header");
  const onScroll = () => {
    if (window.scrollY > 30) {
      header?.classList.add("is-scrolled");
    } else {
      header?.classList.remove("is-scrolled");
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // 6. Estado en vivo de cada sede
  window.updateBranchOpenBadges();
  setInterval(() => window.updateBranchOpenBadges(), 60000);

  // 7. Ocultar barra fija móvil cuando la sección de reservas está en pantalla
  const mobileCtaBar = document.getElementById("mobile-cta-bar");
  const reservasSection = document.getElementById("reservas");
  if (mobileCtaBar && reservasSection && "IntersectionObserver" in window) {
    const ctaObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          mobileCtaBar.classList.toggle("is-hidden", entry.isIntersecting);
        });
      },
      { threshold: 0.12 }
    );
    ctaObserver.observe(reservasSection);
  }

  // 8. Animación sutil de entrada al hacer scroll (.reveal)
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length > 0 && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    revealEls.forEach(el => revealObserver.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("is-visible"));
  }
});
