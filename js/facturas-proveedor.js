(() => {
  let DATA = [];
  let activeFilter = "all";
  let sortCol = "fecha";
  let sortDir = 1;

  let selectedMonths = new Set();
  let selectedTrims  = new Set();

  const els = {
    sociedad: document.getElementById("soc"),
    order: document.getElementById("order"),
    tbody: document.getElementById("tbody"),
    empty: document.getElementById("empty"),
    searchBar: document.getElementById("sbar"),
    toggleAdv: document.getElementById("toggle-adv"),
    search: document.getElementById("srch"),
    year: document.getElementById("fyear"),
    mstrimWrap: document.getElementById("mstrimWrap"),
    mstrimTrigger: document.getElementById("mstrimTrigger"),
    mstrimDropdown: document.getElementById("mstrimDropdown"),
    mstrimLabel: document.getElementById("mstrimLabel"),
    mstrimClear: document.getElementById("mstrimClear"),
    tipo: document.getElementById("ftipo"),
    btnLimpiar: document.getElementById("btn-limpiar"),
    btnBuscar: document.getElementById("btn-buscar"),
    pagInfo: document.getElementById("pag-info"),
    totBase: document.getElementById("tot-base"),
    totIva: document.getElementById("tot-iva"),
    totTotal: document.getElementById("tot-total"),
    totPend: document.getElementById("tot-pend"),
  };

  function fmtCurrency(n) {
    const value = Number(n || 0);
    return value
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  }

  function fmtDate(dateValue) {
    if (!dateValue) return "";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    
    return `${dd}/${mm}/${yyyy}`;
  }

  function stIcon(estado) {
    const map = {
      pagado: '<span class="st-ico ico-ok">✓</span>',
      validado: '<span class="st-ico ico-val">V</span>',
      duplicada: '<span class="st-ico ico-warn">!</span>',
      inmovilizado: '<span class="st-ico ico-val">I</span>',
      pendiente: '<span class="st-ico ico-pend"></span>',
    };
    return map[estado] || '<span class="st-ico ico-pend"></span>';
  }

  function tipoPill(estado, tipo) {
    if (estado === "duplicada") return `<span class="pill p-dup">${tipo || "—"} !</span>`;
    if (estado === "vencida") return `<span class="pill p-venc">${tipo || "—"} !</span>`;
    if (tipo === "Factura") return `<span class="pill p-rect">${tipo}</span>`;
    return `<span class="pill p-norm">${tipo || "—"}</span>`;
  }

  function setEmpty(message) {
    els.tbody.innerHTML = "";
    els.empty.style.display = "block";
    els.empty.textContent = message;
    if (els.pagInfo) els.pagInfo.textContent = "—";
    els.totBase.textContent = "—";
    els.totIva.textContent = "—";
    els.totTotal.textContent = "—";
    els.totPend.textContent = "—";
  }

  function normalizeRow(dto) {
    const fechaImputISO = dto.fechaImputacion || "";
    const fechaProvISO = dto.fechaFacturaProveedor || "";
    // Parse year/month robustly regardless of date format
    let rowYear = null;
    let rowMonth = null;
    if (fechaImputISO) {
      const d = new Date(fechaImputISO);
      if (!isNaN(d.getTime())) {
        rowYear  = d.getFullYear();
        rowMonth = d.getMonth() + 1; // 1-12
      }
    }
    return {
      id: dto.id,
      num: dto.num,
      fechaISO: fechaImputISO,
      fecha: fmtDate(fechaImputISO),
      fprovISO: fechaProvISO,
      fprov: fmtDate(fechaProvISO),
      trim: dto.trim || "",
      nprov: dto.numFacturaProveedor || "",
      proveedor: dto.proveedor || "",
      desc: dto.descripcion || "",
      base: Number(dto.baseImponible ?? 0),
      iva: Number(dto.iva ?? 0),
      total: Number(dto.total ?? 0),
      tipo: dto.tipo || "",
      estado: dto.estado || "pendiente",
      vencimientoISO: dto.fechaVencimiento || "",
      vencimiento: fmtDate(dto.fechaVencimiento),
      year:  rowYear,
      month: rowMonth,
    };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
    }
    return res.json();
  }

  async function checkNotifications() {
    try {
      const sociedadId = els.sociedad.value;
      if (!sociedadId) {
        const bar = document.getElementById("notificationsBar");
        if (bar) bar.style.display = "none";
        return;
      }
      const api = window.api || window.electronAPI;
      const exp = await api.getUpcomingExpirations(sociedadId ? parseInt(sociedadId) : null);
      
      const bar = document.getElementById("notificationsBar");
      const text = document.getElementById("notificationText");
      
      if (exp && exp.length > 0) {
        const count = exp.length;
        text.innerHTML = `Tienes <strong>${count}</strong> factura${count > 1 ? 's' : ''} que vence${count > 1 ? 'n' : 's'} en los próximos 7 días.`;
        bar.style.display = "flex";
      } else {
        bar.style.display = "none";
      }
    } catch (err) {
      console.error("Error checking notifications:", err);
    }
  }

  async function loadSociedades() {
    const api = window.api || window.electronAPI;
    const socs = await api.listSociedades();
    els.sociedad.innerHTML = '<option value="">— Seleccionar sociedad —</option>';
    socs.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nombre;
      els.sociedad.appendChild(opt);
    });
    
    document.getElementById("btnCloseNotifications").addEventListener("click", () => {
      document.getElementById("notificationsBar").style.display = "none";
    });

    checkNotifications();
  }

  async function loadFacturas() {
    const socVal = els.sociedad.value;
    const sociedadId = socVal ? parseInt(socVal) : null;
    
    if (!socVal && !sociedadId) {
      DATA = [];
      setEmpty("Selecciona una sociedad para ver sus facturas.");
      return;
    }

    els.pagInfo.textContent = "Cargando...";
    try {
      const api = window.api || window.electronAPI;
      const dtos = await api.listFacturas(sociedadId, 2000);
      DATA = Array.isArray(dtos) ? dtos.map(normalizeRow) : [];
      render();
      checkNotifications();
    } catch (err) {
      console.error("Error loading facturas:", err);
      setEmpty(`Error al cargar: ${err.message}`);
    }
  }

  function populateYearFilter(rows) {
    // year is now an input, nothing to populate
  }

  function getSortValue(r, col) {
    switch (col) {
      case "fecha":
        return r.fechaISO || "";
      case "num":
        return Number(r.num || 0);
      case "total":
        return Number(r.total || 0);
      case "proveedor":
        return (r.proveedor || "").toLowerCase();
      case "base":
        return Number(r.base || 0);
      default:
        return r[col];
    }
  }

  function updateMstrimLabel() {
    const total = selectedMonths.size + selectedTrims.size;
    if (total === 0) {
      els.mstrimLabel.textContent = "Mes / Trimestre";
      els.mstrimTrigger.classList.remove("active");
    } else {
      const parts = [];
      selectedTrims.forEach((t) => parts.push(t));
      const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      selectedMonths.forEach((m) => parts.push(monthNames[Number(m) - 1]));
      els.mstrimLabel.textContent = parts.join(", ");
      els.mstrimTrigger.classList.add("active");
    }
  }

  function filtered() {
    const q   = (els.search?.value || "").toLowerCase().trim();
    const yr  = els.year?.value ? Number(els.year.value) : null;
    const tip = (els.tipo?.value || "").trim();

    return DATA.filter((r) => {
      if (activeFilter !== "all" && r.estado !== activeFilter) return false;
      if (q) {
        const haystack = [r.proveedor, r.desc, String(r.num ?? ""), r.nprov].map((v) =>
          String(v || "").toLowerCase(),
        );
        if (!haystack.some((v) => v.includes(q))) return false;
      }
      // Year filter (compare as numbers)
      if (yr !== null && r.year !== yr) return false;
      // Month filter
      if (selectedMonths.size > 0 && !selectedMonths.has(String(r.month))) return false;
      // Quarter filter — use r.trim directly (comes from DB as "1TR", "2TR", etc.)
      if (selectedTrims.size > 0 && !selectedTrims.has(r.trim)) return false;
      if (tip && r.tipo !== tip) return false;
      return true;
    }).sort((a, b) => {
      const av = getSortValue(a, sortCol);
      const bv = getSortValue(b, sortCol);
      const v = av > bv ? 1 : av < bv ? -1 : 0;
      return v * sortDir;
    });
  }

  function render() {
    const rows = filtered();
    const total = rows.length;

    if (total === 0) {
      els.tbody.innerHTML = "";
      els.empty.style.display = "block";
      els.empty.textContent = DATA.length ? "No hay resultados para los filtros seleccionados." : "No hay facturas para esta sociedad.";
    } else {
      els.empty.style.display = "none";
      els.tbody.innerHTML = rows
        .map((r) => {
          const isExpired = r.vencimientoISO && new Date(r.vencimientoISO) < new Date() && r.estado !== 'pagado';
          const vencClass = isExpired ? 'venc-expired' : '';
          
          return `
        <tr data-id="${r.id}">
          <td><span class="lnk" data-open-invoice="${r.id}">${escapeHtml(String(r.num ?? "").replace('.', ''))}</span></td>
          <td>${escapeHtml(r.fecha)}</td>
          <td><span class="trim-badge">${escapeHtml(r.trim)}</span></td>
          <td title="${escapeHtmlAttr(r.nprov)}">${escapeHtml(r.nprov)}</td>
          <td>${escapeHtml(r.fprov)}</td>
          <td><span class="venc-date ${vencClass}">${escapeHtml(r.vencimiento)}</span></td>
          <td><span class="lnk" data-open-provider="${escapeHtmlAttr(r.proveedor)}">${escapeHtml(r.proveedor)}</span></td>
          <td title="${escapeHtmlAttr(r.desc)}">${escapeHtml(r.desc)}</td>
          <td class="r">${fmtCurrency(r.base)}</td>
          <td class="r">${fmtCurrency(r.iva)}</td>
          <td class="r">${fmtCurrency(r.total)}</td>
          <td>${tipoPill(r.estado, escapeHtml(String(r.tipo || "")))}</td>
          <td class="c">
            <button class="btn-action ${r.estado === 'pagado' ? 'btn-paid' : ''}" 
                    data-toggle-paid="${r.id}" 
                    data-current-state="${r.estado}"
                    title="${r.estado === 'pagado' ? 'Marcar como pendiente' : 'Marcar como pagada'}">
              ${r.estado === 'pagado' ? '✓' : '○'}
            </button>
          </td>
        </tr>`;
        })
        .join("");
    }

    const totBase = rows.reduce((s, r) => s + (r.base || 0), 0);
    const totIva = rows.reduce((s, r) => s + (r.iva || 0), 0);
    const totTotal = rows.reduce((s, r) => s + (r.total || 0), 0);
    const pagado = rows.filter((r) => r.estado === "pagado").reduce((s, r) => s + (r.total || 0), 0);
    const pend = totTotal - pagado;

    els.totBase.textContent = total ? fmtCurrency(totBase) : "—";
    els.totIva.textContent = total ? fmtCurrency(totIva) : "—";
    els.totTotal.textContent = total ? fmtCurrency(totTotal) : "—";
    els.totPend.textContent = total ? fmtCurrency(pend) : "—";

    if (els.pagInfo) {
      els.pagInfo.textContent = `${total} factura${total !== 1 ? "s" : ""}`;
    }

    ["num", "fecha", "proveedor", "base", "total"].forEach((c) => {
      const el = document.getElementById("sa-" + c);
      if (!el) return;
      const th = el.closest("th");
      if (c === sortCol) {
        el.textContent = sortDir === 1 ? "↑" : "↓";
        th?.classList.add("sorted");
      } else {
        el.textContent = "↕";
        th?.classList.remove("sorted");
      }
    });
  }

  function setFilter(el, f) {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
    el.classList.add("on");
    activeFilter = f;
    render();
  }

  function toggleSearch() {
    els.searchBar.classList.toggle("visible");
  }

  function toggleSort(col) {
    if (sortCol === col) sortDir *= -1;
    else {
      sortCol = col;
      sortDir = 1;
    }
    render();
  }

  function limpiarFiltros() {
    els.search.value = "";
    els.year.value = "";
    selectedMonths.clear();
    selectedTrims.clear();
    document.querySelectorAll(".mstrim-chip").forEach((c) => c.classList.remove("selected"));
    updateMstrimLabel();
    els.tipo.value = "";
    render();
  }


  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeHtmlAttr(s) {
    return escapeHtml(s).replaceAll("`", "&#096;");
  }

  function wireEvents() {
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => setFilter(chip, chip.getAttribute("data-f") || "all"));
    });

    els.toggleAdv.addEventListener("click", toggleSearch);

    els.order.addEventListener("change", () => {
      sortCol = els.order.value;
      sortDir = 1;
      render();
    });

    document.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => toggleSort(th.getAttribute("data-sort")));
    });

    els.btnLimpiar.addEventListener("click", limpiarFiltros);
    els.btnBuscar.addEventListener("click", () => loadFacturas());

    els.search.addEventListener("input", () => {
      render();
    });
    // Year: only filter when value is a complete 4-digit year
    els.year.addEventListener("input", () => {
      const v = els.year.value;
      if (v === "" || (v.length === 4 && Number(v) > 1900)) {
        render();
      }
    });
    // Also trigger on blur so pressing Tab/click-away applies the filter
    els.year.addEventListener("blur", () => {
      render();
    });
    [els.tipo].forEach((sel) =>
      sel.addEventListener("change", () => {
        render();
      }),
    );

    // Multi-select month/trim picker
    els.mstrimTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      els.mstrimDropdown.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!els.mstrimWrap.contains(e.target)) {
        els.mstrimDropdown.classList.remove("open");
      }
    });
    document.querySelectorAll(".mstrim-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const type   = chip.dataset.type;
        const val    = chip.dataset.val;
        const set    = type === "month" ? selectedMonths : selectedTrims;
        const otherSet = type === "month" ? selectedTrims : selectedMonths;
        const otherType = type === "month" ? "trim" : "month";

        // Clear the opposite group (can't mix months and quarters)
        if (otherSet.size > 0) {
          otherSet.clear();
          document.querySelectorAll(`.mstrim-chip[data-type="${otherType}"]`)
            .forEach((c) => c.classList.remove("selected"));
        }

        // Toggle this chip
        if (set.has(val)) {
          set.delete(val);
          chip.classList.remove("selected");
        } else {
          set.add(val);
          chip.classList.add("selected");
        }
        updateMstrimLabel();
        render();
      });
    });
    els.mstrimClear.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedMonths.clear();
      selectedTrims.clear();
      document.querySelectorAll(".mstrim-chip").forEach((c) => c.classList.remove("selected"));
      updateMstrimLabel();
      render();
    });


    els.sociedad.addEventListener("change", async () => {
      activeFilter = "all";
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
      document.querySelector('.chip[data-f="all"]')?.classList.add("on");
      limpiarFiltros();
      try {
        await loadFacturas();
      } catch (e) {
        setEmpty(`No se han podido cargar las facturas. ${e?.message || e}`);
      }
    });

    document.addEventListener("click", (ev) => {
      const invoiceEl = ev.target?.closest?.("[data-open-invoice]");
      if (invoiceEl) {
        const id = invoiceEl.getAttribute("data-open-invoice");
        // Hook futuro: navegar a una vista de detalle
        console.log("Abrir factura:", id);
        openInvoiceDetail(id);
        return;
      }
      const provEl = ev.target?.closest?.("[data-open-provider]");
      if (provEl) {
        const nombre = provEl.getAttribute("data-open-provider");
        console.log("Abrir proveedor:", nombre);
        return;
      }

      const togglePaidEl = ev.target?.closest?.("[data-toggle-paid]");
      if (togglePaidEl) {
        const id = togglePaidEl.getAttribute("data-toggle-paid");
        const currentState = togglePaidEl.getAttribute("data-current-state");
        handleTogglePaid(id, currentState !== "pagado");
      }
    });

    // Evento de doble click en la fila
    els.tbody.addEventListener("dblclick", (ev) => {
      const tr = ev.target.closest("tr");
      if (tr && tr.dataset.id) {
        openInvoiceDetail(tr.dataset.id);
      }
    });

    document.getElementById("btnCloseDetail").addEventListener("click", () => {
      document.getElementById("invoiceDetailModal").style.display = "none";
    });

    document.getElementById("btn-add-payment").addEventListener("click", async () => {
        const modal = document.getElementById("invoiceDetailModal");
        const invoiceId = modal.dataset.currentInvoiceId;
        if (!invoiceId) return;

        const paymentData = {
            fecha: document.getElementById("add-pay-venc").value, // From form
            importe: Math.abs(parseFloat(document.getElementById("add-pay-importe").value)),
            formaPago: document.getElementById("add-pay-forma").value,
            tesoreria: document.getElementById("add-pay-tesoreria").value,
            fechaPago: document.getElementById("add-pay-fecha").value // Actual payment date
        };

        if (!paymentData.importe) {
            alert("Por favor, introduce un importe.");
            return;
        }

        try {
            const api = window.api || window.electronAPI;
            await api.addInvoicePayment({ invoiceId: parseInt(invoiceId), paymentData });
            
            // Reset form
            document.getElementById("add-pay-importe").value = "";
            
            // Refresh details
            await openInvoiceDetail(invoiceId);
            // Also refresh main list to update pending totals
            await loadFacturas();
        } catch (err) {
            console.error("Error adding payment:", err);
            alert("Error al añadir el pago: " + err.message);
        }
    });
  }

  async function openInvoiceDetail(id) {
    try {
      const api = window.api || window.electronAPI;
      const details = await api.getInvoiceDetails(parseInt(id));
      if (!details) return;

      const { header, lines, vencimientos } = details;
      
      const modal = document.getElementById("invoiceDetailModal");
      modal.dataset.currentInvoiceId = id;
      // Store original due date to use in new payments
      modal.dataset.invoiceVencimiento = header.fechaVencimiento ? new Date(header.fechaVencimiento).toISOString().split('T')[0] : '';

      document.getElementById("det-proveedor").textContent = header.proveedor || "—";
      document.getElementById("det-num").textContent = header.numFacturaProveedor || header.num || "—";
      document.getElementById("det-fecha").textContent = fmtDate(header.fecha) || "—";
      document.getElementById("det-vencimiento").textContent = fmtDate(header.fechaVencimiento) || "—";
      document.getElementById("det-tipo").textContent = header.tipo || "—";
      
      const stEl = document.getElementById("det-estado");
      const estadoMap = {
          'pagado': 'Pagada',
          'vencida': 'Vencida',
          'pendiente': 'Pendiente'
      };
      stEl.textContent = estadoMap[header.estado] || "Pendiente";
      stEl.className = "det-val " + (header.estado ? "st-" + header.estado : "st-pendiente");
      
      const obsBox = document.getElementById("det-observaciones");
      const obsSection = document.getElementById("det-obs-section");
      if (header.observaciones || header.concepto) {
        obsBox.textContent = header.observaciones || header.concepto;
        obsSection.style.display = "block";
      } else {
        obsSection.style.display = "none";
      }

      // 1. Render Lines
      const detTbody = document.getElementById("det-tbody");
      const htmlLines = lines.map(l => `
        <tr>
          <td>${l.numOrden}</td>
          <td>${escapeHtml(l.concepto)}</td>
          <td class="r">${l.cantidad}</td>
          <td class="r">${fmtCurrency(l.precio)}</td>
          <td class="r">${l.porcIva}%</td>
          <td class="r">${fmtCurrency(l.base)}</td>
          <td class="r">${fmtCurrency(l.total)}</td>
        </tr>
      `).join("");

      const tQty = lines.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);
      const tBase = lines.reduce((acc, l) => acc + (Number(l.base) || 0), 0);
      const tTotal = lines.reduce((acc, l) => acc + (Number(l.total) || 0), 0);

      const footerHtml = `
        <tr class="detail-total-row">
          <td colspan="2" class="r"><strong>TOTAL</strong></td>
          <td class="r"><strong>${tQty}</strong></td>
          <td></td>
          <td></td>
          <td class="r"><strong>${fmtCurrency(tBase)}</strong></td>
          <td class="r"><strong>${fmtCurrency(tTotal)}</strong></td>
        </tr>
      `;
      detTbody.innerHTML = htmlLines + footerHtml;

      // 2. Render Vencimientos
      const vencTbody = document.getElementById("det-venc-tbody");
      const fpMap = { 19: 'Transferencia', 10: 'Cheque', 7: 'Contado', 14: 'Adeudo', 8: 'Pagaré', 15: 'Bankinter', 11: 'Santander', 13: 'VISA' };
      const tesMap = { 2: 'Inteco 1', 3: 'Inteco 2', 4: 'Caja', 6: 'Banco' };

      vencTbody.innerHTML = (vencimientos || []).map(v => `
        <tr>
          <td>${fmtDate(v.fecha)}</td>
          <td class="r">${fmtCurrency(v.importe)}</td>
          <td class="r">${fmtCurrency(v.importePagado)}</td>
          <td>${fmtDate(v.fechaPago)}</td>
          <td>${fpMap[v.idFormaPago] || '—'}</td>
          <td>${tesMap[v.idTesoreria] || '—'}</td>
          <td class="c">
            <button class="btn-action-small btn-del" data-delete-venc="${v.id}" title="Eliminar pago">×</button>
          </td>
        </tr>
      `).join("");

      // Wire delete buttons
      vencTbody.querySelectorAll("[data-delete-venc]").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("¿Seguro que quieres eliminar este pago?")) return;
          try {
            const vencId = btn.getAttribute("data-delete-venc");
            await api.deleteInvoicePayment(parseInt(vencId));
            await openInvoiceDetail(id);
            await loadFacturas();
          } catch (err) {
            console.error("Error deleting payment:", err);
            alert("Error al eliminar el pago: " + err.message);
          }
        });
      });

      // 3. Calculate Vencimiento Totals
      const totalPagado = (vencimientos || []).reduce((acc, v) => acc + (Number(v.importePagado) || 0), 0);
      
      // LOGIC FIX: Total Factura is always what's in the line items (tTotal)
      const totalFactura = tTotal;
      const pendiente = totalFactura - totalPagado;

      document.getElementById("det-total-pagado").textContent = fmtCurrency(totalPagado);
      document.getElementById("det-total-pendiente").textContent = fmtCurrency(pendiente);
      document.getElementById("det-total-pendiente").className = pendiente > 0.01 ? "pend" : "paid-ok";

      // Set default dates
      const defVenc = header.fechaVencimiento ? new Date(header.fechaVencimiento).toISOString().split('T')[0] : '';
      document.getElementById("add-pay-venc").value = defVenc;
      document.getElementById("add-pay-fecha").value = new Date().toISOString().split('T')[0];

      modal.style.display = "flex";
    } catch (err) {
      console.error("Error opening invoice detail:", err);
      alert("Error al cargar los detalles de la factura: " + err.message);
    }
  }

  async function handleTogglePaid(id, isPaid) {
    try {
      const api = window.api || window.electronAPI;
      await api.toggleInvoicePaid(parseInt(id), isPaid);
      // Reload invoices to show updated status
      await loadFacturas();
    } catch (err) {
      console.error("Error toggling paid status:", err);
      alert("Error al actualizar el estado de pago: " + err.message);
    }
  }

  async function init() {
    wireEvents();

    try {
      await loadSociedades();
    } catch (e) {
      // Si no existe el endpoint (p.ej. perfil h2), seguimos y mostraremos error al cargar facturas.
      console.warn(e);
    }

    try {
      if (!String(els.sociedad.value || "").trim()) {
        setEmpty("Selecciona una sociedad para ver sus facturas.");
        return;
      }
      await loadFacturas();
    } catch (e) {
      setEmpty(
        `No se han podido cargar las facturas desde la base de datos. ${
          e?.message || e
        } (¿está arrancada la app con el perfil 'sqlserver'?)`,
      );
    }
  }

  init();

  // Expose data globally for dashboard
  window.getInvoiceData = () => DATA;

  // Expose reload function so the parent window can trigger a refresh after saving
  window.reloadFacturas = async () => {
    try {
      await loadFacturas();
    } catch (e) {
      console.error('Error reloading facturas:', e);
    }
  };
})();
