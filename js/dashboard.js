/**
 * DashboardManager Component
 * 
 * Manages the visualization of invoice data using Chart.js v4.
 * Handles data aggregation and chart rendering in the dashboard modal.
 */
class DashboardManager {
    constructor() {
        this.modal = document.getElementById('dashboardModal');
        this.btnOpen = document.getElementById('btnShowDashboard');
        this.btnClose = document.getElementById('btnCloseDashboard');
        
        this.charts = {
            monthly: null,
            providers: null,
            types: null
        };
        this.allData = [];
        this.selectedMonths = new Set();
        this.selectedTrims = new Set();
        this.colors = ['#185FA5', '#0F6E56', '#854F0B', '#888780', '#D4537E'];
    }

    initialize() {
        if (!this.modal || !this.btnOpen || !this.btnClose) {
            console.error('DashboardManager: Required DOM elements not found');
            return;
        }

        this.setupEventListeners();
        window.addEventListener('app:themechange', () => {
            if (this.modal.style.display === 'flex' && this.allData.length > 0) {
                this.applyFilter();
            }
        });
        console.log('DashboardManager initialized');
    }

    setupEventListeners() {
        this.btnOpen.addEventListener('click', () => this.openDashboard());
        this.btnClose.addEventListener('click', () => this.closeDashboard());
        
        document.getElementById('btnExportCSV').addEventListener('click', () => {
            const data = typeof window.getInvoiceData === 'function' ? window.getInvoiceData() : [];
            this.exportToCSV(data);
        });

        // Multi-select events
        const trigger = document.getElementById('dashMstrimTrigger');
        const dropdown = document.getElementById('dashMstrimDropdown');
        const clear = document.getElementById('dashMstrimClear');

        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('open');
            });
        }

        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('dashMstrimWrap');
            if (wrap && !wrap.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        document.querySelectorAll('.dash-mstrim-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const type = chip.dataset.type;
                const val = chip.dataset.val;
                const set = type === 'month' ? this.selectedMonths : this.selectedTrims;
                const otherSet = type === 'month' ? this.selectedTrims : this.selectedMonths;

                // Clear other type when switching
                if (otherSet.size > 0) {
                    otherSet.clear();
                    document.querySelectorAll(`.dash-mstrim-chip[data-type="${type === 'month' ? 'trim' : 'month'}"]`)
                        .forEach(c => c.classList.remove('selected'));
                }

                if (set.has(val)) {
                    set.delete(val);
                    chip.classList.remove('selected');
                } else {
                    set.add(val);
                    chip.classList.add('selected');
                }
                this.updateFilterLabel();
                this.applyFilter();
            });
        });

        if (clear) {
            clear.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearFilter();
                this.applyFilter();
            });
        }

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeDashboard();
        });
    }

    openDashboard() {
        const data = typeof window.getInvoiceData === 'function' ? window.getInvoiceData() : [];
        
        if (!data || data.length === 0) {
            alert('No hay datos disponibles. Asegúrese de haber seleccionado una sociedad y que se vean facturas en la tabla.');
            return;
        }

        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Reset filter to "all" when opening
        this.clearFilter();
        
        // Small delay to ensure the DOM elements are visible and have dimensions
        setTimeout(() => {
            this.renderDashboard(data);
        }, 100);
    }

    clearFilter() {
        this.selectedMonths.clear();
        this.selectedTrims.clear();
        document.querySelectorAll('.dash-mstrim-chip').forEach(c => c.classList.remove('selected'));
        this.updateFilterLabel();
        const dropdown = document.getElementById('dashMstrimDropdown');
        if (dropdown) dropdown.classList.remove('open');
    }

    updateFilterLabel() {
        const total = this.selectedMonths.size + this.selectedTrims.size;
        const label = document.getElementById('dashMstrimLabel');
        if (!label) return;

        if (total === 0) {
            label.textContent = "Todo el año";
        } else {
            const parts = [];
            Array.from(this.selectedTrims).sort().forEach(t => parts.push(t));
            const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            Array.from(this.selectedMonths).map(m => parseInt(m)).sort((a,b) => a-b).forEach(m => {
                parts.push(monthNames[m-1]);
            });
            label.textContent = parts.join(", ");
        }
    }

    closeDashboard() {
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Destroy charts to free memory and prevent overlap
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                this.charts[key] = null;
            }
        });
    }

    renderDashboard(data) {
        this.allData = data;
        this.applyFilter();
    }

    applyFilter() {
        let filteredData = this.allData;
        this.syncChartTheme();

        if (this.selectedMonths.size > 0) {
            filteredData = this.allData.filter(inv => this.selectedMonths.has(String(inv.month)));
        } else if (this.selectedTrims.size > 0) {
            filteredData = this.allData.filter(inv => this.selectedTrims.has(inv.trim));
        }

        // Destroy existing charts before re-rendering
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                this.charts[key] = null;
            }
        });

        this.updateMetrics(filteredData);
        this.renderTypesChart(filteredData);
        this.renderProvidersChart(filteredData);
        this.renderMonthlyChart(this.allData); 
    }

    getThemePalette() {
        const isDark = document.documentElement.dataset.theme === 'dark';
        return {
            isDark,
            tickColor: isDark ? 'rgba(248,250,252,0.72)' : 'rgba(15,23,42,0.62)',
            gridColor: isDark ? 'rgba(226,232,240,0.12)' : 'rgba(15,23,42,0.08)',
            tooltipBg: isDark ? '#0f172a' : '#ffffff',
            tooltipText: isDark ? '#f8fafc' : '#0f172a'
        };
    }

    syncChartTheme() {
        if (!window.Chart) return;
        const theme = this.getThemePalette();
        Chart.defaults.color = theme.tickColor;
        Chart.defaults.plugins.tooltip.backgroundColor = theme.tooltipBg;
        Chart.defaults.plugins.tooltip.titleColor = theme.tooltipText;
        Chart.defaults.plugins.tooltip.bodyColor = theme.tooltipText;
    }

    updateMetrics(data) {
        const total = data.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const base = data.reduce((sum, inv) => sum + (inv.base || 0), 0);
        const iva = data.reduce((sum, inv) => sum + (inv.iva || 0), 0);
        const docs = data.length;
        const provs = new Set(data.map(inv => inv.proveedor)).size;
        
        // Calculate average per month (using full data for average context or filtered data?)
        // If filtered by month, average is just the total. 
        // Let's use the full data months to calculate a representative average if possible.
        const months = new Set();
        const dataForAvg = this.allData;
        dataForAvg.forEach(inv => {
            const dateStr = inv.fechaISO || inv.fprovISO;
            if (dateStr) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }
            }
        });
        const monthCount = Math.max(1, months.size);
        const avg = (this.allData.reduce((sum, inv) => sum + (inv.total || 0), 0)) / monthCount;

        // Update UI
        document.getElementById('stat-total').textContent = `€${total.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById('stat-base').textContent = `€${base.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById('stat-iva').textContent = `€${iva.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById('stat-docs').textContent = docs;
        document.getElementById('stat-provs').textContent = provs;
        document.getElementById('stat-avg').textContent = `€${avg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        
        // Update exercise year label (using max year in data)
        const years = Array.from(months).map(m => m.substring(0, 4));
        if (years.length > 0) {
            const maxYear = Math.max(...years);
            document.getElementById('dash-exercise').textContent = `Ejercicio ${maxYear}`;
            document.getElementById('label-curr-year').textContent = maxYear;
            document.getElementById('label-prev-year').textContent = maxYear - 1;
        }
    }

    renderTypesChart(data) {
        const typeData = {};
        data.forEach(inv => {
            const type = inv.tipo || 'Otros';
            typeData[type] = (typeData[type] || 0) + 1;
        });

        const labels = Object.keys(typeData);
        const values = Object.values(typeData);
        const total = values.reduce((a, b) => a + b, 0);
        
        // Sort by value descending
        const combined = labels.map((l, i) => ({ label: l, value: values[i] }))
            .sort((a, b) => b.value - a.value);

        // Update Legend
        const legend = document.getElementById('types-legend');
        legend.innerHTML = '';
        combined.forEach((item, i) => {
            const percent = Math.round((item.value / total) * 100);
            const color = this.colors[i % this.colors.length];
            legend.innerHTML += `
                <span class="legend-item">
                    <span class="legend-dot" style="background:${color};"></span>
                    ${item.label} ${percent}%
                </span>`;
        });

        const ctx = document.getElementById('chartTypes').getContext('2d');
        const theme = this.getThemePalette();
        this.charts.types = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: combined.map(c => c.label),
                datasets: [{
                    data: combined.map(c => c.value),
                    backgroundColor: this.colors.slice(0, combined.length),
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        titleColor: theme.tooltipText,
                        bodyColor: theme.tooltipText,
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                const p = Math.round((val / total) * 100);
                                return ` ${ctx.label}: ${p}% (${val} docs)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderProvidersChart(data) {
        const providerData = {};
        data.forEach(inv => {
            const prov = inv.proveedor || 'Desconocido';
            providerData[prov] = (providerData[prov] || 0) + (inv.total || 0);
        });

        const sorted = Object.keys(providerData)
            .map(p => ({ label: p, value: providerData[p] }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const ctx = document.getElementById('chartProviders').getContext('2d');
        const theme = this.getThemePalette();

        this.charts.providers = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(s => s.label),
                datasets: [{
                    label: 'Importe (€)',
                    data: sorted.map(s => s.value),
                    backgroundColor: this.colors.slice(0, sorted.length),
                    borderWidth: 0,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        titleColor: theme.tooltipText,
                        bodyColor: theme.tooltipText,
                        callbacks: {
                            label: (ctx) => ` €${ctx.parsed.x.toLocaleString('es-ES')}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: theme.gridColor },
                        ticks: {
                            color: theme.tickColor,
                            font: { size: 11 },
                            callback: v => '€' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
                        },
                        border: { display: false }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: theme.tickColor, font: { size: 11 } },
                        border: { display: false }
                    }
                }
            }
        });
    }

    renderMonthlyChart(data) {
        const monthlyData = {};
        const dailyData = {};
        
        data.forEach(inv => {
            const dateStr = inv.fechaISO || inv.fprovISO;
            if (!dateStr) return;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return;
            
            const year = d.getFullYear().toString();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            
            if (!monthlyData[year]) monthlyData[year] = Array(12).fill(0);
            monthlyData[year][month - 1] += (inv.total || 0);

            if (!dailyData[year]) dailyData[year] = {};
            if (!dailyData[year][month]) dailyData[year][month] = Array(32).fill(0);
            dailyData[year][month][day] = (dailyData[year][month][day] || 0) + (inv.total || 0);
        });

        const years = Object.keys(monthlyData).sort();
        if (years.length === 0) return;
        const maxYear = years[years.length - 1];
        const prevYear = (parseInt(maxYear) - 1).toString();

        let labels = [];
        let datasets = [];
        const theme = this.getThemePalette();
        
        const titleEl = document.querySelector('#chartMonthly').closest('.card').querySelector('.card-title');
        
        if (this.selectedMonths.size === 0 && this.selectedTrims.size === 0) {
            // Full Year
            labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            if (titleEl) titleEl.textContent = 'Evolución de gasto mensual (€)';
            
            const getYearData = (yr) => monthlyData[yr] || Array(12).fill(0);
            datasets = this._createDatasets(maxYear, prevYear, getYearData(maxYear), getYearData(prevYear), theme.isDark, 3);
        } else if (this.selectedTrims.size > 0) {
            // Multiple Quarters
            const monthIdx = [];
            Array.from(this.selectedTrims).sort().forEach(tr => {
                const q = parseInt(tr[0]);
                monthIdx.push((q-1)*3, (q-1)*3+1, (q-1)*3+2);
            });
            const allLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            labels = monthIdx.map(i => allLabels[i]);
            if (titleEl) titleEl.textContent = 'Evolución de gasto - Trimestres seleccionados (€)';

            const getQuarterData = (yr) => monthIdx.map(i => (monthlyData[yr] || Array(12).fill(0))[i]);
            datasets = this._createDatasets(maxYear, prevYear, getQuarterData(maxYear), getQuarterData(prevYear), theme.isDark, 5);
        } else if (this.selectedMonths.size === 1) {
            // Single Month -> Daily
            const m = parseInt(Array.from(this.selectedMonths)[0]);
            const daysInMonth = new Date(parseInt(maxYear), m, 0).getDate();
            labels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            if (titleEl) titleEl.textContent = `Evolución de gasto - ${monthNames[m-1]} (€)`;

            const getDailyData = (yr) => {
                const arr = Array(daysInMonth).fill(0);
                if (dailyData[yr] && dailyData[yr][m]) {
                    for (let d = 1; d <= daysInMonth; d++) arr[d-1] = dailyData[yr][m][d] || 0;
                }
                return arr;
            };
            datasets = this._createDatasets(maxYear, prevYear, getDailyData(maxYear), getDailyData(prevYear), theme.isDark, 2);
        } else {
            // Multiple Months
            const sortedMonths = Array.from(this.selectedMonths).map(m => parseInt(m)).sort((a,b) => a-b);
            const allLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            labels = sortedMonths.map(m => allLabels[m-1]);
            if (titleEl) titleEl.textContent = 'Evolución de gasto - Meses seleccionados (€)';

            const getMonthsData = (yr) => sortedMonths.map(m => (monthlyData[yr] || Array(12).fill(0))[m-1]);
            datasets = this._createDatasets(maxYear, prevYear, getMonthsData(maxYear), getMonthsData(prevYear), theme.isDark, 4);
        }

        const ctx = document.getElementById('chartMonthly').getContext('2d');
        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: €${ctx.parsed.y.toLocaleString('es-ES')}` } }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: theme.tickColor, font: { size: 10 }, autoSkip: labels.length > 15, maxRotation: 0 },
                        border: { display: false }
                    },
                    y: {
                        grid: { color: theme.gridColor },
                        ticks: {
                            color: theme.tickColor, font: { size: 11 },
                            callback: v => '€' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
                        },
                        border: { display: false }
                    }
                }
            }
        });
    }

    _createDatasets(maxYear, prevYear, currData, prevData, isDark, pointRadius) {
        const ds = [{
            label: maxYear,
            data: currData,
            borderColor: '#185FA5',
            backgroundColor: isDark ? 'rgba(24,95,165,0.15)' : 'rgba(24,95,165,0.08)',
            borderWidth: 2, fill: true, tension: 0.4, pointRadius: pointRadius, pointBackgroundColor: '#185FA5'
        }];
        if (prevData.some(v => v > 0)) {
            ds.push({
                label: prevYear,
                data: prevData,
                borderColor: '#B4B2A9',
                backgroundColor: 'transparent',
                borderWidth: 1.5, borderDash: [5, 4], fill: false, tension: 0.4, pointRadius: Math.max(1, pointRadius - 1), pointBackgroundColor: '#B4B2A9'
            });
        }
        return ds;
    }

    exportToCSV(data) {
        if (!data || data.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        // Find the most recent month in the data
        const monthMap = {};
        data.forEach(inv => {
            const dateStr = inv.fechaISO || inv.fprovISO;
            if (dateStr) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    monthMap[key] = (monthMap[key] || 0) + 1;
                }
            }
        });

        const sortedMonths = Object.keys(monthMap).sort();
        if (sortedMonths.length === 0) {
            alert('No se encontraron fechas válidas para filtrar por mes.');
            return;
        }

        const latestMonthKey = sortedMonths[sortedMonths.length - 1];
        const [lYear, lMonth] = latestMonthKey.split('-');
        
        const filteredData = data.filter(inv => {
            const dateStr = inv.fechaISO || inv.fprovISO;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getFullYear() === parseInt(lYear) && (d.getMonth() + 1) === parseInt(lMonth);
        });

        const monthName = new Date(parseInt(lYear), parseInt(lMonth) - 1).toLocaleString('es-ES', { month: 'long' });
        const confirmExport = confirm(`Se van a exportar ${filteredData.length} facturas correspondientes a ${monthName} de ${lYear}.\n¿Desea continuar?`);
        
        if (!confirmExport) return;

        // Headers
        const headers = [
            'Nº Factura', 'Fecha Imputacion', 'Trimestre', 'Nº F. Prov', 
            'Fecha Prov', 'Proveedor', 'Descripcion', 'B. Imponible', 
            'IVA + RE', 'Total', 'Tipo'
        ];

        // Format each row
        const rows = filteredData.map(inv => [
            inv.num || '',
            inv.fecha || '',
            inv.trimestre || '',
            inv.numProv || '',
            inv.fprov || '',
            inv.proveedor || '',
            inv.desc || '',
            (inv.base || 0).toString().replace('.', ','),
            (inv.iva || 0).toString().replace('.', ','),
            (inv.total || 0).toString().replace('.', ','),
            inv.tipo || ''
        ]);

        // Join into CSV format using semicolon for Excel compatibility in Spanish
        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        ].join('\n');

        // Create Blob and trigger download
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `Listado_Facturas_${monthName}_${lYear}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
    window.dashboardManager.initialize();
});
